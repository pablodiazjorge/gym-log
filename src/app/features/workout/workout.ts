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
import { ExercisePicker } from '../../shared/components/exercise-picker';
import { Icon } from '../../shared/components/icon';
import { IconName } from '../../shared/components/icon-paths';
import {
  categoryIcon,
  categorySelectedClass,
  categorySolidClass,
  categoryTextClass,
  categoryTileClass,
} from '../../shared/theme';
import { SetInput } from '../../shared/components/set-input';
import {
  appendSet,
  canRemoveLastSet,
  hasPerformedWork,
  removeLastPendingSet,
  swapExercise,
} from './session-edit.util';
import {
  DayType,
  RoutineContext,
  WorkoutSource,
  allSetsCompleted,
  anyExerciseSelected,
  buildWorkoutSession,
  countOpenSets,
  daysSince,
  emptySelection,
  firstOpenExerciseIndex,
  labelForDay,
  maxWorkWeight,
  openSetsWarning,
  resolveDayTemplates,
  resumedStartTime,
  roundBodyWeight,
  routineToPlan,
  warmupSetCount,
  withSetReplaced,
  workSetCount,
} from './workout-flow.util';

import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-workout',
  imports: [SetInput, NgClass, FormsModule, ExercisePicker, Icon],
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

  readonly dayLabel = computed(() => labelForDay(this.dayType(), this.routineName()));

  // ─── Selection phase (day-based workouts only) ───
  readonly choiceGroups = signal<{ groupId: string; label: string; options: ExerciseTemplate[] }[]>([]);
  readonly selectedChoices = signal<Record<string, string>>({}); // groupId → templateId
  readonly isSelecting = computed(() => this.choiceGroups().length > 0 && !this.session());

  readonly exercises = computed(() => this.session()?.exercises ?? []);
  /** null when the index is out of range (no exercises yet): the array type hides that */
  readonly currentExercise = computed<WorkoutExercise | null>(
    () => this.exercises()[this.currentExerciseIndex()] ?? null,
  );
  readonly exerciseCount = computed(() => this.exercises().length);
  readonly isLastExercise = computed(() => this.currentExerciseIndex() >= this.exerciseCount() - 1);
  readonly allCompleted = computed(() => allSetsCompleted(this.exercises()));
  readonly hasWarmupSets = computed(() => this.currentExercise()?.sets.some((s) => s.isWarmup) ?? false);
  readonly durationMinutes = elapsedMinutes(this.startTime);
  readonly completedCount = computed(() => this.currentExercise()?.sets.filter((s) => s.completed).length ?? 0);
  readonly totalSetCount = computed(() => this.currentExercise()?.sets.length ?? 0);
  readonly currentExerciseDone = computed(() => {
    const ex = this.currentExercise();
    return ex ? ex.sets.every((s) => s.completed) : false;
  });

  // Category styling, delegated to the single map in shared/theme.ts
  get accentTextClass(): string {
    return categoryTextClass(this.dayType());
  }

  get accentDotClass(): string {
    return categorySolidClass(this.dayType());
  }

  get dayTileClass(): string {
    return categoryTileClass(this.dayType());
  }

  get dayIcon(): IconName {
    return categoryIcon(this.dayType());
  }

  /** Selected state of a choice-group option, tinted by the day's category */
  get choiceSelectedClass(): string {
    return categorySelectedClass(this.dayType());
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
      this.selectedChoices.set(emptySelection(choices));
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
    const templates = resolveDayTemplates(
      this.routineService.getExercisesForDay(src.dayType),
      this.selectedChoices(),
      (id) => this.routineService.getTemplateById(id),
    );
    this.createNewSessionFromPlan(templates);
  }

  /** Is at least one exercise selected? */
  readonly hasAnySelection = computed(() => anyExerciseSelected(this.selectedChoices()));

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
    // The routine's own sets/reps/RIR/rest override the catalog defaults
    const { templates, context } = routineToPlan(routine, (id) =>
      this.routineService.getTemplateById(id),
    );
    this.createNewSessionFromPlan(templates, context);
  }

  /**
   * Build the session from effective templates, pre-filled from the
   * progression engine's suggestions (advisory only — see buildWorkoutSession).
   */
  private createNewSessionFromPlan(
    templates: ExerciseTemplate[],
    routineContext?: RoutineContext,
  ): void {
    const src = this.source();
    const suggestions = this.progression.getSuggestionsForTemplates(templates);
    const dayType = src.kind === 'day' ? src.dayType : 'routine';
    const s = buildWorkoutSession(templates, suggestions, dayType, routineContext);
    this.session.set(s);
    this.storage.saveCurrentSession(s);
    this.startTime.set(Date.now());
  }

  private loadExistingSession(): void {
    const existing = this.storage.currentSession();
    if (existing) {
      this.session.set(existing);
      // Keep the original start so the saved duration covers the whole
      // session, not just the last stretch (capped — see resumedStartTime).
      const startedAt = resumedStartTime(existing.date, Date.now());
      if (startedAt !== null) this.startTime.set(startedAt);
      if (existing.dayType === 'routine' && existing.routineId) {
        const routine =
          this.routineLibrary.getRoutineById(existing.routineId) ??
          this.routineService.getBuiltInRoutines().find((r) => r.id === existing.routineId);
        this.routineName.set(routine?.name ?? 'Routine');
      }
      this.currentExerciseIndex.set(firstOpenExerciseIndex(existing.exercises));
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
   * Replace a set in the current exercise by set number. The exercise object
   * is replaced, not mutated, so every signal derived from `currentExercise`
   * (completedCount, hasWarmupSets, totalSetCount, currentExerciseDone) sees
   * the change — see withSetReplaced.
   */
  private replaceSet(updatedSet: WorkoutSet): WorkoutExercise | null {
    const s = this.session();
    const index = this.currentExerciseIndex();
    const current = s?.exercises[index];
    if (!s || !current) return null;
    const updated = withSetReplaced(current, updatedSet);
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

  // ─── In-session edits: swap the exercise, add or drop a set ───
  //
  // A routine fixes the plan, but the gym does not always cooperate: a machine
  // is taken, time runs out, a set feels like one too many. These edit the
  // live session only — the routine itself is untouched.

  readonly isSwapping = signal(false);

  /**
   * Already in the session. The picker leaves these out: the progress dots and
   * the summary `track` by templateId, so a duplicate would collide.
   */
  readonly sessionTemplateIds = computed(() => this.exercises().map((ex) => ex.templateId));

  /** Open the picker on the current exercise's category */
  readonly currentCategory = computed<'push' | 'pull' | 'legs' | 'abs' | 'all'>(() => {
    const id = this.currentExercise()?.templateId;
    return (id && this.routineService.getTemplateById(id)?.category) || 'all';
  });

  /** Same predicate swapExercise() uses to decide keep-vs-replace */
  readonly currentHasPerformedWork = computed(() => {
    const ex = this.currentExercise();
    return !!ex && hasPerformedWork(ex);
  });

  readonly canRemoveLastSet = computed(() => {
    const ex = this.currentExercise();
    return !!ex && canRemoveLastSet(ex);
  });

  openSwap(): void {
    this.cancelAdvance();
    this.isSwapping.set(true);
  }

  closeSwap(): void {
    this.isSwapping.set(false);
  }

  /**
   * Replace the current exercise. Its sets are pre-filled the same way a new
   * session is (progression suggestion or last-session copy, per the profile
   * toggle). The routine never planned this exercise, so the catalog template
   * is only a default and the exercise's own history may reshape it — the same
   * rule a day-based workout uses (planIsAuthoritative = false). Performed
   * work of the old one is kept — see swapExercise().
   */
  swapCurrentExercise(template: ExerciseTemplate): void {
    const s = this.session();
    const index = this.currentExerciseIndex();
    const current = s?.exercises[index];
    if (!s || !current) return;

    const suggestion = this.progression.getSuggestionsForTemplates([template]).get(template.id);
    const replacement: WorkoutExercise = {
      templateId: template.id,
      exerciseName: template.name,
      restSeconds: suggestion?.restSeconds ?? current.restSeconds,
      sets: buildSetsForExercise(template, suggestion?.setTargets ?? [], false),
    };

    const result = swapExercise(s.exercises, index, replacement);
    this.commitExercises(result.exercises);
    this.currentExerciseIndex.set(result.index);
    this.isSwapping.set(false);
  }

  addSet(): void {
    this.cancelAdvance();
    this.updateCurrentExercise(appendSet);
  }

  removeLastSet(): void {
    this.updateCurrentExercise(removeLastPendingSet);
  }

  private updateCurrentExercise(fn: (exercise: WorkoutExercise) => WorkoutExercise): void {
    const s = this.session();
    const index = this.currentExerciseIndex();
    const current = s?.exercises[index];
    if (!s || !current) return;
    const updated = fn(current);
    if (updated === current) return;
    const exercises = [...s.exercises];
    exercises[index] = updated;
    this.commitExercises(exercises);
  }

  /** Same immutable-replace rule as replaceSet(): derived signals must see a new object */
  private commitExercises(exercises: WorkoutExercise[]): void {
    const s = this.session();
    if (!s) return;
    const next: WorkoutSession = { ...s, exercises };
    this.session.set(next);
    this.storage.saveCurrentSession(next);
  }

  // ─── Bodyweight weekly check-in (summary screen) ───

  /** Manually expanded state for the bodyweight field */
  readonly bodyWeightOpen = signal(false);

  /** Days since the last session-logged bodyweight (Infinity = never logged) */
  private readonly daysSinceBodyWeight = computed(() =>
    daysSince(this.profileService.getLatestLoggedBodyWeight()?.date, Date.now()),
  );

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
    s.bodyWeightKg = roundBodyWeight(value);
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

  /** Session notes live on the session object and had no persistence hook at all */
  setNotes(value: string): void {
    const s = this.session();
    if (!s) return;
    s.notes = value;
    this.persistCurrent();
  }

  private persistCurrent(): void {
    const s = this.session();
    if (!s) return;
    // Persist the object the signal ends up holding, not the pre-update one.
    const next: WorkoutSession = { ...s, exercises: [...s.exercises] };
    this.session.set(next);
    this.storage.saveCurrentSession(next);
  }

  finishWorkout(): void {
    const s = this.session();
    if (!s) return;
    // A set reopened for editing and never re-completed would be saved as
    // incomplete and vanish from every metric. Say so before it's too late.
    const pending = countOpenSets(s.exercises);
    if (pending > 0) {
      const ok = confirm(openSetsWarning(pending));
      if (!ok) {
        this.isSummary.set(false);
        return;
      }
    }
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

  // Summary counts (pure, see workout-flow.util)
  readonly getMaxWeight = maxWorkWeight;
  readonly getWorkCount = workSetCount;
  readonly getWarmupCount = warmupSetCount;
}
