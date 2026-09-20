import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { ExerciseTemplate } from '../../core/models/workout.model';
import { categoryBadgeClass } from '../theme';
import { Icon } from './icon';

export type PickerCategory = 'push' | 'pull' | 'legs' | 'abs' | 'all';
type Category = Exclude<PickerCategory, 'all'>;

/**
 * Picks one enabled catalog exercise. Shared by the routine editor and the
 * in-workout swap so both offer the same list, the same tabs and the same
 * exclusions — the host decides when it shows and what to do with the pick.
 *
 * The picker is usually created and destroyed per use (`@if`), so the tab the
 * user chose is reported through `categoryChanged`; a host that wants the tab
 * to survive a close feeds it back through `initialCategory`.
 */
@Component({
  selector: 'app-exercise-picker',
  imports: [Icon],
  templateUrl: './exercise-picker.html',
})
export class ExercisePicker {
  private readonly exerciseLibrary = inject(ExerciseLibraryService);

  /** Not `title`: that name is also the global HTML attribute and would render a tooltip on the host */
  readonly heading = input('Add exercise');
  /** Template ids to leave out — already in the routine or the session */
  readonly exclude = input<readonly string[]>([]);
  /** Category tab selected when the picker opens */
  readonly initialCategory = input<PickerCategory>('all');

  readonly picked = output<ExerciseTemplate>();
  readonly closed = output<void>();
  readonly categoryChanged = output<PickerCategory>();

  readonly categories: { value: Category | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'push', label: 'Push' },
    { value: 'pull', label: 'Pull' },
    { value: 'legs', label: 'Legs' },
    { value: 'abs', label: 'Abs' },
  ];

  /** null until the user taps a tab, so the host's initial category applies */
  private readonly chosenCategory = signal<Category | 'all' | null>(null);
  readonly activeCategory = computed(() => this.chosenCategory() ?? this.initialCategory());

  readonly filteredExercises = computed(() => {
    const cat = this.activeCategory();
    const excluded = new Set(this.exclude());
    return this.exerciseLibrary
      .enabledExercises()
      .filter((ex) => !excluded.has(ex.id) && (cat === 'all' || ex.category === cat));
  });

  selectCategory(value: Category | 'all'): void {
    this.chosenCategory.set(value);
    this.categoryChanged.emit(value);
  }

  badge(category: string): string {
    return categoryBadgeClass(category);
  }
}
