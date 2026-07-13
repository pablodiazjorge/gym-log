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

  readonly rirOptions = [0, 1, 2, 3, 4, 5];

  adjustWeight(delta: number): void {
    const s = this.set();
    s.weightKg = Math.max(0, +(s.weightKg + delta).toFixed(1));
  }

  adjustReps(delta: number): void {
    const s = this.set();
    s.reps = Math.max(0, s.reps + delta);
  }

  setRir(value: number): void {
    this.set().rir = value;
  }

  toggleWarmup(): void {
    this.set().isWarmup = !this.set().isWarmup;
  }

  completeSet(): void {
    const s = this.set();
    s.completed = true;
    this.setCompleted.emit({ ...s });
    if (navigator.vibrate) navigator.vibrate(30);
  }
}
