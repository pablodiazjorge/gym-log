// ─── Progression algorithm core ───
//
// Pure, framework-free functions: 1RM estimation, frame-size classification,
// experience-level classification and next-session target suggestion.
// Kept free of Angular DI on purpose so it is trivially unit-testable.
//
// Honesty note: the formulas below (Epley/Brzycki, Metropolitan r-value,
// bodyweight-ratio strength standards, frame adjustment) are reasonable,
// widely-used heuristics — not exact science. Every output of this module is
// advisory and always user-editable (ADR-0007).

import {
  CategoryLevelAssessment,
  ComputedLevelResult,
  ExperienceLevel,
  FrameAssessment,
  FrameSize,
  MovementCategory,
  Sex,
  UserProfile,
} from '../models/profile.model';
import { ProgressionAction, SetTarget } from '../models/progression.model';
import { ExerciseTemplate, WorkoutSet } from '../models/workout.model';

// ─── Tunable constants ───

/** Global rounding increment for suggested weights (smallest common plate/machine step) */
export const PLATE_INCREMENT_KG = 1.25;

/**
 * Progression aggressiveness per experience level.
 * - weightStepPct: relative weight increase when moving up in weight
 * - requireRirInRange: gate progression on recent RIR being within the target range
 *   (beginners progress by default; the novice adaptation absorbs it)
 */
export const AGGRESSIVENESS: Record<
  ExperienceLevel,
  { repsStep: number; weightStepPct: number; requireRirInRange: boolean }
> = {
  beginner: { repsStep: 1, weightStepPct: 0.025, requireRirInRange: false },
  intermediate: { repsStep: 1, weightStepPct: 0.02, requireRirInRange: true },
  advanced: { repsStep: 1, weightStepPct: 0.0125, requireRirInRange: true },
};

/**
 * Bodyweight-ratio strength-standard thresholds per category and sex
 * (estimated 1RM / bodyweight). Rough published landmarks for free-weight
 * compound reference lifts; below beginnerMax = beginner, below
 * intermediateMax = intermediate, otherwise advanced.
 */
export const BASE_STANDARDS: Record<
  MovementCategory,
  Record<Sex, { beginnerMax: number; intermediateMax: number }>
> = {
  push: {
    male: { beginnerMax: 0.75, intermediateMax: 1.25 },
    female: { beginnerMax: 0.5, intermediateMax: 0.85 },
  },
  pull: {
    male: { beginnerMax: 0.75, intermediateMax: 1.15 },
    female: { beginnerMax: 0.5, intermediateMax: 0.8 },
  },
  legs: {
    male: { beginnerMax: 1.0, intermediateMax: 1.75 },
    female: { beginnerMax: 0.75, intermediateMax: 1.35 },
  },
};

/**
 * Frame-size multiplier applied to the strength-standard thresholds.
 * Direction: a small frame RAISES the bar (its lighter skeleton deflates the
 * ratio denominator for reasons unrelated to trained strength), a large frame
 * LOWERS it. Reasoned heuristic, not a cited study result — pinned by a
 * regression test so a refactor can't silently flip it.
 */
export const FRAME_ADJUSTMENT: Record<FrameSize, number> = {
  small: 1.07,
  medium: 1.0,
  large: 0.93,
};

/** RIR → %1RM lookup (linear-interpolated). Documented for consistency; soft estimate. */
const RIR_PERCENT_TABLE: [number, number][] = [
  [0, 1.0],
  [1, 0.97],
  [2, 0.94],
  [3, 0.91],
  [4, 0.88],
  [5, 0.85],
];

// ─── 1RM estimation ───

/**
 * Estimated 1RM blending Epley (better ≥ ~7-10 reps) and Brzycki (better ≤ 6 reps),
 * linearly cross-faded between 6 and 10 reps. Degrades gracefully at high rep
 * counts; treat anything estimated from 12+ reps as a soft guess.
 */
export function estimate1Rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  const epley = weightKg * (1 + reps / 30);
  const brzycki = reps < 37 ? (weightKg * 36) / (37 - reps) : epley;
  // Brzycki weight: 1 at ≤6 reps, 0 at ≥10 reps, linear in between
  const brzyckiWeight = reps <= 6 ? 1 : reps >= 10 ? 0 : (10 - reps) / 4;
  return round1(brzyckiWeight * brzycki + (1 - brzyckiWeight) * epley);
}

/** %1RM corresponding to a given RIR (clamped to [0, 5], linear interpolation) */
export function rirToPercent1Rm(rir: number): number {
  const clamped = Math.min(5, Math.max(0, rir));
  const lower = Math.floor(clamped);
  const upper = Math.ceil(clamped);
  const [, lowPct] = RIR_PERCENT_TABLE[lower];
  const [, highPct] = RIR_PERCENT_TABLE[upper];
  if (lower === upper) return lowPct;
  return lowPct + (highPct - lowPct) * (clamped - lower);
}

// ─── Frame size (bone structure) ───

