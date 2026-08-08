// ─── Core workout interfaces ───

import { UserProfile } from './profile.model';
import { Routine } from './routine.model';

/** Base template for an exercise in the routine catalog */
export interface ExerciseTemplate {
  id: string; // unique slug: "press-inclinado-maquina". Stable FK into logged history — never rename (see ADR-0008).
  name: string;
  category: 'push' | 'pull' | 'legs' | 'abs';
  dayVariant?: 'A' | 'B'; // undefined = same in both variants
  order: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  hasWarmupSets: boolean;
  warmupSets?: number;
  targetRirMin?: number; // minimum target RIR for work sets
  targetRirMax?: number; // maximum target RIR
  choiceGroup?: string; // exercises sharing a choiceGroup are alternatives (pick one)
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
  dayVariant: 'A' | 'B';
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
  dayVariant: 'A' | 'B';
  muscleLabel?: string; // "Chest, shoulders, triceps"
  emoji?: string; // "💪"
}

/** Shape of the exported JSON file */
export interface ExportData {
  version: string;
  exportDate: string;
  appName: string;
  user?: UserProfile; // included when a profile exists
  routines?: Routine[]; // user-created custom routines (export/import is the only backup channel)
  sessions: WorkoutSession[];
}
