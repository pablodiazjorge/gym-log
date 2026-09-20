import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../shared/components/icon';
import { BodyMeasurement } from '../../core/models/measurement.model';
import {
  MeasurementService,
  createMeasurementId,
  mergeWeightSeries,
  trendOver,
} from '../../core/services/measurement.service';
import { StorageService } from '../../core/services/storage.service';
import { buildRows, fromDateInput, toDateInput } from './check-in.util';

@Component({
  selector: 'app-measurements',
  imports: [FormsModule, Icon],
  templateUrl: './measurements.html',
  styleUrl: './measurements.css',
})
export class Measurements {
  private readonly service = inject(MeasurementService);
  private readonly storage = inject(StorageService);

  // ─── Form state ───

  /** Set while editing an existing check-in; null = composing a new one */
  readonly editingId = signal<string | null>(null);
  readonly dateInput = signal(toDateInput(new Date().toISOString()));
  readonly weightKg = signal<number | null>(null);
  readonly waistCm = signal<number | null>(null);
  readonly notes = signal('');

  readonly canSave = computed(
    () => this.weightKg() != null || this.waistCm() != null || this.notes().trim().length > 0,
  );

  // ─── Existing data ───

  readonly rows = computed(() => buildRows(this.service.measurements()));

  /**
   * The weight series spans sessions too — bodyweight logged at the end of a
   * workout is the same measurement, and ignoring it would make both the
   * headline and the trend read as empty for anyone who has only ever weighed
   * in during a session.
   */
  private readonly weightSeries = computed(() =>
    mergeWeightSeries(this.storage.sessions(), this.service.measurements()).map((p) => ({
      date: p.date,
      value: p.weight,
    })),
  );

  /** Latest known numbers — headline figures and stepper placeholders */
  readonly lastWeight = computed(() => this.weightSeries().at(-1) ?? null);
  readonly lastWaist = this.service.latestWaist;

  readonly weightTrend = computed(() => trendOver(this.weightSeries(), 30));

  readonly waistTrend = computed(() =>
    trendOver(
      this.service
        .measurements()
        .filter((m) => m.waistCm != null)
        .map((m) => ({ date: m.date, value: m.waistCm! })),
      30,
    ),
  );

  // ─── Actions ───

  setWeight(value: number | null): void {
    this.weightKg.set(value != null && value > 0 ? round1(value) : null);
  }

  setWaist(value: number | null): void {
    this.waistCm.set(value != null && value > 0 ? round1(value) : null);
  }

  adjustWeight(delta: number): void {
    this.setWeight((this.weightKg() ?? this.lastWeight()?.value ?? 70) + delta);
  }

  adjustWaist(delta: number): void {
    this.setWaist((this.waistCm() ?? this.lastWaist()?.value ?? 80) + delta);
  }

  save(): void {
    if (!this.canSave()) return;
    const editing = this.service.measurements().find((m) => m.id === this.editingId());
    // Keep the original instant when the day was not touched, so re-saving a
    // check-in does not silently move it to midday.
    const date =
      editing && toDateInput(editing.date) === this.dateInput()
        ? editing.date
        : fromDateInput(this.dateInput());

    const notes = this.notes().trim();
    this.service.save({
      id: editing?.id ?? createMeasurementId(),
      date,
      ...(this.weightKg() != null ? { weightKg: this.weightKg()! } : {}),
      ...(this.waistCm() != null ? { waistCm: this.waistCm()! } : {}),
      ...(notes ? { notes } : {}),
    });
    this.resetForm();
  }

  edit(entry: BodyMeasurement): void {
    this.editingId.set(entry.id);
    this.dateInput.set(toDateInput(entry.date));
    this.weightKg.set(entry.weightKg ?? null);
    this.waistCm.set(entry.waistCm ?? null);
    this.notes.set(entry.notes ?? '');
  }

  remove(entry: BodyMeasurement): void {
    if (!confirm(`Delete the check-in from ${this.formatDate(entry.date)}?`)) return;
    this.service.remove(entry.id);
    if (this.editingId() === entry.id) this.resetForm();
  }

  resetForm(): void {
    this.editingId.set(null);
    this.dateInput.set(toDateInput(new Date().toISOString()));
    this.weightKg.set(null);
    this.waistCm.set(null);
    this.notes.set('');
  }

  // ─── Display helpers ───

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  /** Signed, fixed to one decimal — "+0.4", "−1.2", "0.0" */
  formatDelta(delta: number): string {
    const rounded = round1(delta);
    if (rounded > 0) return `+${rounded.toFixed(1)}`;
    if (rounded < 0) return `−${Math.abs(rounded).toFixed(1)}`;
    return '0.0';
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
