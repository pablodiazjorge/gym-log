import { Injectable, computed, signal } from '@angular/core';
import { BodyMeasurement, MEASUREMENT_FIELDS, MeasurementField } from '../models/measurement.model';
import { WorkoutSession } from '../models/workout.model';

const MEASUREMENTS_KEY = 'gym_body_measurements';
const DAY_MS = 86400000;

/** A dated reading pulled out of a check-in */
export interface DatedReading {
  value: number;
  date: string;
}

function isOptionalPositive(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value > 0);
}

/**
 * Same reasoning as `isValidSession`: the interface is erased at runtime, so an
 * imported or hand-edited entry would otherwise be persisted and then feed NaN
 * into the weight trend — and through `getEffectiveBodyWeightKg`, into the
 * bodyweight ratios the experience level is computed from.
 */
export function isValidMeasurement(value: unknown): value is BodyMeasurement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const m = value as Partial<BodyMeasurement>;
  if (typeof m.id !== 'string' || !m.id) return false;
  if (typeof m.date !== 'string' || Number.isNaN(new Date(m.date).getTime())) return false;
  for (const field of MEASUREMENT_FIELDS) {
    if (!isOptionalPositive(m[field])) return false;
  }
  if (m.notes !== undefined && typeof m.notes !== 'string') return false;
  // An entry with every field empty is a dated row with nothing in it.
  return MEASUREMENT_FIELDS.some((field) => m[field] != null) || !!m.notes?.trim();
}

/** The more recent of two dated readings (null-safe); ties keep `a` */
export function moreRecent<T extends { date: string }>(a: T | null, b: T | null): T | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(b.date).getTime() > new Date(a.date).getTime() ? b : a;
}

/** Newest entry that actually carries the given reading, or null */
export function latestReading(
  entries: BodyMeasurement[],
  field: MeasurementField,
): DatedReading | null {
  let best: DatedReading | null = null;
  for (const entry of entries) {
    const value = entry[field];
    if (value == null) continue;
    const candidate = { value, date: entry.date };
    best = moreRecent(best, candidate);
  }
  return best;
}

export function createMeasurementId(): string {
  return `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** One bodyweight reading plus where it came from */
export interface BodyWeightPoint {
  date: string;
  weight: number;
  source: 'session' | 'check-in';
}

/**
 * Every bodyweight reading the app knows about, oldest first. The two sources
 * interleave freely — a check-in can fall between two sessions — so the merged
 * series is re-sorted rather than concatenated.
 */
export function mergeWeightSeries(
  sessions: WorkoutSession[],
  measurements: BodyMeasurement[],
): BodyWeightPoint[] {
  return [
    ...sessions
      .filter((s) => s.completed && s.bodyWeightKg != null)
      .map((s) => ({ date: s.date, weight: s.bodyWeightKg!, source: 'session' as const })),
    ...measurements
      .filter((m) => m.weightKg != null)
      .map((m) => ({ date: m.date, weight: m.weightKg!, source: 'check-in' as const })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export interface Trend {
  /** newest − oldest within the window */
  delta: number;
  /** days actually covered by the two readings, not the window width */
  spanDays: number;
  from: number;
  to: number;
}

/**
 * Change across the readings falling inside the last `windowDays`. Returns null
 * below two readings: a single point is a value, not a trend, and reporting
 * "+0.0 kg" for it would read as "no change" rather than "not enough data".
 */
export function trendOver(
  points: { date: string; value: number }[],
  windowDays: number,
  nowMs: number = Date.now(),
): Trend | null {
  const cutoff = nowMs - windowDays * DAY_MS;
  const inWindow = points
    .filter((p) => new Date(p.date).getTime() >= cutoff)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (inWindow.length < 2) return null;
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  const spanMs = new Date(last.date).getTime() - new Date(first.date).getTime();
  return {
    delta: last.value - first.value,
    spanDays: Math.max(1, Math.round(spanMs / DAY_MS)),
    from: first.value,
    to: last.value,
  };
}

@Injectable({ providedIn: 'root' })
export class MeasurementService {
  /** All check-ins, newest first */
  readonly measurements = signal<BodyMeasurement[]>([]);

  readonly latestWeight = computed(() => latestReading(this.measurements(), 'weightKg'));
  readonly latestWaist = computed(() => latestReading(this.measurements(), 'waistCm'));

  constructor() {
    this.load();
  }

  load(): void {
    try {
      const raw = localStorage.getItem(MEASUREMENTS_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      const all = Array.isArray(parsed) ? parsed : [];
      this.measurements.set(sortNewestFirst(all.filter(isValidMeasurement)));
    } catch {
      console.warn('Failed to load body measurements from localStorage, starting empty');
      this.measurements.set([]);
    }
  }

  /** Add a check-in, or replace the one with the same id */
  save(entry: BodyMeasurement): void {
    const rest = this.measurements().filter((m) => m.id !== entry.id);
    this.measurements.set(sortNewestFirst([...rest, entry]));
    this.persist();
  }

  remove(id: string): void {
    this.measurements.set(this.measurements().filter((m) => m.id !== id));
    this.persist();
  }

  /** Import check-ins from a backup file, skipping ids that already exist */
  importMeasurements(incoming: BodyMeasurement[]): number {
    const existingIds = new Set(this.measurements().map((m) => m.id));
    const fresh = incoming.filter((m) => isValidMeasurement(m) && !existingIds.has(m.id));
    if (fresh.length > 0) {
      this.measurements.set(sortNewestFirst([...this.measurements(), ...fresh]));
      this.persist();
    }
    return fresh.length;
  }

  private persist(): void {
    localStorage.setItem(MEASUREMENTS_KEY, JSON.stringify(this.measurements()));
  }
}

function sortNewestFirst(entries: BodyMeasurement[]): BodyMeasurement[] {
  return [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
