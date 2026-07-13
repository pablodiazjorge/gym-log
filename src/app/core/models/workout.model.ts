// ─── Core workout interfaces ───

/** Plantilla base de un ejercicio en la rutina */
export interface ExerciseTemplate {
  id: string; // slug único: "press-inclinado-maquina"
  name: string;
  category: 'push' | 'pull' | 'legs';
  dayVariant?: 'A' | 'B'; // undefined = se repite igual en ambas variantes
  order: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  hasWarmupSets: boolean;
  warmupSets?: number;
  notes?: string;
}

/** Una serie registrada durante el entrenamiento */
export interface WorkoutSet {
  setNumber: number;
  isWarmup: boolean;
  weightKg: number;
  reps: number;
  rir: number; // Reps In Reserve (0-5)
  completed: boolean;
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
  dayType: 'push' | 'pull' | 'legs';
  dayVariant: 'A' | 'B';
  exercises: WorkoutExercise[];
  durationMinutes?: number;
  bodyWeightKg?: number;
  notes?: string;
  completed: boolean;
}

/** Información de un día de la semana mapeado a la rutina */
export interface DayInfo {
  weekday: number; // 1=Lunes..6=Sábado, 0=Domingo
  label: string; // "Lunes Push"
  dayType: 'push' | 'pull' | 'legs';
  dayVariant: 'A' | 'B';
}

/** Estructura del JSON de exportación */
export interface ExportData {
  version: string;
  exportDate: string;
  appName: string;
  sessions: WorkoutSession[];
}
