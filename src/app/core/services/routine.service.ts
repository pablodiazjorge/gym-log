import { Injectable } from '@angular/core';
import { DayInfo, ExerciseTemplate } from '../models/workout.model';

/**
 * Servicio con la rutina PPL + Abs hardcoded.
 * 4 tipos de sesión: Push, Pull, Legs, Abs.
 * Cada una puede tener ejercicios a elegir al inicio.
 */
@Injectable({ providedIn: 'root' })
export class RoutineService {
  // ─── Tipos de sesión disponibles ───
  private readonly sessionTypes: { dayType: 'push' | 'pull' | 'legs' | 'abs'; dayVariant: 'A'; label: string; muscleLabel: string; emoji: string }[] = [
    { dayType: 'push', dayVariant: 'A', label: 'Push', muscleLabel: 'Pecho, hombro, tríceps', emoji: '💪' },
    { dayType: 'pull', dayVariant: 'A', label: 'Pull', muscleLabel: 'Espalda, bíceps', emoji: '🏋️' },
    { dayType: 'legs', dayVariant: 'A', label: 'Legs', muscleLabel: 'Cuádriceps, isquios, glúteo, femoral, gemelos', emoji: '🦵' },
    { dayType: 'abs', dayVariant: 'A', label: 'Abs', muscleLabel: 'Abdominales', emoji: '🪨' },
  ];

  // ─── Ejercicios de la rutina ───
  private readonly allExercises: ExerciseTemplate[] = [
    // ── PUSH (elegir: press inclinado o press plano) ──
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
      choiceGroup: 'push-main',
    },
    {
      id: 'press-plano',
      name: 'Press plano',
      category: 'push',
      order: 1,
      targetSets: 4,
      targetRepsMin: 10,
      targetRepsMax: 12,
      hasWarmupSets: true,
      warmupSets: 2,
      choiceGroup: 'push-main',
    },
    {
      id: 'press-inclinado-smith',
      name: 'Press inclinado Smith',
      category: 'push',
      order: 1,
      targetSets: 4,
      targetRepsMin: 10,
      targetRepsMax: 12,
      hasWarmupSets: true,
      warmupSets: 2,
      choiceGroup: 'push-main',
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

    // ── PULL (elegir: jalón pecho barra o mag neutro; curl banco inclinado o martillo) ──
    {
      id: 'jalon-pecho-agarre-ancho',
      name: 'Jalón al pecho (barra y straps, agarre ancho, prono)',
      category: 'pull',
      order: 1,
      targetSets: 4,
      targetRepsMin: 8,
      targetRepsMax: 10,
      hasWarmupSets: true,
      warmupSets: 2,
      choiceGroup: 'pull-main',
    },
    {
      id: 'jalon-pecho-agarre-mag-neutro',
      name: 'Jalón al pecho (agarre MAG ancho, neutro)',
      category: 'pull',
      order: 1,
      targetSets: 4,
      targetRepsMin: 8,
      targetRepsMax: 10,
      hasWarmupSets: true,
      warmupSets: 2,
      choiceGroup: 'pull-main',
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
    {
      id: 'curl-biceps-banco-inclinado',
      name: 'Curl de bíceps en banco inclinado',
      category: 'pull',
      order: 3,
      targetSets: 4,
      targetRepsMin: 10,
      targetRepsMax: 12,
      hasWarmupSets: false,
      choiceGroup: 'pull-curl',
    },
    {
      id: 'curl-martillo',
      name: 'Curl martillo',
      category: 'pull',
      order: 3,
      targetSets: 4,
      targetRepsMin: 10,
      targetRepsMax: 12,
      hasWarmupSets: false,
      choiceGroup: 'pull-curl',
    },

    // ── LEGS (ejercicio principal a elegir: hack squat o prensa inclinada) ──
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
      targetRirMin: 1,
      targetRirMax: 2,
      choiceGroup: 'legs-main',
    },
    {
      id: 'prensa-inclinada',
      name: 'Prensa inclinada',
      category: 'legs',
      order: 1,
      targetSets: 4,
      targetRepsMin: 8,
      targetRepsMax: 10,
      hasWarmupSets: true,
      warmupSets: 2,
      targetRirMin: 1,
      targetRirMax: 2,
      choiceGroup: 'legs-main',
    },
    {
      id: 'curl-femoral-sentado',
      name: 'Curl femoral sentado',
      category: 'legs',
      order: 2,
      targetSets: 3,
      targetRepsMin: 12,
      targetRepsMax: 15,
      hasWarmupSets: false,
      targetRirMin: 1,
      targetRirMax: 2,
    },
    {
      id: 'hip-thrust',
      name: 'Hip thrust',
      category: 'legs',
      order: 3,
      targetSets: 3,
      targetRepsMin: 10,
      targetRepsMax: 12,
      hasWarmupSets: false,
      targetRirMin: 1,
      targetRirMax: 2,
    },
    {
      id: 'abductor-maquina',
      name: 'Abductor en máquina',
      category: 'legs',
      order: 4,
      targetSets: 3,
      targetRepsMin: 15,
      targetRepsMax: 20,
      hasWarmupSets: false,
      targetRirMin: 2,
      targetRirMax: 2,
    },
    {
      id: 'elevacion-gemelos-maquina-pie',
      name: 'Elevación de gemelos en máquina de pie',
      category: 'legs',
      order: 5,
      targetSets: 2,
      targetRepsMin: 15,
      targetRepsMax: 20,
      hasWarmupSets: false,
      targetRirMin: 1,
      targetRirMax: 1,
    },

    // ── ABS (elegir un ejercicio) ──
    {
      id: 'abs-colgado-barra',
      name: 'Abs colgado de barra',
      category: 'abs',
      order: 1,
      targetSets: 4,
      targetRepsMin: 8,
      targetRepsMax: 15,
      hasWarmupSets: true,
      warmupSets: 2,
      choiceGroup: 'abs-main',
    },
    {
      id: 'crunch-polea',
      name: 'Crunch con polea',
      category: 'abs',
      order: 1,
      targetSets: 4,
      targetRepsMin: 8,
      targetRepsMax: 15,
      hasWarmupSets: true,
      warmupSets: 2,
      choiceGroup: 'abs-main',
    },
    {
      id: 'dragon-flight',
      name: 'Dragon flight',
      category: 'abs',
      order: 1,
      targetSets: 4,
      targetRepsMin: 6,
      targetRepsMax: 12,
      hasWarmupSets: true,
      warmupSets: 2,
      choiceGroup: 'abs-main',
    },
  ];

