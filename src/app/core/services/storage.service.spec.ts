import { describe, expect, it } from 'vitest';
import { isValidSession } from './storage.service';

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
