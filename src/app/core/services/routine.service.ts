import { Injectable } from '@angular/core';
import { DayInfo, ExerciseTemplate } from '../models/workout.model';

/**
 * Servicio con la rutina PPL 5 días hardcoded.
 * No editable desde la UI — si la rutina cambia, se modifica aquí.
 */
@Injectable({ providedIn: 'root' })
export class RoutineService {
  // ─── Días de la semana mapeados a tipo de entrenamiento ───
  private readonly weekSchedule: Record<number, { dayType: 'push' | 'pull' | 'legs'; dayVariant: 'A' | 'B'; label: string }> = {
    1: { dayType: 'push', dayVariant: 'A', label: 'Lunes Push' },
    3: { dayType: 'pull', dayVariant: 'A', label: 'Miércoles Pull' },
    4: { dayType: 'legs', dayVariant: 'A', label: 'Jueves Legs' },
    5: { dayType: 'push', dayVariant: 'A', label: 'Viernes Push' },
    6: { dayType: 'pull', dayVariant: 'B', label: 'Sábado Pull' },
  };

  // ─── Ejercicios de la rutina ───
  private readonly allExercises: ExerciseTemplate[] = [
    // ── PUSH (A y B idénticos) ──
    {
      id: 'press-inclinado-maquina',
      name: 'Press inclinado en máquina',
      category: 'push',
      order: 1,
      targetSets: 4,
      targetRepsMin: 10,
      targetRepsMax: 12,
      hasWarmupSets: true,
      warmupSets: 2,
    },
    {
      id: 'pec-deck',
      name: 'Pec Deck / Chest Fly Machine',
      category: 'push',
      order: 2,
      targetSets: 3,
      targetRepsMin: 12,
      targetRepsMax: 15,
      hasWarmupSets: false,
    },
    {
      id: 'triceps-polea-vertical',
      name: 'Tríceps en polea vertical',
      category: 'push',
      order: 3,
      targetSets: 3,
      targetRepsMin: 12,
      targetRepsMax: 15,
      hasWarmupSets: false,
    },
    {
      id: 'elevaciones-laterales-banco-inclinado',
      name: 'Elevaciones laterales en banco inclinado',
      category: 'push',
      order: 4,
      targetSets: 3,
      targetRepsMin: 12,
      targetRepsMax: 15,
      hasWarmupSets: false,
    },
    {
      id: 'rear-delt-fly',
      name: 'Rear Delt Fly',
      category: 'push',
      order: 5,
      targetSets: 3,
      targetRepsMin: 12,
      targetRepsMax: 15,
      hasWarmupSets: false,
    },

    // ── PULL ──
    {
      id: 'jalon-pecho-agarre-ancho',
      name: 'Jalón al pecho (agarre ancho, prono)',
      category: 'pull',
      order: 1,
      targetSets: 4,
      targetRepsMin: 8,
      targetRepsMax: 10,
      hasWarmupSets: true,
      warmupSets: 2,
    },
    {
      id: 'remo-t-agarre-neutro',
      name: 'Remo en T con agarre neutro (ancho de hombros)',
      category: 'pull',
      order: 2,
      targetSets: 3,
      targetRepsMin: 10,
      targetRepsMax: 12,
      hasWarmupSets: false,
    },
    // Pull A exclusivos
    {
      id: 'curl-biceps-banco-inclinado',
      name: 'Curl de bíceps en banco inclinado',
      category: 'pull',
      dayVariant: 'A',
      order: 3,
      targetSets: 4,
      targetRepsMin: 10,
      targetRepsMax: 12,
      hasWarmupSets: false,
    },
    {
      id: 'elevaciones-piernas-colgado',
      name: 'Elevaciones de piernas colgado',
      category: 'pull',
      dayVariant: 'A',
      order: 4,
      targetSets: 3,
      targetRepsMin: 12,
      targetRepsMax: 15,
      hasWarmupSets: false,
    },
    // Pull B exclusivos
    {
      id: 'curl-martillo',
      name: 'Curl martillo',
      category: 'pull',
      dayVariant: 'B',
      order: 3,
      targetSets: 4,
      targetRepsMin: 10,
      targetRepsMax: 12,
      hasWarmupSets: false,
    },
    {
      id: 'plancha-peso',
      name: 'Plancha con peso',
      category: 'pull',
      dayVariant: 'B',
      order: 4,
      targetSets: 3,
      targetRepsMin: 12,
      targetRepsMax: 15,
      hasWarmupSets: false,
    },

    // ── LEGS ──
    {
      id: 'hack-squat-maquina',
      name: 'Hack squat en máquina',
      category: 'legs',
      order: 1,
      targetSets: 4,
      targetRepsMin: 8,
      targetRepsMax: 10,
      hasWarmupSets: true,
      warmupSets: 2,
    },
    {
      id: 'prensa-inclinada-pies-altos',
      name: 'Prensa inclinada (pies altos y anchos)',
      category: 'legs',
      order: 2,
      targetSets: 3,
      targetRepsMin: 10,
      targetRepsMax: 12,
      hasWarmupSets: false,
    },
    {
      id: 'curl-femoral-acostado',
      name: 'Curl femoral acostado en máquina',
      category: 'legs',
      order: 3,
      targetSets: 3,
      targetRepsMin: 12,
      targetRepsMax: 15,
      hasWarmupSets: false,
    },
    {
      id: 'hip-thrust-maquina',
      name: 'Hip thrust en máquina',
      category: 'legs',
      order: 4,
      targetSets: 3,
      targetRepsMin: 10,
      targetRepsMax: 12,
      hasWarmupSets: false,
    },
  ];

  // ─── Métodos públicos ───

  /** Devuelve los ejercicios para un día y variante, ordenados */
  getExercisesForDay(dayType: 'push' | 'pull' | 'legs', dayVariant: 'A' | 'B'): ExerciseTemplate[] {
    return this.allExercises
      .filter((ex) => {
        if (ex.category !== dayType) return false;
        // Si el ejercicio tiene dayVariant, debe coincidir; si no, aparece en ambas variantes
        if (ex.dayVariant && ex.dayVariant !== dayVariant) return false;
        return true;
      })
      .sort((a, b) => a.order - b.order);
  }

  /** Dado un día de la semana (1=Lunes..6=Sábado), devuelve la info del día de entrenamiento */
  getDayInfo(weekday: number): DayInfo | null {
    const info = this.weekSchedule[weekday];
    if (!info) return null;
    return {
      weekday,
      ...info,
    };
  }

  /** Lista de todos los días de entrenamiento de la semana */
  getTrainingDays(): DayInfo[] {
    return Object.entries(this.weekSchedule).map(([weekday, info]) => ({
      weekday: Number(weekday),
      ...info,
    }));
  }

  /** Busca un template por su id */
  getTemplateById(id: string): ExerciseTemplate | undefined {
    return this.allExercises.find((ex) => ex.id === id);
  }
}
