import { describe, expect, it } from 'vitest';
import { RoutineService } from './routine.service';

describe('RoutineService.getBuiltInRoutines', () => {
  const service = new RoutineService();

  it('derives exactly 4 built-in routines with stable ids', () => {
    const routines = service.getBuiltInRoutines();
    expect(routines.map((r) => r.id)).toEqual([
      'built-in-push',
      'built-in-pull',
      'built-in-legs',
      'built-in-abs',
    ]);
    expect(routines.every((r) => r.source === 'built-in')).toBe(true);
  });

  it('picks exactly one representative per choice group', () => {
    for (const routine of service.getBuiltInRoutines()) {
      const groups = new Set<string>();
      for (const ex of routine.exercises) {
        const template = service.getTemplateById(ex.templateId)!;
        if (template.choiceGroup) {
          expect(groups.has(template.choiceGroup)).toBe(false);
          groups.add(template.choiceGroup);
        }
      }
    }
  });

  it('seeds exercise configs from the template defaults', () => {
    const push = service.getBuiltInRoutines().find((r) => r.id === 'built-in-push')!;
    for (const ex of push.exercises) {
      const template = service.getTemplateById(ex.templateId)!;
      expect(ex.targetSets).toBe(template.targetSets);
      expect(ex.targetRepsMin).toBe(template.targetRepsMin);
      expect(ex.targetRepsMax).toBe(template.targetRepsMax);
      expect(ex.hasWarmupSets).toBe(template.hasWarmupSets);
    }
  });

  it('is stable across calls (same shape every time)', () => {
    const a = service.getBuiltInRoutines();
    const b = service.getBuiltInRoutines();
    expect(a).toEqual(b);
  });
});
