import { Injectable } from '@angular/core';
import { DayInfo, ExerciseTemplate } from '../models/workout.model';
import { Routine, RoutineExerciseConfig } from '../models/routine.model';

/**
 * Exercise catalog + built-in PPL + Abs routine provider.
 * 4 built-in session types: Push, Pull, Legs, Abs — each may offer
 * alternative exercises to choose from at the start (choice groups).
 *
 * NOTE: ExerciseTemplate ids are Spanish-derived slugs kept as stable FKs into
 * the user's logged history — they are internal opaque keys, exempt from the
 * English rewrite (ADR-0008). Only human-facing names/notes are English.
 */
@Injectable({ providedIn: 'root' })
export class RoutineService {
  // ─── Available session types ───
  private readonly sessionTypes: { dayType: 'push' | 'pull' | 'legs' | 'abs'; dayVariant: 'A'; label: string; muscleLabel: string; emoji: string }[] = [
    { dayType: 'push', dayVariant: 'A', label: 'Push', muscleLabel: 'Chest, shoulders, triceps', emoji: '💪' },
    { dayType: 'pull', dayVariant: 'A', label: 'Pull', muscleLabel: 'Back, biceps', emoji: '🏋️' },
    { dayType: 'legs', dayVariant: 'A', label: 'Legs', muscleLabel: 'Quads, hamstrings, glutes, calves', emoji: '🦵' },
    { dayType: 'abs', dayVariant: 'A', label: 'Abs', muscleLabel: 'Abdominals', emoji: '🪨' },
  ];

