import { describe, expect, it } from 'vitest';
import { EXERCISE_CATALOG } from './index';
import { categoryOfMuscleGroup } from '../../models/workout.model';

/**
 * Catalog integrity — guards the data contract the engine, the pickers and
 * the user's logged history all rely on.
 */
describe('EXERCISE_CATALOG integrity', () => {
  /** The original built-in day members: stable FKs into logged history (ADR-0012) */
  const BUILT_IN_IDS = [
    // push
    'incline-machine-press', 'flat-machine-press', 'incline-smith-press', 'pec-deck',
    'cable-triceps-pushdown', 'incline-bench-lateral-raises', 'rear-delt-fly',
    // pull
    'lat-pulldown-wide-grip', 'lat-pulldown-mag-neutral', 'pronated-pull-ups',
    'single-arm-lat-pulldown', 't-bar-row', 'incline-bench-curl', 'hammer-curl',
    // legs
    'machine-hack-squat', 'incline-leg-press', 'weighted-squats-home', 'seated-leg-curl',
    'single-leg-rdl', 'hip-thrust', 'machine-hip-abduction', 'standing-calf-raise',
    'seated-calf-raise', 'smith-bulgarian-split-squat',
    // abs
    'hanging-leg-raises', 'cable-crunch', 'dragon-flag',
  ];

  it('has unique ids', () => {
    const ids = EXERCISE_CATALOG.map((ex) => ex.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every built-in day member present and flagged', () => {
    for (const id of BUILT_IN_IDS) {
      const entry = EXERCISE_CATALOG.find((ex) => ex.id === id);
      expect(entry, `missing built-in id ${id}`).toBeDefined();
      expect(entry!.builtInDay, `${id} must be builtInDay`).toBe(true);
    }
  });

  it('only the original day members are builtInDay', () => {
    const builtIn = EXERCISE_CATALOG.filter((ex) => ex.builtInDay).map((ex) => ex.id);
    expect(builtIn.sort()).toEqual([...BUILT_IN_IDS].sort());
  });

  it('every entry has complete metadata', () => {
    for (const ex of EXERCISE_CATALOG) {
      expect(ex.name, ex.id).toBeTruthy();
      expect(ex.nameEs, `${ex.id} missing nameEs`).toBeTruthy();
      expect(ex.description, `${ex.id} missing description`).toBeTruthy();
      expect(ex.muscleGroup, `${ex.id} missing muscleGroup`).toBeTruthy();
      expect(ex.equipment, `${ex.id} missing equipment`).toBeTruthy();
      expect(typeof ex.isCompound, `${ex.id} missing isCompound`).toBe('boolean');
      expect(ex.weightIncrementKg, `${ex.id} missing weightIncrementKg`).toBeGreaterThan(0);
      expect(ex.targetSets, ex.id).toBeGreaterThanOrEqual(1);
      expect(ex.targetRepsMin, ex.id).toBeGreaterThanOrEqual(1);
      expect(ex.targetRepsMax, ex.id).toBeGreaterThanOrEqual(ex.targetRepsMin);
    }
  });

  it('strength ranges appear only on compounds and are valid', () => {
    for (const ex of EXERCISE_CATALOG) {
      const hasStrength = ex.strengthRepsMin != null || ex.strengthRepsMax != null;
      if (hasStrength) {
        expect(ex.isCompound, `${ex.id}: strength range on non-compound`).toBe(true);
        expect(ex.strengthRepsMin, ex.id).toBeGreaterThanOrEqual(1);
        expect(ex.strengthRepsMax, ex.id).toBeGreaterThanOrEqual(ex.strengthRepsMin!);
        expect(ex.strengthRepsMax, `${ex.id}: strength range should sit below hypertrophy ceiling`)
          .toBeLessThanOrEqual(ex.targetRepsMax);
      }
    }
  });

  it('category is consistent with the muscle group', () => {
    for (const ex of EXERCISE_CATALOG) {
      expect(categoryOfMuscleGroup(ex.muscleGroup!), ex.id).toBe(ex.category);
    }
  });

  it('all members of a choice group share the same order (stable day ordering)', () => {
    const orders = new Map<string, Set<number>>();
    for (const ex of EXERCISE_CATALOG) {
      if (!ex.choiceGroup) continue;
      const set = orders.get(ex.choiceGroup) ?? new Set<number>();
      set.add(ex.order);
      orders.set(ex.choiceGroup, set);
    }
    for (const [groupId, set] of orders) {
      expect(set.size, `choiceGroup ${groupId} has mixed orders: ${[...set]}`).toBe(1);
    }
  });

  it('every choice group keeps at least one built-in member (never-empty fallback)', () => {
    const groups = new Map<string, { any: number; builtIn: number }>();
    for (const ex of EXERCISE_CATALOG) {
      if (!ex.choiceGroup) continue;
      const entry = groups.get(ex.choiceGroup) ?? { any: 0, builtIn: 0 };
      entry.any++;
      if (ex.builtInDay) entry.builtIn++;
      groups.set(ex.choiceGroup, entry);
    }
    for (const [groupId, counts] of groups) {
      expect(counts.builtIn, `choiceGroup ${groupId} has no built-in member`).toBeGreaterThan(0);
    }
  });

  it('has a substantial repertoire (~80+) without runaway growth', () => {
    expect(EXERCISE_CATALOG.length).toBeGreaterThanOrEqual(75);
    expect(EXERCISE_CATALOG.length).toBeLessThan(200);
  });
});