  // ─── Métodos públicos ───

  /** Devuelve TODOS los ejercicios candidatos para una sesión (incluye alternativas de choiceGroup sin filtrar) */
  getExercisesForDay(dayType: 'push' | 'pull' | 'legs' | 'abs', _variant: 'A' | 'B'): ExerciseTemplate[] {
    return this.allExercises
      .filter((ex) => ex.category === dayType)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Devuelve los grupos de elección para una sesión.
   * Si no hay choices, devuelve array vacío.
   */
  getChoicesForDay(dayType: 'push' | 'pull' | 'legs' | 'abs', dayVariant: 'A' | 'B'): { groupId: string; label: string; options: ExerciseTemplate[] }[] {
    const all = this.getExercisesForDay(dayType, dayVariant);
    const choiceMap = new Map<string, ExerciseTemplate[]>();

    for (const ex of all) {
      if (ex.choiceGroup) {
        const group = choiceMap.get(ex.choiceGroup) ?? [];
        group.push(ex);
        choiceMap.set(ex.choiceGroup, group);
      }
    }

    return [...choiceMap.entries()].map(([groupId, options]) => ({
      groupId,
      label: this.getChoiceLabel(groupId),
      options,
    }));
  }

  /** Etiqueta legible para un grupo de elección */
  private getChoiceLabel(groupId: string): string {
    switch (groupId) {
      case 'push-main': return 'Ejercicio principal de pecho';
      case 'pull-main': return 'Ejercicio principal de espalda';
      case 'pull-curl': return 'Ejercicio de bíceps';
      case 'legs-main': return 'Ejercicio principal de pierna';
      case 'abs-main': return 'Ejercicio de abdominales';
      default: return 'Elige ejercicio';
    }
  }

  /** Lista de los 4 tipos de sesión disponibles */
  getTrainingDays(): DayInfo[] {
    return this.sessionTypes.map((st, i) => ({
      weekday: i + 1,
      dayType: st.dayType,
      dayVariant: st.dayVariant,
      label: st.label,
      muscleLabel: st.muscleLabel,
      emoji: st.emoji,
    }));
  }

  /** Dado un día de la semana (1-4), devuelve la info de la sesión */
  getDayInfo(weekday: number): DayInfo | null {
    const st = this.sessionTypes[weekday - 1];
    if (!st) return null;
    return {
      weekday,
      dayType: st.dayType,
      dayVariant: st.dayVariant,
      label: st.label,
      muscleLabel: st.muscleLabel,
      emoji: st.emoji,
    };
  }

  /** Busca un template por su id */
  getTemplateById(id: string): ExerciseTemplate | undefined {
    return this.allExercises.find((ex) => ex.id === id);
  }
}
