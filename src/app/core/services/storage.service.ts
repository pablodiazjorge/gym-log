import { Injectable, signal } from '@angular/core';
import { WorkoutExercise, WorkoutSession } from '../models/workout.model';

const SESSIONS_KEY = 'gym_sessions';
const CURRENT_SESSION_KEY = 'gym_current_session';

@Injectable({ providedIn: 'root' })
export class StorageService {
  /** All saved sessions */
  readonly sessions = signal<WorkoutSession[]>([]);

  /** Current in-progress session (null = none) */
  readonly currentSession = signal<WorkoutSession | null>(null);

  constructor() {
    this.loadSessions();
    this.loadCurrentSession();
  }

  // ─── Completed sessions ───

  /** Load all sessions from localStorage */
  loadSessions(): void {
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      if (raw) {
        const parsed: WorkoutSession[] = JSON.parse(raw);
        this.sessions.set(parsed);
      }
    } catch {
      console.warn('Failed to load sessions from localStorage, starting empty');
      this.sessions.set([]);
    }
  }

  /** Save a completed session (adds or updates it) */
  saveSession(session: WorkoutSession): void {
    const current = this.sessions();
    const index = current.findIndex((s) => s.id === session.id);
    if (index >= 0) {
      current[index] = session;
    } else {
      current.push(session);
    }
    this.sessions.set([...current]); // new reference to trigger the signal
    this.persistSessions();
  }

  /** Delete a session by id */
  deleteSession(id: string): void {
    const filtered = this.sessions().filter((s) => s.id !== id);
    this.sessions.set(filtered);
    this.persistSessions();
  }

  /**
   * Find the most recent completed occurrence of an exercise across ALL
   * sessions, regardless of dayType/variant. Progression needs
   * exercise-scoped history: a day-scoped lookup silently loses history when
   * the user picked a different choice-group alternative last time.
   */
  getLastExerciseHistory(
    templateId: string,
  ): { session: WorkoutSession; exercise: WorkoutExercise } | undefined {
    const sorted = this.sessions()
      .filter((s) => s.completed)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    for (const session of sorted) {
      const exercise = session.exercises.find((e) => e.templateId === templateId);
      if (exercise) return { session, exercise };
    }
    return undefined;
  }

  private persistSessions(): void {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(this.sessions()));
  }

  // ─── In-progress session ───

  /** Load the in-progress session from localStorage */
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

  /** Save the current in-progress session (autosave) */
  saveCurrentSession(session: WorkoutSession): void {
    this.currentSession.set(session);
    localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
  }

  /** Remove the in-progress session (on finish or discard) */
  clearCurrentSession(): void {
    this.currentSession.set(null);
    localStorage.removeItem(CURRENT_SESSION_KEY);
  }

  // ─── Import ───

  /** Import sessions from an array, skipping duplicates by id */
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
