import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RoutineService } from '../../core/services/routine.service';
import { RoutineLibraryService } from '../../core/services/routine-library.service';
import { StorageService } from '../../core/services/storage.service';
import { ExportService } from '../../core/services/export.service';
import { ProgressionService } from '../../core/services/progression.service';
import { ProfileService } from '../../core/services/profile.service';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { WorkoutSession, WorkoutExercise, WorkoutSet, ExerciseTemplate } from '../../core/models/workout.model';
import { buildSetsForExercise } from '../../core/services/progression.util';
import { elapsedMinutes, minutesSince } from '../../shared/elapsed-minutes';
import { SetInput } from './set-input';

import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

type DayType = 'push' | 'pull' | 'legs' | 'abs';

/** Where this workout was started from */
type WorkoutSource =
  | { kind: 'day'; dayType: DayType }
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
  private readonly profileService = inject(ProfileService);
  private readonly exerciseLibrary = inject(ExerciseLibraryService);

  readonly source = signal<WorkoutSource>({ kind: 'day', dayType: 'push' });
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
  readonly durationMinutes = elapsedMinutes(this.startTime);
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
        this.source.set({ kind: 'day', dayType: params['dayType'] as DayType });
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
    if (!this.guardUnfinishedSession()) return;
    const src = this.source();
    if (src.kind === 'routine') {
      this.createSessionFromRoutine(src.routineId);
      return;
    }
    // Enabled-aware choice groups: built-in options plus enabled catalog variations
    const choices = this.exerciseLibrary.getChoicesForDay(src.dayType);
    if (choices.length > 0) {
      this.choiceGroups.set(choices);
      const init: Record<string, string> = {};
      for (const c of choices) init[c.groupId] = '';
      this.selectedChoices.set(init);
    } else {
      const templates = this.routineService.getExercisesForDay(src.dayType);
      this.createNewSessionFromPlan(templates);
    }
  }

  /**
   * Creating a session overwrites the saved in-progress one (StorageService
   * writes a single key), so a half-finished workout used to vanish without a
   * word. Ask first. Returns false when the caller must stop.
   */
  private guardUnfinishedSession(): boolean {
    const existing = this.storage.currentSession();
    if (!existing || existing.completed) return true;
    const discard = confirm(
      'You have an unfinished workout.\n\n' +
        'OK — discard it and start the new one.\n' +
        'Cancel — go back and resume it.',
    );
    if (discard) {
      // Deliberately NOT cleared here: on the day flow the picker comes first
      // and the new session is only created on confirmSelection(), so clearing
      // now would leave the user with neither if they back out. The pending
      // saveCurrentSession() in createNewSessionFromPlan overwrites it anyway.
      return true;
    }
    // Home shows the "unfinished session" banner with a working Resume action.
    this.router.navigate(['/']);
    return false;
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

    // Fixed day members (no choice group) + the chosen alternatives. Chosen
    // ids are resolved from the full catalog since enabled variations may not
    // belong to the built-in day list.
    const fixed = this.routineService
      .getExercisesForDay(src.dayType)
      .filter((t) => !t.choiceGroup);
    const chosen = [...selectedIds]
      .map((id) => this.routineService.getTemplateById(id))
      .filter((t): t is ExerciseTemplate => !!t);
    const templates = [...fixed, ...chosen].sort((a, b) => a.order - b.order);

    this.createNewSessionFromPlan(templates);
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
    // sets/reps/RIR/rest override the template defaults. The catalog's
    // strength range is stripped — a routine is "configured exactly as you
    // want", so its authored rep range always wins, even under strength focus
    // (the focus still applies its weight-priority threshold within it).
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
        strengthRepsMin: undefined,
        strengthRepsMax: undefined,
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
    // A routine is authored deliberately, so its structure (how many sets, how
    // many of them warm-ups) always wins over whatever shape the last session
    // happened to have. Day-based workouts keep the old behaviour: the catalog
    // template is a default, so the user's own habits may extend it.
    const planIsAuthoritative = !!routineContext;

    const exercises: WorkoutExercise[] = templates.map((template) => {
      const suggestion = suggestions.get(template.id);
      const sets = buildSetsForExercise(template, suggestion?.setTargets ?? [], planIsAuthoritative);

      const restSeconds =
        routineContext?.restByTemplateId.get(template.id) ?? suggestion?.restSeconds;

      return { templateId: template.id, exerciseName: template.name, restSeconds, sets };
    });

    const dayType = src.kind === 'day' ? src.dayType : 'routine';
    const s: WorkoutSession = {
      id: `ws-${new Date().toISOString().slice(0, 10)}-${dayType}-${String(Date.now()).slice(-4)}`,
      date: new Date().toISOString(),
      dayType,
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
      // Without this the clock restarted on every resume and the saved duration
      // only covered the last stretch. Capped at 4 h: resuming the next day
      // would otherwise record a session lasting hundreds of minutes.
      const startedAt = new Date(existing.date).getTime();
      const elapsedMs = Date.now() - startedAt;
      if (!Number.isNaN(startedAt) && elapsedMs >= 0 && elapsedMs <= 4 * 3600_000) {
        this.startTime.set(startedAt);
      }
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

  /**
   * Pending auto-advance. Uncancelled it fires 500 ms after the last set of an
   * exercise is completed — including right after the user taps that set to
   * reopen it, which yanked them into the next exercise mid-edit.
   */
  private advanceTimer: ReturnType<typeof setTimeout> | null = null;

  private cancelAdvance(): void {
    if (this.advanceTimer !== null) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
  }

  goToPrevious(): void {
    this.cancelAdvance();
    if (this.currentExerciseIndex() > 0) this.currentExerciseIndex.update((i) => i - 1);
  }

  goToNext(): void {
    this.cancelAdvance();
    if (this.currentExerciseIndex() < this.exerciseCount() - 1) this.currentExerciseIndex.update((i) => i + 1);
  }

  /**
   * Jump to an exercise from the progress dots. Also leaves the summary — the
   * dots render on top of it and were dead controls there, which left the
   * summary with no way back to the exercises.
   */
  goToExercise(index: number): void {
    this.cancelAdvance();
    this.currentExerciseIndex.set(index);
    this.isSummary.set(false);
  }

  goToSummary(): void {
    this.cancelAdvance();
    this.isSummary.set(true);
  }

  /**
   * Replace a set in the current exercise by set number.
   *
   * The exercise object is replaced, not mutated: `currentExercise` is a
   * computed, and a computed that re-evaluates to an `Object.is`-equal value
   * does not bump its version, so every signal derived from it (completedCount,
   * hasWarmupSets, totalSetCount, currentExerciseDone) kept serving a stale
   * cache until the exercise index changed.
   */
  private replaceSet(updatedSet: WorkoutSet): WorkoutExercise | null {
    const s = this.session();
    const index = this.currentExerciseIndex();
    const current = s?.exercises[index];
    if (!s || !current) return null;
    const updated: WorkoutExercise = {
      ...current,
      sets: current.sets.map((st) => (st.setNumber === updatedSet.setNumber ? updatedSet : st)),
    };
    const exercises = [...s.exercises];
    exercises[index] = updated;
    const next: WorkoutSession = { ...s, exercises };
    this.session.set(next);
    this.storage.saveCurrentSession(next);
    return updated;
  }

  onSetCompleted(updatedSet: WorkoutSet): void {
    const exercise = this.replaceSet(updatedSet);
    if (!exercise) return;
    const allDone = exercise.sets.every((st) => st.completed);
    this.cancelAdvance();
    if (allDone && !this.isLastExercise()) {
      const from = this.currentExerciseIndex();
      this.advanceTimer = setTimeout(() => {
        this.advanceTimer = null;
        // Only advance if the user has not moved (or reopened a set) meanwhile.
        if (this.currentExerciseIndex() === from && !this.isSummary()) this.goToNext();
      }, 500);
    }
    if (this.allCompleted()) this.isSummary.set(true);
  }

  /** A completed set was tapped to be edited again */
  onSetReopened(updatedSet: WorkoutSet): void {
    this.cancelAdvance();
    this.replaceSet(updatedSet);
    // The exercise is no longer finished, so the summary must step aside.
    this.isSummary.set(false);
  }

  /** An edit that must persist before the set is completed (e.g. the warm-up flag) */
  onSetChanged(updatedSet: WorkoutSet): void {
    this.replaceSet(updatedSet);
  }

  // ─── Bodyweight weekly check-in (summary screen) ───

  /** Manually expanded state for the bodyweight field */
  readonly bodyWeightOpen = signal(false);

  /** Days since the last session-logged bodyweight (Infinity = never logged) */
  private readonly daysSinceBodyWeight = computed(() => {
    const latest = this.profileService.getLatestLoggedBodyWeight();
    if (!latest) return Infinity;
    return (Date.now() - new Date(latest.date).getTime()) / 86400000;
  });

  /** Weekly check-in: highlight the field when no weight was logged in ≥7 days */
  readonly shouldPromptBodyWeight = computed(() => this.daysSinceBodyWeight() >= 7);

  /** Field is visible when prompted, manually opened, or already filled this session */
  readonly bodyWeightVisible = computed(
    () =>
      this.shouldPromptBodyWeight() ||
      this.bodyWeightOpen() ||
      this.session()?.bodyWeightKg != null,
  );

  /** Suggested starting value: last logged weight, then profile, empty otherwise */
  readonly bodyWeightPrefill = computed(
    () =>
      this.profileService.getLatestLoggedBodyWeight()?.weightKg ??
      this.profileService.profile()?.bodyWeightKg ??
      null,
  );

  setBodyWeight(value: number | null): void {
    const s = this.session();
    if (!s) return;
    s.bodyWeightKg = value != null && value > 0 ? Math.round(value * 10) / 10 : undefined;
    this.persistCurrent();
  }

  adjustBodyWeight(delta: number): void {
    const s = this.session();
    if (!s) return;
    const current = s.bodyWeightKg ?? this.bodyWeightPrefill() ?? 70;
    this.setBodyWeight(current + delta);
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
    // Computed here rather than read off the ticking signal, which can be a tick behind.
    s.durationMinutes = minutesSince(this.startTime());
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

  /** Skipped sets keep their pre-filled weight now, so they must be excluded here */
  getMaxWeight(ex: WorkoutExercise): number {
    const ws = ex.sets.filter((st) => !st.isWarmup && st.completed && !st.skipped);
    return ws.length > 0 ? Math.max(...ws.map((st) => st.weightKg)) : 0;
  }
  getWorkCount(ex: WorkoutExercise): number { return ex.sets.filter((s) => !s.isWarmup && !s.skipped).length; }
  getWarmupCount(ex: WorkoutExercise): number { return ex.sets.filter((s) => s.isWarmup && !s.skipped).length; }
}
