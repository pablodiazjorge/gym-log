import { describe, expect, it } from 'vitest';
import {
  AGGRESSIVENESS,
  FRAME_ADJUSTMENT,
  PLATE_INCREMENT_KG,
  computeCategoryLevel,
  computeFrameSize,
  decideAction,
  estimate1Rm,
  estimateExerciseFrequency,
  frequencyStepScale,
  resolveLevel,
  rirToPercent1Rm,
  roundToPlate,
  suggestNextSessionSets,
} from './progression.util';
import { ExerciseTemplate, WorkoutSession, WorkoutSet } from '../models/workout.model';
import { ComputedLevelResult, UserProfile } from '../models/profile.model';

// ─── Fixtures ───

const template = (overrides: Partial<ExerciseTemplate> = {}): ExerciseTemplate => ({
  id: 'incline-machine-press',
  name: 'Incline Machine Press',
  category: 'push',
  order: 1,
  targetSets: 3,
  targetRepsMin: 8,
  targetRepsMax: 12,
  hasWarmupSets: false,
  targetRirMin: 1,
  targetRirMax: 2,
  ...overrides,
});

const workSet = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  setNumber: 1,
  isWarmup: false,
  weightKg: 50,
  reps: 8,
  rir: 2,
  completed: true,
  skipped: false,
  ...overrides,
});

/** Realistic 3-set shape: 50×8, 47.5×8, 45×7 (drop ~5%/10%, −1 rep on set 3) */
const lastSessionSets = (): WorkoutSet[] => [
  workSet({ setNumber: 1, weightKg: 50, reps: 8, rir: 2 }),
  workSet({ setNumber: 2, weightKg: 47.5, reps: 8, rir: 2 }),
  workSet({ setNumber: 3, weightKg: 45, reps: 7, rir: 1 }),
];

// ─── estimate1Rm ───

describe('estimate1Rm', () => {
  it('passes through at 1 rep', () => {
    expect(estimate1Rm(100, 1)).toBe(100);
  });

  it('returns 0 for invalid inputs instead of NaN', () => {
    expect(estimate1Rm(0, 5)).toBe(0);
    expect(estimate1Rm(100, 0)).toBe(0);
    expect(estimate1Rm(-10, 5)).toBe(0);
  });

  it('matches Brzycki at low reps (≤6)', () => {
    // Brzycki: 100 × 36 / (37 - 5) = 112.5
    expect(estimate1Rm(100, 5)).toBeCloseTo(112.5, 1);
  });

  it('matches Epley at high reps (≥10)', () => {
    // Epley: 100 × (1 + 10/30) ≈ 133.3
    expect(estimate1Rm(100, 10)).toBeCloseTo(133.3, 1);
  });

  it('blends smoothly between 6 and 10 reps (monotonically increasing)', () => {
    const e6 = estimate1Rm(100, 6);
    const e7 = estimate1Rm(100, 7);
    const e8 = estimate1Rm(100, 8);
    const e10 = estimate1Rm(100, 10);
    expect(e7).toBeGreaterThan(e6);
    expect(e8).toBeGreaterThan(e7);
    expect(e10).toBeGreaterThan(e8);
  });

  it('does not blow up at very high rep counts', () => {
    expect(Number.isFinite(estimate1Rm(50, 30))).toBe(true);
    expect(Number.isFinite(estimate1Rm(50, 40))).toBe(true);
  });
});

// ─── rirToPercent1Rm ───

describe('rirToPercent1Rm', () => {
  it('returns table endpoints', () => {
    expect(rirToPercent1Rm(0)).toBe(1.0);
    expect(rirToPercent1Rm(5)).toBe(0.85);
  });

  it('interpolates midpoints linearly', () => {
    expect(rirToPercent1Rm(0.5)).toBeCloseTo(0.985, 3);
    expect(rirToPercent1Rm(2.5)).toBeCloseTo(0.925, 3);
  });

  it('clamps outside [0, 5]', () => {
    expect(rirToPercent1Rm(-2)).toBe(1.0);
    expect(rirToPercent1Rm(8)).toBe(0.85);
  });
});

// ─── computeFrameSize ───

