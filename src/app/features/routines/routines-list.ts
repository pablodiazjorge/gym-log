import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RoutineService } from '../../core/services/routine.service';
import { RoutineLibraryService } from '../../core/services/routine-library.service';
import { Routine } from '../../core/models/routine.model';

@Component({
  selector: 'app-routines-list',
  imports: [RouterLink],
  templateUrl: './routines-list.html',
  styleUrl: './routines-list.css',
})
export class RoutinesList {
  private readonly router = inject(Router);
  private readonly routineService = inject(RoutineService);
  readonly routineLibrary = inject(RoutineLibraryService);

  readonly builtInRoutines = this.routineService.getBuiltInRoutines();
  readonly customRoutines = computed(() => this.routineLibrary.customRoutines());

  /** id of the routine whose action menu is open (null = none) */
  readonly menuOpenFor = signal<string | null>(null);

  startRoutine(routine: Routine): void {
    if (routine.source === 'built-in' && routine.builtInDayType) {
      // Built-in days keep their live choice-group selection UX
      this.router.navigate(['/workout', routine.builtInDayType]);
    } else {
      this.router.navigate(['/workout/routine', routine.id]);
    }
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.menuOpenFor.update((current) => (current === id ? null : id));
  }

  duplicateRoutine(routine: Routine, event: Event): void {
    event.stopPropagation();
    this.menuOpenFor.set(null);
    const name = prompt('Name for the copy:', `${routine.name} (copy)`);
    if (!name?.trim()) return;
    try {
      this.routineLibrary.createFromRoutine(routine, name.trim());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not duplicate the routine');
    }
  }

  editRoutine(routine: Routine, event: Event): void {
    event.stopPropagation();
    this.menuOpenFor.set(null);
    this.router.navigate(['/routines', routine.id, 'edit']);
  }

  deleteRoutine(routine: Routine, event: Event): void {
    event.stopPropagation();
    this.menuOpenFor.set(null);
    if (confirm(`Delete "${routine.name}"?`)) {
      this.routineLibrary.deleteRoutine(routine.id);
    }
  }

  getDayEmoji(routine: Routine): string {
    switch (routine.builtInDayType) {
      case 'push': return '💪';
      case 'pull': return '🏋️';
      case 'legs': return '🦵';
      case 'abs': return '🪨';
      default: return '📋';
    }
  }

  getAccentColor(routine: Routine): string {
    switch (routine.builtInDayType) {
      case 'push': return '#3b82f6';
      case 'pull': return '#10b981';
      case 'legs': return '#f59e0b';
      case 'abs': return '#ec4899';
      default: return '#8b5cf6';
    }
  }

  getSubtitle(routine: Routine): string {
    const count = routine.exercises.length;
    return `${count} exercise${count === 1 ? '' : 's'}`;
  }
}
