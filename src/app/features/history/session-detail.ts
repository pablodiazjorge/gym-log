import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../core/services/storage.service';
import { ExportService } from '../../core/services/export.service';
import {
  ExerciseTemplate,
  WorkoutExercise,
  WorkoutSession,
} from '../../core/models/workout.model';
import { Icon } from '../../shared/components/icon';
import { SetInput } from '../../shared/components/set-input';
import { ExercisePicker, PickerCategory } from '../../shared/components/exercise-picker';
import { categoryBadgeClass } from '../../shared/theme';
// Pure helpers shared across features: the live-workout seeding for a new set
// and the measurements date-input bridge.
import { appendSet } from '../workout/session-edit.util';
import { toDateInput } from '../measurements/check-in.util';
import {
  addExerciseFromTemplate,
  normalizeForSave,
  removeExerciseAt,
  removeSetAt,
  withSessionDate,
} from './history-edit.util';

@Component({
  selector: 'app-session-detail',
  imports: [RouterLink, FormsModule, Icon, SetInput, ExercisePicker],
  templateUrl: './session-detail.html',
  styleUrl: './session-detail.css',
})
export class SessionDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);
  private readonly exportService = inject(ExportService);

  readonly session = computed<WorkoutSession | undefined>(() => {
    const id = this.route.snapshot.params['sessionId'];
    return this.storage.sessions().find((s) => s.id === id);
  });

  // ─── Edit mode (ADR-0014: history edits correct the record) ───
  // All edits act on a deep-cloned draft; nothing persists until Save, so
  // Cancel is the undo for everything and no per-edit confirm is needed.

  readonly editing = signal(false);
  readonly draft = signal<WorkoutSession | null>(null);
  readonly isPicking = signal(false);
  readonly pickerCategory = signal<PickerCategory>('all');

  readonly draftTemplateIds = computed(
    () => this.draft()?.exercises.map((e) => e.templateId) ?? [],
  );

  startEdit(): void {
    const s = this.session();
    if (!s) return;
    this.draft.set(structuredClone(s));
    this.editing.set(true);
  }

  cancelEdit(): void {
    if (this.isDirty() && !confirm('Discard your changes to this session?')) return;
    this.exitEdit();
  }

  saveEdit(): void {
    const d = this.draft();
    if (!d) return;
    const normalized = normalizeForSave(d);
    if (normalized.exercises.length === 0) {
      alert('Nothing left to save — to remove the whole session, use Delete instead.');
      return;
    }
    this.storage.saveSession(normalized);
    this.exitEdit();
  }

  private exitEdit(): void {
    this.editing.set(false);
    this.draft.set(null);
    this.isPicking.set(false);
  }

  private isDirty(): boolean {
    const s = this.session();
    const d = this.draft();
    return !!s && !!d && JSON.stringify(s) !== JSON.stringify(d);
  }

  /**
   * app-set-input mutates the set object in place and reports through its
   * outputs; bumping the draft reference keeps the signal graph honest.
   */
  refreshDraft(): void {
    const d = this.draft();
    if (d) this.draft.set({ ...d });
  }

  // ─── Structural edits (pure logic in history-edit.util) ───

  addSetTo(exIndex: number): void {
    this.patchExercise(exIndex, (ex) => appendSet(ex));
  }

  removeSet(exIndex: number, setIndex: number): void {
    this.patchExercise(exIndex, (ex) => removeSetAt(ex, setIndex));
  }

  removeExercise(index: number): void {
    const d = this.draft();
    if (!d) return;
    const updated = removeExerciseAt(d, index);
    if (updated !== d) this.draft.set(updated);
  }

  openPicker(): void {
    this.isPicking.set(true);
  }

  closePicker(): void {
    this.isPicking.set(false);
  }

  onExercisePicked(template: ExerciseTemplate): void {
    const d = this.draft();
    if (!d) return;
    this.draft.set(addExerciseFromTemplate(d, template));
    this.isPicking.set(false);
  }

  private patchExercise(index: number, fn: (ex: WorkoutExercise) => WorkoutExercise): void {
    const d = this.draft();
    const current = d?.exercises[index];
    if (!d || !current) return;
    const updated = fn(current);
    if (updated === current) return;
    const exercises = [...d.exercises];
    exercises[index] = updated;
    this.draft.set({ ...d, exercises });
  }

  // ─── Session fields ───

  dateInputValue(): string {
    const d = this.draft();
    return d ? toDateInput(d.date) : '';
  }

  setDate(value: string): void {
    const d = this.draft();
    if (d) this.draft.set(withSessionDate(d, value));
  }

  setDuration(value: number | null): void {
    this.patchSession({
      durationMinutes: value != null && value > 0 ? Math.round(value) : undefined,
    });
  }

  /** Same semantics as the workout summary: rounded to 0.1, cleared when ≤ 0 */
  setBodyWeight(value: number | null): void {
    this.patchSession({
      bodyWeightKg: value != null && value > 0 ? Math.round(value * 10) / 10 : undefined,
    });
  }

  setNotes(value: string): void {
    this.patchSession({ notes: value });
  }

  private patchSession(patch: Partial<WorkoutSession>): void {
    const d = this.draft();
    if (d) this.draft.set({ ...d, ...patch });
  }

  // ─── Read-only view helpers (unchanged) ───

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  getBadgeClass(dayType: string): string {
    return categoryBadgeClass(dayType);
  }

  getDayLabel(dayType: string, date?: string): string {
    const map: Record<string, string> = {
      push: 'Push',
      pull: 'Pull',
      legs: 'Legs',
      abs: 'Abs',
      additional: 'Extra',
      routine: 'Routine',
    };
    const label = map[dayType] ?? dayType;
    if (date) {
      const dayName = this.getDayName(date);
      return `${label} (${dayName})`;
    }
    return label;
  }

  private getDayName(iso: string): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date(iso).getDay()];
  }

  getMaxWeight(exercise: WorkoutExercise): number {
    // Skipped sets keep their typed weight by design — they are not performed
    // work, so they must not become the exercise's headline number.
    const workSets = exercise.sets.filter((s) => !s.isWarmup && !s.skipped);
    return workSets.length > 0 ? Math.max(...workSets.map((s) => s.weightKg)) : 0;
  }

  deleteSession(): void {
    const s = this.session();
    if (!s) return;
    if (confirm('Delete this session?')) {
      this.storage.deleteSession(s.id);
      this.router.navigate(['/history']);
    }
  }

  exportSession(): void {
    const s = this.session();
    if (s) this.exportService.exportSession(s);
  }
}
