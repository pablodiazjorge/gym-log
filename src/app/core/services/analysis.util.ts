// ─── Analysis (coach view) core math ───
//
// Pure, framework-free functions feeding the Analysis feature: local-week
// bucketing, weekly hard-set balance per muscle group, per-exercise e1RM
// series and trends, PR detection, and the RIR trend the progression engine
// consumes. Kept free of Angular DI on purpose so it is trivially
// unit-testable (same contract as progression.util.ts).
//
// Honesty note: the weekly set-target bands are reasonable hypertrophy
// heuristics (roughly 10-20 direct hard sets/week for large muscles, less for
// small ones), not exact science. Only direct work is counted — a row's
// biceps contribution is not attributed to biceps. Advisory and tunable.

import { estimate1Rm, RirTrend } from './progression.util';
import {
  ExerciseTemplate,
  MuscleGroup,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '../models/workout.model';

// ─── Set filtering ───

/**
 * Only completed work sets (no warmups, no skipped). Skipped sets stay
 * `completed: true` by design, so without the `!skipped` guard they would
 * enter every metric as a real 0 kg × 0 rep set.
 */
export function workSets(exercise: WorkoutExercise): WorkoutSet[] {
  return exercise.sets.filter((s) => !s.isWarmup && s.completed && !s.skipped);
}

/** Completed sessions, oldest first — the canonical timeline every metric walks */
export function completedSessionsAsc(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter((s) => s.completed)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ─── Week math (local time end to end) ───

/**
 * Monday of the week containing a date, as a local YYYY-MM-DD string.
 * BUG-20 fix: the old implementation computed the Monday with local getters
 * but serialized via toISOString() (UTC), so any session logged between
 * midnight and the UTC offset fell into the previous week.
 */
export function mondayOfWeekLocal(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return toLocalIsoDate(d);
}

/** Monday of the current week, local YYYY-MM-DD */
export function currentMondayLocal(now: Date = new Date()): string {
  const d = new Date(now.getTime());
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return toLocalIsoDate(d);
}

/**
 * A Monday shifted by whole weeks. Anchored at local noon so a DST change
 * inside the interval can never move the result across a day boundary.
 */
export function addWeeksToMonday(mondayIso: string, deltaWeeks: number): string {
  const d = new Date(`${mondayIso}T12:00:00`);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return toLocalIsoDate(d);
}

// ─── Weekly balance ───

/** Anatomical display order for the balance card */
export const MUSCLE_GROUP_ORDER: readonly MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
];

/** 'unknown' buckets sets whose templateId is missing from the catalog (legacy imports) */
export type ResolvedGroup = MuscleGroup | 'unknown';

/** Sentence-case display labels (Coach design system) */
export const MUSCLE_GROUP_LABELS: Record<ResolvedGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
  unknown: 'Other',
};

/** Advisory weekly hard-set bands per muscle group (direct work only) */
export const WEEKLY_SET_TARGETS: Record<MuscleGroup, { min: number; max: number }> = {
  chest: { min: 10, max: 20 },
  back: { min: 10, max: 20 },
  shoulders: { min: 8, max: 20 },
  quads: { min: 8, max: 18 },
  hamstrings: { min: 6, max: 16 },
  glutes: { min: 6, max: 16 },
  biceps: { min: 6, max: 14 },
  triceps: { min: 6, max: 14 },
  calves: { min: 6, max: 14 },
  abs: { min: 6, max: 14 },
};

/** Muscle group of a logged exercise; 'unknown' when the id left the catalog */
export function resolveMuscleGroup(
  templateId: string,
  byId: ReadonlyMap<string, ExerciseTemplate>,
): ResolvedGroup {
  return byId.get(templateId)?.muscleGroup ?? 'unknown';
}

/**
 * Hard work sets per muscle group for every training week, keyed by the
 * week's local Monday. Weeks with no sessions simply have no entry — the
 * consumer decides whether a gap counts as zero (volume-drop detection does).
 */
