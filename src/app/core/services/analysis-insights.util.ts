// ─── Analysis insights (the "Needs attention" feed) ───
//
// Pure, framework-free detectors turning logged history into a short list of
// findings, each with a line of data and a line of concrete advice. Same
// honesty rule as the progression engine: everything here is advisory
// (ADR-0007), worded as a suggestion, never an order.
//
// Detection is e1RM-based on purpose: an exercise progressing by reps at the
// same weight (double progression) must never read as "stalled" the way the
// old max-weight detector had it.

import {
  ExerciseTrendRow,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUP_ORDER,
  PrEvent,
  PrKind,
  ResolvedGroup,
  addWeeksToMonday,
  buildExerciseTrendRows,
  currentMondayLocal,
  e1rmSeriesForExercise,
  lastSessionAvgRir,
  recentPrEvents,
  rirPerSessionAverages,
  rirTrendForExercise,
  weeklySetsByGroup,
} from './analysis.util';
import { PLATE_INCREMENT_KG } from './progression.util';
import { ExerciseTemplate, WorkoutSession } from '../models/workout.model';

// ─── Model ───

export type InsightKind = 'pr' | 'stagnation' | 'rir-rising' | 'volume-drop';

export interface Insight {
  kind: InsightKind;
  /** 0 = win, 1 = worth a look, 2 = needs action */
  severity: 0 | 1 | 2;
  /** Set when the insight concerns one exercise — the card links to its detail */
  templateId?: string;
  /** Set for volume-drop insights */
  group?: ResolvedGroup;
  title: string;
  detail: string;
  advice?: string;
  /** ISO date of the triggering event, when one exists */
  date?: string;
}

// ─── Tunable constants ───

/** PR cards shown in the feed at most */
export const PR_FEED_CAP = 3;

/** Sessions with data an exercise needs before stagnation is considered */
export const STAGNATION_MIN_SESSIONS = 5;
/** Sessions since the all-time best that reads as a stall */
export const STAGNATION_SESSIONS_SINCE_BEST = 4;
/** Not trained within this window = paused, not stagnant */
export const STAGNATION_ACTIVE_WINDOW_DAYS = 21;

/** Completed weeks of history needed before volume drops are judged */
export const VOLUME_DROP_MIN_WEEKS = 4;
/** A last week below this fraction of the baseline mean is a drop */
export const VOLUME_DROP_FACTOR = 0.5;
/** Baseline weekly sets below this are noise, not a baseline */
export const VOLUME_DROP_MIN_BASELINE_SETS = 4;
/** This many simultaneous drops collapse into one aggregate card (deload weeks) */
export const VOLUME_DROP_AGGREGATE_THRESHOLD = 5;

// ─── PR insights ───

const PR_TITLES: Record<PrKind, string> = {
  weight: 'Weight PR',
  'reps-at-weight': 'Rep PR',
  e1rm: 'e1RM PR',
};

/** The most recent PRs as feed cards, capped at PR_FEED_CAP */
export function prInsights(
  sessions: WorkoutSession[],
  byId: ReadonlyMap<string, ExerciseTemplate>,
  nowMs: number,
): Insight[] {
  return recentPrEvents(sessions, byId, nowMs)
    .slice(0, PR_FEED_CAP)
    .map((event) => ({
      kind: 'pr' as const,
      severity: 0 as const,
      templateId: event.templateId,
      date: event.date,
      title: `${PR_TITLES[event.kind]} — ${event.exerciseName}`,
      detail: prDetail(event),
    }));
}

function prDetail(event: PrEvent): string {
  const when = formatShortDate(event.date);
  switch (event.kind) {
    case 'weight':
      return `${event.value} kg × ${event.reps}, was ${event.prevBest} kg · ${when}`;
    case 'reps-at-weight':
      return event.weightKg > 0
        ? `${event.weightKg} kg × ${event.value}, was × ${event.prevBest} · ${when}`
        : `${event.value} reps, was ${event.prevBest} · ${when}`;
    case 'e1rm':
      return `Est. 1RM ${event.value} kg, was ${event.prevBest} · ${when}`;
  }
}

// ─── Stagnation ───

