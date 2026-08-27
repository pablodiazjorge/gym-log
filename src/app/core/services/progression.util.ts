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
  TrainingFocus,
  UserProfile,
} from '../models/profile.model';
import { ProgressionAction, SetTarget } from '../models/progression.model';
import { ExerciseTemplate, WorkoutSession, WorkoutSet } from '../models/workout.model';

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

// ─── Training frequency ───

/** Look-back window for frequency detection */
export const FREQUENCY_WINDOW_DAYS = 21;

/**
 * Sessions/week in which ANY of the given template ids was trained, over the
 * last FREQUENCY_WINDOW_DAYS. Needs at least 2 occurrences to be meaningful —
 * otherwise returns the neutral default of 1. Clamped to [0.5, 4].
 */
export function estimateFrequencyForTemplates(
  templateIds: ReadonlySet<string>,
  sessions: WorkoutSession[],
  nowMs: number,
): number {
  const windowStart = nowMs - FREQUENCY_WINDOW_DAYS * 86400000;
  let count = 0;
  for (const session of sessions) {
    if (!session.completed) continue;
    const t = new Date(session.date).getTime();
    if (t < windowStart || t > nowMs) continue;
    if (session.exercises.some((e) => templateIds.has(e.templateId))) count++;
  }
  if (count < 2) return 1;
  return clamp(count / (FREQUENCY_WINDOW_DAYS / 7), 0.5, 4);
}

/** Frequency of one specific exercise (sessions/week) */
export function estimateExerciseFrequency(
  templateId: string,
  sessions: WorkoutSession[],
  nowMs: number,
): number {
  return estimateFrequencyForTemplates(new Set([templateId]), sessions, nowMs);
}

/**
 * Per-session weight-step multiplier keeping WEEKLY progression constant:
 * freq 1 → ×1.0, freq 2 → ×0.5. Capped at ×1.5 for sporadic training (a low
 * frequency should not over-boost a single session) and at ×0.5 downward.
 */
export function frequencyStepScale(frequency: number): number {
  if (frequency <= 0) return 1;
  return clamp(1 / frequency, 0.5, 1.5);
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
  /** Progression style; absent = 'hypertrophy' (double progression) */
  focus?: TrainingFocus;
  /** Sessions/week this exercise is trained; absent = 1 (full step per session) */
  frequency?: number;
}

export interface SuggestionResult {
  basis: 'computed' | 'no-history' | 'last-session';
  action?: ProgressionAction;
  targets: SetTarget[];
  rationale: string;
}

/** Round a weight to the nearest load increment (per-exercise when available) */
export function roundToPlate(weightKg: number, incrementKg: number = PLATE_INCREMENT_KG): number {
  if (incrementKg <= 0) incrementKg = PLATE_INCREMENT_KG;
  return Math.max(0, Math.round(weightKg / incrementKg) * incrementKg);
}

/**
 * Decide the progression action from level, focus, exercise type, RIR trend
 * and rep-range position. Focus moves the reps threshold at which weight goes
 * up: hypertrophy = range ceiling (double progression), strength = range
 * midpoint (weight-priority) — but ONLY for compounds; isolation exercises
 * always run double progression (heavy-loading a lateral raise is pointless
 * and injury-prone). Maintenance never adds weight automatically.
 */