/**
 * Metropolitan Life r-value method: r = height(cm) / wrist circumference(cm).
 * Men:   r > 10.4 → small, 9.6–10.4 → medium, < 9.6 → large.
 * Women: r > 11.0 → small, 10.1–11.0 → medium, < 10.1 → large.
 *
 * Ankle circumference (optional) is a soft secondary nudge only — there is no
 * validated published ankle-only threshold table, so it can shift the wrist
 * classification by at most one step when it strongly disagrees.
 */
export function computeFrameSize(
  heightCm: number,
  wristCm: number,
  sex: Sex,
  ankleCm?: number,
): FrameAssessment {
  if (heightCm <= 0 || wristCm <= 0) {
    return { frameSize: 'medium', method: 'none' };
  }
  const r = heightCm / wristCm;
  const thresholds = sex === 'male' ? { small: 10.4, large: 9.6 } : { small: 11.0, large: 10.1 };
  let frameSize: FrameSize = r > thresholds.small ? 'small' : r >= thresholds.large ? 'medium' : 'large';
  let method: FrameAssessment['method'] = 'wrist';

  if (ankleCm && ankleCm > 0) {
    // Rough ankle heuristic: ankle is typically ~1.25-1.30× wrist circumference.
    // Only nudge one step when the ankle strongly disagrees with the wrist read.
    const ankleWristRatio = ankleCm / wristCm;
    if (ankleWristRatio >= 1.45 && frameSize === 'small') {
      frameSize = 'medium';
      method = 'wrist+ankle-nudge';
    } else if (ankleWristRatio <= 1.1 && frameSize === 'large') {
      frameSize = 'medium';
      method = 'wrist+ankle-nudge';
    }
  }

  return { frameSize, wristHeightRatio: round2(r), method };
}

// ─── Experience-level classification ───

/** Classify one movement category from an estimated 1RM and bodyweight, frame-adjusted */
export function computeCategoryLevel(
  e1RmKg: number,
  bodyWeightKg: number,
  frameSize: FrameSize,
  category: MovementCategory,
  sex: Sex,
): CategoryLevelAssessment {
  const base = BASE_STANDARDS[category][sex];
  const factor = FRAME_ADJUSTMENT[frameSize];
  const adjustedThresholds = {
    beginnerMax: round2(base.beginnerMax * factor),
    intermediateMax: round2(base.intermediateMax * factor),
  };

  if (e1RmKg <= 0 || bodyWeightKg <= 0) {
    return { category, adjustedThresholds, level: 'beginner' };
  }

  const ratio = e1RmKg / bodyWeightKg;
  const level: ExperienceLevel =
    ratio < adjustedThresholds.beginnerMax
      ? 'beginner'
      : ratio < adjustedThresholds.intermediateMax
        ? 'intermediate'
        : 'advanced';

  return {
    category,
    estimated1RmKg: round1(e1RmKg),
    bodyweightRatio: round2(ratio),
    adjustedThresholds,
    level,
  };
}

/**
 * Resolve the effective level for a category: the manual choice always wins
 * unless the user opted into the computed level AND that category has data.
 */
export function resolveLevel(
  profile: UserProfile | null,
  computedResult: ComputedLevelResult | null,
  category: MovementCategory,
): ExperienceLevel {
  if (!profile) return 'beginner';
  if (profile.useComputedLevel && computedResult) {
    const match = computedResult.perCategory.find((c) => c.category === category);
    if (match) return match.level;
  }
  return profile.experienceLevelManual;
}

// ─── Next-session suggestion ───

export type RirTrend = 'rising' | 'falling' | 'stable';

export interface SuggestionInput {
  template: ExerciseTemplate;
  /** All sets (warmups included) of the exercise's last completed session; empty = no history */
  lastSets: WorkoutSet[];
  level: ExperienceLevel;
  rirTrend: RirTrend;
  /** Average RIR over the last session's completed work sets */
  avgRecentRir: number;
}

export interface SuggestionResult {
  basis: 'computed' | 'no-history';
  action?: ProgressionAction;
  targets: SetTarget[];
  rationale: string;
}

/** Round a weight to the nearest plate increment */
export function roundToPlate(weightKg: number): number {
  return Math.max(0, Math.round(weightKg / PLATE_INCREMENT_KG) * PLATE_INCREMENT_KG);
}

/** Decide the progression action from level, RIR trend and rep-range position */
export function decideAction(
  level: ExperienceLevel,
  rirTrend: RirTrend,
  avgRecentRir: number,
  targetRirMin: number,
  targetRirMax: number,
  topOfRangeReached: boolean,
): ProgressionAction {
  if (rirTrend === 'falling' || avgRecentRir < targetRirMin - 0.5) return 'hold';
  if (AGGRESSIVENESS[level].requireRirInRange && avgRecentRir < targetRirMin) return 'hold';
  if (rirTrend === 'rising' && avgRecentRir > targetRirMax + 0.5) return 'add-weight-aggressive';
  return topOfRangeReached ? 'add-weight' : 'add-reps';
}

