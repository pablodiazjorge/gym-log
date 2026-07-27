import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RoutineService } from '../../core/services/routine.service';
import { StorageService } from '../../core/services/storage.service';
import { ExportService } from '../../core/services/export.service';
import { WorkoutSession, WorkoutExercise, WorkoutSet, ExerciseTemplate } from '../../core/models/workout.model';
import { SetInput } from './set-input';

import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-workout',
  imports: [SetInput, NgClass, FormsModule],
  templateUrl: './workout.html',
  styleUrl: './workout.css',
})
export class Workout {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routineService = inject(RoutineService);
  private readonly storage = inject(StorageService);
  private readonly exportService = inject(ExportService);

  readonly dayType = signal<'push' | 'pull' | 'legs' | 'abs'>('push');
  readonly dayVariant = signal<'A' | 'B'>('A');
  readonly currentExerciseIndex = signal(0);
  readonly session = signal<WorkoutSession | null>(null);
  readonly isSummary = signal(false);
  readonly startTime = signal(Date.now());

  // ─── Selection phase ───
  readonly choiceGroups = signal<{ groupId: string; label: string; options: ExerciseTemplate[] }[]>([]);
  readonly selectedChoices = signal<Record<string, string>>({}); // groupId → templateId
  readonly isSelecting = computed(() => this.choiceGroups().length > 0 && !this.session());

  readonly exercises = computed(() => this.session()?.exercises ?? []);
  readonly currentExercise = computed(() => this.exercises()[this.currentExerciseIndex()] ?? null);
  readonly exerciseCount = computed(() => this.exercises().length);
  readonly isLastExercise = computed(() => this.currentExerciseIndex() >= this.exerciseCount() - 1);
  readonly allCompleted = computed(() => this.exercises().every((ex) => ex.sets.every((s) => s.completed)));
  readonly hasWarmupSets = computed(() => this.currentExercise()?.sets.some((s) => s.isWarmup) ?? false);
  readonly durationMinutes = computed(() => Math.round((Date.now() - this.startTime()) / 60000));
  readonly completedCount = computed(() => this.currentExercise()?.sets.filter((s) => s.completed).length ?? 0);
  readonly totalSetCount = computed(() => this.currentExercise()?.sets.length ?? 0);
  readonly currentExerciseDone = computed(() => {
    const ex = this.currentExercise();
    return ex ? ex.sets.every((s) => s.completed) : false;
  });

  /** Returns Tailwind border class for the hero card */
  get accentBorderClass(): string {
    switch (this.dayType()) {
      case 'push': return 'border-blue-500/30';
      case 'pull': return 'border-emerald-500/30';
      case 'legs': return 'border-amber-500/30';
      case 'abs': return 'border-pink-500/30';
      default: return 'border-zinc-700';
    }
  }

  get accentBgClass(): string {
    switch (this.dayType()) {
      case 'push': return 'from-blue-500/5 to-transparent';
      case 'pull': return 'from-emerald-500/5 to-transparent';
      case 'legs': return 'from-amber-500/5 to-transparent';
      case 'abs': return 'from-pink-500/5 to-transparent';
      default: return 'from-zinc-800 to-transparent';
    }
  }

  get accentTextClass(): string {
    switch (this.dayType()) {
      case 'push': return 'text-blue-400';
      case 'pull': return 'text-emerald-400';
      case 'legs': return 'text-amber-400';
      case 'abs': return 'text-pink-400';
      default: return 'text-zinc-400';
    }
  }

  get accentDotClass(): string {
    switch (this.dayType()) {
      case 'push': return 'bg-blue-500';
      case 'pull': return 'bg-emerald-500';
      case 'legs': return 'bg-amber-500';
      case 'abs': return 'bg-pink-500';
      default: return 'bg-zinc-500';
    }
  }

  constructor() {
    this.route.params.subscribe((params) => {
      const dayType = params['dayType'] as 'push' | 'pull' | 'legs' | 'abs';
      const variant: 'A' | 'B' = 'A';
      const resume = this.route.snapshot.queryParams['resume'] === 'true';
      this.dayType.set(dayType);
      this.dayVariant.set(variant);
      this.session.set(null);
      this.isSummary.set(false);
      this.selectedChoices.set({});
      if (resume) {
        this.loadExistingSession();
      } else {
        this.initWorkflow(dayType, variant);
      }
    });
  }

  /** Inicia el flujo: si hay choices que elegir, muestra selector; si no, crea la sesión directamente */
  private initWorkflow(dayType: 'push' | 'pull' | 'legs' | 'abs', variant: 'A' | 'B'): void {
    const choices = this.routineService.getChoicesForDay(dayType, variant);
    if (choices.length > 0) {
      this.choiceGroups.set(choices);
      // Inicializar selecciones vacías
      const init: Record<string, string> = {};
      for (const c of choices) init[c.groupId] = '';
      this.selectedChoices.set(init);
    } else {
      this.choiceGroups.set([]);
      this.createNewSession(dayType, variant);
    }
  }

  /** El usuario selecciona un ejercicio de un choiceGroup */
  selectExercise(groupId: string, templateId: string): void {
    this.selectedChoices.update((prev) => ({ ...prev, [groupId]: templateId }));
  }

