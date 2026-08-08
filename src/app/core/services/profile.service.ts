import { Injectable, inject, signal } from '@angular/core';
import {
  ComputedLevelResult,
  ExperienceLevel,
  MovementCategory,
  UserProfile,
} from '../models/profile.model';
import { StorageService } from './storage.service';
import {
  computeCategoryLevel,
  computeFrameSize,
  estimate1Rm,
  resolveLevel,
} from './progression.util';

const PROFILE_KEY = 'gym_user_profile';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly storage = inject(StorageService);

  /** Current user profile (null = never configured) */
  readonly profile = signal<UserProfile | null>(null);

  constructor() {
    this.loadProfile();
  }

  /** Load the profile from localStorage */
  loadProfile(): void {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) {
        this.profile.set(JSON.parse(raw) as UserProfile);
      }
    } catch {
      console.warn('Failed to load profile from localStorage, starting empty');
      this.profile.set(null);
    }
  }

  /** Save (replace) the profile */
  saveProfile(profile: UserProfile): void {
    const stamped: UserProfile = { ...profile, updatedAt: new Date().toISOString() };
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
   * Most recent bodyweight logged on a completed session (weekly check-in).
   */
  getLatestLoggedBodyWeight(): { weightKg: number; date: string } | null {
    const withWeight = this.storage
      .sessions()
      .filter((s) => s.completed && s.bodyWeightKg != null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = withWeight[0];
    return latest ? { weightKg: latest.bodyWeightKg!, date: latest.date } : null;
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
