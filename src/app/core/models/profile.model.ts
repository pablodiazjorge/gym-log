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
 * A self-reported best set on a free-weight reference lift (bench, squat,
 * deadlift, weighted pull-up...). Deliberately decoupled from the machine-based
 * exercise catalog: bodyweight-ratio strength standards only make sense for
 * well-known free-weight compounds.
 */
export interface BenchmarkLift {
  category: MovementCategory;
  exerciseName: string;
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