describe('computeFrameSize', () => {
  it('classifies male frames at exact boundaries', () => {
    // r > 10.4 → small; 9.6–10.4 → medium; < 9.6 → large
    expect(computeFrameSize(178, 17, 'male').frameSize).toBe('small'); // r ≈ 10.47
    expect(computeFrameSize(104, 10, 'male').frameSize).toBe('medium'); // r = 10.4 exactly
    expect(computeFrameSize(96, 10, 'male').frameSize).toBe('medium'); // r = 9.6 exactly
    expect(computeFrameSize(95, 10, 'male').frameSize).toBe('large'); // r = 9.5
  });

  it('classifies female frames with their own thresholds', () => {
    expect(computeFrameSize(165, 14.5, 'female').frameSize).toBe('small'); // r ≈ 11.38
    expect(computeFrameSize(110, 10, 'female').frameSize).toBe('medium'); // r = 11.0
    expect(computeFrameSize(100, 10, 'female').frameSize).toBe('large'); // r = 10.0
  });

  it('returns medium with method none on missing data', () => {
    const result = computeFrameSize(0, 17, 'male');
    expect(result.frameSize).toBe('medium');
    expect(result.method).toBe('none');
  });

  it('ankle only nudges one step when it strongly disagrees', () => {
    // Small wrist read + very thick ankle (ratio ≥ 1.45) → nudged to medium
    const nudged = computeFrameSize(178, 16.5, 'male', 24);
    expect(nudged.frameSize).toBe('medium');
    expect(nudged.method).toBe('wrist+ankle-nudge');
    // Ordinary ankle (~1.27× wrist) → wrist read stands
    const plain = computeFrameSize(178, 16.5, 'male', 21);
    expect(plain.frameSize).toBe('small');
    expect(plain.method).toBe('wrist');
  });
});

// ─── computeCategoryLevel ───

describe('computeCategoryLevel', () => {
  it('buckets by frame-adjusted bodyweight ratio (male push)', () => {
    // Medium frame, thresholds 0.75 / 1.25
    expect(computeCategoryLevel(50, 70, 'medium', 'push', 'male').level).toBe('beginner'); // 0.71
    expect(computeCategoryLevel(70, 70, 'medium', 'push', 'male').level).toBe('intermediate'); // 1.0
    expect(computeCategoryLevel(90, 70, 'medium', 'push', 'male').level).toBe('advanced'); // 1.29
  });

  it('REGRESSION PIN: small frame raises the bar, large frame lowers it', () => {
    expect(FRAME_ADJUSTMENT.small).toBeGreaterThan(1);
    expect(FRAME_ADJUSTMENT.large).toBeLessThan(1);
    // Ratio 1.29 is advanced on a medium frame but only intermediate on a
    // small frame (threshold raised to 1.25 × 1.07 ≈ 1.34)
    expect(computeCategoryLevel(90, 70, 'small', 'push', 'male').level).toBe('intermediate');
    // Ratio 1.21 is intermediate on medium but advanced on large (1.25 × 0.93 ≈ 1.16)
    expect(computeCategoryLevel(85, 70, 'large', 'push', 'male').level).toBe('advanced');
  });

  it('falls back to beginner on invalid inputs', () => {
    expect(computeCategoryLevel(0, 70, 'medium', 'push', 'male').level).toBe('beginner');
    expect(computeCategoryLevel(80, 0, 'medium', 'push', 'male').level).toBe('beginner');
  });
});

// ─── resolveLevel ───

describe('resolveLevel', () => {
  const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
    experienceLevelManual: 'intermediate',
    useComputedLevel: false,
    updatedAt: '2026-08-08T00:00:00Z',
    ...overrides,
  });

  const computed: ComputedLevelResult = {
    frame: { frameSize: 'small', method: 'wrist' },
    perCategory: [
      {
        category: 'push',
        level: 'advanced',
        adjustedThresholds: { beginnerMax: 0.8, intermediateMax: 1.34 },
      },
    ],
  };

  it('defaults to beginner without a profile', () => {
    expect(resolveLevel(null, computed, 'push')).toBe('beginner');
  });

  it('manual choice wins when useComputedLevel is false', () => {
    expect(resolveLevel(profile(), computed, 'push')).toBe('intermediate');
  });

  it('computed level wins when opted in and data exists', () => {
    expect(resolveLevel(profile({ useComputedLevel: true }), computed, 'push')).toBe('advanced');
  });

  it('falls back to manual for categories without computed data', () => {
    expect(resolveLevel(profile({ useComputedLevel: true }), computed, 'legs')).toBe('intermediate');
  });
});

// ─── decideAction ───