  // ─── Routine exercises ───
  private readonly allExercises: ExerciseTemplate[] = [
    // ── PUSH (choose: incline press or flat press) ──
    {
      id: 'press-inclinado-maquina',
      name: 'Incline Machine Press',
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
      name: 'Flat Press',
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
      name: 'Incline Smith Press',
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
      name: 'Cable Triceps Pushdown',
      category: 'push',
      order: 3,
      targetSets: 3,
      targetRepsMin: 12,
      targetRepsMax: 15,
      hasWarmupSets: false,
    },
    {
      id: 'elevaciones-laterales-banco-inclinado',
      name: 'Incline Bench Lateral Raises',
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

    // ── PULL (choose: bar lat pulldown, MAG neutral, pull-ups or 1-arm pulldown; incline bench curl or hammer curl) ──
    {
      id: 'jalon-pecho-agarre-ancho',
      name: 'Lat Pulldown (bar & straps, wide pronated grip)',
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
      name: 'Lat Pulldown (wide MAG grip, neutral)',
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
      id: 'dominadas-agarre-prono',
      name: 'Pronated-Grip Pull-Ups',
      category: 'pull',
      order: 1,
      targetSets: 4,
      targetRepsMin: 6,
      targetRepsMax: 10,
      hasWarmupSets: true,
      warmupSets: 2,
      choiceGroup: 'pull-main',
      notes: 'Wide pronated grip. If you cannot reach 6 reps, use a band or negative reps.',
    },
    {
      id: 'jalon-lat-1-mano',
      name: 'Single-Arm Lat Pulldown',
      category: 'pull',
      order: 1,
      targetSets: 4,
      targetRepsMin: 8,
      targetRepsMax: 12,
      hasWarmupSets: true,
      warmupSets: 2,
      choiceGroup: 'pull-main',
      notes: 'Grab the single handle. Pull toward the chest, elbow close to the body.',
    },
    {
      id: 'remo-t-agarre-neutro',
      name: 'T-Bar Row (neutral shoulder-width grip)',
      category: 'pull',
      order: 2,
      targetSets: 3,
      targetRepsMin: 10,
      targetRepsMax: 12,
      hasWarmupSets: false,
    },
    {
      id: 'curl-biceps-banco-inclinado',
      name: 'Incline Bench Biceps Curl',
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
      name: 'Hammer Curl',
      category: 'pull',
      order: 3,
      targetSets: 4,
      targetRepsMin: 10,
      targetRepsMax: 12,
      hasWarmupSets: false,
      choiceGroup: 'pull-curl',
    },

    // ── LEGS (main exercise to choose: hack squat, incline leg press or weighted squats) ──
    {
      id: 'hack-squat-maquina',
      name: 'Machine Hack Squat',
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
      name: 'Incline Leg Press',
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
      notes: 'Feet low, shoulder-width. Controlled range, lower back supported.',
    },
    {
      id: 'sentadillas-lastradas-casa',
      name: 'Weighted Squats (home)',
      category: 'legs',
      order: 1,
      targetSets: 4,
      targetRepsMin: 10,
      targetRepsMax: 15,
      hasWarmupSets: true,
      warmupSets: 2,
      targetRirMin: 1,
      targetRirMax: 2,
      choiceGroup: 'legs-main',
      notes: 'With a weighted backpack or dumbbells at home. Deep controlled range.',
    },
    {
      id: 'curl-femoral-sentado',
      name: 'Seated Leg Curl',
      category: 'legs',
      order: 2,
      targetSets: 3,
      targetRepsMin: 12,
      targetRepsMax: 15,
      hasWarmupSets: false,
      targetRirMin: 1,
      targetRirMax: 2,
      choiceGroup: 'legs-femoral',
    },
    {
      id: 'rdl-una-pierna',
      name: 'Single-Leg RDL',
      category: 'legs',
      order: 2,
      targetSets: 3,
      targetRepsMin: 10,
      targetRepsMax: 12,
      hasWarmupSets: false,
      targetRirMin: 2,
      targetRirMax: 2,
      choiceGroup: 'legs-femoral',
      notes: 'Torso straight, rear leg as counterweight.',
    },
    {
      id: 'hip-thrust',
      name: 'Hip Thrust',
      category: 'legs',
      order: 3,
      targetSets: 3,
      targetRepsMin: 10,
      targetRepsMax: 12,
      hasWarmupSets: false,
      targetRirMin: 1,
      targetRirMax: 2,
      choiceGroup: 'legs-glute',
    },
    {
      id: 'abductor-maquina',
      name: 'Machine Hip Abduction',
      category: 'legs',
      order: 3,
      targetSets: 3,
      targetRepsMin: 15,
      targetRepsMax: 20,
      hasWarmupSets: false,
      targetRirMin: 2,
      targetRirMax: 2,
      choiceGroup: 'legs-glute',
      notes: 'Lean 10-20° forward. Pause at peak contraction.',
    },
    {
      id: 'elevacion-gemelos-maquina-pie',
      name: 'Standing Machine Calf Raise',
      category: 'legs',
      order: 4,
      targetSets: 2,
      targetRepsMin: 15,
      targetRepsMax: 20,
      hasWarmupSets: false,
      targetRirMin: 1,
      targetRirMax: 1,
      choiceGroup: 'legs-calves',
    },
    {
      id: 'elevacion-gemelos-sentado',
      name: 'Seated Calf Raise',
      category: 'legs',
      order: 4,
      targetSets: 2,
      targetRepsMin: 15,
      targetRepsMax: 20,
      hasWarmupSets: false,
      targetRirMin: 1,
      targetRirMax: 1,
      choiceGroup: 'legs-calves',
    },
    {
      id: 'bulgara-smith',
      name: 'Smith Bulgarian Split Squat',
      category: 'legs',
      order: 5,
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 12,
      hasWarmupSets: false,
      targetRirMin: 1,
      targetRirMax: 2,
      choiceGroup: 'legs-bulgara',
    },

    // ── ABS (choose one exercise) ──
    {
      id: 'abs-colgado-barra',
      name: 'Hanging Leg Raises',
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
      name: 'Cable Crunch',
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
      name: 'Dragon Flag',
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

  // ─── Public methods ───

  /** ALL candidate exercises for a session (choice-group alternatives included, unfiltered) */
  getExercisesForDay(dayType: 'push' | 'pull' | 'legs' | 'abs', _variant: 'A' | 'B'): ExerciseTemplate[] {
    return this.allExercises
      .filter((ex) => ex.category === dayType)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Choice groups for a session.
   * Returns an empty array when there is nothing to choose.
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

  /** Human-readable label for a choice group */
  private getChoiceLabel(groupId: string): string {
    switch (groupId) {
      case 'push-main': return 'Main chest exercise';
      case 'pull-main': return 'Main back exercise';
      case 'pull-curl': return 'Biceps exercise';
      case 'legs-main': return 'Main leg exercise';
      case 'legs-femoral': return 'Hamstring exercise';
      case 'legs-glute': return 'Glute exercise';
      case 'legs-calves': return 'Calf exercise';
      case 'legs-bulgara': return 'Bulgarian split squat (extra)';
      case 'abs-main': return 'Abs exercise';
      default: return 'Choose an exercise';
    }
  }

  /** The 4 available built-in session types */
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

  /** Session info for a given weekday index (1-4) */
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

  /** ALL exercises across every category */
  getAllExercises(): ExerciseTemplate[] {
    return [...this.allExercises].sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order);
  }

  /** Look up a template by id */
  getTemplateById(id: string): ExerciseTemplate | undefined {
    return this.allExercises.find((ex) => ex.id === id);
  }

  /**
   * The 4 built-in days derived as read-only Routine objects so the Routines
   * tab can list them uniformly next to custom ones. For choice groups, the
   * first option is used as the representative exercise — starting a built-in
   * day through the day-card flow still goes through the live choice-selection
   * UX; this derivation only feeds the Routines list and "duplicate to
   * customize".
   */
  getBuiltInRoutines(): Routine[] {
    return this.sessionTypes.map((st) => {
      const seenGroups = new Set<string>();
      const exercises: RoutineExerciseConfig[] = [];
      for (const ex of this.getExercisesForDay(st.dayType, st.dayVariant)) {
        if (ex.choiceGroup) {
          if (seenGroups.has(ex.choiceGroup)) continue; // first option represents the group
          seenGroups.add(ex.choiceGroup);
        }
        exercises.push({
          templateId: ex.id,
          order: ex.order,
          targetSets: ex.targetSets,
          targetRepsMin: ex.targetRepsMin,
          targetRepsMax: ex.targetRepsMax,
          hasWarmupSets: ex.hasWarmupSets,
          warmupSets: ex.warmupSets,
          targetRirMin: ex.targetRirMin,
          targetRirMax: ex.targetRirMax,
          notes: ex.notes,
        });
      }
      return {
        id: `built-in-${st.dayType}`,
        name: st.label,
        source: 'built-in' as const,
        builtInDayType: st.dayType,
        exercises,
        createdAt: '',
        updatedAt: '',
      };
    });
  }
}
