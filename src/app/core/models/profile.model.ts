// ─── User profile & experience-level interfaces ───

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type MovementCategory = 'push' | 'pull' | 'legs';
export type Sex = 'male' | 'female';
export type FrameSize = 'small' | 'medium' | 'large';
export type TrainingGoal =
  | 'lean_bulk'
  | 'bulk'
  | 'cut'
  | 'recomposition'
  | 'maintenance'
  | 'strength';

/**
 * How progression suggestions behave — separate from TrainingGoal (diet phase):
 * hypertrophy = double progression (fill the rep range, then add weight);
 * strength = weight-priority (add weight at mid-range);
 * maintenance = hold current loads.
 */
export type TrainingFocus = 'hypertrophy' | 'strength' | 'maintenance';

/**
 * A best set on a reference lift, either a canonical free-weight lift
 * (bench, squat, deadlift...) entered manually, or an exercise from the app
 * catalog (templateId set) — in which case the best logged set from session
 * history is used automatically and kept up to date as you train.
 * Note: bodyweight-ratio strength standards are calibrated for free-weight
 * compounds; machine numbers make the estimate approximate.
 */
export interface BenchmarkLift {
  category: MovementCategory;
  exerciseName: string;
  /** Set when the lift references a catalog exercise — enables auto-update from history */
  templateId?: string;
  weightKg: number;
  reps: number;
  date?: string; // ISO 8601
}

export interface UserProfile {
  // ── Simple mode ──
  name?: string;
  age?: number;
  sex?: Sex;
  heightCm?: number;
  bodyWeightKg?: number;
  goal?: TrainingGoal;
  /** Manually selected experience level — always the fallback */
  experienceLevelManual: ExperienceLevel;
  /** Progression style; absent = 'hypertrophy' */
  trainingFocus?: TrainingFocus;
  /**
   * Progression-suggestion engine toggle; absent = true (suggestions on).
   * When false, new sessions pre-fill each exercise verbatim from the last
   * session's performed sets instead of computed targets.
   */
  progressionSuggestionsEnabled?: boolean;
  /**
   * Manual weekly-frequency override per category (sessions/week). Absent or
   * empty per-category = auto-detected from the last 3 weeks of history.
   */
  weeklyFrequencyOverride?: { push?: number; pull?: number; legs?: number };

  // ── Advanced mode (optional) ──
  wristCircumferenceCm?: number;
  ankleCircumferenceCm?: number;
  benchmarkLifts?: BenchmarkLift[];

  /** When true and enough advanced data exists, the computed per-category level overrides the manual one */
  useComputedLevel: boolean;
  updatedAt: string; // ISO 8601
}

/** Result of the frame-size (bone structure) assessment */
export interface FrameAssessment {
  frameSize: FrameSize;
  /** height(cm) / wrist circumference(cm) — Metropolitan Life r-value */
  wristHeightRatio?: number;
  method: 'wrist' | 'wrist+ankle-nudge' | 'none';
}

/** Computed experience level for one movement category */
export interface CategoryLevelAssessment {
  category: MovementCategory;
  estimated1RmKg?: number;
  bodyweightRatio?: number;
  /** Frame-adjusted thresholds actually used for classification */
  adjustedThresholds: { beginnerMax: number; intermediateMax: number };
  level: ExperienceLevel;
}

export interface ComputedLevelResult {
  frame: FrameAssessment;
  perCategory: CategoryLevelAssessment[];
}