export function weeklySetsByGroup(
  sessions: WorkoutSession[],
  byId: ReadonlyMap<string, ExerciseTemplate>,
): Map<string, Map<ResolvedGroup, number>> {
  const weeks = new Map<string, Map<ResolvedGroup, number>>();
  for (const session of sessions) {
    if (!session.completed) continue;
    const monday = mondayOfWeekLocal(session.date);
    let counts = weeks.get(monday);
    if (!counts) {
      counts = new Map<ResolvedGroup, number>();
      weeks.set(monday, counts);
    }
    for (const ex of session.exercises) {
      const n = workSets(ex).length;
      if (n === 0) continue;
      const group = resolveMuscleGroup(ex.templateId, byId);
      counts.set(group, (counts.get(group) ?? 0) + n);
    }
  }
  return weeks;
}

/** Hard work sets per muscle group logged in the week starting at weekStartIso */
export function weeklyMuscleGroupSets(
  sessions: WorkoutSession[],
  byId: ReadonlyMap<string, ExerciseTemplate>,
  weekStartIso: string,
): Map<ResolvedGroup, number> {
  return weeklySetsByGroup(sessions, byId).get(weekStartIso) ?? new Map<ResolvedGroup, number>();
}

/** Completed sessions inside one local week */
export function sessionCountInWeek(sessions: WorkoutSession[], weekStartIso: string): number {
  return sessions.filter((s) => s.completed && mondayOfWeekLocal(s.date) === weekStartIso).length;
}

export type BalanceStatus = 'none' | 'under' | 'in' | 'over';

export interface BalanceRow {
  group: ResolvedGroup;
  label: string;
  count: number;
  /** null for the 'unknown' bucket — no band applies to unattributed sets */
  band: { min: number; max: number } | null;
  status: BalanceStatus;
}

/** The 10 groups in anatomical order; the 'unknown' row appended only when it has sets */
export function balanceRows(counts: ReadonlyMap<ResolvedGroup, number>): BalanceRow[] {
  const rows: BalanceRow[] = MUSCLE_GROUP_ORDER.map((group) => {
    const count = counts.get(group) ?? 0;
    const band = WEEKLY_SET_TARGETS[group];
    const status: BalanceStatus =
      count === 0 ? 'none' : count < band.min ? 'under' : count > band.max ? 'over' : 'in';
    return { group, label: MUSCLE_GROUP_LABELS[group], count, band, status };
  });
  const unknown = counts.get('unknown') ?? 0;
  if (unknown > 0) {
    rows.push({
      group: 'unknown',
      label: MUSCLE_GROUP_LABELS.unknown,
      count: unknown,
      band: null,
      status: 'in',
    });
  }
  return rows;
}

// ─── Per-exercise e1RM series ───

export interface E1rmPoint {
  /** Session date as logged (full ISO timestamp) */
  date: string;
  sessionId: string;
  e1rm: number;
  /** The set behind the estimate */
  topWeightKg: number;
  topReps: number;
}

/**
 * Best estimated 1RM per session for one exercise, oldest first. Sessions
 * where the exercise is absent, fully skipped or purely bodyweight (0 kg)
 * contribute no point — a phantom 0 would read as a crash in every trend.
 */
export function e1rmSeriesForExercise(
  templateId: string,
  sessions: WorkoutSession[],
): E1rmPoint[] {
  const points: E1rmPoint[] = [];
  for (const session of completedSessionsAsc(sessions)) {
    const exercise = session.exercises.find((e) => e.templateId === templateId);
    if (!exercise) continue;
    let best: E1rmPoint | null = null;
    for (const s of workSets(exercise)) {
      if (s.weightKg <= 0 || s.reps <= 0) continue;
      const e1rm = estimate1Rm(s.weightKg, s.reps);
      if (!best || e1rm > best.e1rm) {
        best = {
          date: session.date,
          sessionId: session.id,
          e1rm,
          topWeightKg: s.weightKg,
          topReps: s.reps,
        };
      }
    }
    if (best) points.push(best);
  }
  return points;
}

export interface RepsPoint {
  date: string;
  sessionId: string;
  reps: number;
}

