import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StorageService } from '../../core/services/storage.service';
import { ExportService } from '../../core/services/export.service';
import { WorkoutSession, WorkoutExercise } from '../../core/models/workout.model';
import { Icon } from '../../shared/components/icon';
import { categoryBadgeClass } from '../../shared/theme';

@Component({
  selector: 'app-session-detail',
  imports: [RouterLink, Icon],
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
