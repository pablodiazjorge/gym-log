import { Component, computed, inject, signal } from '@angular/core';
import { RoutineService } from '../../core/services/routine.service';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { ExerciseTemplate, MuscleGroup } from '../../core/models/workout.model';

interface GroupSection {
  group: MuscleGroup;
  label: string;
  emoji: string;
  exercises: ExerciseTemplate[];
}

@Component({
  selector: 'app-exercise-library',
  imports: [],
  templateUrl: './exercise-library.html',
  styleUrl: './exercise-library.css',
})
export class ExerciseLibrary {
  private readonly routineService = inject(RoutineService);
  readonly library = inject(ExerciseLibraryService);

  readonly groupFilter = signal<MuscleGroup | 'all'>('all');

  readonly groups: { value: MuscleGroup; label: string; emoji: string }[] = [
    { value: 'chest', label: 'Chest', emoji: '💪' },
    { value: 'back', label: 'Back', emoji: '🏋️' },
    { value: 'shoulders', label: 'Shoulders', emoji: '🎯' },
    { value: 'biceps', label: 'Biceps', emoji: '💪' },
    { value: 'triceps', label: 'Triceps', emoji: '💪' },
    { value: 'quads', label: 'Quads', emoji: '🦵' },
    { value: 'hamstrings', label: 'Hamstrings', emoji: '🦵' },
    { value: 'glutes', label: 'Glutes', emoji: '🍑' },
    { value: 'calves', label: 'Calves', emoji: '🦵' },
    { value: 'abs', label: 'Abs', emoji: '🪨' },
  ];

  readonly sections = computed<GroupSection[]>(() => {
    const filter = this.groupFilter();
    const all = this.routineService.getAllExercises();
    return this.groups
      .filter((g) => filter === 'all' || g.value === filter)
      .map((g) => ({
        group: g.value,
        label: g.label,
        emoji: g.emoji,
        exercises: all.filter((ex) => ex.muscleGroup === g.value),
      }))
      .filter((section) => section.exercises.length > 0);
  });

  readonly enabledCount = computed(() => this.library.enabledIds().size);
  readonly totalCount = this.routineService.getAllExercises().length;

  resetToDefaults(): void {
    if (confirm('Restore the default exercise selection?')) {
      this.library.resetToDefaults();
    }
  }
}