/** Best reps per session — the progression metric for bodyweight exercises */
export function bestRepsSeriesForExercise(
  templateId: string,
  sessions: WorkoutSession[],
): RepsPoint[] {
  const points: RepsPoint[] = [];
  for (const session of completedSessionsAsc(sessions)) {
    const exercise = session.exercises.find((e) => e.templateId === templateId);
    if (!exercise) continue;
    let bestReps = 0;
    for (const s of workSets(exercise)) {
      if (s.reps > bestReps) bestReps = s.reps;
    }
    if (bestReps > 0) points.push({ date: session.date, sessionId: session.id, reps: bestReps });
  }
  return points;
}

/** Average RIR over the work sets of the exercise's most recent session with data; null when none */
export function lastSessionAvgRir(templateId: string, sessions: WorkoutSession[]): number | null {
  const ordered = completedSessionsAsc(sessions);
  for (let i = ordered.length - 1; i >= 0; i--) {
    const exercise = ordered[i].exercises.find((e) => e.templateId === templateId);
    if (!exercise) continue;
    const sets = workSets(exercise);
    if (sets.length === 0) continue;
    return round1(sets.reduce((sum, s) => sum + s.rir, 0) / sets.length);
  }
  return null;
}

// ─── Trend ───

/** Minimum data points (sessions) before a trend is claimed at all */
export const TREND_MIN_POINTS = 4;
/** Sessions per comparison window: mean of the last 3 vs the up-to-3 before them */
export const TREND_WINDOW = 3;
/** Dead band, in percent, inside which a change reads as 'flat' */
export const TREND_THRESHOLD_PCT = 2;

export type TrendDirection = 'up' | 'flat' | 'down';

export interface TrendResult {
  direction: TrendDirection;
  /** % change of the recent window's mean vs the previous window's; null without enough data */
  pctChange: number | null;
  hasEnoughData: boolean;
}

/**
 * Mean of the last TREND_WINDOW values vs the mean of the up-to-TREND_WINDOW
 * values before them (same windowing convention as the RIR trend). Values are
 * one per session, oldest first.
 */
export function computeTrend(values: number[], thresholdPct = TREND_THRESHOLD_PCT): TrendResult {
  if (values.length < TREND_MIN_POINTS) {
    return { direction: 'flat', pctChange: null, hasEnoughData: false };
  }
  const recentAvg = mean(values.slice(-TREND_WINDOW));
  const previousAvg = mean(values.slice(-TREND_WINDOW * 2, -TREND_WINDOW));
  if (previousAvg <= 0) {
    return { direction: 'flat', pctChange: null, hasEnoughData: false };
  }
  const pct = ((recentAvg - previousAvg) / previousAvg) * 100;
  const direction: TrendDirection =
    pct > thresholdPct ? 'up' : pct < -thresholdPct ? 'down' : 'flat';
  return { direction, pctChange: round1(pct), hasEnoughData: true };
}

// ─── RIR trend (progression-engine contract) ───

/** Average RIR over the work sets of each session with data, oldest first */
export function rirPerSessionAverages(templateId: string, sessions: WorkoutSession[]): number[] {
  const perSession: number[] = [];
  for (const session of completedSessionsAsc(sessions)) {
    const exercise = session.exercises.find((e) => e.templateId === templateId);
    if (!exercise) continue;
    const sets = workSets(exercise);
    if (sets.length === 0) continue;
    perSession.push(sets.reduce((sum, s) => sum + s.rir, 0) / sets.length);
  }
  return perSession;
}

/**
 * Average-RIR trend over the last 3 sessions vs the 3 before, exactly as the
 * progression engine has always consumed it (former AnalyticsService
 * semantics, pinned by tests): sessions without work sets contribute nothing,
 * fewer than 4 data points is 'stable', and the dead band is ±0.3 RIR.
 */
export function rirTrendForExercise(templateId: string, sessions: WorkoutSession[]): RirTrend {
  const perSession = rirPerSessionAverages(templateId, sessions);
  if (perSession.length < 4) return 'stable';
  const diff = mean(perSession.slice(-3)) - mean(perSession.slice(-6, -3));
  if (diff > 0.3) return 'rising';
  if (diff < -0.3) return 'falling';
  return 'stable';
}

