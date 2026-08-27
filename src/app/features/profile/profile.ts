import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProfileService } from '../../core/services/profile.service';
import { RoutineService } from '../../core/services/routine.service';
import { StorageService } from '../../core/services/storage.service';
import { estimateFrequencyForTemplates } from '../../core/services/progression.util';
import {
  BenchmarkLift,
  ExperienceLevel,
  MovementCategory,
  Sex,
  TrainingFocus,
  TrainingGoal,
  UserProfile,
} from '../../core/models/profile.model';

/** A selectable benchmark exercise (curated free-weight lift or catalog exercise) */
interface BenchmarkOption {
  key: string;
  label: string;
  category: MovementCategory;
  templateId?: string; // set for catalog exercises → auto-updates from history
}

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  private readonly profileService = inject(ProfileService);
  private readonly routineService = inject(RoutineService);
  private readonly storage = inject(StorageService);

  // ─── Form state (seeded from the stored profile) ───
  readonly name = signal('');
  readonly age = signal<number | null>(null);
  readonly sex = signal<Sex | ''>('');
  readonly heightCm = signal<number | null>(null);
  readonly bodyWeightKg = signal<number | null>(null);
  readonly goal = signal<TrainingGoal | ''>('');
  readonly experienceLevelManual = signal<ExperienceLevel>('beginner');
  readonly trainingFocus = signal<TrainingFocus>('hypertrophy');
  readonly progressionSuggestionsEnabled = signal(true);

  /** Manual weekly-frequency overrides per category (null = auto-detected) */
  readonly freqOverride = signal<Record<MovementCategory, number | null>>({
    push: null,
    pull: null,
    legs: null,
  });

  readonly advancedOpen = signal(false);
  readonly wristCircumferenceCm = signal<number | null>(null);
  readonly ankleCircumferenceCm = signal<number | null>(null);
  readonly benchmarkLifts = signal<BenchmarkLift[]>([]);
  readonly useComputedLevel = signal(false);

  readonly saved = signal(false);

  readonly levels: { value: ExperienceLevel; label: string; hint: string }[] = [
    { value: 'beginner', label: 'Beginner', hint: 'Progressing almost every session' },
    { value: 'intermediate', label: 'Intermediate', hint: 'Progressing month to month' },
    { value: 'advanced', label: 'Advanced', hint: 'Progress takes months of work' },
  ];

  readonly focuses: { value: TrainingFocus; label: string; hint: string }[] = [
    { value: 'hypertrophy', label: 'Hypertrophy', hint: 'Fill the rep range, then add weight (double progression)' },
    { value: 'strength', label: 'Strength', hint: 'Add weight sooner — at mid-range reps' },
    { value: 'maintenance', label: 'Maintenance', hint: 'Hold current loads, no automatic increases' },
  ];

  readonly frequencyCategories: MovementCategory[] = ['push', 'pull', 'legs'];

  readonly goals: { value: TrainingGoal; label: string }[] = [
    { value: 'lean_bulk', label: 'Lean bulk' },
    { value: 'bulk', label: 'Bulk' },
    { value: 'cut', label: 'Cut' },
    { value: 'recomposition', label: 'Recomposition' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'strength', label: 'Strength' },
  ];

  /** Canonical free-weight reference lifts (not in the app catalog, entered manually) */
  readonly referenceOptions: BenchmarkOption[] = [
    { key: 'ref-bench-press', label: 'Bench Press (barbell)', category: 'push' },
    { key: 'ref-overhead-press', label: 'Overhead Press (barbell)', category: 'push' },
    { key: 'ref-weighted-pull-up', label: 'Weighted Pull-Up', category: 'pull' },
    { key: 'ref-barbell-row', label: 'Barbell Row', category: 'pull' },
    { key: 'ref-back-squat', label: 'Back Squat (barbell)', category: 'legs' },
    { key: 'ref-deadlift', label: 'Deadlift (barbell)', category: 'legs' },
  ];

  /** App catalog exercises (abs excluded — no strength standards for abs) */
  readonly catalogOptions: BenchmarkOption[] = this.routineService
    .getAllExercises()
    .filter((t) => t.category !== 'abs')
    .map((t) => ({
      key: t.id,
      label: t.name,
      category: t.category as MovementCategory,
      templateId: t.id,
    }));

  private readonly allOptions = [...this.referenceOptions, ...this.catalogOptions];

  /** Live computed assessment reflecting the SAVED profile + logged history */
  readonly computedResult = computed(() => {
    this.profileService.profile(); // reactive dependency
    return this.profileService.getComputedLevel();
  });

  /** Latest session-logged bodyweight (weekly check-in) — wins over the field above */
  readonly latestLoggedWeight = computed(() => this.profileService.getLatestLoggedBodyWeight());

  /** Auto-detected weekly training frequency per category (last 3 weeks of history) */
  readonly detectedFrequency = computed<Record<MovementCategory, number>>(() => {
    const sessions = this.storage.sessions();
    const now = Date.now();
    const result = {} as Record<MovementCategory, number>;
    for (const category of this.frequencyCategories) {
      const ids = new Set(
        this.routineService
          .getAllExercises()
          .filter((t) => t.category === category)
          .map((t) => t.id),
      );
      result[category] = Math.round(estimateFrequencyForTemplates(ids, sessions, now) * 10) / 10;
    }
    return result;
  });

  adjustFrequency(category: MovementCategory, delta: number): void {
    this.freqOverride.update((prev) => {
      const current = prev[category] ?? Math.round(this.detectedFrequency()[category]);
      const next = Math.min(4, Math.max(1, current + delta));
      return { ...prev, [category]: next };
    });
  }

  clearFrequency(category: MovementCategory): void {
    this.freqOverride.update((prev) => ({ ...prev, [category]: null }));
  }

  constructor() {
    const p = this.profileService.profile();
    if (p) {
      this.name.set(p.name ?? '');
      this.age.set(p.age ?? null);
      this.sex.set(p.sex ?? '');
      this.heightCm.set(p.heightCm ?? null);
      this.bodyWeightKg.set(p.bodyWeightKg ?? null);
      this.goal.set(p.goal ?? '');
      this.experienceLevelManual.set(p.experienceLevelManual);
      this.trainingFocus.set(p.trainingFocus ?? 'hypertrophy');
      this.progressionSuggestionsEnabled.set(p.progressionSuggestionsEnabled ?? true);
      this.freqOverride.set({
        push: p.weeklyFrequencyOverride?.push ?? null,
        pull: p.weeklyFrequencyOverride?.pull ?? null,
        legs: p.weeklyFrequencyOverride?.legs ?? null,
      });
      this.wristCircumferenceCm.set(p.wristCircumferenceCm ?? null);
      this.ankleCircumferenceCm.set(p.ankleCircumferenceCm ?? null);
      this.benchmarkLifts.set(p.benchmarkLifts ? p.benchmarkLifts.map((l) => ({ ...l })) : []);
      this.useComputedLevel.set(p.useComputedLevel);
      this.advancedOpen.set(
        !!(
          p.wristCircumferenceCm ||
          (p.benchmarkLifts && p.benchmarkLifts.length > 0) ||
          p.weeklyFrequencyOverride
        ),
      );
    }
  }

  addBenchmarkLift(): void {
    this.benchmarkLifts.update((lifts) => [
      ...lifts,
      { category: 'push', exerciseName: '', weightKg: 0, reps: 5 },
    ]);
  }

  removeBenchmarkLift(index: number): void {
    this.benchmarkLifts.update((lifts) => lifts.filter((_, i) => i !== index));
  }

  updateLift(index: number, patch: Partial<BenchmarkLift>): void {
    this.benchmarkLifts.update((lifts) =>
      lifts.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );
  }

  /** The option key currently representing a saved lift */
  liftKey(lift: BenchmarkLift): string {
    if (lift.templateId) return lift.templateId;
    return this.allOptions.find((o) => !o.templateId && o.label === lift.exerciseName)?.key ?? '';
  }

  onLiftExerciseChange(index: number, key: string): void {
    const option = this.allOptions.find((o) => o.key === key);
    if (!option) return;
    this.updateLift(index, {
      exerciseName: option.label,
      category: option.category,
      templateId: option.templateId,
    });
  }

  /** Best logged set for a catalog-based lift (shown as the auto-updating value) */
  bestLogged(lift: BenchmarkLift): { weightKg: number; reps: number } | null {
    if (!lift.templateId) return null;
    return this.profileService.getBestLoggedSet(lift.templateId);
  }

  save(): void {
    const profile: UserProfile = {
      name: this.name().trim() || undefined,
      age: this.age() ?? undefined,
      sex: this.sex() || undefined,
      heightCm: this.heightCm() ?? undefined,
      bodyWeightKg: this.bodyWeightKg() ?? undefined,
      goal: this.goal() || undefined,
      experienceLevelManual: this.experienceLevelManual(),
      trainingFocus: this.trainingFocus(),
      progressionSuggestionsEnabled: this.progressionSuggestionsEnabled(),
      weeklyFrequencyOverride: this.buildFrequencyOverride(),
      wristCircumferenceCm: this.wristCircumferenceCm() ?? undefined,
      ankleCircumferenceCm: this.ankleCircumferenceCm() ?? undefined,
      // Keep catalog-based lifts even without a manual set (history feeds them);
      // manual reference lifts need an actual weight × reps entry.
      benchmarkLifts: this.benchmarkLifts().filter(
        (l) => l.templateId || (l.exerciseName && l.weightKg > 0 && l.reps > 0),
      ),
      useComputedLevel: this.useComputedLevel(),
      updatedAt: new Date().toISOString(),
    };
    this.profileService.saveProfile(profile);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }

  levelLabel(level: ExperienceLevel): string {
    return this.levels.find((l) => l.value === level)?.label ?? level;
  }

  private buildFrequencyOverride(): UserProfile['weeklyFrequencyOverride'] {
    const o = this.freqOverride();
    const entries = this.frequencyCategories.filter((c) => o[c] != null);
    if (entries.length === 0) return undefined;
    const result: NonNullable<UserProfile['weeklyFrequencyOverride']> = {};
    for (const c of entries) result[c] = o[c]!;
    return result;
  }
}
