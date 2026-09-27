import {
  ExerciseTemplate,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '../../core/models/workout.model';

/**
 * History edits: correcting the record of a past session.
 *
 * The live-workout rules (ADR-0013) protect an in-progress session — there, a
 * completed set is a record and the way to drop one is Skip. Editing HISTORY
 * is the inverse operation: the record itself is wrong (a typo'd weight, a
 * set logged twice, a forgotten exercise), so any set or exercise may be
 * changed or removed outright (ADR-0014).
 *
 * Pure functions per ADR-0010; inputs are never mutated, and a no-op edit
 * returns the input reference so callers can use identity as a change check.
 */

/** Sequential set numbers after any structural edit (precedent: additional.ts) */
export function renumberSets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.map((s, i) => (s.setNumber === i + 1 ? s : { ...s, setNumber: i + 1 }));
}

/** Remove ANY set — in history a wrong set is corrected, not skipped */
export function removeSetAt(exercise: WorkoutExercise, setIndex: number): WorkoutExercise {
  if (setIndex < 0 || setIndex >= exercise.sets.length) return exercise;
  return { ...exercise, sets: renumberSets(exercise.sets.filter((_, i) => i !== setIndex)) };
}

/**
 * A forgotten exercise, appended with one OPEN seeded set — open so the edit
 * UI drops straight into the steppers; normalizeForSave closes whatever the
 * user leaves open.
 */
export function newExerciseFromTemplate(template: ExerciseTemplate): WorkoutExercise {
  return {
    templateId: template.id,
    exerciseName: template.name,
    sets: [
      {
        setNumber: 1,
        isWarmup: false,
        weightKg: 0,
        reps: template.targetRepsMin,
        rir: midpointRir(template),
        completed: false,
        skipped: false,
      },
    ],
  };
}

/** Append a catalog exercise; a duplicate templateId is refused (the views track by it) */
export function addExerciseFromTemplate(
  session: WorkoutSession,
  template: ExerciseTemplate,
): WorkoutSession {
  if (session.exercises.some((e) => e.templateId === template.id)) return session;
  return { ...session, exercises: [...session.exercises, newExerciseFromTemplate(template)] };
}

export function removeExerciseAt(session: WorkoutSession, index: number): WorkoutSession {
  if (index < 0 || index >= session.exercises.length) return session;
  return { ...session, exercises: session.exercises.filter((_, i) => i !== index) };
}

/**
 * Replace the calendar day (local), keeping the time of day: ordering within
 * a day and the analytics' local-week bucketing read the full timestamp.
 */
export function withSessionDate(session: WorkoutSession, dateInput: string): WorkoutSession {
  const [y, m, d] = dateInput.split('-').map(Number);
  if (!y || !m || !d) return session;
  const next = new Date(session.date);
  if (Number.isNaN(next.getTime())) return session;
  next.setFullYear(y, m - 1, d);
  const iso = next.toISOString();
  return iso === session.date ? session : { ...session, date: iso };
}

/**
 * A saved history session is all record: every remaining set is closed
 * (skipped ones stay skipped), numbering is sequential, and an exercise left
 * with no sets disappears — kept, it would become that template's most recent
 * history and pre-fill the next session from nothing, exactly the shadowing
 * ADR-0013 guards against for warm-up-only exercises.
 */
export function normalizeForSave(session: WorkoutSession): WorkoutSession {
  const exercises = session.exercises
    .filter((e) => e.sets.length > 0)
    .map((e) => ({
      ...e,
      sets: renumberSets(e.sets).map((s) => (s.completed ? s : { ...s, completed: true })),
    }));
  return { ...session, exercises };
}

// ─── Internal helpers ───

/** Same convention as the progression engine's template defaults */
function midpointRir(template: ExerciseTemplate): number {
  const min = template.targetRirMin;
  const max = template.targetRirMax;
  if (min != null && max != null) return Math.round(((min + max) / 2) * 10) / 10;
  return min ?? max ?? 2;
}
