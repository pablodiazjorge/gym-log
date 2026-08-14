import { Injectable, signal } from '@angular/core';
import { WorkoutExercise, WorkoutSession } from '../models/workout.model';

const SESSIONS_KEY = 'gym_sessions';
const CURRENT_SESSION_KEY = 'gym_current_session';
/** Where malformed sessions go instead of being lost outright */
const QUARANTINE_KEY = 'gym_sessions_quarantine';

/**
 * Minimum shape every consumer assumes. `JSON.parse` returns `any` and the
 * `WorkoutSession` annotation is erased at runtime, so without this check a
 * hand-edited or truncated file is persisted and then breaks History and
 * Analysis permanently.
 */
export function isValidSession(value: unknown): value is WorkoutSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as Partial<WorkoutSession>;
  if (typeof s.id !== 'string' || !s.id) return false;
  if (typeof s.date !== 'string' || Number.isNaN(new Date(s.date).getTime())) return false;
  if (!Array.isArray(s.exercises)) return false;
  return s.exercises.every(
    (ex) =>
      !!ex &&
      typeof ex === 'object' &&
      typeof ex.templateId === 'string' &&
      Array.isArray(ex.sets) &&
      // Analysis and History do arithmetic on these two on every render, so a
      // non-numeric value propagates NaN into charts and maxima.
      ex.sets.every(
        (st) =>
          !!st &&
          typeof st === 'object' &&
          typeof st.weightKg === 'number' &&
          Number.isFinite(st.weightKg) &&
          typeof st.reps === 'number' &&
          Number.isFinite(st.reps),
      ),
  );
}

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

  /**
   * Load all sessions from localStorage, quarantining anything malformed.
   *
   * A non-array (or an array with broken entries) used to be stored as-is and
   * then crashed History and Analysis on every load — and History is the only
   * screen that can delete a session, so there was no way out. Dropped entries
   * are copied to a backup key first: the next save persists the filtered list,
   * so without that copy the loss would be permanent and silent.
   */
  loadSessions(): void {
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      const all = Array.isArray(parsed) ? parsed : [];
      const valid = all.filter(isValidSession);
      if (valid.length !== all.length) {
        const dropped = all.filter((s) => !isValidSession(s));
        console.warn(`Quarantined ${dropped.length} malformed session(s) — see ${QUARANTINE_KEY}`);
        try {
          localStorage.setItem(QUARANTINE_KEY, JSON.stringify(dropped));
        } catch {
          /* quota — the warning above is the best we can do */
        }
      }
      this.sessions.set(valid);
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
  /** Same validation as the saved sessions: a malformed one breaks the workout screen */
  loadCurrentSession(): void {
    try {
      const raw = localStorage.getItem(CURRENT_SESSION_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isValidSession(parsed)) {
          this.currentSession.set(parsed);
        } else {
          console.warn('Discarding a malformed in-progress session');
          this.clearCurrentSession();
        }
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
