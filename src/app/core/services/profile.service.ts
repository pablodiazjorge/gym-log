import { Injectable, inject, signal } from '@angular/core';
import {
  BenchmarkLift,
  ComputedLevelResult,
  ExperienceLevel,
  MovementCategory,
  UserProfile,
} from '../models/profile.model';
import { StorageService } from './storage.service';
import { MeasurementService, moreRecent } from './measurement.service';
import {
  computeCategoryLevel,
  computeFrameSize,
  estimate1Rm,
  resolveLevel,
} from './progression.util';

const PROFILE_KEY = 'gym_user_profile';
/** Where a malformed stored profile goes instead of being overwritten by the next save */
const PROFILE_QUARANTINE_KEY = 'gym_user_profile_quarantine';

const LEVELS: readonly ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];

/**
 * Minimum shape the app relies on. `JSON.parse` returns `any` and the
 * `UserProfile` annotation is erased at runtime, so a hand-edited, truncated or
 * imported value is otherwise trusted as-is:
 * - `resolveLevel` returns `experienceLevelManual` straight into the
 *   aggressiveness table, so an absent or unknown level throws on the workout
 *   screen;
 * - `getComputedLevel` and the profile form iterate `benchmarkLifts`, so a
 *   non-array throws and a non-numeric lift turns the estimated 1RM into NaN.
 * Every other field is optional and read with a fallback. What the app adopts
 * from storage or an import is `normalizeProfile`, which only rejects the
 * level and repairs the lifts.
 */
export function isValidProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Partial<UserProfile>;
  if (!LEVELS.includes(p.experienceLevelManual as ExperienceLevel)) return false;
  if (p.benchmarkLifts === undefined) return true;
  return Array.isArray(p.benchmarkLifts) && p.benchmarkLifts.every(isValidLift);
}

function isValidLift(lift: unknown): lift is BenchmarkLift {
  if (!lift || typeof lift !== 'object') return false;
  const l = lift as Partial<BenchmarkLift>;
  return Number.isFinite(l.weightKg) && Number.isFinite(l.reps);
}

/**
 * The profile to adopt from storage or an import: null when the experience
 * level is unusable, otherwise the profile with only its broken benchmark lifts
 * repaired or dropped. The form saves catalog lifts as they are and its number
 * inputs emit null when emptied, so a profile could be stored with
 * `weightKg: null`; rejecting all of it for that looks to the user as if the
 * profile had been deleted.
 * - A catalog lift (with `templateId`) takes its value from logged history, so
 *   unusable manual numbers become 0, which is how `estimate1Rm` already
 *   treated null.
 * - Any other broken lift is dropped.
 */