describe('decideAction', () => {
  // Rep range 8-12: 12 = at ceiling, 8 = mid-range not reached
  it('holds when RIR is trending down', () => {
    expect(decideAction('beginner', 'hypertrophy', 'falling', 2, 1, 2, 12, 8, 12)).toBe('hold');
  });

  it('holds when recent RIR is far below target', () => {
    expect(decideAction('beginner', 'hypertrophy', 'stable', 0.3, 1, 2, 12, 8, 12)).toBe('hold');
  });

  it('gates intermediate/advanced on RIR in range, but not beginner', () => {
    // avgRecentRir 0.7 < targetRirMin 1 (but not < 0.5 below)
    expect(decideAction('intermediate', 'hypertrophy', 'stable', 0.7, 1, 2, 12, 8, 12)).toBe('hold');
    expect(decideAction('advanced', 'hypertrophy', 'stable', 0.7, 1, 2, 12, 8, 12)).toBe('hold');
    expect(decideAction('beginner', 'hypertrophy', 'stable', 0.7, 1, 2, 12, 8, 12)).toBe('add-weight');
  });

  it('takes an aggressive step when RIR is rising and above target', () => {
    expect(decideAction('intermediate', 'hypertrophy', 'rising', 3, 1, 2, 8, 8, 12)).toBe('add-weight-aggressive');
  });

  it('adds weight at the top of the rep range, reps otherwise (hypertrophy)', () => {
    expect(decideAction('intermediate', 'hypertrophy', 'stable', 1.5, 1, 2, 12, 8, 12)).toBe('add-weight');
    expect(decideAction('intermediate', 'hypertrophy', 'stable', 1.5, 1, 2, 8, 8, 12)).toBe('add-reps');
  });

  it('strength focus adds weight at mid-range on COMPOUNDS where hypertrophy adds reps', () => {
    // Range 8-12 → midpoint 10 (isCompound = true)
    expect(decideAction('intermediate', 'strength', 'stable', 1.5, 1, 2, 10, 8, 12, true)).toBe('add-weight');
    expect(decideAction('intermediate', 'hypertrophy', 'stable', 1.5, 1, 2, 10, 8, 12, true)).toBe('add-reps');
    // Below the midpoint even strength keeps adding reps
    expect(decideAction('intermediate', 'strength', 'stable', 1.5, 1, 2, 9, 8, 12, true)).toBe('add-reps');
    // Isolation never gets weight-priority, even under strength focus
    expect(decideAction('intermediate', 'strength', 'stable', 1.5, 1, 2, 10, 8, 12, false)).toBe('add-reps');
  });

  it('maintenance focus never adds weight — holds, or adds a rep only when RIR is high and rising', () => {
    // At the ceiling with RIR in range → still HOLD
    expect(decideAction('intermediate', 'maintenance', 'stable', 1.5, 1, 2, 12, 8, 12)).toBe('hold');
    // RIR rising well above target → the stimulus decayed → one rep, never weight
    expect(decideAction('intermediate', 'maintenance', 'rising', 3, 1, 2, 12, 8, 12)).toBe('add-reps');
    // Fatigue gates still apply
    expect(decideAction('intermediate', 'maintenance', 'falling', 2, 1, 2, 12, 8, 12)).toBe('hold');
  });
});

// ─── Frequency detection & scaling ───

describe('estimateExerciseFrequency', () => {
  const NOW = new Date('2026-08-08T12:00:00Z').getTime();

  const sessionOn = (daysAgo: number, templateId = 'incline-machine-press'): WorkoutSession => ({
    id: `ws-${daysAgo}`,
    date: new Date(NOW - daysAgo * 86400000).toISOString(),
    dayType: 'push',
    exercises: [{ templateId, exerciseName: 'X', sets: [] }],
    completed: true,
  });

  it('returns the neutral default of 1 with fewer than 2 occurrences', () => {
    expect(estimateExerciseFrequency('incline-machine-press', [], NOW)).toBe(1);
    expect(estimateExerciseFrequency('incline-machine-press', [sessionOn(3)], NOW)).toBe(1);
  });

  it('detects ~1×/week and ~2×/week from history', () => {
    const onceWeekly = [sessionOn(2), sessionOn(9), sessionOn(16)];
    expect(estimateExerciseFrequency('incline-machine-press', onceWeekly, NOW)).toBe(1);

    const twiceWeekly = [sessionOn(1), sessionOn(4), sessionOn(8), sessionOn(11), sessionOn(15), sessionOn(18)];
    expect(estimateExerciseFrequency('incline-machine-press', twiceWeekly, NOW)).toBe(2);
  });

  it('ignores sessions outside the 21-day window, incomplete sessions and other exercises', () => {
    const sessions = [
      sessionOn(2),
      sessionOn(30), // outside window
      { ...sessionOn(5), completed: false }, // incomplete
      sessionOn(6, 'flat-machine-press'), // different exercise
    ];
    // Only 1 valid occurrence → default
    expect(estimateExerciseFrequency('incline-machine-press', sessions, NOW)).toBe(1);
  });
});