export function decideAction(
  level: ExperienceLevel,
  focus: TrainingFocus,
  rirTrend: RirTrend,
  avgRecentRir: number,
  targetRirMin: number,
  targetRirMax: number,
  set1Reps: number,
  targetRepsMin: number,
  targetRepsMax: number,
  isCompound = false,
): ProgressionAction {
  if (rirTrend === 'falling' || avgRecentRir < targetRirMin - 0.5) return 'hold';
  if (AGGRESSIVENESS[level].requireRirInRange && avgRecentRir < targetRirMin) return 'hold';
  if (focus === 'maintenance') {
    // Hold loads; only add a rep when the stimulus clearly decayed below maintenance
    return rirTrend === 'rising' && avgRecentRir > targetRirMax + 0.5 ? 'add-reps' : 'hold';
  }
  if (rirTrend === 'rising' && avgRecentRir > targetRirMax + 0.5) return 'add-weight-aggressive';
  const weightThreshold =
    focus === 'strength' && isCompound
      ? Math.ceil((targetRepsMin + targetRepsMax) / 2)
      : targetRepsMax;
  return set1Reps >= weightThreshold ? 'add-weight' : 'add-reps';
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
  const focus = input.focus ?? 'hypertrophy';
  const frequency = input.frequency ?? 1;
  const isCompound = template.isCompound ?? false;
  const increment = template.weightIncrementKg ?? PLATE_INCREMENT_KG;
  const defaultRir = midpointRir(template);

  // Effective rep range: strength focus uses the strength range — compounds
  // with a defined strength range only. Everything else keeps the hypertrophy
  // range (isolation, unilateral/technique-limited compounds, maintenance).
  const useStrengthRange =
    focus === 'strength' &&
    isCompound &&
    template.strengthRepsMin != null &&
    template.strengthRepsMax != null;
  const repsMin = useStrengthRange ? template.strengthRepsMin! : template.targetRepsMin;
  const repsMax = useStrengthRange ? template.strengthRepsMax! : template.targetRepsMax;

  const loggedWorkSets = lastSets.filter((s) => !s.isWarmup && s.completed && !s.skipped);
  /**
   * Bodyweight only when EVERY work set is unloaded (pull-ups, dips, hanging leg
   * raises…). Those used to be filtered out by a blanket `weightKg > 0` and so
   * reported "no previous data" forever, however long the history was.
   *
   * The `every` matters: a single 0 kg ramp-up set logged among weighted ones
   * would otherwise become set 1, and every weight ratio is taken against set 1
   * — dragging the whole exercise's suggestion to 0 kg.
   */
  const isBodyweight = loggedWorkSets.length > 0 && loggedWorkSets.every((s) => s.weightKg === 0);
  const workSets = isBodyweight ? loggedWorkSets : loggedWorkSets.filter((s) => s.weightKg > 0);
  if (workSets.length === 0) {
    return {
      basis: 'no-history',
      targets: targetsFromTemplateDefaults(template, defaultRir, repsMin),
      rationale: 'No previous data for this exercise — using template defaults.',
    };
  }

  const set1 = workSets[0];
  const targetRirMin = template.targetRirMin ?? 1;
  const targetRirMax = template.targetRirMax ?? 3;

  // Fatigue gates always run first — a HOLD verdict is never overridden.
  const gateAction = decideAction(
    level,
    focus,
    rirTrend,
    avgRecentRir,
    targetRirMin,
    targetRirMax,
    set1.reps,
    repsMin,
    repsMax,
    isCompound,
  );

  // Range transition (e.g. focus switched hypertrophy↔strength, or a big
  // overshoot): when the last performance sits far outside the effective
  // range, extrapolating rep-by-rep is meaningless — recalculate the load
  // from the estimated 1RM instead. Skipped under maintenance and whenever
  // the fatigue gates said HOLD.
  // Meaningless without external load: the 1RM back-solve would divide a zero.
  const rangeSwitched =
    !isBodyweight &&
    focus !== 'maintenance' &&
    gateAction !== 'hold' &&
    (set1.reps > repsMax + 2 || set1.reps < repsMin - 2);

  // Without a belt there is no weight to add, so every "add weight" verdict
  // becomes rep progression instead.
  const weightAction = gateAction === 'add-weight' || gateAction === 'add-weight-aggressive';
  const action: ProgressionAction = rangeSwitched
    ? 'add-weight'
    : isBodyweight && weightAction
      ? 'add-reps'
      : gateAction;

  // Scale the per-session weight step so WEEKLY progression stays constant
  // regardless of how often the exercise is trained.
  const step = AGGRESSIVENESS[level].weightStepPct * frequencyStepScale(frequency);
  // The aggressive double step only makes sense on compounds; isolation takes
  // a single step (the per-exercise increment already bounds the jump).
  const aggressiveMultiplier = isCompound ? 2 : 1;

  let newSet1Weight: number;
  let newSet1Reps: number;
  if (rangeSwitched) {
    // Solve Epley backwards: e1RM = w × (1 + n/30) with n = target reps + RIR in reserve
    const e1Rm = estimate1Rm(set1.weightKg, set1.reps);
    newSet1Reps = Math.round((repsMin + repsMax) / 2);
    newSet1Weight = roundToPlate(e1Rm / (1 + (newSet1Reps + defaultRir) / 30), increment);
  } else {
    switch (action) {
      case 'hold':
        newSet1Weight = set1.weightKg;
        newSet1Reps = set1.reps;
        break;
      case 'add-reps':
        newSet1Weight = set1.weightKg;
        // Bodyweight work has no load to add, so clamping at repsMax would
        // freeze it forever while still claiming to progress. Let the reps grow
        // past the range instead — that IS the progression until a belt appears.
        newSet1Reps = isBodyweight
          ? set1.reps + AGGRESSIVENESS[level].repsStep
          : Math.min(set1.reps + AGGRESSIVENESS[level].repsStep, repsMax);
        break;
      case 'add-weight':
        newSet1Weight = roundUpFrom(set1.weightKg, 1 + step, increment);
        newSet1Reps = repsMin;
        break;
      case 'add-weight-aggressive':
        newSet1Weight = roundUpFrom(set1.weightKg, 1 + step * aggressiveMultiplier, increment);
        newSet1Reps = Math.max(repsMin, Math.min(set1.reps, repsMax));
        break;
    }
  }

  // Preserve last session's per-set shape relative to set 1
  const targets: SetTarget[] = [];
  let setNumber = 1;

  // Skipped warm-ups are excluded: they used to carry weightKg 0 into the ratio
  // and propose a 0 kg warm-up for the next session. `completed` is NOT required
  // — an unticked warm-up still describes the shape the user wants, and
  // dropping it would delete the warm-ups from the next session, which then
  // becomes the history and perpetuates the loss.
  for (const warmup of lastSets.filter((s) => s.isWarmup && !s.skipped)) {
    const ratio = set1.weightKg > 0 ? warmup.weightKg / set1.weightKg : 0;
    targets.push({
      setNumber: setNumber++,
      isWarmup: true,
      weightKg: roundToPlate(newSet1Weight * ratio, increment),
      reps: warmup.reps,
      rir: warmup.rir,
    });
  }

  for (const ws of workSets) {
    // Guarded: set1.weightKg is 0 for bodyweight work, which would yield NaN.
    const weightRatio = set1.weightKg > 0 ? ws.weightKg / set1.weightKg : 0;
    // On a range switch the old per-set rep deltas belong to the old range — reset them
    const repsDelta = rangeSwitched ? 0 : ws.reps - set1.reps;
    const rirDelta = ws.rir - set1.rir;
    targets.push({
      setNumber: setNumber++,
      isWarmup: false,
      weightKg: roundToPlate(newSet1Weight * weightRatio, increment),
      reps: Math.max(1, Math.round(newSet1Reps + repsDelta)),
      rir: clamp(defaultRir + rirDelta, 0, 5),
    });
  }

  const rationale = rangeSwitched
    ? `Last performance far outside the ${repsMin}-${repsMax} target range — load recalculated from your estimated 1RM.`
    : buildRationale(action, rirTrend, level, focus, frequency);

  return { basis: 'computed', action, targets, rationale };
}

