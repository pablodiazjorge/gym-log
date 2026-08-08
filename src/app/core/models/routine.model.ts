// ─── Saved routine interfaces ───
//
// A Routine is a fully-configured, reusable workout: an ordered list of
// exercises where sets/reps/RIR/rest are set by the routine author, seeded
// from — but independent of — the exercise catalog's template defaults.
// Built-in routines are derived at read time from the hardcoded catalog;
// custom routines are user-created and persisted (see RoutineLibraryService).

/** Author-configured settings for one exercise inside a routine */
export interface RoutineExerciseConfig {
  templateId: string; // FK into ExerciseTemplate.id (catalog)
  order: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  hasWarmupSets: boolean;
  warmupSets?: number;
  targetRirMin?: number;
  targetRirMax?: number;
  restSeconds?: number; // default rest between sets for this exercise
  notes?: string;
}

export interface Routine {
  id: string; // 'built-in-<dayType>' for built-ins, 'routine-<timestamp>' for custom
  name: string;
  source: 'built-in' | 'custom';
  builtInDayType?: 'push' | 'pull' | 'legs' | 'abs'; // only when source === 'built-in'
  exercises: RoutineExerciseConfig[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
