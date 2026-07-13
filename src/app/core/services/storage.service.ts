import { Injectable, signal } from '@angular/core';
import { WorkoutSession } from '../models/workout.model';

const SESSIONS_KEY = 'gym_sessions';
const CURRENT_SESSION_KEY = 'gym_current_session';

@Injectable({ providedIn: 'root' })
export class StorageService {
  /** Todas las sesiones guardadas */
  readonly sessions = signal<WorkoutSession[]>([]);

  /** Sesión en progreso actual (null = no hay) */
  readonly currentSession = signal<WorkoutSession | null>(null);

  constructor() {
    this.loadSessions();
    this.loadCurrentSession();
  }

  // ─── Sesiones completadas ───

  /** Carga todas las sesiones desde localStorage */
  loadSessions(): void {
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      if (raw) {
        const parsed: WorkoutSession[] = JSON.parse(raw);
        this.sessions.set(parsed);
      }
    } catch {
      console.warn('Error al cargar sesiones de localStorage, iniciando vacío');
      this.sessions.set([]);
    }
  }

  /** Guarda una sesión completada (la añade o actualiza) */
  saveSession(session: WorkoutSession): void {
    const current = this.sessions();
    const index = current.findIndex((s) => s.id === session.id);
    if (index >= 0) {
      current[index] = session;
    } else {
      current.push(session);
    }
    this.sessions.set([...current]); // nueva referencia para disparar signal
    this.persistSessions();
  }

  /** Elimina una sesión por id */
  deleteSession(id: string): void {
    const filtered = this.sessions().filter((s) => s.id !== id);
    this.sessions.set(filtered);
    this.persistSessions();
  }

  /** Busca la última sesión completada de un dayType (para pre-fill) */
  getLastSessionForDay(dayType: 'push' | 'pull' | 'legs'): WorkoutSession | undefined {
    return this.sessions()
      .filter((s) => s.dayType === dayType && s.completed)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }

  private persistSessions(): void {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(this.sessions()));
  }

  // ─── Sesión en progreso ───

  /** Carga la sesión en progreso desde localStorage */
  loadCurrentSession(): void {
    try {
      const raw = localStorage.getItem(CURRENT_SESSION_KEY);
      if (raw) {
        const parsed: WorkoutSession = JSON.parse(raw);
        this.currentSession.set(parsed);
      }
    } catch {
      this.clearCurrentSession();
    }
  }

  /** Guarda la sesión actual en progreso (autosave) */
  saveCurrentSession(session: WorkoutSession): void {
    this.currentSession.set(session);
    localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
  }

  /** Elimina la sesión en progreso (al completar o descartar) */
  clearCurrentSession(): void {
    this.currentSession.set(null);
    localStorage.removeItem(CURRENT_SESSION_KEY);
  }

  // ─── Importación ───

  /** Importa sesiones desde un array, evitando duplicados por id */
  importSessions(incoming: WorkoutSession[]): number {
    const current = this.sessions();
    const existingIds = new Set(current.map((s) => s.id));
    const newSessions = incoming.filter((s) => !existingIds.has(s.id));
    if (newSessions.length > 0) {
      this.sessions.set([...current, ...newSessions]);
      this.persistSessions();
    }
    return newSessions.length;
  }
}
