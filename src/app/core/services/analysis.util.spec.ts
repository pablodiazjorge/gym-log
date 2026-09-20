import { describe, it, expect } from 'vitest';
import {
  addWeeksToMonday,
  balanceRows,
  bestRepsSeriesForExercise,
  buildExerciseTrendRows,
  computeTrend,
  detectPrEvents,
  e1rmSeriesForExercise,
  lastSessionAvgRir,
  mondayOfWeekLocal,
  recentPrEvents,
  rirTrendForExercise,
  sessionCountInWeek,
  weeklyMuscleGroupSets,
  workSets,
  ResolvedGroup,
} from './analysis.util';
import {
  ExerciseTemplate,
  MuscleGroup,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
  categoryOfMuscleGroup,
} from '../models/workout.model';

// ─── Builders ───

const set = (over: Partial<WorkoutSet> = {}): WorkoutSet => ({
  setNumber: 1,
  isWarmup: false,
  weightKg: 40,
  reps: 10,
  rir: 2,
  completed: true,
  skipped: false,
  ...over,
});

const exercise = (templateId: string, sets: WorkoutSet[], name = templateId): WorkoutExercise => ({
  templateId,
  exerciseName: name,
  sets,
});

const session = (
  id: string,
  date: string,
  exercises: WorkoutExercise[],
  over: Partial<WorkoutSession> = {},
): WorkoutSession => ({
  id,
  date,
  dayType: 'routine',
  exercises,
  completed: true,
  ...over,
});

const template = (id: string, muscleGroup: MuscleGroup): ExerciseTemplate => ({
  id,
  name: `Name of ${id}`,
  category: categoryOfMuscleGroup(muscleGroup),
  muscleGroup,
  order: 1,
  targetSets: 3,
  targetRepsMin: 8,
  targetRepsMax: 12,
  hasWarmupSets: false,
});

const catalog = (...templates: ExerciseTemplate[]): ReadonlyMap<string, ExerciseTemplate> =>
  new Map(templates.map((t) => [t.id, t]));

/** N sessions of one exercise, a week apart, each with a single work set */
const weeklySessions = (
  templateId: string,
  sets: Partial<WorkoutSet>[][],
  startDate = new Date(2026, 5, 1, 10, 0),
): WorkoutSession[] =>
  sets.map((sessionSets, i) => {
    const d = new Date(startDate.getTime());
    d.setDate(d.getDate() + i * 7);
    return session(
      `s${i + 1}`,
      d.toISOString(),
      [exercise(templateId, sessionSets.map((over, j) => set({ setNumber: j + 1, ...over })))],
    );
  });

// ─── Week math ───

describe('mondayOfWeekLocal', () => {
  it('maps a mid-week date to its Monday', () => {
    // Local-time string (no Z): parses in the runner's own timezone
    expect(mondayOfWeekLocal('2026-09-16T10:00:00')).toBe('2026-09-14');
  });

  it('maps a Sunday to the PREVIOUS Monday', () => {
    expect(mondayOfWeekLocal('2026-09-20T10:00:00')).toBe('2026-09-14');
  });

  it('is the identity for a Monday, even just after midnight', () => {
    expect(mondayOfWeekLocal('2026-09-14T00:30:00')).toBe('2026-09-14');
  });

  it('BUG-20 regression: a session logged just after local midnight stays in ITS week', () => {
    // Wednesday 00:30 local, serialized the way sessions are stored (UTC ISO).
    // The old implementation found the local Monday but serialized it via
    // toISOString(), so in any timezone ahead of UTC the result slid to Sunday.
    const wednesdayLocalNight = new Date(2026, 8, 16, 0, 30).toISOString();
    expect(mondayOfWeekLocal(wednesdayLocalNight)).toBe('2026-09-14');
  });
});

