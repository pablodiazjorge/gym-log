import { describe, it, expect } from 'vitest';
import { buildSetsForExercise, SetPlan } from './progression.util';
import { SetTarget } from '../models/progression.model';

// ─── Set construction: the plan must win over the recorded history ───

const plan = (over: Partial<SetPlan> = {}): SetPlan => ({
  targetSets: 4,
  targetRepsMin: 8,
  hasWarmupSets: true,
  warmupSets: 2,
  targetRirMin: 2,
  ...over,
});

const target = (setNumber: number, isWarmup: boolean, weightKg: number, reps = 10): SetTarget => ({
  setNumber,
  isWarmup,
  weightKg,
  reps,
  rir: 2,
});

describe('buildSetsForExercise — swapped-in exercise (template is a default, like a day workout)', () => {
  // The in-workout swap calls buildSetsForExercise(template, targets, false):
  // the routine never planned this exercise, so the catalog template is only a
  // default and the exercise's own history may reshape it.

  it('never logged before: template shape at template defaults', () => {
    const sets = buildSetsForExercise(plan({ targetSets: 3, warmupSets: 1 }), [], false);

    expect(sets.map((s) => [s.isWarmup, s.weightKg, s.reps])).toEqual([
      [true, 0, 8],
      [false, 0, 8],
      [false, 0, 8],
      [false, 0, 8],
    ]);
  });

  it('history shorter than the template: extra slots follow the last work target, history roles win', () => {
    // Two flat work sets logged last time vs a template of 1 warm-up + 3 work.
    // Documented behaviour: the history's roles fill the first slots and the
    // remaining ones copy the last work target — no warm-up is re-introduced.
    const history = [target(1, false, 60), target(2, false, 60)];

    const sets = buildSetsForExercise(plan({ targetSets: 3, warmupSets: 1 }), history, false);

    expect(sets).toHaveLength(4);
    expect(sets.every((s) => !s.isWarmup && s.weightKg === 60)).toBe(true);
  });
});

describe('buildSetsForExercise — routine-driven (plan is authoritative)', () => {
  it('keeps the configured warm-ups even when the history had none', () => {
    // Regression pin for the real t-bar-row case: routine says 2 warm-ups + 4
    // work sets, but the last session was logged with 6 flat work sets. Matching
    // targets by flat index used to produce 6 sets with zero warm-ups, and that
    // session then became the new history, perpetuating the loss.
    const history = [1, 2, 3, 4, 5, 6].map((n) => target(n, false, 15));

    const sets = buildSetsForExercise(plan(), history, true);

    expect(sets).toHaveLength(6);
    expect(sets.map((s) => s.isWarmup)).toEqual([true, true, false, false, false, false]);
  });

  it('fills work slots with work targets, not with the warm-up ones', () => {
    const history = [target(1, true, 40), target(2, true, 50), target(3, false, 60), target(4, false, 60)];

    const sets = buildSetsForExercise(plan({ targetSets: 2, warmupSets: 2 }), history, true);

    expect(sets.map((s) => [s.isWarmup, s.weightKg])).toEqual([
      [true, 40],
      [true, 50],
      [false, 60],
      [false, 60],
    ]);
  });

  it('honours a LOWER targetSets than the history — Math.max used to ignore it', () => {
    // The user drops the abductor from 3 to 2 sets in the routine editor while
    // the last session had 3. The routine must win.
    const history = [1, 2, 3].map((n) => target(n, false, 30));

    const sets = buildSetsForExercise(
      plan({ targetSets: 2, hasWarmupSets: false, warmupSets: 0 }),
      history,
      true,
    );

    expect(sets).toHaveLength(2);
    expect(sets.every((s) => !s.isWarmup)).toBe(true);
  });

  it('honours a HIGHER targetSets, reusing the last work weight for the extra sets', () => {
    const history = [target(1, false, 55), target(2, false, 55)];

    const sets = buildSetsForExercise(
      plan({ targetSets: 4, hasWarmupSets: false, warmupSets: 0 }),
      history,
      true,
    );

    expect(sets).toHaveLength(4);
    expect(sets.map((s) => s.weightKg)).toEqual([55, 55, 55, 55]);
  });

  it('falls back to template defaults with no history at all', () => {
    const sets = buildSetsForExercise(plan({ targetSets: 3, warmupSets: 1 }), [], true);

    expect(sets).toHaveLength(4);
    expect(sets.map((s) => s.isWarmup)).toEqual([true, false, false, false]);
    expect(sets.every((s) => s.reps === 8 && s.rir === 2 && s.weightKg === 0)).toBe(true);
  });

  it('never carries a work weight straight into a warm-up slot', () => {
    const history = [target(1, false, 100)];

    const sets = buildSetsForExercise(plan({ targetSets: 1, warmupSets: 2 }), history, true);

    // Half the first work set, not the full load and not a useless 0.
    expect(sets[0].weightKg).toBe(50);
    expect(sets[1].weightKg).toBe(50);
    expect(sets[2].weightKg).toBe(100);
  });

  it('derives a usable warm-up weight when the history has no warm-ups', () => {
    // Real case: t-bar-row. The routine adds 2 warm-up slots to an exercise
    // whose history has none, so they used to be pre-filled at 0 kg.
    const history = [target(1, false, 15), target(2, false, 15)];

    const sets = buildSetsForExercise(plan({ targetSets: 2, warmupSets: 2 }), history, true);

    expect(sets.slice(0, 2).every((s) => s.isWarmup && s.weightKg > 0)).toBe(true);
    expect(sets[0].weightKg).toBe(7.5);
  });

  it('leaves warm-ups at 0 kg for a bodyweight exercise', () => {
    const history = [target(1, false, 0, 10), target(2, false, 0, 8)];

    const sets = buildSetsForExercise(plan({ targetSets: 2, warmupSets: 1 }), history, true);

    expect(sets.every((s) => s.weightKg === 0)).toBe(true);
  });
});

describe('buildSetsForExercise — day-driven (template is only a default)', () => {
  it('lets the history extend the catalog target and keep its own warm-ups', () => {
    const history = [target(1, true, 30), target(2, false, 50), target(3, false, 50), target(4, false, 50)];

    const sets = buildSetsForExercise(
      plan({ targetSets: 2, hasWarmupSets: false, warmupSets: 0 }),
      history,
      false,
    );

    expect(sets).toHaveLength(4);
    expect(sets.map((s) => s.isWarmup)).toEqual([true, false, false, false]);
  });
});

// The "skipped sets must never reach a metric" regression cases live in
// analysis.util.spec.ts (workSets / e1rmSeriesForExercise) since the
// AnalyticsService retirement.
