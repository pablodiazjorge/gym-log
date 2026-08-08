import { Injectable, computed, signal } from '@angular/core';
import { ExerciseTemplate } from '../models/workout.model';
import { RoutineService } from './routine.service';

const ENABLED_KEY = 'gym_enabled_exercises';

/**
 * Which catalog exercises the user has enabled. Only enabled exercises appear
 * in the pickers (routine editor, /additional, built-in day choice groups).
 * Default = the original built-in day members, so behavior is unchanged until
 * the user opts into more (ADR-0011).
 */
@Injectable({ providedIn: 'root' })
export class ExerciseLibraryService {
  /** Enabled exercise ids (persisted) */
  readonly enabledIds = signal<Set<string>>(new Set());

  /** Enabled templates, catalog-ordered */
  readonly enabledExercises = computed<ExerciseTemplate[]>(() => {
    const enabled = this.enabledIds();
    return this.routineService.getAllExercises().filter((ex) => enabled.has(ex.id));
  });

  // Constructor injection (not inject()) so the service is instantiable in
  // plain unit tests without an Angular injection context.
  // eslint-disable-next-line @angular-eslint/prefer-inject
  constructor(private readonly routineService: RoutineService) {
    this.loadEnabled();
  }

  /** Default set: the original members of the built-in days */
  private defaultEnabledIds(): Set<string> {
    return new Set(
      this.routineService
        .getAllExercises()
        .filter((ex) => ex.builtInDay)
        .map((ex) => ex.id),
    );
  }

  loadEnabled(): void {
    try {
      const raw = localStorage.getItem(ENABLED_KEY);
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        this.enabledIds.set(new Set(ids));
        return;
      }
    } catch {
      console.warn('Failed to load enabled exercises from localStorage, using defaults');
    }
    this.enabledIds.set(this.defaultEnabledIds());
  }

  isEnabled(id: string): boolean {
    return this.enabledIds().has(id);
  }

  setEnabled(id: string, enabled: boolean): void {
    this.enabledIds.update((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
    this.persist();
  }

  toggle(id: string): void {
    this.setEnabled(id, !this.isEnabled(id));
  }

  /**
   * Choice groups for a built-in day, filtered by the enabled set and extended
   * with enabled catalog variations sharing the same choiceGroup. A group
   * never renders empty: if every option were disabled, the full built-in
   * option list is used as fallback.
   */
  getChoicesForDay(
    dayType: 'push' | 'pull' | 'legs' | 'abs',
  ): { groupId: string; label: string; options: ExerciseTemplate[] }[] {
    const enabled = this.enabledIds();
    const baseGroups = this.routineService.getChoicesForDay(dayType);
    const extras = this.routineService
      .getAllExercises()
      .filter((ex) => !ex.builtInDay && ex.choiceGroup && ex.category === dayType && enabled.has(ex.id));

    return baseGroups.map((group) => {
      const enabledBase = group.options.filter((ex) => enabled.has(ex.id));
      const enabledExtras = extras.filter((ex) => ex.choiceGroup === group.groupId);
      const options = [...enabledBase, ...enabledExtras];
      // Never-empty fallback: keep the original built-in options
      return { ...group, options: options.length > 0 ? options : group.options };
    });
  }

  /** Restore the default enabled set (original built-in day members) */
  resetToDefaults(): void {
    this.enabledIds.set(this.defaultEnabledIds());
    this.persist();
  }

  /** Merge enabled ids from an import file (union — never disables anything) */
  importEnabledIds(incoming: string[]): number {
    const valid = new Set(this.routineService.getAllExercises().map((ex) => ex.id));
    let added = 0;
    this.enabledIds.update((prev) => {
      const next = new Set(prev);
      for (const id of incoming) {
        if (valid.has(id) && !next.has(id)) {
          next.add(id);
          added++;
        }
      }
      return next;
    });
    if (added > 0) this.persist();
    return added;
  }

  private persist(): void {
    localStorage.setItem(ENABLED_KEY, JSON.stringify([...this.enabledIds()]));
  }
}