describe('addWeeksToMonday', () => {
  it('shifts backwards and forwards by whole weeks', () => {
    expect(addWeeksToMonday('2026-09-14', -1)).toBe('2026-09-07');
    expect(addWeeksToMonday('2026-09-14', 2)).toBe('2026-09-28');
  });

  it('crosses a DST change without sliding a day (noon anchor)', () => {
    // Europe's DST ends Sun 25 Oct 2026 — the 25-hour week must still land on Monday
    expect(addWeeksToMonday('2026-10-19', 1)).toBe('2026-10-26');
    expect(addWeeksToMonday('2026-03-23', 1)).toBe('2026-03-30');
  });

  it('crosses a year boundary', () => {
    expect(addWeeksToMonday('2025-12-29', 1)).toBe('2026-01-05');
  });
});

// ─── Skipped sets must never reach a metric (migrated from session-builder.spec) ───

describe('workSets — skipped sets', () => {
  it('excludes warmups, uncompleted and skipped sets', () => {
    const ex = exercise('pec-deck', [
      set({ setNumber: 1, weightKg: 40, reps: 10 }),
      set({ setNumber: 2, weightKg: 40, reps: 8 }),
      // Skipping keeps completed: true by design, so without the !skipped
      // guard this entered every metric as a real set.
      set({ setNumber: 3, skipped: true, weightKg: 0, reps: 0, rir: 0 }),
      set({ setNumber: 4, isWarmup: true, weightKg: 20, reps: 12 }),
      set({ setNumber: 5, completed: false }),
    ]);

    const sets = workSets(ex);
    expect(sets).toHaveLength(2);
    expect(sets.map((s) => s.reps)).toEqual([10, 8]);
  });

  it('a fully-skipped session contributes no data point at all', () => {
    // Real case: the 23-jul session skipped rear-delt-fly entirely. It used to
    // draw a phantom drop to 0 kg that the stagnation detector read as a
    // regression — the session must contribute nothing.
    const sessions = [
      session('s1', '2026-07-23T06:00:00.000Z', [
        exercise(
          'rear-delt-fly',
          [1, 2, 3].map((n) => set({ setNumber: n, skipped: true, weightKg: 0, reps: 0 })),
        ),
      ]),
    ];

    expect(e1rmSeriesForExercise('rear-delt-fly', sessions)).toEqual([]);
    expect(bestRepsSeriesForExercise('rear-delt-fly', sessions)).toEqual([]);
  });
});

// ─── e1RM series ───

describe('e1rmSeriesForExercise', () => {
  it('takes the best estimated 1RM per session with the achieving set', () => {
    // estimate1Rm(100, 5) = Brzycki only = 100·36/32 = 112.5
    // estimate1Rm(90, 10) = Epley only = 90·(1+10/30) = 120
    const sessions = weeklySessions('bench', [
      [{ weightKg: 100, reps: 5 }, { weightKg: 90, reps: 10 }],
    ]);

    const series = e1rmSeriesForExercise('bench', sessions);
    expect(series).toHaveLength(1);
    expect(series[0].e1rm).toBe(120);
    expect(series[0].topWeightKg).toBe(90);
    expect(series[0].topReps).toBe(10);
  });

  it('orders points by date even when the input is unordered', () => {
    const s1 = session('s1', '2026-09-01T10:00:00', [
      exercise('bench', [set({ weightKg: 100, reps: 5 })]),
    ]);
    const s2 = session('s2', '2026-09-08T10:00:00', [
      exercise('bench', [set({ weightKg: 102.5, reps: 5 })]),
    ]);

    const series = e1rmSeriesForExercise('bench', [s2, s1]);
    expect(series.map((p) => p.sessionId)).toEqual(['s1', 's2']);
  });

  it('bodyweight-only sessions contribute no point (no phantom 0 kg)', () => {
    const sessions = weeklySessions('pull-ups', [
      [{ weightKg: 0, reps: 10 }],
      [{ weightKg: 5, reps: 8 }],
    ]);

    const series = e1rmSeriesForExercise('pull-ups', sessions);
    expect(series).toHaveLength(1);
    expect(series[0].topWeightKg).toBe(5);
  });

  it('ignores incomplete sessions', () => {
    const sessions = [
      session('s1', '2026-09-01T10:00:00', [exercise('bench', [set()])], { completed: false }),
    ];
    expect(e1rmSeriesForExercise('bench', sessions)).toEqual([]);
  });
});

