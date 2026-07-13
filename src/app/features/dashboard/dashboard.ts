import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RoutineService } from '../../core/services/routine.service';
import { StorageService } from '../../core/services/storage.service';
import { ExportService } from '../../core/services/export.service';
import { DayInfo } from '../../core/models/workout.model';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly router = inject(Router);
  private readonly routineService = inject(RoutineService);
  private readonly storage = inject(StorageService);
  private readonly exportService = inject(ExportService);

  readonly trainingDays: DayInfo[] = this.routineService.getTrainingDays();
  readonly hasSessionInProgress = computed(() => this.storage.currentSession() !== null);
  readonly sessionCount = computed(() => this.storage.sessions().length);

  /** Color mapping for day types */
  getDayColor(dayType: string): string {
    switch (dayType) {
      case 'push':
        return 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700';
      case 'pull':
        return 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700';
      case 'legs':
        return 'bg-orange-600 hover:bg-orange-500 active:bg-orange-700';
      default:
        return 'bg-slate-600 hover:bg-slate-500';
    }
  }

  getDayEmoji(dayType: string): string {
    switch (dayType) {
      case 'push':
        return '💪';
      case 'pull':
        return '🏋️';
      case 'legs':
        return '🦵';
      default:
        return '🏃';
    }
  }

  startWorkout(day: DayInfo): void {
    this.router.navigate(['/workout', day.dayType, day.dayVariant]);
  }

  resumeWorkout(): void {
    const session = this.storage.currentSession();
    if (session) {
      this.router.navigate(['/workout', session.dayType, session.dayVariant], {
        queryParams: { resume: 'true' },
      });
    }
  }

  discardSession(): void {
    this.storage.clearCurrentSession();
  }

  async exportAll(): Promise<void> {
    this.exportService.exportAll(this.storage.sessions());
  }

  async importData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const sessions = await this.exportService.importFromFile(file);
      const count = this.storage.importSessions(sessions);
      alert(`Importadas ${count} sesiones nuevas.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      // Reset input para permitir re-importar el mismo archivo
      input.value = '';
    }
  }
}
