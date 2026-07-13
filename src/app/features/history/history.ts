import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StorageService } from '../../core/services/storage.service';
import { ExportService } from '../../core/services/export.service';
import { WorkoutSession } from '../../core/models/workout.model';

@Component({
  selector: 'app-history',
  imports: [RouterLink],
  templateUrl: './history.html',
  styleUrl: './history.css',
})
export class History {
  private readonly storage = inject(StorageService);
  private readonly exportService = inject(ExportService);

  readonly sessions = this.storage.sessions;

  /** Sesiones ordenadas por fecha (más reciente primero) */
  get sortedSessions(): WorkoutSession[] {
    return [...this.sessions()]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  getDayLabel(dayType: string, variant: string): string {
    const map: Record<string, Record<string, string>> = {
      push: { A: 'Push A', B: 'Push B' },
      pull: { A: 'Pull A', B: 'Pull B' },
      legs: { A: 'Legs A', B: 'Legs B' },
    };
    return map[dayType]?.[variant] ?? `${dayType} ${variant}`;
  }

  getDayColor(dayType: string): string {
    switch (dayType) {
      case 'push': return 'bg-blue-600';
      case 'pull': return 'bg-emerald-600';
      case 'legs': return 'bg-orange-600';
      default: return 'bg-slate-600';
    }
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
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
    if (confirm('¿Eliminar esta sesión?')) {
      this.storage.deleteSession(id);
    }
  }

  exportAll(): void {
    this.exportService.exportAll(this.sessions());
  }
}
