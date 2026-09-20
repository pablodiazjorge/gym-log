import { Injectable, signal } from '@angular/core';
import { Routine, RoutineExerciseConfig } from '../models/routine.model';

const ROUTINES_KEY = 'gym_custom_routines';
const HOME_ROUTINES_KEY = 'gym_home_routines';

/**
 * CRUD store for user-created custom routines, persisted in localStorage.
 * Built-in routines are NOT stored here — they are derived at read time by
 * RoutineService.getBuiltInRoutines(); combine both at the call site.
 *
 * Also owns which routines the Home screen shows (`homeRoutineIds`): an
 * ordered id list over BOTH sources, so a custom routine can replace or sit
 * next to the built-in days.
 */
@Injectable({ providedIn: 'root' })
export class RoutineLibraryService {
  /** All user-created routines */
  readonly customRoutines = signal<Routine[]>([]);

  /**
   * Ordered ids of the routines pinned to Home. `null` = the user never
   * customized the selection, and Home falls back to the built-in days —
   * that distinction is why this is not simply an empty array.
   */
  readonly homeRoutineIds = signal<string[] | null>(null);

  constructor() {
    this.loadRoutines();
  }

  /** Load custom routines and the Home selection from localStorage */
  loadRoutines(): void {
    try {
      const raw = localStorage.getItem(ROUTINES_KEY);
      if (raw) {
        this.customRoutines.set(JSON.parse(raw) as Routine[]);
      }
    } catch {
      console.warn('Failed to load custom routines from localStorage, starting empty');
      this.customRoutines.set([]);
    }
    try {
      const raw = localStorage.getItem(HOME_ROUTINES_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      this.homeRoutineIds.set(
        Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : null,
      );
    } catch {
      console.warn('Failed to load the Home routine selection, falling back to built-ins');
      this.homeRoutineIds.set(null);
    }
  }

  /** The Home selection, falling back to the given built-in defaults */
  homeIdsOrDefault(defaults: readonly string[]): string[] {
    return this.homeRoutineIds() ?? [...defaults];
  }

  /**
   * Pin a routine to Home or remove it. The first toggle materializes the
   * default built-in selection so the rest of it survives the edit.
   */
  toggleHomeRoutine(id: string, defaults: readonly string[]): void {
    const current = this.homeIdsOrDefault(defaults);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    this.homeRoutineIds.set(next);
    this.persistHomeRoutineIds();
  }

  /**
   * Validate routine input. Returns an array of error messages (empty = valid).
   */
  validateRoutine(input: { name: string; exercises: RoutineExerciseConfig[] }): string[] {
    const errors: string[] = [];
    if (!input.name.trim()) errors.push('Routine name cannot be empty.');
    if (input.exercises.length === 0) errors.push('A routine needs at least one exercise.');
    for (const ex of input.exercises) {
      if (ex.targetSets < 1) errors.push(`${ex.templateId}: sets must be at least 1.`);
      if (ex.targetRepsMin > ex.targetRepsMax) {
        errors.push(`${ex.templateId}: minimum reps cannot exceed maximum reps.`);
      }
      if (
        ex.targetRirMin != null &&
        ex.targetRirMax != null &&
        ex.targetRirMin > ex.targetRirMax
      ) {
        errors.push(`${ex.templateId}: minimum RIR cannot exceed maximum RIR.`);
      }
    }
    return errors;
  }

  /** Create a new custom routine. Throws on invalid input. */
  createRoutine(input: { name: string; exercises: RoutineExerciseConfig[] }): Routine {
    const errors = this.validateRoutine(input);
    if (errors.length > 0) throw new Error(errors.join(' '));
    const now = new Date().toISOString();
    const routine: Routine = {
      // Random suffix so two routines created in the same millisecond never collide
      id: `routine-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: input.name.trim(),
      source: 'custom',
      exercises: input.exercises.map((ex, i) => ({ ...ex, order: i + 1 })),
      createdAt: now,
      updatedAt: now,
    };
    this.customRoutines.update((list) => [...list, routine]);
    this.persistRoutines();
    return routine;
  }

  /** Fork any routine (built-in or custom) into a new editable custom copy */
  createFromRoutine(source: Routine, newName: string): Routine {
    return this.createRoutine({
      name: newName,
      exercises: source.exercises.map((ex) => ({ ...ex })), // deep enough: configs are flat objects
    });
  }

  /** Update an existing custom routine. Throws on invalid result. */
  updateRoutine(id: string, patch: Partial<Pick<Routine, 'name' | 'exercises'>>): void {
    const existing = this.customRoutines().find((r) => r.id === id);
    if (!existing) return;
    const updated: Routine = {
      ...existing,
      ...patch,
      exercises: (patch.exercises ?? existing.exercises).map((ex, i) => ({ ...ex, order: i + 1 })),
      updatedAt: new Date().toISOString(),
    };
    const errors = this.validateRoutine(updated);
    if (errors.length > 0) throw new Error(errors.join(' '));
    this.customRoutines.update((list) => list.map((r) => (r.id === id ? updated : r)));
    this.persistRoutines();
  }

  /** Delete a custom routine by id (and drop it from the Home selection) */
  deleteRoutine(id: string): void {
    this.customRoutines.update((list) => list.filter((r) => r.id !== id));
    this.persistRoutines();
    const home = this.homeRoutineIds();
    if (home?.includes(id)) {
      this.homeRoutineIds.set(home.filter((x) => x !== id));
      this.persistHomeRoutineIds();
    }
  }

  /** Look up a CUSTOM routine by id (built-ins live in RoutineService) */
  getRoutineById(id: string): Routine | undefined {
    return this.customRoutines().find((r) => r.id === id);
  }

  /** Import routines from an export file, skipping duplicates by id */
  importRoutines(incoming: Routine[]): number {
    const current = this.customRoutines();
    const existingIds = new Set(current.map((r) => r.id));
    const fresh = incoming.filter((r) => r.source === 'custom' && !existingIds.has(r.id));
    if (fresh.length > 0) {
      this.customRoutines.set([...current, ...fresh]);
      this.persistRoutines();
    }
    return fresh.length;
  }

  private persistRoutines(): void {
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(this.customRoutines()));
  }

  private persistHomeRoutineIds(): void {
    const ids = this.homeRoutineIds();
    if (ids === null) {
      localStorage.removeItem(HOME_ROUTINES_KEY);
    } else {
      localStorage.setItem(HOME_ROUTINES_KEY, JSON.stringify(ids));
    }
  }
}
