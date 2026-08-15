import { describe, expect, it } from 'vitest';
import {
  isValidMeasurement,
  latestReading,
  mergeWeightSeries,
  moreRecent,
  trendOver,
} from './measurement.service';
import { BodyMeasurement } from '../models/measurement.model';
import { WorkoutSession } from '../models/workout.model';

function measurement(partial: Partial<BodyMeasurement>): BodyMeasurement {
  return { id: 'bm-1', date: '2026-08-10T12:00:00.000Z', ...partial };
}

function session(date: string, bodyWeightKg?: number, completed = true): WorkoutSession {
  return {
    id: `ws-${date}`,
    date,
    dayType: 'push',
    exercises: [],
    completed,
    ...(bodyWeightKg != null ? { bodyWeightKg } : {}),
  };
}

describe('isValidMeasurement', () => {
  it('accepts a weight-only, a waist-only and a notes-only check-in', () => {
    expect(isValidMeasurement(measurement({ weightKg: 77 }))).toBe(true);
    expect(isValidMeasurement(measurement({ waistCm: 82.5 }))).toBe(true);
    expect(isValidMeasurement(measurement({ notes: 'slept 5h' }))).toBe(true);
  });

  it('rejects an entry with nothing in it', () => {
    expect(isValidMeasurement(measurement({}))).toBe(false);
    expect(isValidMeasurement(measurement({ notes: '   ' }))).toBe(false);
  });

  it('rejects non-finite or non-positive readings', () => {
    expect(isValidMeasurement(measurement({ weightKg: NaN }))).toBe(false);
    expect(isValidMeasurement(measurement({ weightKg: 0 }))).toBe(false);
    expect(isValidMeasurement(measurement({ waistCm: -3 }))).toBe(false);
    expect(isValidMeasurement(measurement({ weightKg: '77' as unknown as number }))).toBe(false);
  });

  it('rejects a missing id or an unparseable date', () => {
    expect(isValidMeasurement(measurement({ id: '', weightKg: 77 }))).toBe(false);
    expect(isValidMeasurement(measurement({ date: 'not a date', weightKg: 77 }))).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isValidMeasurement(null)).toBe(false);
    expect(isValidMeasurement([measurement({ weightKg: 77 })])).toBe(false);
    expect(isValidMeasurement('77kg')).toBe(false);
  });
});

describe('moreRecent', () => {
  const older = { date: '2026-08-01T12:00:00.000Z' };
  const newer = { date: '2026-08-09T12:00:00.000Z' };

  it('picks the later date regardless of argument order', () => {
    expect(moreRecent(older, newer)).toBe(newer);
    expect(moreRecent(newer, older)).toBe(newer);
  });

  it('is null-safe on either side', () => {
    expect(moreRecent(null, newer)).toBe(newer);
    expect(moreRecent(older, null)).toBe(older);
    expect(moreRecent(null, null)).toBeNull();
  });
});

describe('latestReading', () => {
  // The list is stored newest-first, but a check-in edited to an older date can
  // break that ordering until the next reload, so the scan must not assume it.
  const entries = [
    measurement({ id: 'a', date: '2026-08-14T12:00:00.000Z', notes: 'no numbers' }),
    measurement({ id: 'b', date: '2026-08-12T12:00:00.000Z', weightKg: 77, waistCm: 82 }),
    measurement({ id: 'c', date: '2026-08-05T12:00:00.000Z', weightKg: 76 }),
  ];

  it('skips entries that lack the requested field', () => {
    expect(latestReading(entries, 'weightKg')).toEqual({
      value: 77,
      date: '2026-08-12T12:00:00.000Z',
    });
    expect(latestReading(entries, 'waistCm')).toEqual({
      value: 82,
      date: '2026-08-12T12:00:00.000Z',
    });
  });

  it('returns null when no entry carries the field', () => {
    expect(latestReading([entries[0]], 'weightKg')).toBeNull();
    expect(latestReading([], 'weightKg')).toBeNull();
  });

  it('does not rely on the array being sorted', () => {
    const unsorted = [entries[2], entries[1], entries[0]];
    expect(latestReading(unsorted, 'weightKg')?.value).toBe(77);
  });
});

describe('mergeWeightSeries', () => {
  it('interleaves the two sources chronologically', () => {
    const sessions = [
      session('2026-08-01T18:00:00.000Z', 76),
      session('2026-08-14T18:00:00.000Z', 77.4),
    ];
    const measurements = [measurement({ id: 'bm-1', date: '2026-08-09T09:00:00.000Z', weightKg: 76.8 })];

    expect(mergeWeightSeries(sessions, measurements)).toEqual([
      { date: '2026-08-01T18:00:00.000Z', weight: 76, source: 'session' },
      { date: '2026-08-09T09:00:00.000Z', weight: 76.8, source: 'check-in' },
      { date: '2026-08-14T18:00:00.000Z', weight: 77.4, source: 'session' },
    ]);
  });

  it('ignores sessions without a weight and unfinished ones', () => {
    const sessions = [
      session('2026-08-01T18:00:00.000Z'),
      session('2026-08-02T18:00:00.000Z', 76, false),
    ];
    expect(mergeWeightSeries(sessions, [])).toEqual([]);
  });

  it('ignores check-ins that only carry a waist reading or a note', () => {
    const measurements = [
      measurement({ id: 'bm-1', waistCm: 82 }),
      measurement({ id: 'bm-2', notes: 'hot night' }),
    ];
    expect(mergeWeightSeries([], measurements)).toEqual([]);
  });
});

describe('trendOver', () => {
  const now = new Date('2026-08-15T12:00:00.000Z').getTime();
  const point = (date: string, value: number) => ({ date, value });

  it('measures newest minus oldest inside the window', () => {
    const trend = trendOver(
      [point('2026-08-01T12:00:00.000Z', 76), point('2026-08-15T12:00:00.000Z', 77.4)],
      30,
      now,
    );
    expect(trend?.delta).toBeCloseTo(1.4, 5);
    expect(trend?.spanDays).toBe(14);
    expect(trend?.from).toBe(76);
    expect(trend?.to).toBe(77.4);
  });

  it('returns null below two readings — one point is a value, not a trend', () => {
    expect(trendOver([point('2026-08-15T12:00:00.000Z', 77)], 30, now)).toBeNull();
    expect(trendOver([], 30, now)).toBeNull();
  });

  it('drops readings older than the window', () => {
    const trend = trendOver(
      [
        point('2026-01-01T12:00:00.000Z', 65),
        point('2026-08-10T12:00:00.000Z', 77),
        point('2026-08-15T12:00:00.000Z', 77.4),
      ],
      30,
      now,
    );
    expect(trend?.from).toBe(77);
    expect(trend?.spanDays).toBe(5);
  });

  it('never reports a zero-day span for two readings on the same day', () => {
    const trend = trendOver(
      [point('2026-08-15T06:00:00.000Z', 77), point('2026-08-15T12:00:00.000Z', 77.6)],
      30,
      now,
    );
    expect(trend?.spanDays).toBe(1);
  });
});