describe('frequencyStepScale', () => {
  it('keeps weekly progression constant: freq 1 → ×1, freq 2 → ×0.5', () => {
    expect(frequencyStepScale(1)).toBe(1);
    expect(frequencyStepScale(2)).toBe(0.5);
  });

  it('caps the boost for sporadic training and the cut for very high frequency', () => {
    expect(frequencyStepScale(0.5)).toBe(1.5); // capped, not ×2
    expect(frequencyStepScale(4)).toBe(0.5); // capped, not ×0.25
    expect(frequencyStepScale(0)).toBe(1); // guard
  });
});

// ─── suggestNextSessionSets ───

describe('suggestNextSessionSets', () => {
  it('falls back to template defaults with no history', () => {
    const result = suggestNextSessionSets({
      template: template({ hasWarmupSets: true, warmupSets: 2 }),
      lastSets: [],
      level: 'intermediate',
      rirTrend: 'stable',
      avgRecentRir: 0,
    });
    expect(result.basis).toBe('no-history');
    expect(result.targets).toHaveLength(5); // 3 work + 2 warm-up
    expect(result.targets[0].isWarmup).toBe(true);
    expect(result.targets[2].weightKg).toBe(0);
    expect(result.targets[2].reps).toBe(8);
  });

  it('HOLD repeats last session exactly', () => {
    const result = suggestNextSessionSets({
      template: template(),
      lastSets: lastSessionSets(),
      level: 'intermediate',
      rirTrend: 'falling',
      avgRecentRir: 1.7,
    });
    expect(result.action).toBe('hold');
    expect(result.targets.map((t) => t.weightKg)).toEqual([50, 47.5, 45]);
    expect(result.targets.map((t) => t.reps)).toEqual([8, 8, 7]);
  });

  it('ADD_REPS keeps weight, adds one rep, preserves set shape', () => {
    const result = suggestNextSessionSets({
      template: template(),
      lastSets: lastSessionSets(),
      level: 'intermediate',
      rirTrend: 'stable',
      avgRecentRir: 1.7,
    });
    expect(result.action).toBe('add-reps');
    expect(result.targets.map((t) => t.weightKg)).toEqual([50, 47.5, 45]); // ratios 1 / 0.95 / 0.90
    expect(result.targets.map((t) => t.reps)).toEqual([9, 9, 8]); // +1 with deltas 0 / 0 / −1
  });

  it('ADD_WEIGHT at rep ceiling: weight up, reps back to range minimum', () => {
    const topped = [
      workSet({ setNumber: 1, weightKg: 50, reps: 12, rir: 2 }),
      workSet({ setNumber: 2, weightKg: 47.5, reps: 12, rir: 2 }),
    ];
    const result = suggestNextSessionSets({
      template: template(),
      lastSets: topped,
      level: 'intermediate',
      rirTrend: 'stable',
      avgRecentRir: 2,
    });
    expect(result.action).toBe('add-weight');
    // 50 × 1.02 = 51 → rounds to 51.25 (guaranteed ≥ one plate increment)
    expect(result.targets[0].weightKg).toBe(51.25);
    expect(result.targets[0].reps).toBe(8);
    // Set 2 keeps its 0.95 ratio: 51.25 × 0.95 = 48.69 → 48.75
    expect(result.targets[1].weightKg).toBe(48.75);
  });

  it('ADD_WEIGHT_AGGRESSIVE doubles the step on compounds when RIR is consistently high', () => {
    const result = suggestNextSessionSets({
      template: template({ isCompound: true }),
      lastSets: [workSet({ weightKg: 100, reps: 10, rir: 4 })],
      level: 'intermediate',
      rirTrend: 'rising',
      avgRecentRir: 4,
    });
    expect(result.action).toBe('add-weight-aggressive');
    // 100 × 1.04 = 104 → 104/1.25 = 83.2 → 83 × 1.25 = 103.75
    expect(result.targets[0].weightKg).toBe(103.75);
    expect(result.targets[0].reps).toBe(10); // keeps reps (≥ range min)
  });

  it('level aggressiveness: beginner takes bigger weight steps than advanced', () => {
    const topped = [workSet({ weightKg: 200, reps: 12, rir: 2 })];
    const beginner = suggestNextSessionSets({
      template: template(),
      lastSets: topped,
      level: 'beginner',
      rirTrend: 'stable',
      avgRecentRir: 2,
    });
    const advanced = suggestNextSessionSets({
      template: template(),
      lastSets: topped,
      level: 'advanced',
      rirTrend: 'stable',
      avgRecentRir: 2,
    });
    expect(AGGRESSIVENESS.beginner.weightStepPct).toBeGreaterThan(AGGRESSIVENESS.advanced.weightStepPct);
    expect(beginner.targets[0].weightKg).toBeGreaterThan(advanced.targets[0].weightKg);
  });

  it('scales warmups proportionally to the new working weight', () => {
    const sets = [
      workSet({ setNumber: 1, isWarmup: true, weightKg: 20, reps: 12, rir: 5 }),
      workSet({ setNumber: 2, isWarmup: true, weightKg: 35, reps: 8, rir: 4 }),
      workSet({ setNumber: 3, weightKg: 50, reps: 12, rir: 2 }),
    ];
    const result = suggestNextSessionSets({
      template: template({ hasWarmupSets: true, warmupSets: 2 }),
      lastSets: sets,
      level: 'intermediate',
      rirTrend: 'stable',
      avgRecentRir: 2,
    });
    expect(result.action).toBe('add-weight');
    const newWork = result.targets[2].weightKg; // 51.25
    // Warmups keep their 40% / 70% ratios, plate-rounded
    expect(result.targets[0].weightKg).toBe(roundToPlate(newWork * (20 / 50)));
    expect(result.targets[1].weightKg).toBe(roundToPlate(newWork * (35 / 50)));
    expect(result.targets[0].isWarmup).toBe(true);
  });

  it('never suggests fractional weights off the plate increment', () => {
    const result = suggestNextSessionSets({
      template: template(),
      lastSets: [workSet({ weightKg: 43.7, reps: 12, rir: 2 })],
      level: 'intermediate',
      rirTrend: 'stable',
      avgRecentRir: 2,
    });
    for (const t of result.targets) {
      const remainder = Math.round((t.weightKg % PLATE_INCREMENT_KG) * 1000) / 1000;
      expect(remainder === 0 || remainder === PLATE_INCREMENT_KG).toBe(true);
    }
  });

  it('frequency 2 halves the weight step vs frequency 1 (weekly progression constant)', () => {
    const topped = [workSet({ weightKg: 200, reps: 12, rir: 2 })];
    const base = { template: template(), lastSets: topped, level: 'intermediate' as const, rirTrend: 'stable' as const, avgRecentRir: 2 };
    const freq1 = suggestNextSessionSets({ ...base, frequency: 1 });
    const freq2 = suggestNextSessionSets({ ...base, frequency: 2 });
    // 200 × 1.02 = 204 → 203.75 ; 200 × 1.01 = 202 → 202.5
    expect(freq1.targets[0].weightKg).toBe(203.75);
    expect(freq2.targets[0].weightKg).toBe(202.5);
    expect(freq2.targets[0].weightKg - 200).toBeLessThan(freq1.targets[0].weightKg - 200);
  });

  it('defaults (no focus/frequency) behave exactly like hypertrophy at frequency 1', () => {
    const topped = [workSet({ weightKg: 200, reps: 12, rir: 2 })];
    const implicit = suggestNextSessionSets({
      template: template(), lastSets: topped, level: 'intermediate', rirTrend: 'stable', avgRecentRir: 2,
    });
    const explicit = suggestNextSessionSets({
      template: template(), lastSets: topped, level: 'intermediate', rirTrend: 'stable', avgRecentRir: 2,
      focus: 'hypertrophy', frequency: 1,
    });
    expect(implicit.targets).toEqual(explicit.targets);
    expect(implicit.action).toBe(explicit.action);
  });

  it('maintenance focus holds the load even at the rep ceiling', () => {
    const topped = [workSet({ weightKg: 50, reps: 12, rir: 2 })];
    const result = suggestNextSessionSets({
      template: template(), lastSets: topped, level: 'intermediate', rirTrend: 'stable', avgRecentRir: 2,
      focus: 'maintenance',
    });
    expect(result.action).toBe('hold');
    expect(result.targets[0].weightKg).toBe(50);
    expect(result.targets[0].reps).toBe(12);
  });

  it('strength focus moves weight up at mid-range on compounds without a strength range', () => {
    // Compound with no strengthReps defined → weight-priority applies on the hypertrophy range
    const midRange = [workSet({ weightKg: 50, reps: 10, rir: 2 })]; // range 8-12, midpoint 10
    const strength = suggestNextSessionSets({
      template: template({ isCompound: true }), lastSets: midRange, level: 'intermediate', rirTrend: 'stable', avgRecentRir: 2,
      focus: 'strength',
    });
    const hypertrophy = suggestNextSessionSets({
      template: template({ isCompound: true }), lastSets: midRange, level: 'intermediate', rirTrend: 'stable', avgRecentRir: 2,
      focus: 'hypertrophy',
    });
    expect(strength.action).toBe('add-weight');
    expect(strength.targets[0].reps).toBe(8); // back to range minimum
    expect(hypertrophy.action).toBe('add-reps');
  });

  // ─── Exercise-type-aware behavior (compound vs isolation) ───

  const compoundTemplate = (over: Partial<ExerciseTemplate> = {}): ExerciseTemplate =>
    template({ isCompound: true, strengthRepsMin: 3, strengthRepsMax: 6, weightIncrementKg: 2.5, ...over });
  const isolationTemplate = (over: Partial<ExerciseTemplate> = {}): ExerciseTemplate =>
    template({ isCompound: false, targetRepsMin: 10, targetRepsMax: 15, weightIncrementKg: 2.0, ...over });

  it('strength focus on a compound uses the strength rep range', () => {
    // Last performance already inside 3-6: 100×5, RIR in range → midpoint of 3-6 is 5 → add-weight
    const result = suggestNextSessionSets({
      template: compoundTemplate(),
      lastSets: [workSet({ weightKg: 100, reps: 5, rir: 2 })],
      level: 'intermediate', rirTrend: 'stable', avgRecentRir: 2, focus: 'strength',
    });
    expect(result.action).toBe('add-weight');
    expect(result.targets[0].reps).toBe(3); // back to strength range minimum
  });

  it('range switch: strength focus after hypertrophy work recalculates from e1RM', () => {
    // Last session 50×10 (way above the 3-6 strength range) → e1RM-based reload
    const result = suggestNextSessionSets({
      template: compoundTemplate(),
      lastSets: [workSet({ weightKg: 50, reps: 10, rir: 2 })],
      level: 'intermediate', rirTrend: 'stable', avgRecentRir: 2, focus: 'strength',
    });
    // e1RM ≈ 66.7; target 5 reps @ RIR 1.5 → 66.7/(1+6.5/30) ≈ 54.8 → 55 with 2.5 increment
    expect(result.targets[0].weightKg).toBe(55);
    expect(result.targets[0].reps).toBe(5);
    expect(result.rationale).toContain('recalculated');
  });

  it('fatigue gates override the range switch (falling RIR far outside range → HOLD)', () => {
    // Overshoot to 15 reps on a 6-12 range, but RIR is trending down → HOLD, no e1RM reload
    const result = suggestNextSessionSets({
      template: compoundTemplate({ targetRepsMin: 6, targetRepsMax: 12 }),
      lastSets: [workSet({ weightKg: 50, reps: 15, rir: 1 })],
      level: 'intermediate', rirTrend: 'falling', avgRecentRir: 1, focus: 'hypertrophy',
    });
    expect(result.action).toBe('hold');
    expect(result.targets[0].weightKg).toBe(50);
    expect(result.targets[0].reps).toBe(15);
  });

  it('downward range switch (strength→hypertrophy) also reloads from e1RM', () => {
    // Last block: 80×4 heavy work; now hypertrophy range 8-12 → e1RM-based lighter reload
    const result = suggestNextSessionSets({
      template: template({ isCompound: true, weightIncrementKg: 2.5 }), // range 8-12
      lastSets: [workSet({ weightKg: 80, reps: 4, rir: 2 })],
      level: 'intermediate', rirTrend: 'stable', avgRecentRir: 2, focus: 'hypertrophy',
    });
    // e1RM (Brzycki @4 reps) ≈ 87.3; target 10 reps @ RIR 1.5 → 87.3/(1+11.5/30) ≈ 63.1 → 62.5
    expect(result.rationale).toContain('recalculated');
    expect(result.targets[0].reps).toBe(10);
    expect(result.targets[0].weightKg).toBeLessThan(80);
    expect(result.targets[0].weightKg).toBe(62.5);
  });

  it('strength focus does NOT heavy-load isolation exercises', () => {
    // Isolation at 12 reps (mid of 10-15), RIR fine → stays double progression (add-reps)
    const result = suggestNextSessionSets({
      template: isolationTemplate(),
      lastSets: [workSet({ weightKg: 20, reps: 12, rir: 2 })],
      level: 'intermediate', rirTrend: 'stable', avgRecentRir: 2, focus: 'strength',
    });
    expect(result.action).toBe('add-reps');
    expect(result.targets[0].reps).toBe(13);
    expect(result.targets[0].weightKg).toBe(20);
  });

  it('uses the per-exercise weight increment (light dumbbell steps by 2.0)', () => {
    // 10 kg isolation at the 15-rep ceiling → add-weight → 10×1.02=10.2 rounds to 10 → forced +2.0 = 12
    const result = suggestNextSessionSets({
      template: isolationTemplate(),
      lastSets: [workSet({ weightKg: 10, reps: 15, rir: 2 })],
      level: 'intermediate', rirTrend: 'stable', avgRecentRir: 2,
    });
    expect(result.action).toBe('add-weight');
    expect(result.targets[0].weightKg).toBe(12);
  });

  it('aggressive double step applies to compounds only', () => {
    const high = { level: 'intermediate' as const, rirTrend: 'rising' as const, avgRecentRir: 4 };
    const compound = suggestNextSessionSets({
      template: compoundTemplate({ targetRepsMin: 6, targetRepsMax: 12 }),
      lastSets: [workSet({ weightKg: 100, reps: 8, rir: 4 })], ...high,
    });
    const isolation = suggestNextSessionSets({
      template: isolationTemplate(),
      lastSets: [workSet({ weightKg: 100, reps: 12, rir: 4 })], ...high,
    });
    expect(compound.action).toBe('add-weight-aggressive');
    expect(isolation.action).toBe('add-weight-aggressive');
    // Compound: 100×1.04=104 → 105 (2.5 inc). Isolation: single step 100×1.02=102 → 102 (2.0 inc)
    expect(compound.targets[0].weightKg).toBe(105);
    expect(isolation.targets[0].weightKg).toBe(102);
  });

  it('ignores skipped and incomplete sets when reading history', () => {
    const sets = [
      workSet({ setNumber: 1, weightKg: 50, reps: 8, rir: 2 }),
      workSet({ setNumber: 2, weightKg: 0, reps: 0, skipped: true }),
      workSet({ setNumber: 3, weightKg: 47.5, reps: 8, rir: 2, completed: false }),
    ];
    const result = suggestNextSessionSets({
      template: template(),
      lastSets: sets,
      level: 'intermediate',
      rirTrend: 'stable',
      avgRecentRir: 2,
    });
    expect(result.basis).toBe('computed');
    expect(result.targets).toHaveLength(1); // only the one valid work set
  });
});