/**
 * Compute suggested targets for the next session of one exercise.
 *
 * Double progression with RIR autoregulation: fill the rep range first, then
 * add weight and drop back to the bottom of the range. The per-set decline
 * ("drop between sets") is not imposed — it preserves the shape of the user's
 * own last session: each set keeps its weight ratio, rep delta and RIR delta
 * relative to set 1, re-applied on top of the new set-1 target. Warmups scale
 * proportionally to the new working weight.
 */
export function suggestNextSessionSets(input: SuggestionInput): SuggestionResult {
  const { template, lastSets, level, rirTrend, avgRecentRir } = input;
  const defaultRir = midpointRir(template);

  const workSets = lastSets.filter((s) => !s.isWarmup && s.completed && !s.skipped && s.weightKg > 0);
  if (workSets.length === 0) {
    return {
      basis: 'no-history',
      targets: targetsFromTemplateDefaults(template, defaultRir),
      rationale: 'No previous data for this exercise — using template defaults.',
    };
  }

  const set1 = workSets[0];
  const targetRirMin = template.targetRirMin ?? 1;
  const targetRirMax = template.targetRirMax ?? 3;
  const topOfRange = set1.reps >= template.targetRepsMax;
  const action = decideAction(level, rirTrend, avgRecentRir, targetRirMin, targetRirMax, topOfRange);
  const step = AGGRESSIVENESS[level].weightStepPct;

  let newSet1Weight: number;
  let newSet1Reps: number;
  switch (action) {
    case 'hold':
      newSet1Weight = set1.weightKg;
      newSet1Reps = set1.reps;
      break;
    case 'add-reps':
      newSet1Weight = set1.weightKg;
      newSet1Reps = Math.min(set1.reps + AGGRESSIVENESS[level].repsStep, template.targetRepsMax);
      break;
    case 'add-weight':
      newSet1Weight = roundUpFrom(set1.weightKg, 1 + step);
      newSet1Reps = template.targetRepsMin;
      break;
    case 'add-weight-aggressive':
      newSet1Weight = roundUpFrom(set1.weightKg, 1 + step * 2);
      newSet1Reps = Math.max(template.targetRepsMin, set1.reps);
      break;
  }

  // Preserve last session's per-set shape relative to set 1
  const targets: SetTarget[] = [];
  let setNumber = 1;

  for (const warmup of lastSets.filter((s) => s.isWarmup)) {
    const ratio = set1.weightKg > 0 ? warmup.weightKg / set1.weightKg : 0;
    targets.push({
      setNumber: setNumber++,
      isWarmup: true,
      weightKg: roundToPlate(newSet1Weight * ratio),
      reps: warmup.reps,
      rir: warmup.rir,
    });
  }

  for (const ws of workSets) {
    const weightRatio = ws.weightKg / set1.weightKg;
    const repsDelta = ws.reps - set1.reps;
    const rirDelta = ws.rir - set1.rir;
    targets.push({
      setNumber: setNumber++,
      isWarmup: false,
      weightKg: roundToPlate(newSet1Weight * weightRatio),
      reps: Math.max(1, Math.round(newSet1Reps + repsDelta)),
      rir: clamp(defaultRir + rirDelta, 0, 5),
    });
  }

  return { basis: 'computed', action, targets, rationale: buildRationale(action, rirTrend, level) };
}

// ─── Internal helpers ───

function targetsFromTemplateDefaults(template: ExerciseTemplate, defaultRir: number): SetTarget[] {
  const warmupCount = template.hasWarmupSets ? (template.warmupSets ?? 0) : 0;
  const total = template.targetSets + warmupCount;
  const targets: SetTarget[] = [];
  for (let i = 0; i < total; i++) {
    targets.push({
      setNumber: i + 1,
      isWarmup: i < warmupCount,
      weightKg: 0,
      reps: template.targetRepsMin,
      rir: defaultRir,
    });
  }
  return targets;
}

function midpointRir(template: ExerciseTemplate): number {
  const min = template.targetRirMin;
  const max = template.targetRirMax;
  if (min != null && max != null) return round1((min + max) / 2);
  return min ?? max ?? 2;
}

/** Round up to the next plate increment, guaranteeing at least one increment of progress */
function roundUpFrom(baseWeight: number, factor: number): number {
  const raw = baseWeight * factor;
  const rounded = roundToPlate(raw);
  return rounded > baseWeight ? rounded : baseWeight + PLATE_INCREMENT_KG;
}

function buildRationale(action: ProgressionAction, rirTrend: RirTrend, level: ExperienceLevel): string {
  switch (action) {
    case 'hold':
      return rirTrend === 'falling'
        ? 'RIR trending down — consolidate at the same load.'
        : 'Recent RIR below target — repeat last session before progressing.';
    case 'add-reps':
      return 'Within the rep range — add a rep at the same weight (double progression).';
    case 'add-weight':
      return `Rep-range ceiling reached — weight up (${level} step), reps back to range minimum.`;
    case 'add-weight-aggressive':
      return 'RIR consistently above target — current load too easy, taking a double step up.';
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
