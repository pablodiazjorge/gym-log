import { Injectable } from '@angular/core';
import { DayInfo, ExerciseTemplate } from '../models/workout.model';
import { Routine, RoutineExerciseConfig } from '../models/routine.model';
import { EXERCISE_CATALOG } from '../data/exercises';

/**
 * Exercise catalog + built-in PPL + Abs routine provider.
 * The catalog lives in src/app/core/data/exercises/* (mirrored in
 * docs/exercises/*.md); this service is the read-only access layer.
 *
 * 4 built-in session types: Push, Pull, Legs, Abs — their members are the
 * catalog entries flagged `builtInDay`. Other catalog exercises join built-in
 * days only as enabled alternatives of a choiceGroup (see
 * ExerciseLibraryService / ADR-0011).
 *
 * ExerciseTemplate ids are English slugs used as stable FKs into the user's
 * logged history (ADR-0012 — v2 format).
 */
@Injectable({ providedIn: 'root' })
export class RoutineService {
  // ─── Available session types ───
  private readonly sessionTypes: { dayType: 'push' | 'pull' | 'legs' | 'abs'; label: string; muscleLabel: string; emoji: string }[] = [
    { dayType: 'push', label: 'Push', muscleLabel: 'Chest, shoulders, triceps', emoji: '💪' },
    { dayType: 'pull', label: 'Pull', muscleLabel: 'Back, biceps', emoji: '🏋️' },
    { dayType: 'legs', label: 'Legs', muscleLabel: 'Quads, hamstrings, glutes, calves', emoji: '🦵' },
    { dayType: 'abs', label: 'Abs', muscleLabel: 'Abdominals', emoji: '🪨' },
  ];

  private readonly allExercises: ExerciseTemplate[] = EXERCISE_CATALOG;

  // ─── Public methods ───

  /**
   * Candidate exercises for a built-in session: only the original built-in
   * day members (choice-group alternatives included, unfiltered). Catalog
   * extras never auto-join a day here.
   */
  getExercisesForDay(dayType: 'push' | 'pull' | 'legs' | 'abs'): ExerciseTemplate[] {
    return this.allExercises
      .filter((ex) => ex.category === dayType && ex.builtInDay)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Choice groups for a built-in session (built-in members only — the
   * enabled-aware variant lives in ExerciseLibraryService).
   * Returns an empty array when there is nothing to choose.
   */
  getChoicesForDay(dayType: 'push' | 'pull' | 'legs' | 'abs'): { groupId: string; label: string; options: ExerciseTemplate[] }[] {
    const all = this.getExercisesForDay(dayType);
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
  getChoiceLabel(groupId: string): string {
    switch (groupId) {
      case 'push-main': return 'Main chest exercise';
      case 'pull-main': return 'Main back exercise';
      case 'pull-curl': return 'Biceps exercise';
      case 'legs-main': return 'Main leg exercise';
      case 'legs-femoral': return 'Hamstring exercise';
      case 'legs-glute': return 'Glute exercise';
      case 'legs-calves': return 'Calf exercise';
      case 'legs-split-squat': return 'Bulgarian split squat (extra)';
      case 'abs-main': return 'Abs exercise';
      default: return 'Choose an exercise';
    }
  }

  /** The 4 available built-in session types */
  getTrainingDays(): DayInfo[] {
    return this.sessionTypes.map((st, i) => ({
      weekday: i + 1,
      dayType: st.dayType,
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
      label: st.label,
      muscleLabel: st.muscleLabel,
      emoji: st.emoji,
    };
  }

  /** ALL catalog exercises across every category */
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
      for (const ex of this.getExercisesForDay(st.dayType)) {
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