// ─── Bodyweight exercises (regression: they used to have no history at all) ───

describe('suggestNextSessionSets — bodyweight exercises', () => {
  const pullUps = template({
    id: 'pronated-pull-ups',
    name: 'Pull-ups',
    category: 'pull',
    isCompound: true,
    targetRepsMin: 6,
    targetRepsMax: 10,
  });

  /** Real shape from the 5-aug session: 10/8/7/5 reps at bodyweight */
  const bodyweightHistory = (): WorkoutSet[] => [
    workSet({ setNumber: 1, weightKg: 0, reps: 10, rir: 2 }),
    workSet({ setNumber: 2, weightKg: 0, reps: 8, rir: 2 }),
    workSet({ setNumber: 3, weightKg: 0, reps: 7, rir: 2 }),
  ];

  it('uses the history instead of reporting "no previous data"', () => {
    // The old `weightKg > 0` filter emptied workSets for every bodyweight
    // exercise, so however many sessions were logged the answer was always
    // basis 'no-history' with template defaults.
    const result = suggestNextSessionSets({
      template: pullUps,
      lastSets: bodyweightHistory(),
      level: 'intermediate',
      rirTrend: 'stable',
      avgRecentRir: 2,
    });

    expect(result.basis).toBe('computed');
    expect(result.targets).toHaveLength(3);
  });

  it('progresses by reps and never invents a weight', () => {
    const result = suggestNextSessionSets({
      template: pullUps,
      lastSets: bodyweightHistory(),
      level: 'intermediate',
      rirTrend: 'stable',
      avgRecentRir: 2,
    });

    expect(result.targets.every((t) => t.weightKg === 0)).toBe(true);
    expect(result.targets.every((t) => Number.isFinite(t.reps) && t.reps > 0)).toBe(true);
    // Per-set rep shape is preserved relative to set 1 (10/8/7 → deltas 0/−2/−3)
    const [a, b, c] = result.targets.map((t) => t.reps);
    expect(b).toBe(a - 2);
    expect(c).toBe(a - 3);
  });

  it('never produces NaN, whatever the rep count', () => {
    for (const reps of [1, 5, 10, 20, 40]) {
      const result = suggestNextSessionSets({
        template: pullUps,
        lastSets: [workSet({ weightKg: 0, reps, rir: 0 })],
        level: 'beginner',
        rirTrend: 'falling',
        avgRecentRir: 0,
      });
      for (const t of result.targets) {
        expect(Number.isNaN(t.weightKg)).toBe(false);
        expect(Number.isNaN(t.reps)).toBe(false);
        expect(Number.isNaN(t.rir)).toBe(false);
      }
    }
  });
});

