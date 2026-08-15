// ─── Body check-in (weight / waist logged outside a workout) ───

/**
 * A dated body check-in, independent of `WorkoutSession.bodyWeightKg`.
 *
 * Weighing yourself is a weekly habit that does not line up with training days,
 * and the waist reading had nowhere to live inside a session at all — the two
 * together are what separate a lean bulk from plain weight gain.
 *
 * Every field except id/date is optional: a check-in may be weight-only,
 * waist-only, or just a note ("slept 5h, hot night"). Consumers must treat each
 * series independently instead of assuming one entry carries both readings.
 */
export interface BodyMeasurement {
  id: string;
  date: string; // ISO 8601
  weightKg?: number;
  waistCm?: number;
  notes?: string;
}
