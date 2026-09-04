import { describe, expect, it } from 'vitest';
import {
  appendSet,
  canRemoveLastSet,
  hasPerformedWork,
  removeLastPendingSet,
  swapExercise,
} from './session-edit.util';
import { WorkoutExercise, WorkoutSet } from '../../core/models/workout.model';

const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  setNumber: 1,
  isWarmup: false,
  weightKg: 50,
  reps: 8,
  rir: 2,
  completed: false,
  skipped: false,
  ...overrides,
});

const exercise = (sets: WorkoutSet[], overrides: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  templateId: 'incline-machine-press',
  exerciseName: 'Incline Machine Press',
  restSeconds: 120,
  sets,
  ...overrides,
});

describe('appendSet', () => {
  it('adds a pending work set seeded from the last work set', () => {
    const ex = exercise([
      set({ setNumber: 1, isWarmup: true, weightKg: 25, reps: 12, rir: 5, completed: true }),
      set({ setNumber: 2, weightKg: 50, reps: 8, rir: 2, completed: true }),
      set({ setNumber: 3, weightKg: 47.5, reps: 7, rir: 1, completed: true }),
    ]);

    const result = appendSet(ex);
    expect(result.sets).toHaveLength(4);
    expect(result.sets[3]).toEqual({
      setNumber: 4,
      isWarmup: false,
      weightKg: 47.5,
      reps: 7,
      rir: 1,
      completed: false,
      skipped: false,
    });
  });

  it('seeds from the last set of any kind when there is no work set', () => {
    const ex = exercise([set({ setNumber: 1, isWarmup: true, weightKg: 20, reps: 15, rir: 5 })]);
    const added = appendSet(ex).sets[1];
    expect(added.isWarmup).toBe(false);
    expect(added.weightKg).toBe(20);
    expect(added.reps).toBe(15);
  });

  it('numbers after the highest existing set number, not the array length', () => {
    const ex = exercise([set({ setNumber: 1 }), set({ setNumber: 5 })]);
    expect(appendSet(ex).sets[2].setNumber).toBe(6);
  });

  it('skips a trailing warm-up and seeds from the last work set', () => {
    // Reachable: set-input's warm-up toggle can flip the last set mid-session
    const ex = exercise([
      set({ setNumber: 1, weightKg: 60, reps: 8, rir: 2, completed: true }),
      set({ setNumber: 2, isWarmup: true, weightKg: 30, reps: 15, rir: 5 }),
    ]);
    const added = appendSet(ex).sets[2];
    expect(added.isWarmup).toBe(false);
    expect([added.weightKg, added.reps, added.rir]).toEqual([60, 8, 2]);
  });

  it('handles an exercise with no sets at all (hand-edited import)', () => {
    const added = appendSet(exercise([])).sets[0];
    expect(added).toEqual({
      setNumber: 1,
      isWarmup: false,
      weightKg: 0,
      reps: 0,
      rir: 2,
      completed: false,
      skipped: false,
    });
  });

  it('never mutates the input', () => {
    const ex = exercise([set()]);
    const snapshot = JSON.parse(JSON.stringify(ex));
    appendSet(ex);
    expect(ex).toEqual(snapshot);
  });
});

describe('removeLastPendingSet', () => {
  it('removes the last set while it is still open', () => {
    const ex = exercise([set({ setNumber: 1, completed: true }), set({ setNumber: 2 })]);
    expect(canRemoveLastSet(ex)).toBe(true);
    expect(removeLastPendingSet(ex).sets.map((s) => s.setNumber)).toEqual([1]);
  });

  it('refuses when the last set is completed — it is a record now', () => {
    const ex = exercise([set({ setNumber: 1 }), set({ setNumber: 2, completed: true })]);
    expect(canRemoveLastSet(ex)).toBe(false);
    expect(removeLastPendingSet(ex)).toBe(ex);
  });

  it('refuses a skipped last set (skipped sets are completed by design)', () => {
    const ex = exercise([set({ setNumber: 1 }), set({ setNumber: 2, completed: true, skipped: true })]);
    expect(canRemoveLastSet(ex)).toBe(false);
  });

  it('never drops below one set', () => {
    const ex = exercise([set({ setNumber: 1 })]);
    expect(canRemoveLastSet(ex)).toBe(false);
    expect(removeLastPendingSet(ex)).toBe(ex);
  });
});

