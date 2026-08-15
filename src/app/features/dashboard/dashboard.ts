import { Component, computed, inject, viewChild, ElementRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RoutineService } from '../../core/services/routine.service';
import { RoutineLibraryService } from '../../core/services/routine-library.service';
import { StorageService } from '../../core/services/storage.service';
import { ExportService } from '../../core/services/export.service';
import { ProfileService } from '../../core/services/profile.service';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { MeasurementService } from '../../core/services/measurement.service';
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
  private readonly routineLibrary = inject(RoutineLibraryService);
  private readonly profileService = inject(ProfileService);
  private readonly exerciseLibrary = inject(ExerciseLibraryService);
  private readonly measurements = inject(MeasurementService);
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

  // ─── Body check-in ───

  /** Latest weight from either source — a check-in or the end of a session */
  readonly latestWeight = computed(() => {
    // Reads storage.sessions() and measurements.latestWeight() underneath, so
    // this stays reactive despite going through a plain method.
    this.storage.sessions();
    this.measurements.latestWeight();
    return this.profileService.getLatestLoggedBodyWeight();
  });

  readonly latestWaist = this.measurements.latestWaist;

  /** Nudge after a week without a weigh-in — same cadence as the session prompt */
  readonly checkInDue = computed(() => {
    const latest = this.latestWeight();
    if (!latest) return true;
    return (Date.now() - new Date(latest.date).getTime()) / 86400000 >= 7;
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

  getDayTypeLabel(dayType: string): string {
    switch (dayType) {
      case 'push': return 'Push';
      case 'pull': return 'Pull';
      case 'legs': return 'Legs';
      case 'abs': return 'Abs';
      case 'additional': return 'Extra';
      case 'routine': return 'Routine';
      default: return dayType;
    }
  }

  getDayName(iso: string): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date(iso).getDay()];
  }

  startWorkout(day: DayInfo): void {
    this.router.navigate(['/workout', day.dayType]);
  }

  startAdditional(): void {
    this.router.navigate(['/additional']);
  }

  resumeWorkout(): void {
    const session = this.storage.currentSession();
    if (!session) return;
    if (session.dayType === 'routine' && session.routineId) {
      this.router.navigate(['/workout/routine', session.routineId], { queryParams: { resume: 'true' } });
    } else {
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
      const result = await this.exportService.importFromFile(file);
      const count = this.storage.importSessions(result.sessions);
      const routineCount = result.routines ? this.routineLibrary.importRoutines(result.routines) : 0;
      const measurementCount = result.measurements
        ? this.measurements.importMeasurements(result.measurements)
        : 0;
      if (result.enabledExerciseIds) {
        this.exerciseLibrary.importEnabledIds(result.enabledExerciseIds);
      }
      // Only adopt the imported profile when none exists yet (new-device convenience)
      if (result.user && !this.profileService.profile()) {
        this.profileService.saveProfile(result.user);
      }
      const parts = [`Imported ${count} new session${count === 1 ? '' : 's'}.`];
      if (routineCount > 0) parts.push(`${routineCount} routine${routineCount === 1 ? '' : 's'}.`);
      if (measurementCount > 0) {
        parts.push(`${measurementCount} check-in${measurementCount === 1 ? '' : 's'}.`);
      }
      // Silently dropping malformed entries would look like data loss, so say so.
      if (result.skippedSessions > 0) {
        parts.push(
          `${result.skippedSessions} session${result.skippedSessions === 1 ? '' : 's'} skipped (malformed).`,
        );
      }
      alert(parts.join(' '));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      input.value = '';
    }
  }
}
