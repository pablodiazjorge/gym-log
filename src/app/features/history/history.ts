import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { StorageService } from '../../core/services/storage.service';
import { ExportService } from '../../core/services/export.service';
import { WorkoutSession } from '../../core/models/workout.model';
import { Icon } from '../../shared/components/icon';
import { categoryBadgeClass, categorySolidClass } from '../../shared/theme';

@Component({
  selector: 'app-history',
  imports: [RouterLink, SlicePipe, Icon],
  templateUrl: './history.html',
  styleUrl: './history.css',
})
export class History {
  private readonly storage = inject(StorageService);
  private readonly exportService = inject(ExportService);

  readonly sessions = this.storage.sessions;

  get sortedSessions(): WorkoutSession[] {
    return [...this.sessions()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

  getBarClass(dayType: string): string {
    return categorySolidClass(dayType);
  }

  getBadgeClass(dayType: string): string {
    return categoryBadgeClass(dayType);
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  /** Only real work sets: warm-ups, skipped and never-completed sets don't count */
  getMaxWeight(session: WorkoutSession): number {
    let max = 0;
    for (const ex of session.exercises) {
      for (const s of ex.sets) {
        if (!s.isWarmup && s.completed && !s.skipped && s.weightKg > max) max = s.weightKg;
      }
    }
    return max;
  }

  deleteSession(id: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (confirm('Delete this session?')) this.storage.deleteSession(id);
  }

  exportAll(): void {
    this.exportService.exportAll(this.sessions());
  }
}