describe('swapExercise', () => {
  const replacement = exercise([set({ setNumber: 1, weightKg: 8, reps: 12 })], {
    templateId: 'standing-dumbbell-lateral-raise',
    exerciseName: 'Standing Dumbbell Lateral Raise',
    restSeconds: 90,
  });
  const before = exercise([set({ setNumber: 1, completed: true })], { templateId: 'pec-deck' });
  const after = exercise([set({ setNumber: 1 })], { templateId: 'cable-triceps-pushdown' });

  it('replaces in place when nothing was performed yet', () => {
    const untouched = exercise([set({ setNumber: 1 }), set({ setNumber: 2 })], {
      templateId: 'incline-bench-lateral-raises',
    });
    const result = swapExercise([before, untouched, after], 1, replacement);

    expect(result.index).toBe(1);
    expect(result.exercises.map((e) => e.templateId)).toEqual([
      'pec-deck',
      'standing-dumbbell-lateral-raise',
      'cable-triceps-pushdown',
    ]);
  });

  it('replaces in place when only a warm-up was performed — a lone warm-up would shadow real history', () => {
    const warmupOnly = exercise(
      [
        set({ setNumber: 1, isWarmup: true, weightKg: 30, reps: 12, rir: 5, completed: true }),
        set({ setNumber: 2, weightKg: 60, reps: 8 }),
        set({ setNumber: 3, weightKg: 60, reps: 8 }),
      ],
      { templateId: 'pec-deck' },
    );
    expect(hasPerformedWork(warmupOnly)).toBe(false);

    const result = swapExercise([warmupOnly, after], 0, replacement);
    expect(result.index).toBe(0);
    expect(result.exercises.map((e) => e.templateId)).toEqual([
      'standing-dumbbell-lateral-raise',
      'cable-triceps-pushdown',
    ]);
  });

  it('keeps a performed warm-up alongside performed work when the original is kept', () => {
    const partial = exercise(
      [
        set({ setNumber: 1, isWarmup: true, weightKg: 30, reps: 12, rir: 5, completed: true }),
        set({ setNumber: 2, weightKg: 60, reps: 8, completed: true }),
        set({ setNumber: 3, weightKg: 60, reps: 8 }),
      ],
      { templateId: 'pec-deck' },
    );
    expect(hasPerformedWork(partial)).toBe(true);

    const result = swapExercise([partial], 0, replacement);
    expect(result.index).toBe(1);
    expect(result.exercises[0].sets.map((s) => s.setNumber)).toEqual([1, 2]);
  });

  it('inserts after the LAST exercise and returns the new last index', () => {
    const last = exercise([set({ setNumber: 1, completed: true }), set({ setNumber: 2 })], {
      templateId: 'incline-bench-lateral-raises',
    });
    const result = swapExercise([before, after, last], 2, replacement);
    expect(result.index).toBe(3);
    expect(result.exercises).toHaveLength(4);
    expect(result.exercises[3]).toBe(replacement);
    expect(result.index).toBe(result.exercises.length - 1);
  });

  it('treats an exercise with only skipped sets as untouched', () => {
    const allSkipped = exercise(
      [set({ setNumber: 1, completed: true, skipped: true }), set({ setNumber: 2, completed: true, skipped: true })],
      { templateId: 'incline-bench-lateral-raises' },
    );
    const result = swapExercise([allSkipped], 0, replacement);
    expect(result.index).toBe(0);
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].templateId).toBe('standing-dumbbell-lateral-raise');
  });

  it('keeps performed sets under the original and inserts the replacement after it', () => {
    const partial = exercise(
      [
        set({ setNumber: 1, completed: true }),
        set({ setNumber: 2, completed: true, skipped: true }),
        set({ setNumber: 3 }),
        set({ setNumber: 4 }),
      ],
      { templateId: 'incline-bench-lateral-raises' },
    );
    const result = swapExercise([before, partial, after], 1, replacement);

    expect(result.index).toBe(2);
    expect(result.exercises.map((e) => e.templateId)).toEqual([
      'pec-deck',
      'incline-bench-lateral-raises',
      'standing-dumbbell-lateral-raise',
      'cable-triceps-pushdown',
    ]);
    // Only the performed set survives on the original; pending and skipped slots go
    expect(result.exercises[1].sets.map((s) => s.setNumber)).toEqual([1]);
    expect(result.exercises[2]).toBe(replacement);
  });

  it('returns the input untouched for an out-of-range index', () => {
    const list = [before];
    const result = swapExercise(list, 3, replacement);
    expect(result.exercises).toBe(list);
    expect(result.index).toBe(3);
  });

  it('never mutates the input array or exercises', () => {
    const partial = exercise([set({ setNumber: 1, completed: true }), set({ setNumber: 2 })]);
    const list = [partial];
    const snapshot = JSON.parse(JSON.stringify(list));
    swapExercise(list, 0, replacement);
    expect(list).toEqual(snapshot);
    expect(list).toHaveLength(1);
  });
});
