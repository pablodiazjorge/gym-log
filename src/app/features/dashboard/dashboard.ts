import { Component, computed, inject, viewChild, ElementRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RoutineService } from '../../core/services/routine.service';
import { RoutineLibraryService } from '../../core/services/routine-library.service';
import { StorageService } from '../../core/services/storage.service';
import { ExportService } from '../../core/services/export.service';
import { ProfileService } from '../../core/services/profile.service';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { MeasurementService } from '../../core/services/measurement.service';
import { Routine } from '../../core/models/routine.model';
import { Icon } from '../../shared/components/icon';
import { IconName } from '../../shared/components/icon-paths';
import { categoryIcon, categoryTileClass } from '../../shared/theme';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, Icon],
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

  private readonly builtInRoutines = this.routineService.getBuiltInRoutines();
  /** dayType → muscle label, for the built-in cards' subtitle */
  private readonly muscleLabels = new Map(
    this.routineService.getTrainingDays().map((d) => [d.dayType, d.muscleLabel]),
  );

  /**
   * The routines shown on Home: the user's pinned selection (Routines tab →
   * card menu), or the four built-in days until it is customized. Ids whose
   * routine no longer exists are skipped rather than rendered broken.
   */
  readonly homeRoutines = computed<Routine[]>(() => {
    const defaults = this.builtInRoutines.map((r) => r.id);
    const ids = this.routineLibrary.homeRoutineIds() ?? defaults;
    const byId = new Map(
      [...this.builtInRoutines, ...this.routineLibrary.customRoutines()].map((r) => [r.id, r]),
    );
    return ids.flatMap((id) => byId.get(id) ?? []);
  });

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

  getRoutineTile(routine: Routine): string {
    return categoryTileClass(routine.builtInDayType ?? 'routine');
  }

  getRoutineIcon(routine: Routine): IconName {
    return categoryIcon(routine.builtInDayType ?? 'routine');
  }

  getRoutineSubtitle(routine: Routine): string {
    if (routine.builtInDayType) return this.muscleLabels.get(routine.builtInDayType) ?? '';
    const count = routine.exercises.length;
    return `${count} exercise${count === 1 ? '' : 's'}`;
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

  startRoutine(routine: Routine): void {
    if (routine.source === 'built-in' && routine.builtInDayType) {
      // Built-in days keep their live choice-group selection UX
      this.router.navigate(['/workout', routine.builtInDayType]);
    } else {
      this.router.navigate(['/workout/routine', routine.id]);
    }
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
