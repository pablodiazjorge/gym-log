// ─── Core workout interfaces ───

import { BodyMeasurement } from './measurement.model';
import { UserProfile } from './profile.model';
import { Routine } from './routine.model';

/** Fine-grained muscle group; maps onto the coarse push/pull/legs/abs category */
export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs';

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'smith' | 'cable' | 'bodyweight';

/** chest/shoulders/triceps → push · back/biceps → pull · quads/hamstrings/glutes/calves → legs · abs → abs */
export function categoryOfMuscleGroup(group: MuscleGroup): 'push' | 'pull' | 'legs' | 'abs' {
  switch (group) {
    case 'chest':
    case 'shoulders':
    case 'triceps':
      return 'push';
    case 'back':
    case 'biceps':
      return 'pull';
    case 'quads':
    case 'hamstrings':
    case 'glutes':
    case 'calves':
      return 'legs';
    case 'abs':
      return 'abs';
  }
}

/** Base template for an exercise in the routine catalog */
export interface ExerciseTemplate {
  id: string; // unique English slug, e.g. "incline-machine-press" — stable FK into logged history (ADR-0012)
  name: string; // English display name (primary)
  nameEs?: string; // Spanish display name
  description?: string; // short English how-to/cue description
  category: 'push' | 'pull' | 'legs' | 'abs';
  muscleGroup?: MuscleGroup;
  equipment?: Equipment;
  isCompound?: boolean; // drives strength-focus behavior (absent = isolation)
  order: number;
  targetSets: number;
  targetRepsMin: number; // hypertrophy-default rep range
  targetRepsMax: number;
  strengthRepsMin?: number; // strength-focus range — compounds only (typically 3-6)
  strengthRepsMax?: number;
  weightIncrementKg?: number; // smallest realistic load step (absent = global default)
  hasWarmupSets: boolean;
  warmupSets?: number;
  targetRirMin?: number; // minimum target RIR for work sets
  targetRirMax?: number; // maximum target RIR
  choiceGroup?: string; // exercises sharing a choiceGroup are alternatives (pick one)
  /**
   * True for the original members of the built-in Push/Pull/Legs/Abs days.
   * Catalog-only exercises (absent/false) never auto-join a built-in day —
   * they can only appear there as enabled alternatives of a choiceGroup.
   */
  builtInDay?: boolean;
  notes?: string;
}

/** A single set logged during a workout */
export interface WorkoutSet {
  setNumber: number;
  isWarmup: boolean;
  weightKg: number;
  reps: number;
  partialReps?: number; // extra partial reps (lockout partials, reduced range, etc.)
  eccentricSeconds?: number; // negative-phase (eccentric) tempo in seconds, optional per set
  rir: number; // Reps In Reserve (0-5)
  completed: boolean;
  skipped: boolean;
  notes?: string;
}

/** An exercise logged within a session */
export interface WorkoutExercise {
  templateId: string;
  exerciseName: string; // snapshot in case the template changes
  restSeconds?: number; // rest between sets, one value for the whole exercise (manual field)
  sets: WorkoutSet[];
}

/** A complete workout session */
export interface WorkoutSession {
  id: string;
  date: string; // ISO 8601
  dayType: 'push' | 'pull' | 'legs' | 'abs' | 'additional' | 'routine';
  exercises: WorkoutExercise[];
  routineId?: string; // set when the session was started from a saved routine
  durationMinutes?: number;
  bodyWeightKg?: number;
  notes?: string;
  completed: boolean;
}

/** Info for a training day mapped to the built-in routine */
export interface DayInfo {
  weekday: number; // 1-4 for the 4 session types
  label: string; // "Push"
  dayType: 'push' | 'pull' | 'legs' | 'abs';
  muscleLabel?: string; // "Chest, shoulders, triceps"
}

/** Shape of the exported JSON file */
export interface ExportData {
  version: string;
  exportDate: string;
  appName: string;
  user?: UserProfile; // included when a profile exists
  routines?: Routine[]; // user-created custom routines (export/import is the only backup channel)
  enabledExerciseIds?: string[]; // user's enabled exercise subset (ADR-0011)
  measurements?: BodyMeasurement[]; // body check-ins (export/import is the only backup channel)
  sessions: WorkoutSession[];
}