// ─── PR detection ───

/** How far back the "Needs attention" feed celebrates a PR */
export const PR_RECENCY_DAYS = 14;

export type PrKind = 'weight' | 'reps-at-weight' | 'e1rm';

export interface PrEvent {
  templateId: string;
  exerciseName: string;
  kind: PrKind;
  /** Session date as logged */
  date: string;
  sessionId: string;
  /** The new best: kg for 'weight'/'e1rm', reps for 'reps-at-weight' */
  value: number;
  prevBest: number;
  /** The achieving set, for display ("85 kg × 6") */
  weightKg: number;
  reps: number;
}

/**
 * Every PR in one exercise's history, oldest first — a single ascending pass
 * with running bests. The first session with data only sets the baselines and
 * emits nothing (everything is trivially a "PR" there — feed noise).
 *
 * Kinds: 'weight' = heaviest work set ever; 'reps-at-weight' = more reps than
 * ever done AT the running top weight (for bodyweight exercises that weight
 * is 0 kg, making this their only PR kind); 'e1rm' = best estimated 1RM.
 */
export function detectPrEvents(templateId: string, sessions: WorkoutSession[]): PrEvent[] {
  const events: PrEvent[] = [];
  let bestWeight = -1;
  let bestRepsAtTop = -1;
  let bestE1rm = 0;
  let baselineSet = false;

  for (const session of completedSessionsAsc(sessions)) {
    const exercise = session.exercises.find((e) => e.templateId === templateId);
    if (!exercise) continue;
    const sets = workSets(exercise);
    if (sets.length === 0) continue;

    const sessionTopWeight = Math.max(...sets.map((s) => s.weightKg));
    const repsAtTop = Math.max(
      ...sets.filter((s) => s.weightKg === sessionTopWeight).map((s) => s.reps),
    );
    let sessionBestE1rm = 0;
    let e1rmSet: WorkoutSet | null = null;
    for (const s of sets) {
      if (s.weightKg <= 0 || s.reps <= 0) continue;
      const e1rm = estimate1Rm(s.weightKg, s.reps);
      if (e1rm > sessionBestE1rm) {
        sessionBestE1rm = e1rm;
        e1rmSet = s;
      }
    }

    if (baselineSet) {
      const base = {
        templateId,
        exerciseName: exercise.exerciseName,
        date: session.date,
        sessionId: session.id,
      };
      if (sessionTopWeight > bestWeight) {
        events.push({
          ...base,
          kind: 'weight',
          value: sessionTopWeight,
          prevBest: bestWeight,
          weightKg: sessionTopWeight,
          reps: repsAtTop,
        });
      } else if (sessionTopWeight === bestWeight && repsAtTop > bestRepsAtTop) {
        events.push({
          ...base,
          kind: 'reps-at-weight',
          value: repsAtTop,
          prevBest: bestRepsAtTop,
          weightKg: sessionTopWeight,
          reps: repsAtTop,
        });
      }
      if (e1rmSet && sessionBestE1rm > bestE1rm && bestE1rm > 0) {
        events.push({
          ...base,
          kind: 'e1rm',
          value: sessionBestE1rm,
          prevBest: bestE1rm,
          weightKg: e1rmSet.weightKg,
          reps: e1rmSet.reps,
        });
      }
    }

    // Update running bests (also on the baseline session)
    if (sessionTopWeight > bestWeight) {
      bestWeight = sessionTopWeight;
      bestRepsAtTop = repsAtTop;
    } else if (sessionTopWeight === bestWeight && repsAtTop > bestRepsAtTop) {
      bestRepsAtTop = repsAtTop;
    }
    if (sessionBestE1rm > bestE1rm) bestE1rm = sessionBestE1rm;
    baselineSet = true;
  }
  return events;
}

/**
 * PRs across every trained exercise within the recency window, newest first,
 * at most one per exercise and session — priority weight > reps-at-weight >
 * e1rm, since an e1RM record almost always tags along with the set that broke
 * the others. Names prefer the catalog over the logged snapshot.
 */
