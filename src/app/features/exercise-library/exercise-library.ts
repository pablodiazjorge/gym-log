import { Component, computed, inject, signal } from '@angular/core';
import { RoutineService } from '../../core/services/routine.service';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { ExerciseTemplate, MuscleGroup } from '../../core/models/workout.model';

interface GroupSection {
  group: MuscleGroup;
  label: string;
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

  readonly groups: { value: MuscleGroup; label: string }[] = [
    { value: 'chest', label: 'Chest' },
    { value: 'back', label: 'Back' },
    { value: 'shoulders', label: 'Shoulders' },
    { value: 'biceps', label: 'Biceps' },
    { value: 'triceps', label: 'Triceps' },
    { value: 'quads', label: 'Quads' },
    { value: 'hamstrings', label: 'Hamstrings' },
    { value: 'glutes', label: 'Glutes' },
    { value: 'calves', label: 'Calves' },
    { value: 'abs', label: 'Abs' },
  ];

  readonly sections = computed<GroupSection[]>(() => {
    const filter = this.groupFilter();
    const all = this.routineService.getAllExercises();
    return this.groups
      .filter((g) => filter === 'all' || g.value === filter)
      .map((g) => ({
        group: g.value,
        label: g.label,
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
