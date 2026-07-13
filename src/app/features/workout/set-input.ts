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
  // Inputs
  readonly set = input.required<WorkoutSet>();
  readonly hasWarmup = input(false);
  readonly isLastSet = input(false);

  // Outputs
  readonly setCompleted = output<WorkoutSet>();

  // RIR options
  readonly rirOptions = [0, 1, 2, 3, 4, 5];

  adjustWeight(delta: number): void {
    const current = this.set();
    const newWeight = Math.max(0, +(current.weightKg + delta).toFixed(1));
    current.weightKg = newWeight;
  }

  adjustReps(delta: number): void {
    const current = this.set();
    const newReps = Math.max(0, current.reps + delta);
    current.reps = newReps;
  }

  setRir(value: number): void {
    this.set().rir = value;
  }

  toggleWarmup(): void {
    this.set().isWarmup = !this.set().isWarmup;
  }

  completeSet(): void {
    const current = this.set();
    current.completed = true;
    this.setCompleted.emit({ ...current });

    // Vibración si está disponible
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }
}
