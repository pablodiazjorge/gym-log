import { describe, it, expect } from 'vitest';
import {
  addExerciseFromTemplate,
  newExerciseFromTemplate,
  normalizeForSave,
  removeExerciseAt,
  removeSetAt,
  renumberSets,
  withSessionDate,
} from './history-edit.util';
import {
  ExerciseTemplate,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '../../core/models/workout.model';

// ─── Builders ───

const set = (over: Partial<WorkoutSet> = {}): WorkoutSet => ({
  setNumber: 1,
  isWarmup: false,
  weightKg: 40,
  reps: 10,
  rir: 2,
  completed: true,
  skipped: false,
  ...over,
});

const exercise = (over: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  templateId: 'pec-deck',
  exerciseName: 'Pec Deck',
  sets: [set({ setNumber: 1 }), set({ setNumber: 2 }), set({ setNumber: 3 })],
  ...over,
});

const session = (over: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 's1',
  date: '2026-09-17T06:30:00.000Z',
  dayType: 'routine',
  exercises: [exercise()],
  completed: true,
  ...over,
});

const template = (over: Partial<ExerciseTemplate> = {}): ExerciseTemplate => ({
  id: 't-bar-row',
  name: 'T-Bar Row',
  category: 'pull',
  order: 1,
  targetSets: 3,
  targetRepsMin: 8,
  targetRepsMax: 12,
  hasWarmupSets: false,
  ...over,
});

// ─── Sets ───

describe('renumberSets', () => {
  it('renumbers sequentially, keeping already-correct entries by reference', () => {
    const sets = [set({ setNumber: 1 }), set({ setNumber: 5 })];
    const result = renumberSets(sets);
    expect(result.map((s) => s.setNumber)).toEqual([1, 2]);
    expect(result[0]).toBe(sets[0]); // untouched entry keeps its reference
    expect(result[1]).not.toBe(sets[1]);
  });
});

describe('removeSetAt', () => {
  it('removes a MIDDLE set and renumbers — history corrects, it does not skip', () => {
    const ex = exercise();
    const result = removeSetAt(ex, 1);
    expect(result.sets.map((s) => s.setNumber)).toEqual([1, 2]);
    expect(ex.sets).toHaveLength(3); // input untouched
  });

  it('returns the same reference for an invalid index', () => {
    const ex = exercise();
    expect(removeSetAt(ex, 3)).toBe(ex);
    expect(removeSetAt(ex, -1)).toBe(ex);
  });

  it('can remove the only set (normalizeForSave drops the empty exercise)', () => {
    const ex = exercise({ sets: [set()] });
    expect(removeSetAt(ex, 0).sets).toEqual([]);
  });
});

// ─── Exercises ───

describe('newExerciseFromTemplate / addExerciseFromTemplate', () => {
  it('seeds one OPEN set from the template defaults', () => {
    const ex = newExerciseFromTemplate(template({ targetRirMin: 2, targetRirMax: 3 }));
    expect(ex.sets).toHaveLength(1);
    expect(ex.sets[0]).toMatchObject({
      setNumber: 1,
      weightKg: 0,
      reps: 8,
      rir: 2.5,
      completed: false,
    });
  });

  it('falls back to RIR 2 when the template has no target range', () => {
    expect(newExerciseFromTemplate(template()).sets[0].rir).toBe(2);
  });

  it('appends to the session, refusing a duplicate templateId by identity', () => {
    const s = session();
    const added = addExerciseFromTemplate(s, template());
    expect(added.exercises.map((e) => e.templateId)).toEqual(['pec-deck', 't-bar-row']);

    const duplicate = addExerciseFromTemplate(s, template({ id: 'pec-deck' }));
    expect(duplicate).toBe(s); // the views track exercises by templateId
  });
});

describe('removeExerciseAt', () => {
  it('removes by index; invalid index is a no-op by reference', () => {
    const s = session();
    expect(removeExerciseAt(s, 0).exercises).toEqual([]);
    expect(removeExerciseAt(s, 1)).toBe(s);
  });
});

// ─── Session date ───

describe('withSessionDate', () => {
  it('changes the local calendar day but keeps the time of day', () => {
    // Build from local parts so the assertion is timezone-independent
    const original = new Date(2026, 8, 17, 18, 45).toISOString();
    const edited = withSessionDate(session({ date: original }), '2026-09-16');

    const d = new Date(edited.date);
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 9, 16]);
    expect([d.getHours(), d.getMinutes()]).toEqual([18, 45]);
  });

  it('is a no-op by reference for a malformed input or an unchanged day', () => {
    const original = new Date(2026, 8, 17, 18, 45).toISOString();
    const s = session({ date: original });
    expect(withSessionDate(s, '')).toBe(s);
    expect(withSessionDate(s, 'not-a-date')).toBe(s);
    expect(withSessionDate(s, '2026-09-17')).toBe(s);
  });
});

// ─── Save normalization ───

describe('normalizeForSave', () => {
  it('closes open sets, keeps skipped ones skipped, renumbers, drops empty exercises', () => {
    const s = session({
      exercises: [
        exercise({
          sets: [
            set({ setNumber: 2, completed: false }), // left open in the editor
            set({ setNumber: 7, skipped: true }),
          ],
        }),
        exercise({ templateId: 'ghost', exerciseName: 'Ghost', sets: [] }),
      ],
    });

    const result = normalizeForSave(s);
    expect(result.exercises).toHaveLength(1); // the empty exercise is gone
    const sets = result.exercises[0].sets;
    expect(sets.map((x) => x.setNumber)).toEqual([1, 2]);
    expect(sets.every((x) => x.completed)).toBe(true);
    expect(sets[1].skipped).toBe(true);
  });

  it('keeps the session completed flag untouched', () => {
    const incomplete = session({ completed: false });
    expect(normalizeForSave(incomplete).completed).toBe(false);
  });
});