/**
 * A stall: enough history, the all-time best of the exercise's metric is
 * several sessions old, the trend is not already recovering, and the exercise
 * is actually being trained. The advice ladder escalates with how long the
 * best has stood, with one override: when the last session's average RIR is
 * high, the first lever is intensity, not load.
 */
export function detectStagnationFlag(
  row: ExerciseTrendRow,
  sessions: WorkoutSession[],
  nowMs: number,
  weightIncrementKg: number = PLATE_INCREMENT_KG,
): Insight | null {
  const { values } = row;
  if (values.length < STAGNATION_MIN_SESSIONS) return null;
  if (row.trend.direction === 'up') return null;
  const idleMs = nowMs - new Date(row.lastTrainedDate).getTime();
  if (idleMs > STAGNATION_ACTIVE_WINDOW_DAYS * 86400000) return null;

  const best = Math.max(...values);
  const sessionsSinceBest = values.length - 1 - values.lastIndexOf(best);
  if (sessionsSinceBest < STAGNATION_SESSIONS_SINCE_BEST) return null;

  const detail =
    row.metric === 'e1rm'
      ? `Best e1RM ${best} kg was ${sessionsSinceBest} sessions ago`
      : `Best ${best} reps was ${sessionsSinceBest} sessions ago`;

  return {
    kind: 'stagnation',
    severity: 2,
    templateId: row.templateId,
    title: `Stalled — ${row.name}`,
    detail,
    advice: stagnationAdvice(row, sessions, sessionsSinceBest, weightIncrementKg),
  };
}

function stagnationAdvice(
  row: ExerciseTrendRow,
  sessions: WorkoutSession[],
  sessionsSinceBest: number,
  weightIncrementKg: number,
): string {
  const avgRir = lastSessionAvgRir(row.templateId, sessions);
  if (avgRir != null && avgRir >= 2.5) {
    return `Intensity looks low (avg RIR ${avgRir}) — take your top sets closer to RIR 1-2 before adding load.`;
  }
  if (sessionsSinceBest <= STAGNATION_SESSIONS_SINCE_BEST + 1) {
    return row.metric === 'e1rm'
      ? `Try +1 rep on your top set, or a +${weightIncrementKg} kg microload next session.`
      : 'Try +1 rep on your top set next session.';
  }
  if (sessionsSinceBest <= 8) {
    const bestSet = bestSetLabel(row, sessions);
    return bestSet
      ? `Check sleep, food and rest times, then attempt ${bestSet} again fresh.`
      : 'Check sleep, food and rest times, then attempt your best again fresh.';
  }
  return 'Consider a lighter week (−10%) or swapping in a similar exercise for a few weeks.';
}

/** "82.5 kg × 6" for the best e1RM point; "12 reps" for the reps metric */
function bestSetLabel(row: ExerciseTrendRow, sessions: WorkoutSession[]): string | null {
  const bestIndex = row.values.lastIndexOf(Math.max(...row.values));
  if (row.metric === 'reps') return `${row.values[bestIndex]} reps`;
  const point = e1rmSeriesForExercise(row.templateId, sessions)[bestIndex];
  return point ? `${point.topWeightKg} kg × ${point.topReps}` : null;
}

// ─── RIR rising without progress ───

/**
 * The load is getting easier (average RIR trending up) while the metric is
 * not improving — the same signal the progression engine acts on when it
 * takes an aggressive step, surfaced instead of silently baked into pre-fills.
 */
export function detectRirRisingFlag(
  row: ExerciseTrendRow,
  sessions: WorkoutSession[],
): Insight | null {
  if (row.trend.direction === 'up') return null;
  if (rirTrendForExercise(row.templateId, sessions) !== 'rising') return null;

  const rirs = rirPerSessionAverages(row.templateId, sessions);
  const recent = round1(mean(rirs.slice(-3)));
  const previous = round1(mean(rirs.slice(-6, -3)));

  return {
    kind: 'rir-rising',
    severity: 1,
    templateId: row.templateId,
    title: `Getting easier — ${row.name}`,
    detail: `Avg RIR ${previous} → ${recent} while the load stays put`,
    advice: 'Add weight next session — you have reps in the tank.',
  };
}

