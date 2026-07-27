import { Component, computed, inject, viewChild, ElementRef } from '@angular/core';
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
  readonly storage = inject(StorageService);
  private readonly exportService = inject(ExportService);

  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly trainingDays = this.routineService.getTrainingDays();
  readonly hasSessionInProgress = computed(() => this.storage.currentSession() !== null);
  readonly totalSessions = computed(() => this.storage.sessions().length);
  readonly lastSession = computed(() => {
    const sessions = this.storage.sessions();
    return sessions.length > 0 ? sessions[sessions.length - 1] : null;
  });

  getAccentColor(dayType: string): string {
    switch (dayType) {
      case 'push': return '#3b82f6';
      case 'pull': return '#10b981';
      case 'legs': return '#f59e0b';
      case 'abs': return '#ec4899';
      default: return '#71717a';
    }
  }

  getDayEmoji(dayType: string): string {
    switch (dayType) {
      case 'push': return '💪';
      case 'pull': return '🏋️';
      case 'legs': return '🦵';
      case 'abs': return '🪨';
      default: return '🏃';
    }
  }

  getMuscleLabel(dayType: string): string {
    switch (dayType) {
      case 'push': return 'Pecho, hombro, tríceps';
      case 'pull': return 'Espalda, bíceps';
      case 'legs': return 'Cuádriceps, isquios, glúteo, femoral, gemelos';
      case 'abs': return 'Abdominales';
      default: return '';
    }
  }

  getDayName(iso: string): string {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[new Date(iso).getDay()];
  }

  startWorkout(day: DayInfo): void {
    this.router.navigate(['/workout', day.dayType]);
  }

  resumeWorkout(): void {
    const session = this.storage.currentSession();
    if (session) {
      this.router.navigate(['/workout', session.dayType], { queryParams: { resume: 'true' } });
    }
  }

  discardSession(): void {
    this.storage.clearCurrentSession();
  }

  exportAll(): void {
    this.exportService.exportAll(this.storage.sessions());
  }

  triggerImport(): void {
    this.fileInput()?.nativeElement.click();
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
      input.value = '';
    }
  }
}
