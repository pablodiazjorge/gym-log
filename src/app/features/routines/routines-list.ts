import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RoutineService } from '../../core/services/routine.service';
import { RoutineLibraryService } from '../../core/services/routine-library.service';
import { Routine } from '../../core/models/routine.model';
import { Icon } from '../../shared/components/icon';
import { IconName } from '../../shared/components/icon-paths';
import { categoryIcon, categoryTileClass } from '../../shared/theme';

@Component({
  selector: 'app-routines-list',
  imports: [RouterLink, Icon],
  templateUrl: './routines-list.html',
  styleUrl: './routines-list.css',
})
export class RoutinesList {
  private readonly router = inject(Router);
  private readonly routineService = inject(RoutineService);
  readonly routineLibrary = inject(RoutineLibraryService);

  readonly builtInRoutines = this.routineService.getBuiltInRoutines();
  readonly customRoutines = computed(() => this.routineLibrary.customRoutines());

  private readonly builtInIds = this.builtInRoutines.map((r) => r.id);

  /** id of the routine whose action menu is open (null = none) */
  readonly menuOpenFor = signal<string | null>(null);

  /** Whether this routine is currently shown on the Home screen */
  isOnHome(id: string): boolean {
    return this.routineLibrary.homeIdsOrDefault(this.builtInIds).includes(id);
  }

  toggleHome(routine: Routine, event: Event): void {
    event.stopPropagation();
    this.menuOpenFor.set(null);
    this.routineLibrary.toggleHomeRoutine(routine.id, this.builtInIds);
  }

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

  getTile(routine: Routine): string {
    return categoryTileClass(routine.builtInDayType ?? 'routine');
  }

  getIcon(routine: Routine): IconName {
    return categoryIcon(routine.builtInDayType ?? 'routine');
  }

  getSubtitle(routine: Routine): string {
    const count = routine.exercises.length;
    return `${count} exercise${count === 1 ? '' : 's'}`;
  }
}
