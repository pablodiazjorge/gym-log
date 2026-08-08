import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProfileService } from '../../core/services/profile.service';
import {
  BenchmarkLift,
  ExperienceLevel,
  MovementCategory,
  Sex,
  TrainingGoal,
  UserProfile,
} from '../../core/models/profile.model';

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  private readonly profileService = inject(ProfileService);

  // ─── Form state (seeded from the stored profile) ───
  readonly name = signal('');
  readonly age = signal<number | null>(null);
  readonly sex = signal<Sex | ''>('');
  readonly heightCm = signal<number | null>(null);
  readonly bodyWeightKg = signal<number | null>(null);
  readonly goal = signal<TrainingGoal | ''>('');
  readonly experienceLevelManual = signal<ExperienceLevel>('beginner');

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

  readonly goals: { value: TrainingGoal; label: string }[] = [
    { value: 'lean_bulk', label: 'Lean bulk' },
    { value: 'bulk', label: 'Bulk' },
    { value: 'cut', label: 'Cut' },
    { value: 'recomposition', label: 'Recomposition' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'strength', label: 'Strength' },
  ];

  readonly benchmarkCategories: { value: MovementCategory; label: string; examples: string }[] = [
    { value: 'push', label: 'Push', examples: 'Bench press, overhead press' },
    { value: 'pull', label: 'Pull', examples: 'Weighted pull-up, barbell row' },
    { value: 'legs', label: 'Legs', examples: 'Back squat, deadlift' },
  ];

  /** Live computed assessment reflecting the SAVED profile */
  readonly computedResult = computed(() => {
    this.profileService.profile(); // reactive dependency
    return this.profileService.getComputedLevel();
  });

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
      this.wristCircumferenceCm.set(p.wristCircumferenceCm ?? null);
      this.ankleCircumferenceCm.set(p.ankleCircumferenceCm ?? null);
      this.benchmarkLifts.set(p.benchmarkLifts ? p.benchmarkLifts.map((l) => ({ ...l })) : []);
      this.useComputedLevel.set(p.useComputedLevel);
      this.advancedOpen.set(
        !!(p.wristCircumferenceCm || (p.benchmarkLifts && p.benchmarkLifts.length > 0)),
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

  save(): void {
    const profile: UserProfile = {
      name: this.name().trim() || undefined,
      age: this.age() ?? undefined,
      sex: this.sex() || undefined,
      heightCm: this.heightCm() ?? undefined,
      bodyWeightKg: this.bodyWeightKg() ?? undefined,
      goal: this.goal() || undefined,
      experienceLevelManual: this.experienceLevelManual(),
      wristCircumferenceCm: this.wristCircumferenceCm() ?? undefined,
      ankleCircumferenceCm: this.ankleCircumferenceCm() ?? undefined,
      benchmarkLifts: this.benchmarkLifts().filter((l) => l.weightKg > 0 && l.reps > 0),
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
}