describe('bestRepsSeriesForExercise', () => {
  it('takes the best reps per session — the bodyweight progression metric', () => {
    const sessions = weeklySessions('pull-ups', [
      [{ weightKg: 0, reps: 8 }, { weightKg: 0, reps: 10 }],
      [{ weightKg: 0, reps: 11 }],
    ]);

    expect(bestRepsSeriesForExercise('pull-ups', sessions).map((p) => p.reps)).toEqual([10, 11]);
  });
});

describe('lastSessionAvgRir', () => {
  it('averages the work sets of the most recent session with data', () => {
    const sessions = weeklySessions('bench', [
      [{ rir: 1 }],
      [{ rir: 2 }, { rir: 3 }],
    ]);
    expect(lastSessionAvgRir('bench', sessions)).toBe(2.5);
  });

  it('returns null for an exercise never trained', () => {
    expect(lastSessionAvgRir('bench', [])).toBeNull();
  });
});

// ─── Trend ───

describe('computeTrend', () => {
  it('claims nothing below 4 points', () => {
    expect(computeTrend([100, 105, 110])).toEqual({
      direction: 'flat',
      pctChange: null,
      hasEnoughData: false,
    });
  });

  it('compares the mean of the last 3 vs the up-to-3 before them', () => {
    // recent = (100+100+110)/3 = 103.33 vs previous = 100 → +3.3% → up
    expect(computeTrend([100, 100, 100, 110])).toEqual({
      direction: 'up',
      pctChange: 3.3,
      hasEnoughData: true,
    });
    expect(computeTrend([100, 100, 100, 90]).direction).toBe('down');
  });

  it('reads changes inside the ±2% dead band as flat', () => {
    // recent = 101 vs previous = 100 → +1% → flat
    expect(computeTrend([100, 100, 100, 103]).direction).toBe('flat');
  });
});

// ─── RIR trend (progression-engine contract, pins old AnalyticsService semantics) ───

describe('rirTrendForExercise', () => {
  const rirSessions = (rirs: number[]): WorkoutSession[] =>
    weeklySessions('bench', rirs.map((rir) => [{ rir }]));

  it('needs at least 4 sessions with data', () => {
    expect(rirTrendForExercise('bench', rirSessions([2, 3, 4]))).toBe('stable');
  });

  it('rising when the last 3 sessions average >0.3 RIR above the 3 before', () => {
    // recent (2+2+3)/3 = 2.33 vs previous 2 → diff 0.33
    expect(rirTrendForExercise('bench', rirSessions([2, 2, 2, 3]))).toBe('rising');
  });

  it('falling when it drops by more than 0.3', () => {
    expect(rirTrendForExercise('bench', rirSessions([3, 3, 3, 2]))).toBe('falling');
  });

  it('a diff of exactly ±0.3 is still stable (strict threshold)', () => {
    expect(rirTrendForExercise('bench', rirSessions([2, 2, 2, 2.3, 2.3, 2.3]))).toBe('stable');
  });

  it('skipped sets and empty sessions contribute nothing', () => {
    const sessions = rirSessions([2, 2, 2, 3]);
    // A fifth session where every set was skipped must not enter the windows
    sessions.push(
      session('s5', '2026-07-06T10:00:00', [
        exercise('bench', [set({ skipped: true, rir: 0 })]),
      ]),
    );
    expect(rirTrendForExercise('bench', sessions)).toBe('rising');
  });
});

// ─── Weekly balance ───