/**
 * Verbatim prefill for users who turned progression suggestions OFF:
 * copy the last session's performed sets (completed && !skipped) as targets —
 * weight, reps, RIR and warm-up flag unchanged, set numbers renumbered 1..n.
 * 0 kg sets are kept (bodyweight); verbatim means verbatim. Falls back to
 * template defaults when nothing was performed.
 */
export function targetsFromLastSession(
  lastSets: WorkoutSet[],
  template: ExerciseTemplate,
): SuggestionResult {
  const performed = lastSets.filter((s) => s.completed && !s.skipped);
  if (performed.length === 0) {
    return {
      basis: 'no-history',
      targets: targetsFromTemplateDefaults(template, midpointRir(template)),
      rationale: 'No previous data for this exercise — using template defaults.',
    };
  }
  return {
    basis: 'last-session',
    targets: performed.map((s, i) => ({
      setNumber: i + 1,
      isWarmup: s.isWarmup,
      weightKg: s.weightKg,
      reps: s.reps,
      rir: s.rir,
    })),
    rationale: 'Progression suggestions off — pre-filled from your last logged session.',
  };
}

// ─── Internal helpers ───

function targetsFromTemplateDefaults(
  template: ExerciseTemplate,
  defaultRir: number,
  repsMin: number = template.targetRepsMin,
): SetTarget[] {
  const warmupCount = template.hasWarmupSets ? (template.warmupSets ?? 0) : 0;
  const total = template.targetSets + warmupCount;
  const targets: SetTarget[] = [];
  for (let i = 0; i < total; i++) {
    targets.push({
      setNumber: i + 1,
      isWarmup: i < warmupCount,
      weightKg: 0,
      reps: repsMin,
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

/** Round up to the next load increment, guaranteeing at least one increment of progress */
function roundUpFrom(baseWeight: number, factor: number, incrementKg: number = PLATE_INCREMENT_KG): number {
  const raw = baseWeight * factor;
  const rounded = roundToPlate(raw, incrementKg);
  return rounded > baseWeight ? rounded : baseWeight + incrementKg;
}

function buildRationale(
  action: ProgressionAction,
  rirTrend: RirTrend,
  level: ExperienceLevel,
  focus: TrainingFocus,
  frequency: number,
): string {
  const freqNote =
    frequency >= 1.5 ? ` Trained ~${Math.round(frequency)}×/week — smaller per-session step.` : '';
  switch (action) {
    case 'hold':
      if (focus === 'maintenance') return 'Maintenance focus — holding the current load.';
      return rirTrend === 'falling'
        ? 'RIR trending down — consolidate at the same load.'
        : 'Recent RIR below target — repeat last session before progressing.';
    case 'add-reps':
      if (focus === 'maintenance') {
        return 'RIR well above target — adding a rep to keep the maintenance stimulus.';
      }
      return 'Within the rep range — add a rep at the same weight (double progression).';
    case 'add-weight':
      return focus === 'strength'
        ? `Strength focus — reps at mid-range, weight up (${level} step), reps back to minimum.${freqNote}`
        : `Rep-range ceiling reached — weight up (${level} step), reps back to range minimum.${freqNote}`;
    case 'add-weight-aggressive':
      return `RIR consistently above target — current load too easy, taking a double step up.${freqNote}`;
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

// ─── Session set construction ───

/** The subset of a template that decides the shape of an exercise's sets */
export type SetPlan = Pick<
  ExerciseTemplate,
  'targetSets' | 'targetRepsMin' | 'hasWarmupSets' | 'warmupSets' | 'targetRirMin'
>;

/**
 * Build the sets for one exercise of a new session.
 *
 * `planIsAuthoritative` (routine-driven sessions) makes the PLAN decide the
 * structure — how many sets exist and which of them are warm-ups — while the
 * suggested targets only supply values, matched **by role**: the n-th warm-up
 * target fills the n-th warm-up slot, the n-th work target the n-th work slot.
 *
 * Without it (day-driven sessions) the catalog template is only a default, so
 * the recorded history may extend it and decides which sets are warm-ups.
 *
 * Regression guard: matching targets by flat index used to let a history with
 * no warm-ups occupy the warm-up slots, silently dropping the warm-up sets a
 * routine had configured — and, because that session became the new history,
 * the loss perpetuated itself. `Math.max` likewise made lowering `targetSets`
 * in the routine editor a no-op whenever the last session had more sets.
 */
export function buildSetsForExercise(
  plan: SetPlan,
  targets: SetTarget[],
  planIsAuthoritative: boolean,
): WorkoutSet[] {
  const warmupCount = plan.hasWarmupSets ? (plan.warmupSets ?? 0) : 0;
  const totalSets = planIsAuthoritative
    ? plan.targetSets + warmupCount
    : Math.max(plan.targetSets + warmupCount, targets.length);
  const defaultRir = plan.targetRirMin ?? 2;
  const warmupTargets = targets.filter((t) => t.isWarmup);
  const workTargets = targets.filter((t) => !t.isWarmup);
  const lastWorkTarget = workTargets[workTargets.length - 1];
  const lastWarmupTarget = warmupTargets[warmupTargets.length - 1];

  const firstWorkTarget = workTargets[0];
  /**
   * Weight for a warm-up slot the history has nothing for — the usual case when
   * a routine adds warm-up sets to an exercise that never had them. Half the
   * first work set is a conventional, safe opener; without it the slot came out
   * at 0 kg and had to be typed in every single session.
   */
  const derivedWarmupWeight = firstWorkTarget
    ? roundToPlate(firstWorkTarget.weightKg * 0.5, PLATE_INCREMENT_KG)
    : 0;

  const sets: WorkoutSet[] = [];
  for (let i = 0; i < totalSets; i++) {
    const isWarmup = planIsAuthoritative
      ? i < warmupCount
      : (targets[i]?.isWarmup ?? i < warmupCount);
    const target = planIsAuthoritative
      ? isWarmup
        ? warmupTargets[i]
        : workTargets[i - warmupCount]
      : targets[i];
    // Fall back to the last target OF THE SAME ROLE, as a whole: taking only
    // the weight from it left reps and RIR on the template defaults, so a
    // filled-in slot mixed a real load with a generic rep count.
    const fallback = isWarmup ? lastWarmupTarget : lastWorkTarget;
    const source = target ?? fallback;
    const fallbackWeight = isWarmup ? derivedWarmupWeight : 0;
    sets.push({
      setNumber: i + 1,
      isWarmup,
      weightKg: source?.weightKg ?? fallbackWeight,
      reps: source?.reps ?? plan.targetRepsMin,
      partialReps: 0,
      rir: source?.rir ?? defaultRir,
      completed: false,
      skipped: false,
      notes: '',
    });
  }
  return sets;
}
