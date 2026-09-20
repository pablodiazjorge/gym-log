import { describe, it, expect } from 'vitest';
import {
  buildInsights,
  detectRirRisingFlag,
  detectStagnationFlag,
  detectVolumeDropFlags,
  formatShortDate,
  prInsights,
} from './analysis-insights.util';
import { buildExerciseTrendRows, ExerciseTrendRow } from './analysis.util';
import {
  ExerciseTemplate,
  MuscleGroup,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
  categoryOfMuscleGroup,
} from '../models/workout.model';

// ─── Builders (same conventions as analysis.util.spec) ───

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

/** N weekly sessions of one exercise (one per week, starting at startDate) */
const weeklySessions = (
  templateId: string,
  sets: Partial<WorkoutSet>[][],
  startDate: Date,
  idPrefix = 's',
): WorkoutSession[] =>
  sets.map((sessionSets, i) => {
    const d = new Date(startDate.getTime());
    d.setDate(d.getDate() + i * 7);
    return session(
      `${idPrefix}${i + 1}`,
      d.toISOString(),
      [exercise(templateId, sessionSets.map((over, j) => set({ setNumber: j + 1, ...over })))],
    );
  });

const rowFor = (
  templateId: string,
  sessions: WorkoutSession[],
  byId: ReadonlyMap<string, ExerciseTemplate>,
): ExerciseTrendRow => {
  const row = buildExerciseTrendRows(sessions, byId).find((r) => r.templateId === templateId);
  if (!row) throw new Error(`no trend row for ${templateId}`);
  return row;
};

const dayAfter = (sessions: WorkoutSession[]): number =>
  new Date(sessions[sessions.length - 1].date).getTime() + 86400000;

const byId = catalog(template('bench', 'chest'));

/**
 * A stalled bench: e1RMs 112.5 · 106.9 ×5 — the best is 5 sessions old and
 * the trend windows compare flat (106.9 vs 108.8 → −1.7%).
 */
const stalledSessions = (rirs: number[] = [2, 2, 2, 2, 2, 2]): WorkoutSession[] =>
  weeklySessions(
    'bench',
    [100, 95, 95, 95, 95, 95].map((weightKg, i) => [{ weightKg, reps: 5, rir: rirs[i] }]),
    new Date(2026, 7, 3, 10, 0), // Mon 3 Aug 2026 → last session Mon 7 Sep
  );

// ─── Stagnation ───

describe('detectStagnationFlag', () => {
  it('flags an e1RM best that is several sessions old with a flat trend', () => {
    const sessions = stalledSessions();
    const flag = detectStagnationFlag(rowFor('bench', sessions, byId), sessions, dayAfter(sessions));

    expect(flag).toMatchObject({
      kind: 'stagnation',
      severity: 2,
      templateId: 'bench',
      title: 'Stalled — Name of bench',
      detail: 'Best e1RM 112.5 kg was 5 sessions ago',
    });
    // 4-5 sessions since best → the microload tier, with the given increment
    const custom = detectStagnationFlag(
      rowFor('bench', sessions, byId),
      sessions,
      dayAfter(sessions),
      2.5,
    );
    expect(custom?.advice).toContain('+2.5 kg microload');
  });

  it('does NOT flag while the trend is recovering (double progression is not a stall)', () => {
    // Best (110×5 → 123.8) long ago, but the last 3 sessions climb past the
    // previous window: 112.5·115.9·119.3 vs 112.5×3 → +3% → trend up
    const sessions = weeklySessions(
      'bench',
      [110, 100, 100, 100, 100, 103, 106].map((weightKg) => [{ weightKg, reps: 5 }]),
      new Date(2026, 6, 27, 10, 0), // Mon 27 Jul → last session Mon 7 Sep
    );
    expect(
      detectStagnationFlag(rowFor('bench', sessions, byId), sessions, dayAfter(sessions)),
    ).toBeNull();
  });

  it('does NOT flag an exercise not trained in the last 21 days (paused, not stagnant)', () => {
    const sessions = stalledSessions();
    const nowMs = dayAfter(sessions) + 29 * 86400000;
    expect(detectStagnationFlag(rowFor('bench', sessions, byId), sessions, nowMs)).toBeNull();
  });

  it('needs at least 5 sessions of data', () => {
    const sessions = stalledSessions().slice(0, 4);
    expect(
      detectStagnationFlag(rowFor('bench', sessions, byId), sessions, dayAfter(sessions)),
    ).toBeNull();
  });

  it('leads with intensity when the last session averaged RIR ≥ 2.5', () => {
    const sessions = stalledSessions([2, 2, 2, 2, 2, 3]);
    const flag = detectStagnationFlag(rowFor('bench', sessions, byId), sessions, dayAfter(sessions));
    expect(flag?.advice).toContain('Intensity looks low (avg RIR 3)');
  });

  it('escalates to retrying the best set fresh, then to a deload', () => {
    // Best in session 1, then 6 flat sessions → 6 since best
    const midTerm = weeklySessions(
      'bench',
      [100, 95, 95, 95, 95, 95, 95].map((weightKg) => [{ weightKg, reps: 5 }]),
      new Date(2026, 6, 20, 10, 0),
    );
    const midFlag = detectStagnationFlag(rowFor('bench', midTerm, byId), midTerm, dayAfter(midTerm));
    expect(midFlag?.advice).toContain('attempt 100 kg × 5 again fresh');

    // 9 since best → the long-stall tier
    const longTerm = weeklySessions(
      'bench',
      [100, 95, 95, 95, 95, 95, 95, 95, 95, 95].map((weightKg) => [{ weightKg, reps: 5 }]),
      new Date(2026, 5, 29, 10, 0),
    );
    const longFlag = detectStagnationFlag(
      rowFor('bench', longTerm, byId),
      longTerm,
      dayAfter(longTerm),
    );
    expect(longFlag?.advice).toContain('lighter week');
  });
});

