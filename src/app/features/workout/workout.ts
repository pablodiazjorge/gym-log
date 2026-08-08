import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RoutineService } from '../../core/services/routine.service';
import { RoutineLibraryService } from '../../core/services/routine-library.service';
import { StorageService } from '../../core/services/storage.service';
import { ExportService } from '../../core/services/export.service';
import { ProgressionService } from '../../core/services/progression.service';
import { WorkoutSession, WorkoutExercise, WorkoutSet, ExerciseTemplate } from '../../core/models/workout.model';
import { SetInput } from './set-input';

import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

type DayType = 'push' | 'pull' | 'legs' | 'abs';

/** Where this workout was started from */
type WorkoutSource =
  | { kind: 'day'; dayType: DayType; variant: 'A' | 'B' }
  | { kind: 'routine'; routineId: string };

@Component({
  selector: 'app-workout',
  imports: [SetInput, NgClass, FormsModule],
  templateUrl: './workout.html',
  styleUrl: './workout.css',
})
export class Workout {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routineService = inject(RoutineService);
  private readonly routineLibrary = inject(RoutineLibraryService);
  private readonly storage = inject(StorageService);
  private readonly exportService = inject(ExportService);
  private readonly progression = inject(ProgressionService);

  readonly source = signal<WorkoutSource>({ kind: 'day', dayType: 'push', variant: 'A' });
  readonly routineName = signal<string>('');
  readonly currentExerciseIndex = signal(0);
  readonly session = signal<WorkoutSession | null>(null);
  readonly isSummary = signal(false);
  readonly startTime = signal(Date.now());

  /** Day type driving labels/colors; 'routine' for custom-routine workouts */
  readonly dayType = computed<DayType | 'routine'>(() => {
    const src = this.source();
    return src.kind === 'day' ? src.dayType : 'routine';
  });

  readonly dayLabel = computed(() => {
    const dt = this.dayType();
    if (dt === 'routine') return this.routineName() || 'Routine';
    return dt.charAt(0).toUpperCase() + dt.slice(1);
  });

  // ─── Selection phase (day-based workouts only) ───
  readonly choiceGroups = signal<{ groupId: string; label: string; options: ExerciseTemplate[] }[]>([]);
  readonly selectedChoices = signal<Record<string, string>>({}); // groupId → templateId
  readonly isSelecting = computed(() => this.choiceGroups().length > 0 && !this.session());

  readonly exercises = computed(() => this.session()?.exercises ?? []);
  readonly currentExercise = computed(() => this.exercises()[this.currentExerciseIndex()] ?? null);
  readonly exerciseCount = computed(() => this.exercises().length);
  readonly isLastExercise = computed(() => this.currentExerciseIndex() >= this.exerciseCount() - 1);
  readonly allCompleted = computed(() => this.exercises().every((ex) => ex.sets.every((s) => s.completed)));
  readonly hasWarmupSets = computed(() => this.currentExercise()?.sets.some((s) => s.isWarmup) ?? false);
  readonly durationMinutes = computed(() => Math.round((Date.now() - this.startTime()) / 60000));
  readonly completedCount = computed(() => this.currentExercise()?.sets.filter((s) => s.completed).length ?? 0);
  readonly totalSetCount = computed(() => this.currentExercise()?.sets.length ?? 0);
  readonly currentExerciseDone = computed(() => {
    const ex = this.currentExercise();
    return ex ? ex.sets.every((s) => s.completed) : false;
  });

  /** Tailwind border class for the hero card */
  get accentBorderClass(): string {
    switch (this.dayType()) {
      case 'push': return 'border-blue-500/30';
      case 'pull': return 'border-emerald-500/30';
      case 'legs': return 'border-amber-500/30';
      case 'abs': return 'border-pink-500/30';
      case 'routine': return 'border-violet-500/30';
      default: return 'border-zinc-700';
    }
  }

  get accentBgClass(): string {
    switch (this.dayType()) {
      case 'push': return 'from-blue-500/5 to-transparent';
      case 'pull': return 'from-emerald-500/5 to-transparent';
      case 'legs': return 'from-amber-500/5 to-transparent';
      case 'abs': return 'from-pink-500/5 to-transparent';
      case 'routine': return 'from-violet-500/5 to-transparent';
      default: return 'from-zinc-800 to-transparent';
    }
  }

  get accentTextClass(): string {
    switch (this.dayType()) {
      case 'push': return 'text-blue-400';
      case 'pull': return 'text-emerald-400';
      case 'legs': return 'text-amber-400';
      case 'abs': return 'text-pink-400';
      case 'routine': return 'text-violet-400';
      default: return 'text-zinc-400';
    }
  }

  get accentDotClass(): string {
    switch (this.dayType()) {
      case 'push': return 'bg-blue-500';
      case 'pull': return 'bg-emerald-500';
      case 'legs': return 'bg-amber-500';
      case 'abs': return 'bg-pink-500';
      case 'routine': return 'bg-violet-500';
      default: return 'bg-zinc-500';
    }
  }