// ─── Skipped warm-ups must not seed the next session ───

describe('suggestNextSessionSets — skipped warm-ups', () => {
  it('ignores a skipped warm-up instead of proposing it at 0 kg', () => {
    // Real case: seated-leg-curl on 13-aug had its warm-up skipped, which left
    // weightKg 0 and produced a 0 kg warm-up target for the next session.
    const result = suggestNextSessionSets({
      template: template({ hasWarmupSets: true, warmupSets: 1 }),
      lastSets: [
        workSet({ setNumber: 1, isWarmup: true, skipped: true, weightKg: 0, reps: 0 }),
        ...lastSessionSets().map((s, i) => ({ ...s, setNumber: i + 2 })),
      ],
      level: 'intermediate',
      rirTrend: 'stable',
      avgRecentRir: 2,
    });

    expect(result.targets.filter((t) => t.isWarmup)).toEqual([]);
    expect(result.targets.every((t) => t.weightKg > 0)).toBe(true);
  });
});

// ─── Mixed 0 kg / loaded history (regression: all targets collapsed to 0 kg) ───

describe('suggestNextSessionSets — a stray 0 kg set among loaded ones', () => {
  it('does not drag the whole exercise to 0 kg', () => {
    // Real case: t-bar-row on 12-aug was logged as 0×15, 10×12, 15×10, 15×9,
    // 15×7, 15×7 (the first two were ramp-ups the warm-up bug left unflagged).
    // Treating set 1 as the reference made every weight ratio 0.
    const result = suggestNextSessionSets({
      template: template({ id: 't-bar-row', targetRepsMin: 8, targetRepsMax: 12 }),
      lastSets: [
        workSet({ setNumber: 1, weightKg: 0, reps: 15, rir: 6 }),
        workSet({ setNumber: 2, weightKg: 10, reps: 12, rir: 3 }),
        workSet({ setNumber: 3, weightKg: 15, reps: 10, rir: 2 }),
        workSet({ setNumber: 4, weightKg: 15, reps: 9, rir: 1.5 }),
      ],
      level: 'intermediate',
      rirTrend: 'stable',
      avgRecentRir: 2,
    });

    expect(result.basis).toBe('computed');
    expect(result.targets.every((t) => t.weightKg > 0)).toBe(true);
    // The 0 kg set is ignored, so the reference is the 10 kg one and the
    // heaviest target tracks the 15 kg sets.
    expect(Math.max(...result.targets.map((t) => t.weightKg))).toBeGreaterThanOrEqual(15);
  });

  it('still treats a fully unloaded exercise as bodyweight', () => {
    const result = suggestNextSessionSets({
      template: template({ id: 'pronated-pull-ups', targetRepsMin: 6, targetRepsMax: 10 }),
      lastSets: [
        workSet({ setNumber: 1, weightKg: 0, reps: 10 }),
        workSet({ setNumber: 2, weightKg: 0, reps: 8 }),
      ],
      level: 'intermediate',
      rirTrend: 'stable',
      avgRecentRir: 2,
    });

    expect(result.basis).toBe('computed');
    expect(result.targets.every((t) => t.weightKg === 0)).toBe(true);
  });
});

