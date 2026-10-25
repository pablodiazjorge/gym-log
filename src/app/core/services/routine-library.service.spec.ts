import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutineLibraryService, isValidRoutine } from './routine-library.service';
import { Routine, RoutineExerciseConfig } from '../models/routine.model';

const config = (overrides: Partial<RoutineExerciseConfig> = {}): RoutineExerciseConfig => ({
  templateId: 'incline-machine-press',
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

  describe('Home routine selection', () => {
    const DEFAULTS = ['built-in-push', 'built-in-pull', 'built-in-legs', 'built-in-abs'];

    it('falls back to the built-in defaults until customized', () => {
      expect(service.homeRoutineIds()).toBeNull();
      expect(service.homeIdsOrDefault(DEFAULTS)).toEqual(DEFAULTS);
    });

    it('materializes the defaults on the first toggle so the rest survive', () => {
      service.toggleHomeRoutine('built-in-abs', DEFAULTS);
      expect(service.homeRoutineIds()).toEqual(['built-in-push', 'built-in-pull', 'built-in-legs']);

      service.toggleHomeRoutine('routine-123', DEFAULTS);
      expect(service.homeIdsOrDefault(DEFAULTS)).toEqual([
        'built-in-push',
        'built-in-pull',
        'built-in-legs',
        'routine-123',
      ]);
    });

    it('persists the selection and reloads it in a fresh instance', () => {
      service.toggleHomeRoutine('built-in-push', DEFAULTS);
      const fresh = new RoutineLibraryService();
      expect(fresh.homeRoutineIds()).toEqual(['built-in-pull', 'built-in-legs', 'built-in-abs']);
    });

    it('drops a deleted custom routine from the selection', () => {
      const created = service.createRoutine({ name: 'Upper', exercises: [config()] });
      service.toggleHomeRoutine(created.id, DEFAULTS);
      expect(service.homeIdsOrDefault(DEFAULTS)).toContain(created.id);

      service.deleteRoutine(created.id);
      expect(service.homeIdsOrDefault(DEFAULTS)).not.toContain(created.id);
    });

    it('ignores a malformed stored selection', () => {
      localStorage.setItem('gym_home_routines', JSON.stringify({ not: 'an array' }));
      const fresh = new RoutineLibraryService();
      expect(fresh.homeRoutineIds()).toBeNull();
    });
  });
});

// ─── Stored and imported routines are untrusted input ───

const ROUTINES_KEY = 'gym_custom_routines';
const QUARANTINE_KEY = 'gym_custom_routines_quarantine';

const routine = (overrides: Record<string, unknown> = {}) => ({
  id: 'routine-1-abc',
  name: 'Pull',
  source: 'custom',
  exercises: [config({ templateId: 't-bar-row' })],
  createdAt: '2026-08-08T00:00:00.000Z',
  updatedAt: '2026-08-08T00:00:00.000Z',
  ...overrides,
});

describe('isValidRoutine', () => {
  it('accepts a well-formed routine', () => {
    expect(isValidRoutine(routine())).toBe(true);
  });

  it('accepts optional fields left out', () => {
    const minimal = { templateId: 'pec-deck', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15 };
    expect(isValidRoutine(routine({ exercises: [minimal] }))).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'Pull'],
    ['an array', [routine()]],
  ])('rejects %s', (_label, value) => {
    expect(isValidRoutine(value)).toBe(false);
  });

  it('rejects empty, unnamed or exercise-less routines', () => {
    expect(isValidRoutine(routine({ name: '  ' }))).toBe(false);
    expect(isValidRoutine(routine({ name: undefined }))).toBe(false);
    expect(isValidRoutine(routine({ exercises: [] }))).toBe(false);
    expect(isValidRoutine(routine({ exercises: 'pec-deck' }))).toBe(false);
    expect(isValidRoutine(routine({ id: '' }))).toBe(false);
  });

  it('rejects exercise configs that would break the session builder', () => {
    const bad = (over: Record<string, unknown>) =>
      routine({
        exercises: [
          { templateId: 'x', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, ...over },
        ],
      });
    expect(isValidRoutine(bad({ targetSets: 0 }))).toBe(false);
    expect(isValidRoutine(bad({ targetRepsMin: 12, targetRepsMax: 8 }))).toBe(false);
    expect(isValidRoutine(bad({ templateId: undefined }))).toBe(false);
    expect(isValidRoutine(bad({ targetSets: '4' }))).toBe(false);
  });

  it('rejects a half-written routine: one good exercise is not enough', () => {
    const halfWritten = routine({
      exercises: [config(), { templateId: 'pec-deck', targetSets: 3 }],
    });
    expect(isValidRoutine(halfWritten)).toBe(false);
  });

  it('accepts the real routines of the export', async () => {
    const { readFileSync } = await import('node:fs');
    const data = JSON.parse(readFileSync('docs/personal-progress/gym_data_v2.json', 'utf8'));
    expect(data.routines.filter((r: unknown) => !isValidRoutine(r))).toEqual([]);
  });
});

describe('RoutineLibraryService.loadRoutines', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('keeps the valid routines and quarantines the stored list when one is broken', () => {
    const raw = JSON.stringify([
      routine({ id: 'routine-good' }),
      routine({ id: 'routine-bad', exercises: [] }),
    ]);
    localStorage.setItem(ROUTINES_KEY, raw);

    const service = new RoutineLibraryService();

    expect(service.customRoutines().map((r) => r.id)).toEqual(['routine-good']);
    expect(localStorage.getItem(QUARANTINE_KEY)).toBe(raw);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('starts empty when the stored value is not a list', () => {
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(routine()));
    expect(new RoutineLibraryService().customRoutines()).toEqual([]);
    expect(localStorage.getItem(QUARANTINE_KEY)).not.toBeNull();
  });

  it('starts empty on unparseable JSON', () => {
    localStorage.setItem(ROUTINES_KEY, '[{"id": "routine-1", "na');
    expect(new RoutineLibraryService().customRoutines()).toEqual([]);
  });

  it('loads a clean list without warnings or a quarantine copy', () => {
    localStorage.setItem(ROUTINES_KEY, JSON.stringify([routine()]));
    expect(new RoutineLibraryService().customRoutines()).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
    expect(localStorage.getItem(QUARANTINE_KEY)).toBeNull();
  });

  it('importRoutines leaves malformed entries out', () => {
    const service = new RoutineLibraryService();
    // Typed as Routine[] by the caller, but it is whatever the file held
    const fromFile = [
      routine({ id: 'routine-ok' }),
      routine({ id: 'routine-broken', exercises: [{ templateId: 'x', targetSets: 0 }] }),
    ] as unknown as Routine[];
    const count = service.importRoutines(fromFile);
    expect(count).toBe(1);
    expect(service.customRoutines().map((r) => r.id)).toEqual(['routine-ok']);
  });
});
