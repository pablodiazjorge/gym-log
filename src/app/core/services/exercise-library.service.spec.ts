import { beforeEach, describe, expect, it } from 'vitest';
import { ExerciseLibraryService } from './exercise-library.service';
import { RoutineService } from './routine.service';

describe('ExerciseLibraryService', () => {
  let routineService: RoutineService;
  let service: ExerciseLibraryService;

  beforeEach(() => {
    localStorage.clear();
    routineService = new RoutineService();
    service = new ExerciseLibraryService(routineService);
  });

  it('defaults to exactly the built-in day members', () => {
    const expected = routineService
      .getAllExercises()
      .filter((ex) => ex.builtInDay)
      .map((ex) => ex.id)
      .sort();
    expect([...service.enabledIds()].sort()).toEqual(expected);
  });

  it('toggle persists across instances', () => {
    service.setEnabled('barbell-back-squat', true);
    service.setEnabled('pec-deck', false);

    const fresh = new ExerciseLibraryService(routineService);
    expect(fresh.isEnabled('barbell-back-squat')).toBe(true);
    expect(fresh.isEnabled('pec-deck')).toBe(false);
  });

  it('resetToDefaults restores the built-in set', () => {
    service.setEnabled('barbell-back-squat', true);
    service.setEnabled('pec-deck', false);
    service.resetToDefaults();
    expect(service.isEnabled('barbell-back-squat')).toBe(false);
    expect(service.isEnabled('pec-deck')).toBe(true);
  });

  it('importEnabledIds unions valid ids and ignores unknown ones', () => {
    const added = service.importEnabledIds(['barbell-back-squat', 'nonexistent-id', 'pec-deck']);
    expect(added).toBe(1); // pec-deck already enabled, unknown ignored
    expect(service.isEnabled('barbell-back-squat')).toBe(true);
  });

  describe('getChoicesForDay (enabled-aware)', () => {
    it('matches the built-in groups by default', () => {
      const base = routineService.getChoicesForDay('push', 'A');
      const enabledAware = service.getChoicesForDay('push', 'A');
      expect(enabledAware.map((g) => g.groupId)).toEqual(base.map((g) => g.groupId));
      expect(enabledAware[0].options.map((o) => o.id)).toEqual(base[0].options.map((o) => o.id));
    });

    it('adds enabled catalog variations to their choice group', () => {
      service.setEnabled('flat-barbell-bench-press', true);
      const pushMain = service.getChoicesForDay('push', 'A').find((g) => g.groupId === 'push-main')!;
      expect(pushMain.options.some((o) => o.id === 'flat-barbell-bench-press')).toBe(true);
    });

    it('filters disabled built-in options out', () => {
      service.setEnabled('flat-machine-press', false);
      const pushMain = service.getChoicesForDay('push', 'A').find((g) => g.groupId === 'push-main')!;
      expect(pushMain.options.some((o) => o.id === 'flat-machine-press')).toBe(false);
      expect(pushMain.options.length).toBeGreaterThan(0);
    });

    it('uses an enabled catalog extra alone (no fallback) when all built-ins are disabled', () => {
      for (const id of ['incline-machine-press', 'flat-machine-press', 'incline-smith-press']) {
        service.setEnabled(id, false);
      }
      service.setEnabled('flat-barbell-bench-press', true);
      const pushMain = service.getChoicesForDay('push', 'A').find((g) => g.groupId === 'push-main')!;
      expect(pushMain.options.map((o) => o.id)).toEqual(['flat-barbell-bench-press']);
    });

    it('falls back to the full built-in group when everything is disabled', () => {
      // Disable every push-main built-in member
      for (const id of ['incline-machine-press', 'flat-machine-press', 'incline-smith-press']) {
        service.setEnabled(id, false);
      }
      const pushMain = service.getChoicesForDay('push', 'A').find((g) => g.groupId === 'push-main')!;
      expect(pushMain.options.length).toBe(3); // full built-in fallback
    });
  });
});
