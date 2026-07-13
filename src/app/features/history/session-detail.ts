import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StorageService } from '../../core/services/storage.service';
import { ExportService } from '../../core/services/export.service';
import { WorkoutSession, WorkoutExercise } from '../../core/models/workout.model';

@Component({
  selector: 'app-session-detail',
  imports: [RouterLink],
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

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  getAccentColor(dayType: string): string {
    switch (dayType) {
      case 'push': return '#3b82f6';
      case 'pull': return '#10b981';
      case 'legs': return '#f59e0b';
      default: return '#71717a';
    }
  }

  getDayLabel(dayType: string, variant: string): string {
    const map: Record<string, Record<string, string>> = {
      push: { A: 'Push A', B: 'Push B' },
      pull: { A: 'Pull A', B: 'Pull B' },
      legs: { A: 'Legs A', B: 'Legs B' },
    };
    return map[dayType]?.[variant] ?? `${dayType} ${variant}`;
  }

  getMaxWeight(exercise: WorkoutExercise): number {
    const workSets = exercise.sets.filter((s) => !s.isWarmup);
    return workSets.length > 0 ? Math.max(...workSets.map((s) => s.weightKg)) : 0;
  }

  getWorkSets(exercise: WorkoutExercise): number {
    return exercise.sets.filter((s) => !s.isWarmup).length;
  }

  getWarmupSets(exercise: WorkoutExercise): number {
    return exercise.sets.filter((s) => s.isWarmup).length;
  }

  deleteSession(): void {
    const s = this.session();
    if (!s) return;
    if (confirm('¿Eliminar esta sesión?')) {
      this.storage.deleteSession(s.id);
      this.router.navigate(['/history']);
    }
  }

  exportSession(): void {
    const s = this.session();
    if (s) this.exportService.exportSession(s);
  }
}
