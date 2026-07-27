import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { StorageService } from '../../core/services/storage.service';
import { ExportService } from '../../core/services/export.service';
import { WorkoutSession } from '../../core/models/workout.model';

@Component({
  selector: 'app-history',
  imports: [RouterLink, SlicePipe],
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

  getDayLabel(dayType: string, _variant: string, date?: string): string {
    const map: Record<string, string> = {
      push: 'Push',
      pull: 'Pull',
      legs: 'Legs',
      abs: 'Abs',
    };
    const label = map[dayType] ?? dayType;
    if (date) {
      const dayName = this.getDayName(date);
      return `${label} (${dayName})`;
    }
    return label;
  }

  private getDayName(iso: string): string {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[new Date(iso).getDay()];
  }

  getAccentColor(dayType: string): string {
    switch (dayType) {
      case 'push': return '#3b82f6';
      case 'pull': return '#10b981';
      case 'legs': return '#f59e0b';
      case 'abs': return '#ec4899';
      default: return '#71717a';
    }
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  getMaxWeight(session: WorkoutSession): number {
    let max = 0;
    for (const ex of session.exercises) {
      for (const s of ex.sets) {
        if (!s.isWarmup && s.weightKg > max) max = s.weightKg;
      }
    }
    return max;
  }

  deleteSession(id: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (confirm('¿Eliminar esta sesión?')) this.storage.deleteSession(id);
  }

  exportAll(): void {
    this.exportService.exportAll(this.sessions());
  }
}
