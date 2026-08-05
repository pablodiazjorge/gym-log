import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RoutineService } from '../../core/services/routine.service';
import { StorageService } from '../../core/services/storage.service';
import { ExerciseTemplate, WorkoutSession, WorkoutExercise, WorkoutSet } from '../../core/models/workout.model';
import { FormsModule } from '@angular/forms';

type Category = 'push' | 'pull' | 'legs' | 'abs';

@Component({
  selector: 'app-additional',
  imports: [FormsModule],
  templateUrl: './additional.html',
  styleUrl: './additional.css',
})
export class Additional {
  private readonly routineService = inject(RoutineService);
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);

  // ─── Phases: 'select' | 'workout' ───
  readonly phase = signal<'select' | 'workout'>('select');

  // ─── Exercise selection phase ───
  readonly allExercises = this.routineService.getAllExercises();
  readonly categoryFilter = signal<Category | 'all'>('all');
  /** IDs de los ejercicios seleccionados (multi-select) */
  readonly selectedTemplateIds = signal<string[]>([]);

  readonly categories: { value: Category | 'all'; label: string; emoji: string }[] = [
    { value: 'all', label: 'Todos', emoji: '🏋️' },
    { value: 'push', label: 'Push', emoji: '💪' },
    { value: 'pull', label: 'Pull', emoji: '🏋️' },
    { value: 'legs', label: 'Legs', emoji: '🦵' },
    { value: 'abs', label: 'Abs', emoji: '🪨' },
  ];

  readonly filteredExercises = computed(() => {
    const cat = this.categoryFilter();
    if (cat === 'all') return this.allExercises;
    return this.allExercises.filter((ex) => ex.category === cat);
  });

  /** Templates seleccionados, en orden */
  readonly selectedTemplates = computed(() =>
    this.selectedTemplateIds()
      .map((id) => this.allExercises.find((ex) => ex.id === id))
      .filter((t): t is ExerciseTemplate => !!t),
  );

  // ─── Workout phase ───
  /** Sets por ejercicio: Record<templateId, WorkoutSet[]> */
  readonly exercisesData = signal<Record<string, WorkoutSet[]>>({});
  /** Índice del ejercicio actual */
  readonly currentExerciseIndex = signal(0);
  readonly startTime = signal(Date.now());
  readonly durationMinutes = computed(() => Math.round((Date.now() - this.startTime()) / 60000));

  /** Template del ejercicio actual */
  readonly currentTemplate = computed(() => {
    const templates = this.selectedTemplates();
    const idx = this.currentExerciseIndex();
    return templates[idx] ?? null;
  });

  /** Sets del ejercicio actual */
  readonly currentSets = computed(() => {
    const t = this.currentTemplate();
    if (!t) return [];
    return this.exercisesData()[t.id] ?? [];
  });

  readonly nextSetNumber = computed(() => this.currentSets().length + 1);

  // Current set being edited
  readonly currentWeight = signal(0);
  readonly currentReps = signal(10);
  readonly currentRir = signal(2);
  readonly currentPartialReps = signal(0);
  readonly currentIsWarmup = signal(false);

  readonly completedSets = computed(() => this.currentSets().filter((s) => s.completed).length);
  readonly totalSets = computed(() => this.currentSets().length);

  /** Si hay al menos una serie en cualquier ejercicio */
  readonly hasAnySets = computed(() => {
    const data = this.exercisesData();
    return Object.values(data).some((sets) => sets.length > 0);
  });

  /** Número total de ejercicios en la rutina */
  readonly totalExercises = computed(() => this.selectedTemplates().length);

  /** Si estamos en el último ejercicio */
  readonly isLastExercise = computed(() =>
    this.currentExerciseIndex() >= this.selectedTemplates().length - 1,
  );

  // ─── Category helpers ───
  getCategoryLabel(cat: string): string {
    switch (cat) {
      case 'push': return 'Push';
      case 'pull': return 'Pull';
      case 'legs': return 'Legs';
      case 'abs': return 'Abs';
      default: return '';
    }
  }

  getCategoryEmoji(cat: string): string {
    switch (cat) {
      case 'push': return '💪';
      case 'pull': return '🏋️';
      case 'legs': return '🦵';
      case 'abs': return '🪨';
      default: return '🏃';
    }
  }

  getCategoryAccent(cat: string): string {
    switch (cat) {
      case 'push': return 'border-blue-500/30 bg-blue-500/5';
      case 'pull': return 'border-emerald-500/30 bg-emerald-500/5';
      case 'legs': return 'border-amber-500/30 bg-amber-500/5';
      case 'abs': return 'border-pink-500/30 bg-pink-500/5';
      default: return 'border-gray-700 bg-gray-900';
    }
  }

  getCategoryBadge(cat: string): string {
    switch (cat) {
      case 'push': return 'bg-blue-500/20 text-blue-300';
      case 'pull': return 'bg-emerald-500/20 text-emerald-300';
      case 'legs': return 'bg-amber-500/20 text-amber-300';
      case 'abs': return 'bg-pink-500/20 text-pink-300';
      default: return 'bg-gray-700 text-gray-400';
    }
  }

  getAccentBtnClass(): string {
    const t = this.currentTemplate();
    if (!t) return 'bg-gray-800 text-gray-500 cursor-not-allowed';
    switch (t.category) {
      case 'push': return 'bg-blue-600 hover:bg-blue-500';
      case 'pull': return 'bg-emerald-600 hover:bg-emerald-500';
      case 'legs': return 'bg-amber-600 hover:bg-amber-500';
      case 'abs': return 'bg-pink-600 hover:bg-pink-500';
      default: return 'bg-gray-600';
    }
  }

  /** Obtiene clase de acento por categoría */
  getAccentClassByCategory(cat: string): string {
    switch (cat) {
      case 'push': return 'bg-blue-600 hover:bg-blue-500';
      case 'pull': return 'bg-emerald-600 hover:bg-emerald-500';
      case 'legs': return 'bg-amber-600 hover:bg-amber-500';
      case 'abs': return 'bg-pink-600 hover:bg-pink-500';
      default: return 'bg-gray-600';
    }
  }

  // ─── Selection actions ───

  /** Toggle de selección múltiple */
  toggleExercise(templateId: string): void {
    this.selectedTemplateIds.update((ids) => {
      if (ids.includes(templateId)) {
        return ids.filter((id) => id !== templateId);
      }
      return [...ids, templateId];
    });
  }

  /** Confirma selección e inicia la rutina */
  confirmExercises(): void {
    if (this.selectedTemplateIds().length === 0) return;
    // Inicializar datos vacíos para cada ejercicio
    const data: Record<string, WorkoutSet[]> = {};
    for (const id of this.selectedTemplateIds()) {
      data[id] = [];
    }
    this.exercisesData.set(data);
    this.currentExerciseIndex.set(0);
    this.phase.set('workout');
    this.startTime.set(Date.now());
  }

  backToSelect(): void {
    if (this.hasAnySets() && !confirm('¿Volver atrás? Perderás todas las series que hayas añadido.')) return;
    this.phase.set('select');
    this.exercisesData.set({});
    this.currentExerciseIndex.set(0);
    this.selectedTemplateIds.set([]);
    this.resetCurrentSet();
  }

  // ─── Workout navigation ───

  goToExercise(index: number): void {
    if (index >= 0 && index < this.totalExercises()) {
      this.currentExerciseIndex.set(index);
      this.resetCurrentSet();
    }
  }

  nextExercise(): void {
    if (!this.isLastExercise()) {
      this.currentExerciseIndex.update((i) => i + 1);
      this.resetCurrentSet();
    }
  }

  previousExercise(): void {
    if (this.currentExerciseIndex() > 0) {
      this.currentExerciseIndex.update((i) => i - 1);
      this.resetCurrentSet();
    }
  }

  // ─── Set management ───

  addSet(): void {
    const t = this.currentTemplate();
    if (!t) return;

    const s: WorkoutSet = {
      setNumber: this.nextSetNumber(),
      isWarmup: this.currentIsWarmup(),
      weightKg: this.currentWeight(),
      reps: this.currentReps(),
      partialReps: this.currentPartialReps(),
      rir: this.currentRir(),
      completed: true,
      skipped: false,
    };

    this.exercisesData.update((data) => ({
      ...data,
      [t.id]: [...(data[t.id] ?? []), s],
    }));
    this.resetCurrentSet();
    if (navigator.vibrate) navigator.vibrate(30);
  }

  removeSet(index: number): void {
    const t = this.currentTemplate();
    if (!t) return;

    this.exercisesData.update((data) => {
      const current = data[t.id] ?? [];
      const updated = current.filter((_, i) => i !== index);
      return {
        ...data,
        [t.id]: updated.map((s, i) => ({ ...s, setNumber: i + 1 })),
      };
    });
  }

  private resetCurrentSet(): void {
    this.currentWeight.set(0);
    this.currentReps.set(10);
    this.currentRir.set(2);
    this.currentPartialReps.set(0);
    this.currentIsWarmup.set(false);
  }

  toggleWarmup(): void {
    this.currentIsWarmup.update((v) => !v);
  }

  adjustWeight(delta: number): void {
    this.currentWeight.update((v) => Math.max(0, +(v + delta).toFixed(1)));
  }

  adjustReps(delta: number): void {
    this.currentReps.update((v) => Math.max(0, v + delta));
  }

  adjustRir(delta: number): void {
    this.currentRir.update((v) => Math.max(0, +(v + delta).toFixed(1)));
  }

  adjustPartialReps(delta: number): void {
    this.currentPartialReps.update((v) => Math.max(0, v + delta));
  }

  // ─── Finish / Save ───

  finishWorkout(): void {
    if (!this.hasAnySets()) return;

    const exercises: WorkoutExercise[] = this.selectedTemplates()
      .map((t) => {
        const sets = this.exercisesData()[t.id] ?? [];
        if (sets.length === 0) return null; // skip exercises with no sets
        return {
          templateId: t.id,
          exerciseName: t.name,
          sets,
        } as WorkoutExercise;
      })
      .filter((e): e is WorkoutExercise => !!e);

    if (exercises.length === 0) return;

    const session: WorkoutSession = {
      id: `ws-${new Date().toISOString().slice(0, 10)}-additional-${String(Date.now()).slice(-4)}`,
      date: new Date().toISOString(),
      dayType: 'additional',
      dayVariant: 'A',
      exercises,
      durationMinutes: this.durationMinutes(),
      completed: true,
    };

    this.storage.saveSession(session);
    this.router.navigate(['/']);
  }

  discardWorkout(): void {
    if (confirm('¿Descartar esta rutina adicional?')) {
      this.router.navigate(['/']);
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