  constructor() {
    this.route.params.subscribe((params) => {
      const resume = this.route.snapshot.queryParams['resume'] === 'true';
      this.session.set(null);
      this.isSummary.set(false);
      this.selectedChoices.set({});
      this.choiceGroups.set([]);

      if (params['routineId']) {
        this.source.set({ kind: 'routine', routineId: params['routineId'] as string });
      } else {
        this.source.set({
          kind: 'day',
          dayType: params['dayType'] as DayType,
          variant: 'A',
        });
      }

      if (resume) {
        this.loadExistingSession();
      } else {
        this.initWorkflow();
      }
    });
  }

  /**
   * Start the flow. Day-based: show the choice selector when there are
   * alternatives to pick. Routine-based: choices were already resolved at
   * authoring time, create the session directly.
   */
  private initWorkflow(): void {
    const src = this.source();
    if (src.kind === 'routine') {
      this.createSessionFromRoutine(src.routineId);
      return;
    }
    const choices = this.routineService.getChoicesForDay(src.dayType, src.variant);
    if (choices.length > 0) {
      this.choiceGroups.set(choices);
      const init: Record<string, string> = {};
      for (const c of choices) init[c.groupId] = '';
      this.selectedChoices.set(init);
    } else {
      const templates = this.routineService.getExercisesForDay(src.dayType, src.variant);
      this.createNewSessionFromPlan(templates);
    }
  }

  /** The user picks an exercise inside a choice group */
  selectExercise(groupId: string, templateId: string): void {
    this.selectedChoices.update((prev) => ({ ...prev, [groupId]: templateId }));
  }

  /** Confirm the selections and create the session */
  confirmSelection(): void {
    const src = this.source();
    if (src.kind !== 'day') return;
    const selected = this.selectedChoices();
    const selectedIds = new Set(Object.values(selected).filter(Boolean));

    const allTemplates = this.routineService.getExercisesForDay(src.dayType, src.variant);
    // Keep exercises without a choiceGroup, plus the chosen alternatives
    const filtered = allTemplates.filter((t) => !t.choiceGroup || selectedIds.has(t.id));

    this.createNewSessionFromPlan(filtered);
  }

  /** Is at least one exercise selected? */
  readonly hasAnySelection = computed(() => {
    const sel = this.selectedChoices();
    return Object.values(sel).some((id) => id !== '');
  });

  /** Resolve a custom routine into effective templates and create the session */
  private createSessionFromRoutine(routineId: string): void {
    const routine =
      this.routineLibrary.getRoutineById(routineId) ??
      this.routineService.getBuiltInRoutines().find((r) => r.id === routineId);
    if (!routine) {
      this.router.navigate(['/routines']);
      return;
    }
    this.routineName.set(routine.name);

    // Merge each config with its catalog template: the routine's own
    // sets/reps/RIR/rest override the template defaults.
    const templates: ExerciseTemplate[] = [];
    const restByTemplateId = new Map<string, number | undefined>();
    for (const config of [...routine.exercises].sort((a, b) => a.order - b.order)) {
      const catalog = this.routineService.getTemplateById(config.templateId);
      if (!catalog) continue; // template removed from catalog — skip gracefully
      templates.push({
        ...catalog,
        targetSets: config.targetSets,
        targetRepsMin: config.targetRepsMin,
        targetRepsMax: config.targetRepsMax,
        hasWarmupSets: config.hasWarmupSets,
        warmupSets: config.warmupSets,
        targetRirMin: config.targetRirMin ?? catalog.targetRirMin,
        targetRirMax: config.targetRirMax ?? catalog.targetRirMax,
      });
      restByTemplateId.set(config.templateId, config.restSeconds);
    }
    this.createNewSessionFromPlan(templates, { routineId: routine.id, restByTemplateId });
  }

