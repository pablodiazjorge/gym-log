// ─── Progression suggestion interfaces ───

/** The progression action decided for an exercise's next session */
export type ProgressionAction = 'hold' | 'add-reps' | 'add-weight' | 'add-weight-aggressive';

/** Suggested target for one set of the next session */
export interface SetTarget {
  setNumber: number;
  isWarmup: boolean;
  weightKg: number;
  reps: number;
  rir: number;
}

/** Full next-session suggestion for one exercise */
export interface ExerciseProgressionSuggestion {
  templateId: string;
  exerciseName: string;
  restSeconds?: number; // carried forward from the last logged instance (manual field, no algorithm)
  setTargets: SetTarget[];
  /** 'last-session' = suggestions disabled: verbatim copy of the previous session */
  basis: 'computed' | 'no-history' | 'last-session';
  action?: ProgressionAction; // absent unless basis === 'computed'
  /** Short human-readable explanation of why these targets were suggested */
  rationale: string;
}
