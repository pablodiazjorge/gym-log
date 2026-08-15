import { describe, expect, it } from 'vitest';
import { buildRows, fromDateInput, toDateInput } from './check-in.util';
import { BodyMeasurement } from '../../core/models/measurement.model';

function entry(partial: Partial<BodyMeasurement> & { id: string }): BodyMeasurement {
  return { date: '2026-08-10T12:00:00.000Z', ...partial };
}

describe('buildRows', () => {
  it('reports no delta for the first ever reading of each kind', () => {
    const rows = buildRows([entry({ id: 'a', weightKg: 77, waistCm: 82 })]);
    expect(rows[0].weightDelta).toBeNull();
    expect(rows[0].waistDelta).toBeNull();
  });

  it('compares against the previous entry that carried the same reading', () => {
    // The middle check-in has no waist number. Comparing with the immediate
    // neighbour would report the newest waist as a +82 cm jump out of nowhere.
    const rows = buildRows([
      entry({ id: 'c', date: '2026-08-14T12:00:00.000Z', weightKg: 77.4, waistCm: 81.5 }),
      entry({ id: 'b', date: '2026-08-12T12:00:00.000Z', weightKg: 77 }),
      entry({ id: 'a', date: '2026-08-05T12:00:00.000Z', weightKg: 76, waistCm: 82 }),
    ]);

    expect(rows[0].weightDelta).toBeCloseTo(0.4, 5);
    expect(rows[0].waistDelta).toBeCloseTo(-0.5, 5);
    expect(rows[1].weightDelta).toBeCloseTo(1, 5);
    expect(rows[1].waistDelta).toBeNull();
    expect(rows[2].weightDelta).toBeNull();
    expect(rows[2].waistDelta).toBeNull();
  });

  it('leaves both deltas null on a notes-only check-in', () => {
    const rows = buildRows([
      entry({ id: 'b', date: '2026-08-14T12:00:00.000Z', notes: 'slept 5h' }),
      entry({ id: 'a', weightKg: 76 }),
    ]);
    expect(rows[0]).toEqual({ entry: rows[0].entry, weightDelta: null, waistDelta: null });
  });

  it('handles an empty history', () => {
    expect(buildRows([])).toEqual([]);
  });
});

describe('date input round-trip', () => {
  it('returns the same local day it was given', () => {
    // Midday anchoring is what makes this hold: a midnight anchor shifts a day
    // in either direction once the local offset is applied.
    for (const day of ['2026-01-15', '2026-08-15', '2026-12-31', '2026-03-29']) {
      expect(toDateInput(fromDateInput(day))).toBe(day);
    }
  });

  it('formats a local date with zero padding', () => {
    const iso = fromDateInput('2026-03-07');
    expect(toDateInput(iso)).toBe('2026-03-07');
  });
});
