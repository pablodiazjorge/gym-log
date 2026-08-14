import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WorkoutSet } from '../../core/models/workout.model';

@Component({
  selector: 'app-set-input',
  imports: [FormsModule],
  templateUrl: './set-input.html',
  styleUrl: './set-input.css',
})
export class SetInput {
  readonly set = input.required<WorkoutSet>();
  readonly hasWarmup = input(false);

  readonly setCompleted = output<WorkoutSet>();
  /** A completed set was tapped to be edited again */
  readonly setReopened = output<WorkoutSet>();
  /** An edit that must persist before the set is completed (e.g. the warm-up flag) */
  readonly setChanged = output<WorkoutSet>();

  adjustWeight(delta: number): void {
    const s = this.set();
    s.weightKg = Math.max(0, +(s.weightKg + delta).toFixed(1));
  }

  adjustReps(delta: number): void {
    const s = this.set();
    s.reps = Math.max(0, s.reps + delta);
  }

  adjustRir(delta: number): void {
    const s = this.set();
    s.rir = Math.max(0, +(s.rir + delta).toFixed(1));
  }

  adjustPartialReps(delta: number): void {
    const s = this.set();
    s.partialReps = Math.max(0, (s.partialReps ?? 0) + delta);
  }

  adjustEccentricSeconds(delta: number): void {
    const s = this.set();
    s.eccentricSeconds = Math.max(0, (s.eccentricSeconds ?? 0) + delta);
  }

  toggleWarmup(): void {
    const s = this.set();
    s.isWarmup = !s.isWarmup;
    // Emit so the parent persists it: otherwise the flag is lost if the set is
    // never completed, and hasWarmupSets() keeps a stale value.
    this.setChanged.emit({ ...s });
  }

  completeSet(): void {
    const s = this.set();
    s.completed = true;
    this.setCompleted.emit({ ...s });
    if (navigator.vibrate) navigator.vibrate(30);
  }

  /**
   * Skipping keeps the typed weight/reps instead of zeroing them, so the set can
   * be reopened without data loss. Every consumer filters on `skipped`, so the
   * retained values never reach a metric.
   */
  skipSet(): void {
    const s = this.set();
    s.skipped = true;
    s.completed = true;
    this.setCompleted.emit({ ...s });
    if (navigator.vibrate) navigator.vibrate(30);
  }

  /** Back to the editable state — the only way out of a mistyped set */
  reopenSet(): void {
    const s = this.set();
    s.completed = false;
    s.skipped = false;
    this.setReopened.emit({ ...s });
    if (navigator.vibrate) navigator.vibrate(15);
  }
}
