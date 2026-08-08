import { Injectable, signal } from '@angular/core';
import {
  ComputedLevelResult,
  ExperienceLevel,
  MovementCategory,
  UserProfile,
} from '../models/profile.model';
import {
  computeCategoryLevel,
  computeFrameSize,
  estimate1Rm,
  resolveLevel,
} from './progression.util';

const PROFILE_KEY = 'gym_user_profile';

@Injectable({ providedIn: 'root' })
export class ProfileService {
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
   * Compute the advanced-mode assessment (frame size + per-category level).
   * Returns null when the profile lacks the required advanced data
   * (height, wrist circumference, bodyweight, sex or benchmark lifts).
   */
  getComputedLevel(): ComputedLevelResult | null {
    const p = this.profile();
    if (!p?.heightCm || !p.wristCircumferenceCm || !p.bodyWeightKg || !p.sex) return null;
    const lifts = p.benchmarkLifts ?? [];
    if (lifts.length === 0) return null;

    const frame = computeFrameSize(p.heightCm, p.wristCircumferenceCm, p.sex, p.ankleCircumferenceCm);

    // Best estimated 1RM per category across the user's benchmark lifts
    const bestPerCategory = new Map<MovementCategory, number>();
    for (const lift of lifts) {
      const e1rm = estimate1Rm(lift.weightKg, lift.reps);
      if (e1rm > (bestPerCategory.get(lift.category) ?? 0)) {
        bestPerCategory.set(lift.category, e1rm);
      }
    }

    const perCategory = [...bestPerCategory.entries()].map(([category, e1rm]) =>
      computeCategoryLevel(e1rm, p.bodyWeightKg!, frame.frameSize, category, p.sex!),
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