// ─── RIR rising ───

describe('detectRirRisingFlag', () => {
  it('flags a rising RIR while the metric goes nowhere', () => {
    const sessions = weeklySessions(
      'bench',
      [1, 1, 1, 2.5, 2.5, 2.5].map((rir) => [{ weightKg: 100, reps: 5, rir }]),
      new Date(2026, 7, 3, 10, 0),
    );

    const flag = detectRirRisingFlag(rowFor('bench', sessions, byId), sessions);
    expect(flag).toMatchObject({
      kind: 'rir-rising',
      severity: 1,
      detail: 'Avg RIR 1 → 2.5 while the load stays put',
    });
  });

  it('stays silent while the metric is improving — rising RIR with progress is a win', () => {
    const sessions = weeklySessions(
      'bench',
      [100, 100, 100, 104, 108, 112].map((weightKg, i) => [
        { weightKg, reps: 5, rir: i < 3 ? 1 : 2.5 },
      ]),
      new Date(2026, 7, 3, 10, 0),
    );
    expect(detectRirRisingFlag(rowFor('bench', sessions, byId), sessions)).toBeNull();
  });
});

// ─── Volume drops ───

describe('detectVolumeDropFlags', () => {
  const volumeById = catalog(
    template('bench', 'chest'),
    template('row', 'back'),
    template('ohp', 'shoulders'),
    template('squat', 'quads'),
    template('curl', 'biceps'),
  );
  // Wed 16 Sep 2026 → current week starts Mon 14 Sep; last completed week Mon 7 Sep
  const nowMs = new Date(2026, 8, 16, 10, 0).getTime();
  const chestWeek = (id: string, date: string, sets: number): WorkoutSession =>
    session(id, date, [
      exercise('bench', Array.from({ length: sets }, (_, j) => set({ setNumber: j + 1 }))),
    ]);

  it('flags a group whose last completed week fell below half its baseline', () => {
    const sessions = [
      chestWeek('w1', '2026-08-17T10:00:00', 8),
      chestWeek('w2', '2026-08-24T10:00:00', 8),
      chestWeek('w3', '2026-08-31T10:00:00', 8),
      chestWeek('w4', '2026-09-07T10:00:00', 2),
    ];

    const flags = detectVolumeDropFlags(sessions, volumeById, nowMs);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      kind: 'volume-drop',
      group: 'chest',
      title: 'Chest volume dropped',
      detail: '2 sets last week vs ~8/week before',
    });
  });

  it('never judges the current partial week', () => {
    const sessions = [
      chestWeek('w1', '2026-08-17T10:00:00', 8),
      chestWeek('w2', '2026-08-24T10:00:00', 8),
      chestWeek('w3', '2026-08-31T10:00:00', 8),
      chestWeek('w4', '2026-09-07T10:00:00', 8),
      // Current week barely started — must not read as a drop
      chestWeek('w5', '2026-09-14T10:00:00', 1),
    ];
    expect(detectVolumeDropFlags(sessions, volumeById, nowMs)).toEqual([]);
  });

  it('zero-fills a skipped week — a gap is a real drop, not missing data', () => {
    const sessions = [
      chestWeek('w1', '2026-08-17T10:00:00', 8),
      chestWeek('w2', '2026-08-24T10:00:00', 8),
      chestWeek('w3', '2026-08-31T10:00:00', 8),
      // Nothing at all the week of 7 Sep
    ];

    const flags = detectVolumeDropFlags(sessions, volumeById, nowMs);
    expect(flags).toHaveLength(1);
    expect(flags[0].detail).toContain('0 sets last week');
  });

  it('stays silent with fewer than 4 completed weeks of history', () => {
    const sessions = [
      chestWeek('w2', '2026-08-24T10:00:00', 8),
      chestWeek('w3', '2026-08-31T10:00:00', 8),
      chestWeek('w4', '2026-09-07T10:00:00', 2),
    ];
    expect(detectVolumeDropFlags(sessions, volumeById, nowMs)).toEqual([]);
  });

  it('collapses 5+ simultaneous drops into one aggregate card (deload week)', () => {
    const allGroupsWeek = (id: string, date: string): WorkoutSession =>
      session(
        id,
        date,
        ['bench', 'row', 'ohp', 'squat', 'curl'].map((tid) =>
          exercise(tid, Array.from({ length: 4 }, (_, j) => set({ setNumber: j + 1 }))),
        ),
      );
    const sessions = [
      allGroupsWeek('w1', '2026-08-17T10:00:00'),
      allGroupsWeek('w2', '2026-08-24T10:00:00'),
      allGroupsWeek('w3', '2026-08-31T10:00:00'),
      // Week of 7 Sep skipped entirely
    ];

    const flags = detectVolumeDropFlags(sessions, volumeById, nowMs);
    expect(flags).toHaveLength(1);
    expect(flags[0].title).toBe('Training volume dropped across the board');
    expect(flags[0].detail).toContain('5 muscle groups');
  });
});