describe('weeklyMuscleGroupSets / sessionCountInWeek', () => {
  const byId = catalog(template('bench', 'chest'), template('row', 'back'));

  it('counts hard sets per resolved group inside one local week only', () => {
    const sessions = [
      session('s1', '2026-09-14T10:00:00', [
        exercise('bench', [set(), set(), set({ isWarmup: true })]),
        exercise('row', [set()]),
      ]),
      session('s2', '2026-09-16T10:00:00', [exercise('bench', [set()])]),
      // Previous week — must not leak in
      session('s3', '2026-09-10T10:00:00', [exercise('bench', [set()])]),
    ];

    const counts = weeklyMuscleGroupSets(sessions, byId, '2026-09-14');
    expect(counts.get('chest')).toBe(3); // warmup excluded
    expect(counts.get('back')).toBe(1);
    expect(sessionCountInWeek(sessions, '2026-09-14')).toBe(2);
  });

  it('buckets templateIds missing from the catalog as unknown', () => {
    const sessions = [
      session('s1', '2026-09-14T10:00:00', [exercise('press-banca-legacy', [set()])]),
    ];
    expect(weeklyMuscleGroupSets(sessions, byId, '2026-09-14').get('unknown')).toBe(1);
  });
});

describe('balanceRows', () => {
  const counts = (entries: [ResolvedGroup, number][]) => new Map<ResolvedGroup, number>(entries);

  it('always renders the 10 groups in anatomical order, unknown only when present', () => {
    const rows = balanceRows(counts([]));
    expect(rows).toHaveLength(10);
    expect(rows[0].group).toBe('chest');
    expect(rows[9].group).toBe('abs');
    expect(rows.every((r) => r.status === 'none')).toBe(true);

    const withUnknown = balanceRows(counts([['unknown', 2]]));
    expect(withUnknown).toHaveLength(11);
    expect(withUnknown[10]).toMatchObject({ group: 'unknown', band: null, count: 2 });
  });

  it('grades each count against its band', () => {
    const rows = balanceRows(
      counts([
        ['chest', 9], // min is 10
        ['back', 10],
        ['shoulders', 20], // max for shoulders
        ['quads', 19], // max is 18
      ]),
    );
    const byGroup = new Map(rows.map((r) => [r.group, r.status]));
    expect(byGroup.get('chest')).toBe('under');
    expect(byGroup.get('back')).toBe('in');
    expect(byGroup.get('shoulders')).toBe('in');
    expect(byGroup.get('quads')).toBe('over');
    expect(byGroup.get('abs')).toBe('none');
  });
});

// ─── PR detection ───

describe('detectPrEvents', () => {
  it('emits nothing from the first session with data (baseline only)', () => {
    const sessions = weeklySessions('bench', [[{ weightKg: 100, reps: 5 }]]);
    expect(detectPrEvents('bench', sessions)).toEqual([]);
  });

  it('detects a weight PR without a tag-along e1RM PR when the estimate did not improve', () => {
    // s1: 100×5 → e1RM 112.5 · s2: 105×3 → e1RM 105·36/34 = 111.2 < 112.5
    const sessions = weeklySessions('bench', [
      [{ weightKg: 100, reps: 5 }],
      [{ weightKg: 105, reps: 3 }],
    ]);

    const events = detectPrEvents('bench', sessions);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'weight', value: 105, prevBest: 100, reps: 3 });
  });

  it('detects more reps at the running top weight, alongside an e1RM PR', () => {
    // s1: 100×5 (112.5) · s2: 100×7 → reps PR at 100 kg AND e1RM 120.8
    const sessions = weeklySessions('bench', [
      [{ weightKg: 100, reps: 5 }],
      [{ weightKg: 100, reps: 7 }],
    ]);

    const events = detectPrEvents('bench', sessions);
    expect(events.map((e) => e.kind)).toEqual(['reps-at-weight', 'e1rm']);
    expect(events[0]).toMatchObject({ value: 7, prevBest: 5, weightKg: 100 });
  });

  it('bodyweight exercises: reps-at-weight is their only PR kind', () => {
    const sessions = weeklySessions('pull-ups', [
      [{ weightKg: 0, reps: 10 }],
      [{ weightKg: 0, reps: 12 }],
    ]);

    const events = detectPrEvents('pull-ups', sessions);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'reps-at-weight', value: 12, prevBest: 10 });
  });

  it('a worse session emits nothing and leaves the baselines intact', () => {
    const sessions = weeklySessions('bench', [
      [{ weightKg: 100, reps: 5 }],
      [{ weightKg: 95, reps: 4 }],
      [{ weightKg: 102.5, reps: 5 }],
    ]);

    const events = detectPrEvents('bench', sessions);
    expect(events.map((e) => [e.kind, e.value])).toEqual([
      ['weight', 102.5],
      ['e1rm', expect.any(Number)],
    ]);
  });
});

