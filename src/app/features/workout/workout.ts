import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RoutineService } from '../../core/services/routine.service';
import { StorageService } from '../../core/services/storage.service';
import { ExportService } from '../../core/services/export.service';
import { WorkoutSession, WorkoutExercise, WorkoutSet } from '../../core/models/workout.model';
import { SetInput } from './set-input';

@Component({
  selector: 'app-workout',
  imports: [SetInput],
  templateUrl: './workout.html',
  styleUrl: './workout.css',
})
export class Workout {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routineService = inject(RoutineService);
  private readonly storage = inject(StorageService);
  private readonly exportService = inject(ExportService);

  readonly dayType = signal<'push' | 'pull' | 'legs'>('push');
  readonly dayVariant = signal<'A' | 'B'>('A');
  readonly currentExerciseIndex = signal(0);
  readonly session = signal<WorkoutSession | null>(null);
  readonly isSummary = signal(false);
  readonly startTime = signal(Date.now());
  /** Contador que se incrementa en cada mutación para forzar reevaluación de computeds */
  readonly changeTick = signal(0);

  readonly exercises = computed(() => {
    this.changeTick(); // dependencia para forzar reevaluación tras mutaciones
    return this.session()?.exercises ?? [];
  });
  readonly currentExercise = computed(() => this.exercises()[this.currentExerciseIndex()] ?? null);
  readonly exerciseCount = computed(() => this.exercises().length);
  readonly isLastExercise = computed(() => this.currentExerciseIndex() >= this.exerciseCount() - 1);
  readonly allCompleted = computed(() => {
    this.changeTick(); // dependencia para forzar reevaluación
    return this.exercises().every((ex) => ex.sets.every((s) => s.completed));
  });
  readonly hasWarmupSets = computed(() => this.currentExercise()?.sets.some((s) => s.isWarmup) ?? false);
  readonly progressPercent = computed(() => {
    const total = this.exerciseCount();
    if (total === 0) return 0;
    return Math.round((this.currentExerciseIndex() / total) * 100);
  });
  readonly durationMinutes = computed(() => {
    if (!this.startTime()) return 0;
    return Math.round((Date.now() - this.startTime()) / 60000);
  });

  constructor() {
    this.route.params.subscribe((params) => {
      const dayType = params['dayType'] as 'push' | 'pull' | 'legs';
      const variant = params['variant'] as 'A' | 'B';
      const resume = this.route.snapshot.queryParams['resume'] === 'true';

      this.dayType.set(dayType);
      this.dayVariant.set(variant);

      if (resume) {
        this.loadExistingSession();
      } else {
        this.createNewSession(dayType, variant);
      }
    });
  }

  private createNewSession(dayType: 'push' | 'pull' | 'legs', variant: 'A' | 'B'): void {
    const templates = this.routineService.getExercisesForDay(dayType, variant);
    const lastSession = this.storage.getLastSessionForDay(dayType);

    const exercises: WorkoutExercise[] = templates.map((template) => {
      const lastExercise = lastSession?.exercises.find((ex) => ex.templateId === template.id);
      const totalSets = template.targetSets + (template.hasWarmupSets ? (template.warmupSets ?? 0) : 0);
      const warmupCount = template.hasWarmupSets ? (template.warmupSets ?? 0) : 0;

      const sets: WorkoutSet[] = [];
      for (let i = 0; i < totalSets; i++) {
        const isWarmup = i < warmupCount;
        const lastSet = lastExercise?.sets[i];

        sets.push({
          setNumber: i + 1,
          isWarmup,
          weightKg: lastSet?.weightKg ?? 0,
          reps: lastSet?.reps ?? template.targetRepsMin,
          rir: lastSet?.rir ?? 2,
          completed: false,
          notes: '',
        });
      }

      return {
        templateId: template.id,
        exerciseName: template.name,
        sets,
      };
    });

    const session: WorkoutSession = {
      id: `ws-${new Date().toISOString().slice(0, 10)}-${dayType}-${String(Date.now()).slice(-4)}`,
      date: new Date().toISOString(),
      dayType,
      dayVariant: variant,
      exercises,
      completed: false,
    };

    this.session.set(session);
    this.storage.saveCurrentSession(session);
    this.startTime.set(Date.now());
  }

  private loadExistingSession(): void {
    const existing = this.storage.currentSession();
    if (existing) {
      this.session.set(existing);
      const idx = existing.exercises.findIndex((ex) => ex.sets.some((s) => !s.completed));
      this.currentExerciseIndex.set(idx >= 0 ? idx : 0);
      this.startTime.set(new Date(existing.date).getTime());
    } else {
      this.router.navigate(['/']);
    }
  }

  goToPrevious(): void {
    if (this.currentExerciseIndex() > 0) {
      this.currentExerciseIndex.update((i) => i - 1);
    }
  }

  goToNext(): void {
    if (this.currentExerciseIndex() < this.exerciseCount() - 1) {
      this.currentExerciseIndex.update((i) => i + 1);
    }
  }

  onSetCompleted(updatedSet: WorkoutSet): void {
    const session = this.session();
    if (!session) return;

    const exercise = this.exercises()[this.currentExerciseIndex()];
    const setIndex = exercise.sets.findIndex((s) => s.setNumber === updatedSet.setNumber);
    if (setIndex >= 0) {
      exercise.sets[setIndex] = updatedSet;
    }

    // Disparar reactividad: nuevo tick + nueva referencia del session
    this.changeTick.update((t) => t + 1);
    this.session.update((s) => ({ ...s! }));

    this.storage.saveCurrentSession(session);

    const allSetsDone = exercise.sets.every((s) => s.completed);
    if (allSetsDone && !this.isLastExercise()) {
      setTimeout(() => this.goToNext(), 600);
    }

    if (this.allCompleted()) {
      this.isSummary.set(true);
    }
  }

  finishWorkout(): void {
    const session = this.session();
    if (!session) return;

    session.completed = true;
    session.durationMinutes = this.durationMinutes();

    this.storage.saveSession(session);
    this.storage.clearCurrentSession();
    this.router.navigate(['/']);
  }

  discardWorkout(): void {
    if (confirm('¿Descartar este entrenamiento? Se perderán los datos no guardados.')) {
      this.storage.clearCurrentSession();
      this.router.navigate(['/']);
    }
  }

  exportCurrentSession(): void {
    const session = this.session();
    if (session) {
      this.exportService.exportSession(session);
    }
  }

  getMaxWeight(exercise: WorkoutExercise): number {
    const workSets = exercise.sets.filter((s) => !s.isWarmup && s.completed);
    if (workSets.length === 0) return 0;
    return Math.max(...workSets.map((s) => s.weightKg));
  }

  getTotalSets(exercise: WorkoutExercise): { work: number; warmup: number } {
    const work = exercise.sets.filter((s) => !s.isWarmup && s.completed).length;
    const warmup = exercise.sets.filter((s) => s.isWarmup && s.completed).length;
    return { work, warmup };
  }
}