  /** Confirma las selecciones y crea la sesión */
  confirmSelection(): void {
    const dayType = this.dayType();
    const variant = this.dayVariant();
    const selected = this.selectedChoices();
    const selectedIds = new Set(Object.values(selected).filter(Boolean));

    const allTemplates = this.routineService.getExercisesForDay(dayType, variant);
    // Filtrar: solo ejercicios sin choiceGroup, o cuyo id esté en los seleccionados
    const filtered = allTemplates.filter((t) => !t.choiceGroup || selectedIds.has(t.id));

    this.createNewSessionFromTemplates(dayType, variant, filtered);
  }

  /** ¿Están todos los choice groups seleccionados? */
  readonly allChoicesSelected = computed(() => {
    const sel = this.selectedChoices();
    return Object.values(sel).every((id) => id !== '');
  });

  private createNewSession(dayType: 'push' | 'pull' | 'legs' | 'abs', variant: 'A' | 'B'): void {
    const templates = this.routineService.getExercisesForDay(dayType, variant);
    this.createNewSessionFromTemplates(dayType, variant, templates);
  }

  private createNewSessionFromTemplates(dayType: 'push' | 'pull' | 'legs' | 'abs', variant: 'A' | 'B', templates: ExerciseTemplate[]): void {
    const lastSession = this.storage.getLastSessionForDay(dayType, variant);
    const exercises: WorkoutExercise[] = templates.map((template) => {
      const lastExercise = lastSession?.exercises.find((ex) => ex.templateId === template.id);
      const totalSets = template.targetSets + (template.hasWarmupSets ? (template.warmupSets ?? 0) : 0);
      const warmupCount = template.hasWarmupSets ? (template.warmupSets ?? 0) : 0;
      const defaultRir = template.targetRirMin ?? 2;
      const sets: WorkoutSet[] = [];
      for (let i = 0; i < totalSets; i++) {
        const isWarmup = i < warmupCount;
        const lastSet = lastExercise?.sets[i];
        sets.push({
          setNumber: i + 1, isWarmup,
          weightKg: lastSet?.weightKg ?? 0,
          reps: lastSet?.reps ?? template.targetRepsMin,
          partialReps: lastSet?.partialReps ?? 0,
          rir: lastSet?.rir ?? defaultRir,
          completed: false, skipped: false, notes: '',
        });
      }
      return { templateId: template.id, exerciseName: template.name, sets };
    });
    const s: WorkoutSession = {
      id: `ws-${new Date().toISOString().slice(0, 10)}-${dayType}-${String(Date.now()).slice(-4)}`,
      date: new Date().toISOString(), dayType, dayVariant: variant, exercises, completed: false,
    };
    this.session.set(s);
    this.storage.saveCurrentSession(s);
    this.startTime.set(Date.now());
  }

  private loadExistingSession(): void {
    const existing = this.storage.currentSession();
    if (existing) {
      this.session.set(existing);
      const idx = existing.exercises.findIndex((ex) => ex.sets.some((s) => !s.completed));
      this.currentExerciseIndex.set(idx >= 0 ? idx : 0);
      if (this.allCompleted()) this.isSummary.set(true);
    } else {
      this.router.navigate(['/']);
    }
  }

  goToPrevious(): void { if (this.currentExerciseIndex() > 0) this.currentExerciseIndex.update((i) => i - 1); }
  goToNext(): void { if (this.currentExerciseIndex() < this.exerciseCount() - 1) this.currentExerciseIndex.update((i) => i + 1); }

  goToSummary(): void { this.isSummary.set(true); }

  onSetCompleted(updatedSet: WorkoutSet): void {
    const s = this.session();
    if (!s) return;

    const exercise = this.exercises()[this.currentExerciseIndex()];
    const idx = exercise.sets.findIndex((st) => st.setNumber === updatedSet.setNumber);
    if (idx >= 0) exercise.sets[idx] = updatedSet;
    this.session.update((prev) => ({ ...prev!, exercises: [...prev!.exercises] }));
    this.storage.saveCurrentSession(s);
    const allDone = exercise.sets.every((st) => st.completed);
    if (allDone && !this.isLastExercise()) setTimeout(() => this.goToNext(), 500);
    if (this.allCompleted()) this.isSummary.set(true);
  }

  finishWorkout(): void {
    const s = this.session();
    if (!s) return;
    s.completed = true;
    s.durationMinutes = this.durationMinutes();
    this.storage.saveSession(s);
    this.storage.clearCurrentSession();
    this.router.navigate(['/']);
  }

  discardWorkout(): void {
    if (confirm('¿Descartar este entrenamiento?')) { this.storage.clearCurrentSession(); this.router.navigate(['/']); }
  }

  goHome(): void { this.router.navigate(['/']); }

  exportCurrentSession(): void {
    const s = this.session();
    if (s) this.exportService.exportSession(s);
  }

  getMaxWeight(ex: WorkoutExercise): number {
    const ws = ex.sets.filter((st) => !st.isWarmup && st.completed);
    return ws.length > 0 ? Math.max(...ws.map((st) => st.weightKg)) : 0;
  }
  getWorkCount(ex: WorkoutExercise): number { return ex.sets.filter((s) => !s.isWarmup).length; }
  getWarmupCount(ex: WorkoutExercise): number { return ex.sets.filter((s) => s.isWarmup).length; }
}
