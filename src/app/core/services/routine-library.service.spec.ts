import { beforeEach, describe, expect, it } from 'vitest';
import { RoutineLibraryService } from './routine-library.service';
import { RoutineExerciseConfig } from '../models/routine.model';

const config = (overrides: Partial<RoutineExerciseConfig> = {}): RoutineExerciseConfig => ({
  templateId: 'press-inclinado-maquina',
  order: 1,
  targetSets: 4,
  targetRepsMin: 10,
  targetRepsMax: 12,
  hasWarmupSets: true,
  warmupSets: 2,
  restSeconds: 120,
  ...overrides,
});

describe('RoutineLibraryService', () => {
  let service: RoutineLibraryService;

  beforeEach(() => {
    localStorage.clear();
    service = new RoutineLibraryService();
  });

  describe('validation', () => {
    it('rejects an empty name', () => {
      expect(service.validateRoutine({ name: '   ', exercises: [config()] })).not.toHaveLength(0);
    });

    it('rejects an empty exercise list', () => {
      expect(service.validateRoutine({ name: 'Push A', exercises: [] })).not.toHaveLength(0);
    });

    it('rejects repsMin > repsMax and sets < 1', () => {
      const bad = config({ targetRepsMin: 12, targetRepsMax: 8, targetSets: 0 });
      const errors = service.validateRoutine({ name: 'Push A', exercises: [bad] });
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });

    it('accepts a valid routine', () => {
      expect(service.validateRoutine({ name: 'Push A', exercises: [config()] })).toHaveLength(0);
    });
  });

  describe('CRUD', () => {
    it('creates, persists and reloads a routine', () => {
      const created = service.createRoutine({ name: 'Push A', exercises: [config()] });
      expect(created.source).toBe('custom');
      expect(service.customRoutines()).toHaveLength(1);

      // A fresh instance reads the same data back from localStorage
      const fresh = new RoutineLibraryService();
      expect(fresh.customRoutines()).toHaveLength(1);
      expect(fresh.getRoutineById(created.id)?.name).toBe('Push A');
    });

    it('throws on invalid create input', () => {
      expect(() => service.createRoutine({ name: '', exercises: [] })).toThrow();
    });

    it('updates a routine and re-normalizes exercise order', () => {
      const created = service.createRoutine({
        name: 'Push A',
        exercises: [config(), config({ templateId: 'pec-deck', order: 99 })],
      });
      service.updateRoutine(created.id, { name: 'Push B' });
      const updated = service.getRoutineById(created.id)!;
      expect(updated.name).toBe('Push B');
      expect(updated.exercises.map((e) => e.order)).toEqual([1, 2]);
    });

    it('deletes by id', () => {
      const created = service.createRoutine({ name: 'Push A', exercises: [config()] });
      service.deleteRoutine(created.id);
      expect(service.customRoutines()).toHaveLength(0);
    });
  });

  describe('createFromRoutine (duplicate to customize)', () => {
    it('deep-clones exercises — mutating the copy never touches the source', () => {
      const original = service.createRoutine({ name: 'Push A', exercises: [config()] });
      const copy = service.createFromRoutine(original, 'Push A v2');

      expect(copy.id).not.toBe(original.id);
      expect(copy.source).toBe('custom');

      copy.exercises[0].targetSets = 99;
      expect(service.getRoutineById(original.id)!.exercises[0].targetSets).toBe(4);
    });
  });

  describe('importRoutines', () => {
    it('skips duplicates by id and non-custom sources', () => {
      const created = service.createRoutine({ name: 'Push A', exercises: [config()] });
      const count = service.importRoutines([
        created, // duplicate id → skipped
        { ...created, id: 'routine-999', name: 'Imported' }, // fresh → imported
        { ...created, id: 'built-in-push', source: 'built-in' }, // built-in → skipped
      ]);
      expect(count).toBe(1);
      expect(service.customRoutines()).toHaveLength(2);
    });
  });
});