// ─── The feed ───

describe('buildInsights', () => {
  it('orders PRs first and suppresses the RIR flag of a stalled exercise', () => {
    const stalledById = catalog(template('bench', 'chest'), template('row', 'back'));
    // bench: stalled AND with rising RIR — only the stall may surface
    const bench = stalledSessions([1, 1, 1, 2.5, 2.5, 2.5]);
    // row: a fresh weight PR two days before nowMs
    const row = weeklySessions(
      'row',
      [[{ weightKg: 80, reps: 6 }], [{ weightKg: 85, reps: 6 }]],
      new Date(2026, 8, 1, 10, 0),
      'r',
    );
    const nowMs = dayAfter(row) + 86400000;

    const feed = buildInsights([...bench, ...row], stalledById, nowMs);
    expect(feed.map((i) => i.kind)).toEqual(['pr', 'stagnation']);
    expect(feed[0].title).toBe('Weight PR — Name of row');
    expect(feed[1].templateId).toBe('bench');
  });

  it('caps the PR cards at 3', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const manyById = catalog(...ids.map((id) => template(id, 'chest')));
    const sessions = ids.flatMap((id, i) =>
      weeklySessions(
        id,
        [[{ weightKg: 100, reps: 5 }], [{ weightKg: 105, reps: 5 }]],
        new Date(2026, 8, 1 + i, 10, 0),
        id,
      ),
    );
    const nowMs = new Date(2026, 8, 12, 10, 0).getTime();

    const feed = buildInsights(sessions, manyById, nowMs);
    expect(feed.filter((i) => i.kind === 'pr')).toHaveLength(3);
  });
});

describe('prInsights / formatShortDate', () => {
  it('writes the PR card data line with the short date', () => {
    const prById = catalog(template('bench', 'chest'));
    const sessions = weeklySessions(
      'bench',
      [[{ weightKg: 100, reps: 5 }], [{ weightKg: 105, reps: 6 }]],
      new Date(2026, 8, 1, 10, 0), // second session: Tue 8 Sep
    );

    const cards = prInsights(sessions, prById, dayAfter(sessions));
    expect(cards).toHaveLength(1);
    expect(cards[0].detail).toBe('105 kg × 6, was 100 kg · Tue 8 Sep');
  });

  it('formats dates from fixed English arrays', () => {
    expect(formatShortDate('2026-09-16T10:00:00')).toBe('Wed 16 Sep');
  });
});
