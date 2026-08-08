import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RoutineService } from '../../core/services/routine.service';
import { RoutineLibraryService } from '../../core/services/routine-library.service';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { RoutineExerciseConfig } from '../../core/models/routine.model';
import { ExerciseTemplate } from '../../core/models/workout.model';

type Category = 'push' | 'pull' | 'legs' | 'abs';

/** Editable exercise row in the routine form */
interface EditorRow extends RoutineExerciseConfig {
  exerciseName: string;
  category: Category;
}

@Component({
  selector: 'app-routine-editor',
  imports: [FormsModule],
  templateUrl: './routine-editor.html',
  styleUrl: './routine-editor.css',
})
export class RoutineEditor {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routineService = inject(RoutineService);
  private readonly routineLibrary = inject(RoutineLibraryService);
  private readonly exerciseLibrary = inject(ExerciseLibraryService);

  readonly editingId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.editingId() !== null);

  readonly name = signal('');
  readonly rows = signal<EditorRow[]>([]);
  readonly errors = signal<string[]>([]);

  // ─── Exercise picker (enabled exercises only) ───
  readonly isPicking = signal(false);
  readonly categoryFilter = signal<Category | 'all'>('all');
  readonly categories: { value: Category | 'all'; label: string; emoji: string }[] = [
    { value: 'all', label: 'All', emoji: '🏋️' },
    { value: 'push', label: 'Push', emoji: '💪' },
    { value: 'pull', label: 'Pull', emoji: '🏋️' },
    { value: 'legs', label: 'Legs', emoji: '🦵' },
    { value: 'abs', label: 'Abs', emoji: '🪨' },
  ];
  readonly filteredExercises = computed(() => {
    const cat = this.categoryFilter();
    const inRoutine = new Set(this.rows().map((r) => r.templateId));
    return this.exerciseLibrary
      .enabledExercises()
      .filter((ex) => !inRoutine.has(ex.id) && (cat === 'all' || ex.category === cat));
  });

  constructor() {
    const routineId = this.route.snapshot.params['routineId'] as string | undefined;
    if (routineId) {
      const routine = this.routineLibrary.getRoutineById(routineId);
      if (!routine) {
        // Unknown or built-in id — built-ins are edited via duplicate-then-edit
        this.router.navigate(['/routines']);
        return;
      }
      this.editingId.set(routine.id);
      this.name.set(routine.name);
      this.rows.set(
        [...routine.exercises]
          .sort((a, b) => a.order - b.order)
          .map((ex) => this.toRow(ex)),
      );
    }
  }

  private toRow(config: RoutineExerciseConfig): EditorRow {
    const template = this.routineService.getTemplateById(config.templateId);
    return {
      ...config,
      exerciseName: template?.name ?? config.templateId,
      category: template?.category ?? 'push',
    };
  }

  // ─── Picker actions ───

  openPicker(): void {
    this.isPicking.set(true);
  }

  closePicker(): void {
    this.isPicking.set(false);
  }

  addExercise(template: ExerciseTemplate): void {
    const row: EditorRow = {
      templateId: template.id,
      exerciseName: template.name,
      category: template.category,
      order: this.rows().length + 1,
      targetSets: template.targetSets,
      targetRepsMin: template.targetRepsMin,
      targetRepsMax: template.targetRepsMax,
      hasWarmupSets: template.hasWarmupSets,
      warmupSets: template.warmupSets,
      targetRirMin: template.targetRirMin,
      targetRirMax: template.targetRirMax,
    };
    this.rows.update((rows) => [...rows, row]);
    this.isPicking.set(false);
  }

  removeRow(index: number): void {
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
  }

  moveRow(index: number, delta: number): void {
    this.rows.update((rows) => {
      const target = index + delta;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // ─── Row field adjustments (stepper pattern) ───

  adjustSets(index: number, delta: number): void {
    this.updateRow(index, (r) => ({ ...r, targetSets: Math.max(1, r.targetSets + delta) }));
  }

  adjustRepsMin(index: number, delta: number): void {
    this.updateRow(index, (r) => ({
      ...r,
      targetRepsMin: Math.max(1, Math.min(r.targetRepsMin + delta, r.targetRepsMax)),
    }));
  }

  adjustRepsMax(index: number, delta: number): void {
    this.updateRow(index, (r) => ({
      ...r,
      targetRepsMax: Math.max(r.targetRepsMin, r.targetRepsMax + delta),
    }));
  }

  adjustWarmupSets(index: number, delta: number): void {
    this.updateRow(index, (r) => {
      const warmupSets = Math.max(0, (r.warmupSets ?? 0) + delta);
      return { ...r, warmupSets, hasWarmupSets: warmupSets > 0 };
    });
  }

  adjustRest(index: number, delta: number): void {
    this.updateRow(index, (r) => ({
      ...r,
      restSeconds: Math.max(0, (r.restSeconds ?? 90) + delta),
    }));
  }

  private updateRow(index: number, fn: (row: EditorRow) => EditorRow): void {
    this.rows.update((rows) => rows.map((r, i) => (i === index ? fn(r) : r)));
  }

  // ─── Save / cancel ───

  save(): void {
    const exercises: RoutineExerciseConfig[] = this.rows().map(
      ({ exerciseName: _n, category: _c, ...config }, i) => ({ ...config, order: i + 1 }),
    );
    const input = { name: this.name(), exercises };

    const validationErrors = this.routineLibrary.validateRoutine(input);
    if (validationErrors.length > 0) {
      this.errors.set(validationErrors);
      return;
    }

    try {
      const id = this.editingId();
      if (id) {
        this.routineLibrary.updateRoutine(id, input);
      } else {
        this.routineLibrary.createRoutine(input);
      }
      this.router.navigate(['/routines']);
    } catch (err) {
      this.errors.set([err instanceof Error ? err.message : 'Could not save the routine']);
    }
  }

  cancel(): void {
    this.router.navigate(['/routines']);
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
}