// ─── Weekly volume drops ───

/**
 * Muscle groups whose last COMPLETED week fell below half their recent weekly
 * baseline. The current (partial) week is never judged — that mistake is what
 * made the old "Watch out" tile read red almost permanently. Weeks with no
 * sessions count as zero, so a skipped week is a real drop, not a gap in the
 * data. When most groups drop at once it is one event (a deload or a week
 * off), not ten alarms.
 */
export function detectVolumeDropFlags(
  sessions: WorkoutSession[],
  byId: ReadonlyMap<string, ExerciseTemplate>,
  nowMs: number,
): Insight[] {
  const weeks = weeklySetsByGroup(sessions, byId);
  if (weeks.size === 0) return [];

  const currentMonday = currentMondayLocal(new Date(nowMs));
  const dataMondays = [...weeks.keys()].filter((m) => m < currentMonday).sort();
  if (dataMondays.length === 0) return [];

  // Continuous timeline from the first data week to the last completed week
  const lastCompleted = addWeeksToMonday(currentMonday, -1);
  const timeline: string[] = [];
  for (let monday = dataMondays[0]; monday <= lastCompleted; monday = addWeeksToMonday(monday, 1)) {
    timeline.push(monday);
  }
  if (timeline.length < VOLUME_DROP_MIN_WEEKS) return [];

  const flagged: Insight[] = [];
  for (const group of MUSCLE_GROUP_ORDER) {
    const series = timeline.map((monday) => weeks.get(monday)?.get(group) ?? 0);
    const lastCount = series[series.length - 1];
    const baseline = series.slice(-VOLUME_DROP_MIN_WEEKS, -1);
    const baselineMean = mean(baseline);
    if (baselineMean < VOLUME_DROP_MIN_BASELINE_SETS) continue;
    if (lastCount >= baselineMean * VOLUME_DROP_FACTOR) continue;

    const label = MUSCLE_GROUP_LABELS[group];
    flagged.push({
      kind: 'volume-drop',
      severity: 1,
      group,
      title: `${label} volume dropped`,
      detail: `${lastCount} sets last week vs ~${Math.round(baselineMean)}/week before`,
      advice: `Add direct ${label.toLowerCase()} work this week to keep the stimulus.`,
    });
  }

  if (flagged.length >= VOLUME_DROP_AGGREGATE_THRESHOLD) {
    return [
      {
        kind: 'volume-drop',
        severity: 1,
        title: 'Training volume dropped across the board',
        detail: `${flagged.length} muscle groups fell below half their recent weekly sets`,
        advice: 'Fine if last week was a deload or a break — otherwise plan this week now.',
      },
    ];
  }
  return flagged;
}

// ─── The feed ───

/**
 * The full "Needs attention" feed: recent PRs first (wins), then stalls, then
 * easier-than-it-should-be exercises, then volume drops. One flag per
 * exercise at most — a stall suppresses its own RIR flag, which would only
 * restate it.
 */
export function buildInsights(
  sessions: WorkoutSession[],
  byId: ReadonlyMap<string, ExerciseTemplate>,
  nowMs: number,
): Insight[] {
  const insights: Insight[] = prInsights(sessions, byId, nowMs);

  const stagnationFlags: Insight[] = [];
  const rirFlags: Insight[] = [];
  for (const row of buildExerciseTrendRows(sessions, byId)) {
    const increment = byId.get(row.templateId)?.weightIncrementKg ?? PLATE_INCREMENT_KG;
    const stall = detectStagnationFlag(row, sessions, nowMs, increment);
    if (stall) {
      stagnationFlags.push(stall);
      continue;
    }
    const rirFlag = detectRirRisingFlag(row, sessions);
    if (rirFlag) rirFlags.push(rirFlag);
  }

  return [
    ...insights,
    ...stagnationFlags,
    ...rirFlags,
    ...detectVolumeDropFlags(sessions, byId, nowMs),
  ];
}

// ─── Internal helpers ───

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Tue 16 Sep" — fixed English arrays so tests never depend on the runner's ICU */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "16 Sep" */
export function formatDayMonth(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
