import { WorkoutExercise, WorkoutSet } from '../../core/models/workout.model';

/**
 * In-session edits to a workout that a routine did not anticipate: an extra
 * set, one set fewer, or a different exercise because the machine was taken
 * or the time ran out. Pure functions over the session model (ADR-0010);
 * every result is a new object and the input is never mutated.
 */

/** A set that was actually performed (skipped sets stay `completed` by design) */
function isPerformed(set: WorkoutSet): boolean {
  return set.completed && !set.skipped;
}

/**
 * Has any WORK set been performed? A warm-up alone is not work: analytics
 * ignore it, and an exercise kept with only a warm-up would become that
 * template's latest history and pre-fill the next session at 0 kg, shadowing
 * the real numbers from the session before.
 */
export function hasPerformedWork(exercise: WorkoutExercise): boolean {
  return exercise.sets.some((s) => isPerformed(s) && !s.isWarmup);
}

/**
 * Append one pending work set, seeded from the last work set (weight, reps,
 * RIR) so the user only has to tap "done" when it repeats. Falls back to the
 * last set of any kind when the exercise has no work set yet.
 */
export function appendSet(exercise: WorkoutExercise): WorkoutExercise {
  const sets = exercise.sets;
  const seed = [...sets].reverse().find((s) => !s.isWarmup) ?? sets[sets.length - 1];
  const nextNumber = sets.reduce((max, s) => Math.max(max, s.setNumber), 0) + 1;
  const added: WorkoutSet = {
    setNumber: nextNumber,
    isWarmup: false,
    weightKg: seed?.weightKg ?? 0,
    reps: seed?.reps ?? 0,
    rir: seed?.rir ?? 2,
    completed: false,
    skipped: false,
  };
  return { ...exercise, sets: [...sets, added] };
}

/**
 * Only the last set can be removed, and only while it is still open: a
 * completed set is a record, and removing a middle set would renumber the
 * ones the user has already ticked. Skipping remains the way to drop those.
 */
export function canRemoveLastSet(exercise: WorkoutExercise): boolean {
  const last = exercise.sets[exercise.sets.length - 1];
  return exercise.sets.length > 1 && !!last && !last.completed;
}

/** Remove the last set when {@link canRemoveLastSet}; otherwise return the input unchanged */
export function removeLastPendingSet(exercise: WorkoutExercise): WorkoutExercise {
  if (!canRemoveLastSet(exercise)) return exercise;
  return { ...exercise, sets: exercise.sets.slice(0, -1) };
}

export interface SwapResult {
  exercises: WorkoutExercise[];
  /** Where the replacement landed — the index to navigate to */
  index: number;
}

/**
 * Replace the exercise at `index` with `replacement`.
 *
 * No work performed yet (nothing, or only a warm-up) → replaced in place, same
 * index. Some work performed → the performed sets (warm-ups included) stay
 * logged under the original exercise, its pending and skipped slots are
 * dropped, and the replacement is inserted right after — so no work is ever
 * lost by changing your mind mid-exercise.
 */
export function swapExercise(
  exercises: WorkoutExercise[],
  index: number,
  replacement: WorkoutExercise,
): SwapResult {
  const current = exercises[index];
  if (!current) return { exercises, index };

  const next = [...exercises];
  if (!hasPerformedWork(current)) {
    next[index] = replacement;
    return { exercises: next, index };
  }
  next[index] = { ...current, sets: current.sets.filter(isPerformed) };
  next.splice(index + 1, 0, replacement);
  return { exercises: next, index: index + 1 };
}