export function normalizeProfile(value: unknown): UserProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as UserProfile;
  if (!LEVELS.includes(p.experienceLevelManual)) return null;
  if (p.benchmarkLifts === undefined || isValidProfile(value)) return p;
  const lifts: unknown[] = Array.isArray(p.benchmarkLifts) ? p.benchmarkLifts : [];
  return {
    ...p,
    benchmarkLifts: lifts.flatMap((lift): BenchmarkLift[] => {
      if (isValidLift(lift)) return [lift];
      if (!lift || typeof lift !== 'object') return [];
      const l = lift as BenchmarkLift;
      if (typeof l.templateId !== 'string' || !l.templateId) return [];
      return [
        {
          ...l,
          weightKg: Number.isFinite(l.weightKg) ? l.weightKg : 0,
          reps: Number.isFinite(l.reps) ? l.reps : 0,
        },
      ];
    }),
  };
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly storage = inject(StorageService);
  private readonly measurements = inject(MeasurementService);

  /** Current user profile (null = never configured) */
  readonly profile = signal<UserProfile | null>(null);

  constructor() {
    this.loadProfile();
  }

  /**
   * Load the profile from localStorage. A malformed one is repaired by
   * `normalizeProfile` (only its broken lifts change) or, when even the level
   * is unusable, ignored, and the app behaves as if no profile was ever
   * configured. Either way the original is copied to a backup key first: the
   * next save overwrites it, so without that copy the loss would be silent and
   * permanent.
   */
  loadProfile(): void {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      const profile = normalizeProfile(parsed);
      if (!isValidProfile(parsed)) {
        console.warn(
          `${profile ? 'Repaired' : 'Ignoring'} a malformed profile — see ${PROFILE_QUARANTINE_KEY}`,
        );
        try {
          localStorage.setItem(PROFILE_QUARANTINE_KEY, raw);
        } catch {
          /* quota — the warning above is the best we can do */
        }
      }
      this.profile.set(profile);
    } catch {
      console.warn('Failed to load profile from localStorage, starting empty');
      this.profile.set(null);
    }
  }

  /** Save (replace) the profile, with its broken lifts repaired as on load */
  saveProfile(profile: UserProfile): void {
    const stamped: UserProfile = {
      ...(normalizeProfile(profile) ?? profile),
      updatedAt: new Date().toISOString(),
    };
    this.profile.set(stamped);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(stamped));
  }

  /** Merge a partial update into the existing profile (creates one if absent) */
  updateProfile(patch: Partial<UserProfile>): void {
    const current = this.profile() ?? this.emptyProfile();
    this.saveProfile({ ...current, ...patch });
  }

  /** Delete the profile entirely */
  clearProfile(): void {
    this.profile.set(null);
    localStorage.removeItem(PROFILE_KEY);
  }

  /**
   * Best logged set (by estimated 1RM) for a catalog exercise across all
   * completed sessions. This is what keeps benchmark lifts self-updating:
   * it reads live session data, so the computed level follows your training.
   */
  getBestLoggedSet(
    templateId: string,
  ): { weightKg: number; reps: number; e1Rm: number } | null {
    let best: { weightKg: number; reps: number; e1Rm: number } | null = null;
    for (const session of this.storage.sessions()) {
      if (!session.completed) continue;
      const exercise = session.exercises.find((e) => e.templateId === templateId);
      if (!exercise) continue;
      for (const set of exercise.sets) {
        if (set.isWarmup || !set.completed || set.skipped) continue;
        const e1Rm = estimate1Rm(set.weightKg, set.reps);
        if (e1Rm > (best?.e1Rm ?? 0)) {
          best = { weightKg: set.weightKg, reps: set.reps, e1Rm };
        }
      }
    }
    return best;
  }

  /**
   * Most recent bodyweight from either source: a completed session, or a body
   * check-in logged outside one. The check-in screen exists precisely so a
   * weigh-in does not require a training day, so sessions can no longer be
   * assumed to be the fresher of the two — whichever is more recent wins.
   */
  getLatestLoggedBodyWeight(): { weightKg: number; date: string } | null {
    const withWeight = this.storage
      .sessions()
      .filter((s) => s.completed && s.bodyWeightKg != null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = withWeight[0];
    const fromSession = latest ? { weightKg: latest.bodyWeightKg!, date: latest.date } : null;

    const checkIn = this.measurements.latestWeight();
    const fromCheckIn = checkIn ? { weightKg: checkIn.value, date: checkIn.date } : null;

    return moreRecent(fromSession, fromCheckIn);
  }

  /**
   * The bodyweight used for all calculations: the latest session-logged value
   * wins over the (potentially stale) profile field.
   */
  getEffectiveBodyWeightKg(): number | null {
    return this.getLatestLoggedBodyWeight()?.weightKg ?? this.profile()?.bodyWeightKg ?? null;
  }

  /**
   * Compute the advanced-mode assessment (frame size + per-category level).
   * Benchmark lifts referencing a catalog exercise (templateId) use the best
   * logged set from history — whichever is stronger between the manual entry
   * and the logged history wins. Bodyweight comes from the latest logged
   * session when available. Returns null when the profile lacks the required
   * advanced data.
   */
  getComputedLevel(): ComputedLevelResult | null {
    const p = this.profile();
    const bodyWeightKg = this.getEffectiveBodyWeightKg();
    if (!p?.heightCm || !p.wristCircumferenceCm || !bodyWeightKg || !p.sex) return null;
    const lifts = p.benchmarkLifts ?? [];
    if (lifts.length === 0) return null;

    const frame = computeFrameSize(p.heightCm, p.wristCircumferenceCm, p.sex, p.ankleCircumferenceCm);

    // Best estimated 1RM per category across the user's benchmark lifts
    const bestPerCategory = new Map<MovementCategory, number>();
    for (const lift of lifts) {
      let e1rm = estimate1Rm(lift.weightKg, lift.reps);
      if (lift.templateId) {
        const logged = this.getBestLoggedSet(lift.templateId);
        if (logged && logged.e1Rm > e1rm) e1rm = logged.e1Rm;
      }
      if (e1rm <= 0) continue;
      if (e1rm > (bestPerCategory.get(lift.category) ?? 0)) {
        bestPerCategory.set(lift.category, e1rm);
      }
    }

    if (bestPerCategory.size === 0) return null;

    const perCategory = [...bestPerCategory.entries()].map(([category, e1rm]) =>
      computeCategoryLevel(e1rm, bodyWeightKg, frame.frameSize, category, p.sex!),
    );

    return { frame, perCategory };
  }

  /**
   * The effective experience level for a movement category: manual choice
   * unless the user opted into the computed level and data exists for it.
   * The 'abs' catalog category maps to 'push' standards (closest proxy).
   */
  getResolvedLevel(category: 'push' | 'pull' | 'legs' | 'abs'): ExperienceLevel {
    const mapped: MovementCategory = category === 'abs' ? 'push' : category;
    return resolveLevel(this.profile(), this.getComputedLevel(), mapped);
  }

  private emptyProfile(): UserProfile {
    return {
      experienceLevelManual: 'beginner',
      useComputedLevel: false,
      updatedAt: new Date().toISOString(),
    };
  }
}
