import { BodyMeasurement } from '../../core/models/measurement.model';

/** A history row plus the change since the previous reading of the same kind */
export interface MeasurementRow {
  entry: BodyMeasurement;
  weightDelta: number | null;
  waistDelta: number | null;
}

/**
 * Deltas compare against the previous entry carrying the *same* reading, not
 * the previous entry outright: a check-in may be weight-only or waist-only, so
 * comparing with the immediate neighbour would show a swing of the entire value
 * every time a field was left blank.
 *
 * `entries` must be newest first — the order the service stores them in.
 */
export function buildRows(entries: BodyMeasurement[]): MeasurementRow[] {
  const deltaFor = (index: number, field: 'weightKg' | 'waistCm'): number | null => {
    const current = entries[index][field];
    if (current == null) return null;
    for (let i = index + 1; i < entries.length; i++) {
      const previous = entries[i][field];
      if (previous != null) return current - previous;
    }
    return null; // first ever reading of this kind
  };

  return entries.map((entry, index) => ({
    entry,
    weightDelta: deltaFor(index, 'weightKg'),
    waistDelta: deltaFor(index, 'waistCm'),
  }));
}

/** ISO instant → the `yyyy-mm-dd` an `<input type="date">` expects, in local time */
export function toDateInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * `yyyy-mm-dd` → ISO instant, anchored at local midday. Midnight would land on
 * the previous day once converted to UTC for anyone east of Greenwich, and
 * every consumer reads the date back through `new Date(...)`.
 */
export function fromDateInput(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}
