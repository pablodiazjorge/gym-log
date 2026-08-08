import { Injectable, signal } from '@angular/core';
import { Routine, RoutineExerciseConfig } from '../models/routine.model';

const ROUTINES_KEY = 'gym_custom_routines';

/**
 * CRUD store for user-created custom routines, persisted in localStorage.
 * Built-in routines are NOT stored here — they are derived at read time by
 * RoutineService.getBuiltInRoutines(); combine both at the call site.
 */
@Injectable({ providedIn: 'root' })
export class RoutineLibraryService {
  /** All user-created routines */
  readonly customRoutines = signal<Routine[]>([]);

  constructor() {
    this.loadRoutines();
  }

  /** Load custom routines from localStorage */
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

  /** Delete a custom routine by id */
  deleteRoutine(id: string): void {
    this.customRoutines.update((list) => list.filter((r) => r.id !== id));
    this.persistRoutines();
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
}