export function recentPrEvents(
  sessions: WorkoutSession[],
  byId: ReadonlyMap<string, ExerciseTemplate>,
  nowMs: number,
  windowDays: number = PR_RECENCY_DAYS,
): PrEvent[] {
  const windowStart = nowMs - windowDays * 86400000;
  const priority: Record<PrKind, number> = { weight: 0, 'reps-at-weight': 1, e1rm: 2 };
  const picked = new Map<string, PrEvent>();

  for (const templateId of trainedTemplateIds(sessions)) {
    for (const event of detectPrEvents(templateId, sessions)) {
      const t = new Date(event.date).getTime();
      if (t < windowStart || t > nowMs) continue;
      const key = `${event.templateId}|${event.sessionId}`;
      const existing = picked.get(key);
      if (!existing || priority[event.kind] < priority[existing.kind]) {
        picked.set(key, {
          ...event,
          exerciseName: byId.get(event.templateId)?.name ?? event.exerciseName,
        });
      }
    }
  }
  return [...picked.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── Progress ranking ───

export interface ExerciseTrendRow {
  templateId: string;
  name: string;
  group: ResolvedGroup;
  /** For the badge color; null when the id left the catalog */
  category: 'push' | 'pull' | 'legs' | 'abs' | null;
  /** 'reps' for bodyweight exercises (no weighted set ever) */
  metric: 'e1rm' | 'reps';
  lastValue: number;
  bestValue: number;
  trend: TrendResult;
  /** Sessions that produced a data point for the metric */
  sessionsCount: number;
  lastTrainedDate: string;
  /** Metric values, oldest first (sparklines / detail chart share them) */
  values: number[];
}

/**
 * One row per exercise ever trained, unsorted (presentation decides order).
 * Exercises whose every logged set was skipped produce no row at all.
 */
export function buildExerciseTrendRows(
  sessions: WorkoutSession[],
  byId: ReadonlyMap<string, ExerciseTemplate>,
): ExerciseTrendRow[] {
  const rows: ExerciseTrendRow[] = [];
  for (const templateId of trainedTemplateIds(sessions)) {
    const template = byId.get(templateId);
    let metric: 'e1rm' | 'reps' = 'e1rm';
    let values: number[];
    let dates: string[];

    const e1rmSeries = e1rmSeriesForExercise(templateId, sessions);
    if (e1rmSeries.length > 0) {
      values = e1rmSeries.map((p) => p.e1rm);
      dates = e1rmSeries.map((p) => p.date);
    } else {
      const repsSeries = bestRepsSeriesForExercise(templateId, sessions);
      if (repsSeries.length === 0) continue;
      metric = 'reps';
      values = repsSeries.map((p) => p.reps);
      dates = repsSeries.map((p) => p.date);
    }

    rows.push({
      templateId,
      name: template?.name ?? lastLoggedName(templateId, sessions),
      group: template?.muscleGroup ?? 'unknown',
      category: template?.category ?? null,
      metric,
      lastValue: values[values.length - 1],
      bestValue: Math.max(...values),
      trend: computeTrend(values),
      sessionsCount: values.length,
      lastTrainedDate: dates[dates.length - 1],
      values,
    });
  }
  return rows;
}

/** Distinct templateIds across completed sessions, in first-seen order */
export function trainedTemplateIds(sessions: WorkoutSession[]): string[] {
  const ids = new Set<string>();
  for (const session of sessions) {
    if (!session.completed) continue;
    for (const ex of session.exercises) ids.add(ex.templateId);
  }
  return [...ids];
}

// ─── Internal helpers ───

/** Most recent logged exerciseName snapshot — display fallback for catalog-less ids */
function lastLoggedName(templateId: string, sessions: WorkoutSession[]): string {
  const ordered = completedSessionsAsc(sessions);
  for (let i = ordered.length - 1; i >= 0; i--) {
    const exercise = ordered[i].exercises.find((e) => e.templateId === templateId);
    if (exercise) return exercise.exerciseName;
  }
  return templateId;
}

function toLocalIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
