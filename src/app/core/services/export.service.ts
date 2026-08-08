import { Injectable, inject } from '@angular/core';
import { ExportData, WorkoutSession } from '../models/workout.model';
import { Routine } from '../models/routine.model';
import { UserProfile } from '../models/profile.model';
import { ProfileService } from './profile.service';
import { RoutineLibraryService } from './routine-library.service';

/** Result of parsing an import file */
export interface ImportResult {
  sessions: WorkoutSession[];
  user?: UserProfile;
  routines?: Routine[];
}

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly profileService = inject(ProfileService);
  private readonly routineLibrary = inject(RoutineLibraryService);

  private readonly appName = 'GymTracker';
  private readonly version = '1.1';

  /** Export all sessions (plus profile and custom routines) to JSON and trigger the download */
  exportAll(sessions: WorkoutSession[]): void {
    const data = this.buildExportData(sessions);
    this.downloadJson(data, `gym_data_${this.dateString()}.json`);
  }

  /** Export a single session to JSON and trigger the download */
  exportSession(session: WorkoutSession): void {
    const data = this.buildExportData([session]);
    this.downloadJson(data, `gym_session_${session.id}.json`);
  }

  /** Read a JSON file and return the parsed sessions, profile and routines */
  async importFromFile(file: File): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data: ExportData = JSON.parse(reader.result as string);
          if (!data.sessions || !Array.isArray(data.sessions)) {
            throw new Error('Invalid format: missing "sessions" array');
          }
          resolve({
            sessions: data.sessions,
            user: data.user,
            routines: Array.isArray(data.routines) ? data.routines : undefined,
          });
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to parse the JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read the file'));
      reader.readAsText(file);
    });
  }

  private buildExportData(sessions: WorkoutSession[]): ExportData {
    const user = this.profileService.profile();
    const routines = this.routineLibrary.customRoutines();
    return {
      version: this.version,
      exportDate: new Date().toISOString(),
      appName: this.appName,
      ...(user ? { user } : {}),
      ...(routines.length > 0 ? { routines } : {}),
      sessions,
    };
  }

  private downloadJson(data: ExportData, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private dateString(): string {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }
}
