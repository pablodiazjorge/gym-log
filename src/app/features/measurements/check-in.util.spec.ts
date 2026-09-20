import { describe, expect, it } from 'vitest';
import { buildRows, fromDateInput, toDateInput } from './check-in.util';
import { BodyMeasurement } from '../../core/models/measurement.model';

function entry(partial: Partial<BodyMeasurement> & { id: string }): BodyMeasurement {
  return { date: '2026-08-10T12:00:00.000Z', ...partial };
}

describe('buildRows', () => {
  it('reports no delta for the first ever reading of each kind', () => {
    const rows = buildRows([entry({ id: 'a', weightKg: 77, waistCm: 82 })]);
    expect(rows[0].deltas.weightKg).toBeNull();
    expect(rows[0].deltas.waistCm).toBeNull();
  });

  it('compares against the previous entry that carried the same reading', () => {
    // The middle check-in has no waist number. Comparing with the immediate
    // neighbour would report the newest waist as a +82 cm jump out of nowhere.
    const rows = buildRows([
      entry({ id: 'c', date: '2026-08-14T12:00:00.000Z', weightKg: 77.4, waistCm: 81.5 }),
      entry({ id: 'b', date: '2026-08-12T12:00:00.000Z', weightKg: 77 }),
      entry({ id: 'a', date: '2026-08-05T12:00:00.000Z', weightKg: 76, waistCm: 82 }),
    ]);

    expect(rows[0].deltas.weightKg).toBeCloseTo(0.4, 5);
    expect(rows[0].deltas.waistCm).toBeCloseTo(-0.5, 5);
    expect(rows[1].deltas.weightKg).toBeCloseTo(1, 5);
    expect(rows[1].deltas.waistCm).toBeNull();
    expect(rows[2].deltas.weightKg).toBeNull();
    expect(rows[2].deltas.waistCm).toBeNull();
  });

  it('tracks each girth series independently of weight and waist', () => {
    // Girths land on photo-check days only, weeks apart from the weekly
    // weigh-ins — the sparse series must still pair with its own previous
    // reading, skipping every check-in that lacks it.
    const rows = buildRows([
      entry({ id: 'd', date: '2026-09-25T12:00:00.000Z', hipCm: 76, armLeftCm: 33.5 }),
      entry({ id: 'c', date: '2026-09-12T12:00:00.000Z', weightKg: 67.2 }),
      entry({ id: 'b', date: '2026-08-25T12:00:00.000Z', hipCm: 75, thighCm: 52 }),
      entry({ id: 'a', date: '2026-07-25T12:00:00.000Z', hipCm: 75 }),
    ]);

    expect(rows[0].deltas.hipCm).toBeCloseTo(1, 5);
    expect(rows[0].deltas.armLeftCm).toBeNull(); // first arm reading ever
    expect(rows[0].deltas.weightKg).toBeNull(); // entry carries no weight
    expect(rows[2].deltas.hipCm).toBeCloseTo(0, 5);
    expect(rows[2].deltas.thighCm).toBeNull();
  });

  it('leaves every delta null on a notes-only check-in', () => {
    const rows = buildRows([
      entry({ id: 'b', date: '2026-08-14T12:00:00.000Z', notes: 'slept 5h' }),
      entry({ id: 'a', weightKg: 76 }),
    ]);
    expect(Object.values(rows[0].deltas).every((d) => d === null)).toBe(true);
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
