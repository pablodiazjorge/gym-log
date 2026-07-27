// ─── Core workout interfaces ───

/** Plantilla base de un ejercicio en la rutina */
export interface ExerciseTemplate {
  id: string; // slug único: "press-inclinado-maquina"
  name: string;
  category: 'push' | 'pull' | 'legs' | 'abs';
  dayVariant?: 'A' | 'B'; // undefined = se repite igual en ambas variantes
  order: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  hasWarmupSets: boolean;
  warmupSets?: number;
  targetRirMin?: number; // RIR objetivo mínimo para las series de trabajo
  targetRirMax?: number; // RIR objetivo máximo
  choiceGroup?: string; // si varios ejercicios comparten choiceGroup, son alternativas (elegir uno)
  notes?: string;
}

/** Una serie registrada durante el entrenamiento */
export interface WorkoutSet {
  setNumber: number;
  isWarmup: boolean;
  weightKg: number;
  reps: number;
  partialReps?: number; // repeticiones parciales extra (brazos bloqueados, rango reducido, etc.)
  rir: number; // Reps In Reserve (0-5)
  completed: boolean;
  skipped: boolean;
  notes?: string;
}

/** Ejercicio registrado dentro de una sesión */
export interface WorkoutExercise {
  templateId: string;
  exerciseName: string; // snapshot por si cambia el template
  sets: WorkoutSet[];
}

/** Sesión de entrenamiento completa */
export interface WorkoutSession {
  id: string;
  date: string; // ISO 8601
  dayType: 'push' | 'pull' | 'legs' | 'abs';
  dayVariant: 'A' | 'B';
  exercises: WorkoutExercise[];
  durationMinutes?: number;
  bodyWeightKg?: number;
  notes?: string;
  completed: boolean;
}

/** Información de un día de la semana mapeado a la rutina */
export interface DayInfo {
  weekday: number; // 1-4 para los 4 tipos de sesión
  label: string; // "Push"
  dayType: 'push' | 'pull' | 'legs' | 'abs';
  dayVariant: 'A' | 'B';
  muscleLabel?: string; // "Pecho, hombro, tríceps"
  emoji?: string; // "💪"
}

/** Estructura del JSON de exportación */
export interface ExportData {
  version: string;
  exportDate: string;
  appName: string;
  sessions: WorkoutSession[];
}
