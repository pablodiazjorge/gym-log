import { describe, expect, it } from 'vitest';
import { isValidSession } from './storage.service';
import { isValidProfile, isValidRoutine } from './export.service';

// Data-integrity guard (ADR-0010 scope): a malformed entry used to be persisted
// as-is and then crash History and Analysis on every load — and History is the
// only screen offering deleteSession(), so the app was stuck.

const valid = () => ({
  id: 'ws-2026-08-14-push-1234',
  date: '2026-08-14T04:33:52.466Z',
  dayType: 'push',
  completed: true,
  exercises: [
    { templateId: 'pec-deck', exerciseName: 'Pec Deck', sets: [] },
  ],
});

describe('isValidSession', () => {
  it('accepts a well-formed session', () => {
    expect(isValidSession(valid())).toBe(true);
  });

  it('accepts a session with no exercises', () => {
    expect(isValidSession({ ...valid(), exercises: [] })).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'nope'],
    ['a number', 42],
    ['an array', []],
  ])('rejects %s', (_label, value) => {
    expect(isValidSession(value)).toBe(false);
  });

  it('rejects a missing or empty id', () => {
    expect(isValidSession({ ...valid(), id: undefined })).toBe(false);
    expect(isValidSession({ ...valid(), id: '' })).toBe(false);
    expect(isValidSession({ ...valid(), id: 123 })).toBe(false);
  });

  it('rejects an unparseable date', () => {
    expect(isValidSession({ ...valid(), date: 'not-a-date' })).toBe(false);
    expect(isValidSession({ ...valid(), date: undefined })).toBe(false);
  });

  it('rejects a missing exercises array — the crash History used to hit', () => {
    expect(isValidSession({ ...valid(), exercises: undefined })).toBe(false);
    expect(isValidSession({ ...valid(), exercises: 'push,pull' })).toBe(false);
  });

  it('rejects an exercise without a sets array', () => {
    expect(
      isValidSession({ ...valid(), exercises: [{ templateId: 'pec-deck', exerciseName: 'x' }] }),
    ).toBe(false);
  });

  it('rejects an exercise without a templateId', () => {
    expect(isValidSession({ ...valid(), exercises: [{ exerciseName: 'x', sets: [] }] })).toBe(false);
  });

  it('accepts every session of the real export', async () => {
    const { readFileSync } = await import('node:fs');
    const data = JSON.parse(
      readFileSync('docs/personal-progress/exports/gym_data_2026-08-14.json', 'utf8'),
    );
    expect(data.sessions.filter((s: unknown) => !isValidSession(s))).toEqual([]);
  });
});

// ─── Import guards for the non-session payload ───

describe('isValidProfile', () => {
  it('accepts a profile with a known experience level', () => {
    expect(isValidProfile({ experienceLevelManual: 'beginner', useComputedLevel: false })).toBe(true);
  });

  it('rejects a profile the progression engine would index with undefined', () => {
    // resolveLevel returns experienceLevelManual straight into AGGRESSIVENESS[level];
    // an absent or bogus value throws on the workout screen.
    expect(isValidProfile({})).toBe(false);
    expect(isValidProfile({ experienceLevelManual: 'pro' })).toBe(false);
    expect(isValidProfile(null)).toBe(false);
    expect(isValidProfile([])).toBe(false);
  });
});

describe('isValidRoutine', () => {
  const routine = () => ({
    id: 'routine-1-abc',
    name: 'Pull',
    source: 'custom',
    exercises: [{ templateId: 't-bar-row', order: 1, targetSets: 4, targetRepsMin: 8, targetRepsMax: 12, hasWarmupSets: true }],
    createdAt: '2026-08-08T00:00:00.000Z',
    updatedAt: '2026-08-08T00:00:00.000Z',
  });

  it('accepts a well-formed routine', () => {
    expect(isValidRoutine(routine())).toBe(true);
  });

  it('rejects empty, unnamed or exercise-less routines', () => {
    expect(isValidRoutine({ ...routine(), name: '  ' })).toBe(false);
    expect(isValidRoutine({ ...routine(), exercises: [] })).toBe(false);
    expect(isValidRoutine({ ...routine(), id: '' })).toBe(false);
  });

  it('rejects exercise configs that would break the session builder', () => {
    expect(isValidRoutine({ ...routine(), exercises: [{ templateId: 'x', targetSets: 0, targetRepsMin: 8, targetRepsMax: 12 }] })).toBe(false);
    expect(isValidRoutine({ ...routine(), exercises: [{ templateId: 'x', targetSets: 3, targetRepsMin: 12, targetRepsMax: 8 }] })).toBe(false);
    expect(isValidRoutine({ ...routine(), exercises: [{ targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 }] })).toBe(false);
  });

  it('accepts the real routines of the export', async () => {
    const { readFileSync } = await import('node:fs');
    const data = JSON.parse(readFileSync('docs/personal-progress/gym_data_v2.json', 'utf8'));
    expect(data.routines.filter((r: unknown) => !isValidRoutine(r))).toEqual([]);
    expect(isValidProfile(data.user)).toBe(true);
  });
});
