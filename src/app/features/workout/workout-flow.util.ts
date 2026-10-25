import {
  ExerciseTemplate,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '../../core/models/workout.model';
import { Routine } from '../../core/models/routine.model';
import { ExerciseProgressionSuggestion } from '../../core/models/progression.model';
import { buildSetsForExercise } from '../../core/services/progression.util';

/**
 * The pure part of the guided workout flow: which exercises a new session
 * gets, how it is built, where a resumed one picks up and what the summary
 * counts. Moved out of the `Workout` component unchanged, so it can be tested
 * without Angular (ADR-0010); the component keeps the signals, routing,
 * dialogs and persistence.
 */

export type DayType = 'push' | 'pull' | 'legs' | 'abs';

/** Where a workout was started from */
export type WorkoutSource =
  { kind: 'day'; dayType: DayType } | { kind: 'routine'; routineId: string };

/** What a routine adds to the plan: its id and the rest time it set per exercise */
export interface RoutineContext {
  routineId: string;
  restByTemplateId: Map<string, number | undefined>;
}

/** Catalog lookup by template id */
export type TemplateLookup = (id: string) => ExerciseTemplate | undefined;

/**
 * A resumed session inherits its original start time only within this window:
 * resuming the next day would otherwise record a session lasting hundreds of
 * minutes.
 */
export const MAX_RESUME_ELAPSED_MS = 4 * 3600_000;

const DAY_MS = 86400000;

// ─── Labels and selection ───

/** Header label: the capitalized day type, or the routine's name */
export function labelForDay(dayType: DayType | 'routine', routineName: string): string {
  if (dayType === 'routine') return routineName || 'Routine';
  return dayType.charAt(0).toUpperCase() + dayType.slice(1);
}

/** One empty pick per choice group */
export function emptySelection(groups: readonly { groupId: string }[]): Record<string, string> {
  const init: Record<string, string> = {};
  for (const g of groups) init[g.groupId] = '';
  return init;
}

/** Is at least one exercise selected? */
export function anyExerciseSelected(selected: Record<string, string>): boolean {
  return Object.values(selected).some((id) => id !== '');
}

/**
 * Fixed day members (no choice group) plus the chosen alternatives, in catalog
 * order. Chosen ids are resolved from the full catalog, since enabled
 * variations may not belong to the built-in day list.
 */
export function resolveDayTemplates(
  dayTemplates: readonly ExerciseTemplate[],
  selected: Record<string, string>,
  lookup: TemplateLookup,
): ExerciseTemplate[] {
  const selectedIds = new Set(Object.values(selected).filter(Boolean));
  const fixed = dayTemplates.filter((t) => !t.choiceGroup);
  const chosen = [...selectedIds].map((id) => lookup(id)).filter((t): t is ExerciseTemplate => !!t);
  return [...fixed, ...chosen].sort((a, b) => a.order - b.order);
}

/**
 * Merge each routine config with its catalog template: the routine's own
 * sets/reps/RIR/rest override the template defaults. The catalog's strength
 * range is stripped — a routine is "configured exactly as you want", so its
 * authored rep range always wins, even under strength focus (the focus still
 * applies its weight-priority threshold within it). Configs whose template
 * left the catalog are skipped.
 */
export function routineToPlan(
  routine: Routine,
  lookup: TemplateLookup,
): { templates: ExerciseTemplate[]; context: RoutineContext } {
  const templates: ExerciseTemplate[] = [];
  const restByTemplateId = new Map<string, number | undefined>();
  for (const config of [...routine.exercises].sort((a, b) => a.order - b.order)) {
    const catalog = lookup(config.templateId);
    if (!catalog) continue;
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
  return { templates, context: { routineId: routine.id, restByTemplateId } };
}

// ─── Building and resuming a session ───

/**
 * Build a new in-progress session from effective templates. Set values come
 * from the progression suggestions (advisory only, every field stays
 * editable). A routine is authored deliberately, so its structure (how many
 * sets, how many of them warm-ups) wins over whatever shape the last session
 * happened to have; day-based workouts treat the catalog template as a
 * default, so the user's own history may extend it.
 */
export function buildWorkoutSession(
  templates: readonly ExerciseTemplate[],
  suggestions: Map<string, ExerciseProgressionSuggestion>,
  dayType: DayType | 'routine',
  routineContext?: RoutineContext,
  now: Date = new Date(),
): WorkoutSession {
  const planIsAuthoritative = !!routineContext;

  const exercises: WorkoutExercise[] = templates.map((template) => {
    const suggestion = suggestions.get(template.id);
    const sets = buildSetsForExercise(template, suggestion?.setTargets ?? [], planIsAuthoritative);
    const restSeconds =
      routineContext?.restByTemplateId.get(template.id) ?? suggestion?.restSeconds;
    return { templateId: template.id, exerciseName: template.name, restSeconds, sets };
  });

  return {
    id: `ws-${now.toISOString().slice(0, 10)}-${dayType}-${String(now.getTime()).slice(-4)}`,
    date: now.toISOString(),
    dayType,
    exercises,
    routineId: routineContext?.routineId,
    completed: false,
  };
}

/**
 * The start time a resumed session keeps, or null to restart the clock. The
 * clock used to restart on every resume, so the saved duration only covered
 * the last stretch; an unparseable date, a future one or one older than
 * MAX_RESUME_ELAPSED_MS restarts it instead.
 */
export function resumedStartTime(sessionDate: string, nowMs: number): number | null {
  const startedAt = new Date(sessionDate).getTime();
  const elapsedMs = nowMs - startedAt;
  if (!Number.isNaN(startedAt) && elapsedMs >= 0 && elapsedMs <= MAX_RESUME_ELAPSED_MS) {
    return startedAt;
  }
  return null;
}

/** Where a resumed session picks up: the first exercise with an open set, else the first */
export function firstOpenExerciseIndex(exercises: readonly WorkoutExercise[]): number {
  const idx = exercises.findIndex((ex) => ex.sets.some((s) => !s.completed));
  return idx >= 0 ? idx : 0;
}

export function allSetsCompleted(exercises: readonly WorkoutExercise[]): boolean {
  return exercises.every((ex) => ex.sets.every((s) => s.completed));
}

/**
 * The exercise with one set replaced by set number. Always a new object:
 * the component's `currentExercise` is a computed, and a computed that
 * re-evaluates to an `Object.is`-equal value does not bump its version, so
 * every signal derived from it would keep serving a stale cache.
 */
export function withSetReplaced(
  exercise: WorkoutExercise,
  updatedSet: WorkoutSet,
): WorkoutExercise {
  return {
    ...exercise,
    sets: exercise.sets.map((st) => (st.setNumber === updatedSet.setNumber ? updatedSet : st)),
  };
}

// ─── Finishing ───

/** Sets still open across the session (they are saved as not completed) */
export function countOpenSets(exercises: readonly WorkoutExercise[]): number {
  return exercises.reduce((n, ex) => n + ex.sets.filter((st) => !st.completed).length, 0);
}

/** The confirm shown when finishing with open sets */
export function openSetsWarning(pending: number): string {
  return (
    `${pending} set${pending === 1 ? '' : 's'} still open.\n\n` +
    'They will be saved as not completed and left out of your stats.\n\n' +
    'OK — save anyway.  Cancel — go back and finish them.'
  );
}

/** Bodyweight as stored: one decimal, or undefined for an empty or non-positive value */
export function roundBodyWeight(value: number | null): number | undefined {
  return value != null && value > 0 ? Math.round(value * 10) / 10 : undefined;
}

/** Days since an ISO date; Infinity when there is none */
export function daysSince(date: string | null | undefined, nowMs: number): number {
  if (date == null) return Infinity;
  return (nowMs - new Date(date).getTime()) / DAY_MS;
}

// ─── Summary ───

/** Heaviest performed work set. Skipped sets keep their pre-filled weight, so they are excluded */
export function maxWorkWeight(ex: WorkoutExercise): number {
  const ws = ex.sets.filter((st) => !st.isWarmup && st.completed && !st.skipped);
  return ws.length > 0 ? Math.max(...ws.map((st) => st.weightKg)) : 0;
}

/** Work sets that were not skipped */
export function workSetCount(ex: WorkoutExercise): number {
  return ex.sets.filter((s) => !s.isWarmup && !s.skipped).length;
}

/** Warm-up sets that were not skipped */
export function warmupSetCount(ex: WorkoutExercise): number {
  return ex.sets.filter((s) => s.isWarmup && !s.skipped).length;
}
