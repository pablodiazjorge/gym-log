// ─── Body check-in (readings logged outside a workout) ───

/**
 * A dated body check-in, independent of `WorkoutSession.bodyWeightKg`.
 *
 * Weighing yourself is a weekly habit that does not line up with training days,
 * and the girth readings had nowhere to live inside a session at all — weight
 * plus waist are what separate a lean bulk from plain weight gain, and the
 * girths are the numbers the photo-check protocol asks to note the same day
 * (docs/personal-progress/README.md): hip, thigh and both flexed arms.
 *
 * Every field except id/date is optional: a check-in may be weight-only,
 * waist-only, girths-only, or just a note ("slept 5h, hot night"). Consumers
 * must treat each series independently instead of assuming one entry carries
 * every reading.
 */
export interface BodyMeasurement {
  id: string;
  date: string; // ISO 8601
  weightKg?: number;
  waistCm?: number;
  hipCm?: number;
  thighCm?: number;
  armLeftCm?: number; // flexed
  armRightCm?: number; // flexed
  notes?: string;
}

/** Every numeric reading a check-in can carry — the schema, not logic */
export const MEASUREMENT_FIELDS = [
  'weightKg',
  'waistCm',
  'hipCm',
  'thighCm',
  'armLeftCm',
  'armRightCm',
] as const;

export type MeasurementField = (typeof MEASUREMENT_FIELDS)[number];