describe('recentPrEvents', () => {
  const byId = catalog(template('bench', 'chest'));

  it('keeps one event per exercise and session with priority weight > reps > e1rm', () => {
    // 100×7 beats both reps-at-weight and e1RM in the same session → reps wins the card
    const sessions = weeklySessions('bench', [
      [{ weightKg: 100, reps: 5 }],
      [{ weightKg: 100, reps: 7 }],
    ]);
    const nowMs = new Date(sessions[1].date).getTime() + 86400000;

    const events = recentPrEvents(sessions, byId, nowMs);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('reps-at-weight');
    expect(events[0].exerciseName).toBe('Name of bench'); // catalog name, not the snapshot
  });

  it('applies the recency window and orders newest first', () => {
    const sessions = weeklySessions('bench', [
      [{ weightKg: 100, reps: 5 }],
      [{ weightKg: 102.5, reps: 5 }], // day 7 — a weight PR
      [{ weightKg: 105, reps: 5 }], // day 14 — another weight PR
    ]);
    const nowMs = new Date(sessions[2].date).getTime() + 86400000; // day 15

    // 7-day window: only the day-14 PR is recent enough
    expect(recentPrEvents(sessions, byId, nowMs, 7).map((e) => e.value)).toEqual([105]);
    // 30-day window: both, newest first
    expect(recentPrEvents(sessions, byId, nowMs, 30).map((e) => e.value)).toEqual([105, 102.5]);
  });
});

// ─── Progress ranking ───

describe('buildExerciseTrendRows', () => {
  const byId = catalog(template('bench', 'chest'));

  it('builds an e1RM row with catalog metadata and a trend', () => {
    const sessions = weeklySessions('bench', [
      [{ weightKg: 100, reps: 5 }],
      [{ weightKg: 100, reps: 5 }],
      [{ weightKg: 100, reps: 5 }],
      [{ weightKg: 105, reps: 5 }],
    ]);

    const rows = buildExerciseTrendRows(sessions, byId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      templateId: 'bench',
      name: 'Name of bench',
      group: 'chest',
      category: 'push',
      metric: 'e1rm',
      sessionsCount: 4,
    });
    expect(rows[0].trend.direction).toBe('flat'); // +1.7% is inside the dead band
    expect(rows[0].bestValue).toBeGreaterThan(rows[0].values[0]);
  });

  it('falls back to the reps metric for bodyweight exercises', () => {
    const sessions = weeklySessions('pull-ups', [
      [{ weightKg: 0, reps: 8 }],
      [{ weightKg: 0, reps: 10 }],
    ]);

    const rows = buildExerciseTrendRows(sessions, byId);
    expect(rows[0].metric).toBe('reps');
    expect(rows[0].lastValue).toBe(10);
    expect(rows[0].trend.hasEnoughData).toBe(false);
  });

  it('falls back to the logged snapshot name for ids missing from the catalog', () => {
    const sessions = [
      session('s1', '2026-09-14T10:00:00', [
        exercise('press-banca-legacy', [set()], 'Press banca'),
      ]),
    ];

    const rows = buildExerciseTrendRows(sessions, byId);
    expect(rows[0]).toMatchObject({ name: 'Press banca', group: 'unknown', category: null });
  });

  it('produces no row for an exercise whose every set was skipped', () => {
    const sessions = [
      session('s1', '2026-09-14T10:00:00', [
        exercise('rear-delt-fly', [set({ skipped: true, weightKg: 0, reps: 0 })]),
      ]),
    ];
    expect(buildExerciseTrendRows(sessions, byId)).toEqual([]);
  });
});