  /**
   * Build the session from effective templates. Set values are pre-filled from
   * the progression engine's suggestions (advisory only — everything stays
   * editable in the set-input UI, exactly like the old copy-last-session flow).
   */
  private createNewSessionFromPlan(
    templates: ExerciseTemplate[],
    routineContext?: { routineId: string; restByTemplateId: Map<string, number | undefined> },
  ): void {
    const src = this.source();
    const suggestions = this.progression.getSuggestionsForTemplates(templates);

    const exercises: WorkoutExercise[] = templates.map((template) => {
      const suggestion = suggestions.get(template.id);
      const targets = suggestion?.setTargets ?? [];
      const warmupCount = template.hasWarmupSets ? (template.warmupSets ?? 0) : 0;
      const totalSets = Math.max(template.targetSets + warmupCount, targets.length);
      const defaultRir = template.targetRirMin ?? 2;
      const lastWorkTarget = [...targets].reverse().find((t) => !t.isWarmup);

      const sets: WorkoutSet[] = [];
      for (let i = 0; i < totalSets; i++) {
        const target = targets[i];
        sets.push({
          setNumber: i + 1,
          isWarmup: target?.isWarmup ?? i < warmupCount,
          weightKg: target?.weightKg ?? lastWorkTarget?.weightKg ?? 0,
          reps: target?.reps ?? template.targetRepsMin,
          partialReps: 0,
          rir: target?.rir ?? defaultRir,
          completed: false,
          skipped: false,
          notes: '',
        });
      }

      const restSeconds =
        routineContext?.restByTemplateId.get(template.id) ?? suggestion?.restSeconds;

      return { templateId: template.id, exerciseName: template.name, restSeconds, sets };
    });

    const dayType = src.kind === 'day' ? src.dayType : 'routine';
    const s: WorkoutSession = {
      id: `ws-${new Date().toISOString().slice(0, 10)}-${dayType}-${String(Date.now()).slice(-4)}`,
      date: new Date().toISOString(),
      dayType,
      dayVariant: src.kind === 'day' ? src.variant : 'A',
      exercises,
      routineId: routineContext?.routineId,
      completed: false,
    };
    this.session.set(s);
    this.storage.saveCurrentSession(s);
    this.startTime.set(Date.now());
  }

  private loadExistingSession(): void {
    const existing = this.storage.currentSession();
    if (existing) {
      this.session.set(existing);
      if (existing.dayType === 'routine' && existing.routineId) {
        const routine =
          this.routineLibrary.getRoutineById(existing.routineId) ??
          this.routineService.getBuiltInRoutines().find((r) => r.id === existing.routineId);
        this.routineName.set(routine?.name ?? 'Routine');
      }
      const idx = existing.exercises.findIndex((ex) => ex.sets.some((s) => !s.completed));
      this.currentExerciseIndex.set(idx >= 0 ? idx : 0);
      if (this.allCompleted()) this.isSummary.set(true);
    } else {
      this.router.navigate(['/']);
    }
  }

  goToPrevious(): void { if (this.currentExerciseIndex() > 0) this.currentExerciseIndex.update((i) => i - 1); }
  goToNext(): void { if (this.currentExerciseIndex() < this.exerciseCount() - 1) this.currentExerciseIndex.update((i) => i + 1); }

  goToSummary(): void { this.isSummary.set(true); }

  onSetCompleted(updatedSet: WorkoutSet): void {
    const s = this.session();
    if (!s) return;

    const exercise = this.exercises()[this.currentExerciseIndex()];
    const idx = exercise.sets.findIndex((st) => st.setNumber === updatedSet.setNumber);
    if (idx >= 0) exercise.sets[idx] = updatedSet;
    this.session.update((prev) => ({ ...prev!, exercises: [...prev!.exercises] }));
    this.storage.saveCurrentSession(s);
    const allDone = exercise.sets.every((st) => st.completed);
    if (allDone && !this.isLastExercise()) setTimeout(() => this.goToNext(), 500);
    if (this.allCompleted()) this.isSummary.set(true);
  }

  /** Adjust the current exercise's rest time (one value for all its sets) */
  adjustRestSeconds(delta: number): void {
    const ex = this.currentExercise();
    if (!ex) return;
    ex.restSeconds = Math.max(0, (ex.restSeconds ?? 0) + delta);
    this.persistCurrent();
  }

  setRestSeconds(value: number): void {
    const ex = this.currentExercise();
    if (!ex) return;
    ex.restSeconds = Math.max(0, value);
    this.persistCurrent();
  }

  private persistCurrent(): void {
    const s = this.session();
    if (!s) return;
    this.session.update((prev) => ({ ...prev!, exercises: [...prev!.exercises] }));
    this.storage.saveCurrentSession(s);
  }

  finishWorkout(): void {
    const s = this.session();
    if (!s) return;
    s.completed = true;
    s.durationMinutes = this.durationMinutes();
    this.storage.saveSession(s);
    this.storage.clearCurrentSession();
    this.router.navigate(['/']);
  }

  discardWorkout(): void {
    if (confirm('Discard this workout?')) { this.storage.clearCurrentSession(); this.router.navigate(['/']); }
  }

  goHome(): void { this.router.navigate(['/']); }

  exportCurrentSession(): void {
    const s = this.session();
    if (s) this.exportService.exportSession(s);
  }

  getMaxWeight(ex: WorkoutExercise): number {
    const ws = ex.sets.filter((st) => !st.isWarmup && st.completed);
    return ws.length > 0 ? Math.max(...ws.map((st) => st.weightKg)) : 0;
  }
  getWorkCount(ex: WorkoutExercise): number { return ex.sets.filter((s) => !s.isWarmup).length; }
  getWarmupCount(ex: WorkoutExercise): number { return ex.sets.filter((s) => s.isWarmup).length; }
}