// ─── Bodyweight at the top of the rep range ───

describe('suggestNextSessionSets — bodyweight at the rep ceiling', () => {
  it('keeps adding reps past repsMax instead of freezing', () => {
    // Real case: pull-ups at 10 reps with a 6-10 template. Clamping at repsMax
    // returned the exact same targets session after session while claiming to
    // progress — and there is no weight to add without a belt.
    const pullUps = template({ id: 'pronated-pull-ups', targetRepsMin: 6, targetRepsMax: 10, isCompound: true });
    const result = suggestNextSessionSets({
      template: pullUps,
      lastSets: [workSet({ setNumber: 1, weightKg: 0, reps: 10, rir: 2 })],
      level: 'intermediate',
      rirTrend: 'stable',
      avgRecentRir: 2,
    });

    expect(result.targets[0].reps).toBeGreaterThan(10);
    expect(result.targets.every((t) => t.weightKg === 0)).toBe(true);
  });

  it('still clamps at repsMax when there is weight to add', () => {
    const result = suggestNextSessionSets({
      template: template({ targetRepsMin: 8, targetRepsMax: 12 }),
      lastSets: [workSet({ setNumber: 1, weightKg: 50, reps: 12, rir: 3 })],
      level: 'intermediate',
      rirTrend: 'stable',
      avgRecentRir: 3,
    });

    expect(result.targets.every((t) => t.reps <= 12)).toBe(true);
  });
});
