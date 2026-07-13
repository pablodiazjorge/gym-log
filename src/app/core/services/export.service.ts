import { Injectable } from '@angular/core';
import { ExportData, WorkoutSession } from '../models/workout.model';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly appName = 'GymTracker';
  private readonly version = '1.0';

  /** Exporta todas las sesiones a JSON y dispara la descarga */
  exportAll(sessions: WorkoutSession[]): void {
    const data: ExportData = {
      version: this.version,
      exportDate: new Date().toISOString(),
      appName: this.appName,
      sessions,
    };
    this.downloadJson(data, `gym_data_${this.dateString()}.json`);
  }

  /** Exporta una sola sesión a JSON y dispara la descarga */
  exportSession(session: WorkoutSession): void {
    const data: ExportData = {
      version: this.version,
      exportDate: new Date().toISOString(),
      appName: this.appName,
      sessions: [session],
    };
    this.downloadJson(data, `gym_session_${session.id}.json`);
  }

  /** Lee un archivo JSON y devuelve las sesiones parseadas */
  async importFromFile(file: File): Promise<WorkoutSession[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data: ExportData = JSON.parse(reader.result as string);
          if (!data.sessions || !Array.isArray(data.sessions)) {
            throw new Error('Formato inválido: falta el array "sessions"');
          }
          resolve(data.sessions);
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Error al parsear el archivo JSON'));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsText(file);
    });
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
