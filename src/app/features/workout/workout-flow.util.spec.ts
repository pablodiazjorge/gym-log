import { describe, expect, it } from 'vitest';
import {
  MAX_RESUME_ELAPSED_MS,
  allSetsCompleted,
  anyExerciseSelected,
  buildWorkoutSession,
  countOpenSets,
  daysSince,
  emptySelection,
  firstOpenExerciseIndex,
  labelForDay,
  maxWorkWeight,
  openSetsWarning,
  resolveDayTemplates,
  resumedStartTime,
  roundBodyWeight,
  routineToPlan,
  warmupSetCount,
  withSetReplaced,
  workSetCount,
} from './workout-flow.util';
import { ExerciseTemplate, WorkoutExercise, WorkoutSet } from '../../core/models/workout.model';
import { Routine } from '../../core/models/routine.model';
import { ExerciseProgressionSuggestion, SetTarget } from '../../core/models/progression.model';

// Characterization tests: they pin what the Workout component did before this
// logic moved out of it (G7), so the move itself is the only change.

const template = (id: string, over: Partial<ExerciseTemplate> = {}): ExerciseTemplate => ({
  id,
  name: id,
  category: 'push',
  order: 1,
  targetSets: 3,
  targetRepsMin: 8,
  targetRepsMax: 12,
  hasWarmupSets: false,
  ...over,
});

const set = (setNumber: number, over: Partial<WorkoutSet> = {}): WorkoutSet => ({
  setNumber,
  isWarmup: false,
  weightKg: 40,
  reps: 10,
  rir: 2,
  completed: false,
  skipped: false,
  ...over,
});

const exercise = (templateId: string, sets: WorkoutSet[]): WorkoutExercise => ({
  templateId,
  exerciseName: templateId,
  sets,
});

const suggestion = (
  templateId: string,
  setTargets: SetTarget[],
  restSeconds?: number,
): ExerciseProgressionSuggestion => ({
  templateId,
  exerciseName: templateId,
  setTargets,
  restSeconds,
  basis: 'computed',
  rationale: '',
});

const target = (setNumber: number, weightKg: number, isWarmup = false): SetTarget => ({
  setNumber,
  isWarmup,
  weightKg,
  reps: 10,
  rir: 2,
});

describe('labelForDay', () => {
  it('capitalizes a built-in day type', () => {
    expect(labelForDay('push', '')).toBe('Push');
    expect(labelForDay('abs', 'ignored')).toBe('Abs');
  });

  it("shows the routine's name, or a generic label while it is unknown", () => {
    expect(labelForDay('routine', 'Upper A')).toBe('Upper A');
    expect(labelForDay('routine', '')).toBe('Routine');
  });
});

describe('choice-group selection', () => {
  it('starts with one empty pick per group', () => {
    expect(emptySelection([{ groupId: 'push-main' }, { groupId: 'push-fly' }])).toEqual({
      'push-main': '',
      'push-fly': '',
    });
  });

  it('needs at least one pick to start', () => {
    expect(anyExerciseSelected({ 'push-main': '', 'push-fly': '' })).toBe(false);
    expect(anyExerciseSelected({ 'push-main': '', 'push-fly': 'pec-deck' })).toBe(true);
    expect(anyExerciseSelected({})).toBe(false);
  });
});

describe('resolveDayTemplates', () => {
  const catalog = new Map(
    [
      template('fixed-a', { order: 3 }),
      template('fixed-b', { order: 1 }),
      template('choice-x', { order: 2, choiceGroup: 'main' }),
      template('choice-y', { order: 2, choiceGroup: 'main' }),
      template('catalog-extra', { order: 5, choiceGroup: 'main' }),
    ].map((t) => [t.id, t]),
  );
  const lookup = (id: string) => catalog.get(id);
  const day = ['fixed-a', 'fixed-b', 'choice-x', 'choice-y'].map((id) => catalog.get(id)!);

  it('keeps the fixed members, adds the picks and sorts by catalog order', () => {
    const result = resolveDayTemplates(day, { main: 'choice-y' }, lookup);
    expect(result.map((t) => t.id)).toEqual(['fixed-b', 'choice-y', 'fixed-a']);
  });

  it('leaves the unpicked alternatives and empty groups out', () => {
    const result = resolveDayTemplates(day, { main: '', other: '' }, lookup);
    expect(result.map((t) => t.id)).toEqual(['fixed-b', 'fixed-a']);
  });

  it('resolves a pick from the full catalog, even outside the day list', () => {
    const result = resolveDayTemplates(day, { main: 'catalog-extra' }, lookup);
    expect(result.map((t) => t.id)).toEqual(['fixed-b', 'fixed-a', 'catalog-extra']);
  });

  it('drops a pick the catalog no longer knows', () => {
    const result = resolveDayTemplates(day, { main: 'gone' }, lookup);
    expect(result.map((t) => t.id)).toEqual(['fixed-b', 'fixed-a']);
  });
});

describe('routineToPlan', () => {
  const catalog = new Map(
    [
      template('incline-machine-press', {
        order: 1,
        targetSets: 4,
        hasWarmupSets: true,
        warmupSets: 2,
        strengthRepsMin: 4,
        strengthRepsMax: 6,
        targetRirMin: 1,
        targetRirMax: 2,
      }),
      template('pec-deck', { order: 2, targetRirMin: 0, targetRirMax: 1 }),
    ].map((t) => [t.id, t]),
  );
  const lookup = (id: string) => catalog.get(id);

  const routine: Routine = {
    id: 'routine-1',
    name: 'Chest day',
    source: 'custom',
    createdAt: '2026-08-08T00:00:00.000Z',
    updatedAt: '2026-08-08T00:00:00.000Z',
    exercises: [
      {
        templateId: 'pec-deck',
        order: 2,
        targetSets: 2,
        targetRepsMin: 12,
        targetRepsMax: 15,
        hasWarmupSets: false,
        restSeconds: 60,
      },
      {
        templateId: 'removed-from-catalog',
        order: 3,
        targetSets: 3,
        targetRepsMin: 8,
        targetRepsMax: 10,
        hasWarmupSets: false,
      },
      {
        templateId: 'incline-machine-press',
        order: 1,
        targetSets: 3,
        targetRepsMin: 6,
        targetRepsMax: 8,
        hasWarmupSets: true,
        warmupSets: 1,
        targetRirMin: 2,
      },
    ],
  };

  it('follows the routine order and skips exercises missing from the catalog', () => {
    const { templates } = routineToPlan(routine, lookup);
    expect(templates.map((t) => t.id)).toEqual(['incline-machine-press', 'pec-deck']);
  });

  it("lets the routine's sets, reps and warm-ups override the template", () => {
    const [press] = routineToPlan(routine, lookup).templates;
    expect(press).toMatchObject({
      targetSets: 3,
      targetRepsMin: 6,
      targetRepsMax: 8,
      hasWarmupSets: true,
      warmupSets: 1,
    });
  });

  it('strips the catalog strength range so the authored rep range always wins', () => {
    const [press] = routineToPlan(routine, lookup).templates;
    expect(press.strengthRepsMin).toBeUndefined();
    expect(press.strengthRepsMax).toBeUndefined();
  });

  it('falls back to the catalog RIR target per bound when the routine leaves it out', () => {
    const [press, pecDeck] = routineToPlan(routine, lookup).templates;
    expect([press.targetRirMin, press.targetRirMax]).toEqual([2, 2]);
    expect([pecDeck.targetRirMin, pecDeck.targetRirMax]).toEqual([0, 1]);
  });

  it('carries the routine id and the configured rest per exercise', () => {
    const { context } = routineToPlan(routine, lookup);
    expect(context.routineId).toBe('routine-1');
    expect([...context.restByTemplateId]).toEqual([
      ['incline-machine-press', undefined],
      ['pec-deck', 60],
    ]);
  });
});

describe('buildWorkoutSession', () => {
  const now = new Date('2026-10-22T07:30:00.123Z');
  const press = template('incline-machine-press', {
    targetSets: 2,
    hasWarmupSets: true,
    warmupSets: 1,
  });

  it('builds an open session with a dated id and no routine for a day workout', () => {
    const session = buildWorkoutSession([press], new Map(), 'push', undefined, now);
    expect(session).toMatchObject({
      id: 'ws-2026-10-22-push-0123',
      date: '2026-10-22T07:30:00.123Z',
      dayType: 'push',
      routineId: undefined,
      completed: false,
    });
    expect(session.exercises.map((e) => [e.templateId, e.exerciseName])).toEqual([
      ['incline-machine-press', 'incline-machine-press'],
    ]);
  });

  it('pre-fills the sets from the suggestion', () => {
    const suggestions = new Map([
      [press.id, suggestion(press.id, [target(1, 20, true), target(2, 50), target(3, 50)])],
    ]);
    const [ex] = buildWorkoutSession([press], suggestions, 'push', undefined, now).exercises;
    expect(ex.sets.map((s) => [s.isWarmup, s.weightKg])).toEqual([
      [true, 20],
      [false, 50],
      [false, 50],
    ]);
  });

  it('day workout: a longer history extends the template', () => {
    const history = [1, 2, 3, 4, 5].map((n) => target(n, 50));
    const suggestions = new Map([[press.id, suggestion(press.id, history)]]);
    const [ex] = buildWorkoutSession([press], suggestions, 'push', undefined, now).exercises;
    expect(ex.sets).toHaveLength(5);
  });

  it('routine workout: the plan decides how many sets there are', () => {
    const history = [1, 2, 3, 4, 5].map((n) => target(n, 50));
    const suggestions = new Map([[press.id, suggestion(press.id, history)]]);
    const context = { routineId: 'routine-1', restByTemplateId: new Map([[press.id, 90]]) };
    const session = buildWorkoutSession([press], suggestions, 'routine', context, now);
    expect(session.id).toBe('ws-2026-10-22-routine-0123');
    expect(session.routineId).toBe('routine-1');
    expect(session.exercises[0].sets).toHaveLength(3); // 1 warm-up + 2 work
  });

  it("uses the routine's rest time, then the suggestion's", () => {
    const pecDeck = template('pec-deck');
    const suggestions = new Map([
      [press.id, suggestion(press.id, [], 150)],
      [pecDeck.id, suggestion(pecDeck.id, [], 75)],
    ]);
    const context = {
      routineId: 'routine-1',
      restByTemplateId: new Map<string, number | undefined>([
        [press.id, 90],
        [pecDeck.id, undefined],
      ]),
    };
    const fromRoutine = buildWorkoutSession([press, pecDeck], suggestions, 'routine', context, now);
    expect(fromRoutine.exercises.map((e) => e.restSeconds)).toEqual([90, 75]);

    const fromDay = buildWorkoutSession([press, pecDeck], suggestions, 'push', undefined, now);
    expect(fromDay.exercises.map((e) => e.restSeconds)).toEqual([150, 75]);
  });
});

describe('resuming a session', () => {
  const started = '2026-10-22T07:00:00.000Z';
  const startedMs = new Date(started).getTime();

  it('keeps the original start time within the window, bounds included', () => {
    expect(resumedStartTime(started, startedMs)).toBe(startedMs);
    expect(resumedStartTime(started, startedMs + 30 * 60_000)).toBe(startedMs);
    expect(resumedStartTime(started, startedMs + MAX_RESUME_ELAPSED_MS)).toBe(startedMs);
  });

  it('restarts the clock for an old, future or unparseable start', () => {
    expect(resumedStartTime(started, startedMs + MAX_RESUME_ELAPSED_MS + 1)).toBeNull();
    expect(resumedStartTime(started, startedMs - 1)).toBeNull();
    expect(resumedStartTime('not a date', startedMs)).toBeNull();
  });

  it('picks up at the first exercise with an open set', () => {
    const done = exercise('a', [set(1, { completed: true })]);
    const open = exercise('b', [set(1, { completed: true }), set(2)]);
    expect(firstOpenExerciseIndex([done, open, open])).toBe(1);
  });

  it('falls back to the first exercise when nothing is open', () => {
    const done = exercise('a', [set(1, { completed: true })]);
    expect(firstOpenExerciseIndex([done, done])).toBe(0);
    expect(firstOpenExerciseIndex([])).toBe(0);
  });

  it('counts the session as finished only when every set is closed (skipped counts)', () => {
    const skipped = exercise('a', [set(1, { completed: true, skipped: true })]);
    expect(allSetsCompleted([skipped])).toBe(true);
    expect(allSetsCompleted([skipped, exercise('b', [set(1)])])).toBe(false);
    expect(allSetsCompleted([])).toBe(true);
  });
});

describe('withSetReplaced', () => {
  it('replaces the set with the same number in a new exercise object', () => {
    const original = exercise('a', [set(1), set(2)]);
    const updated = withSetReplaced(original, set(2, { completed: true, reps: 8 }));

    expect(updated).not.toBe(original);
    expect(updated.sets.map((s) => [s.setNumber, s.completed, s.reps])).toEqual([
      [1, false, 10],
      [2, true, 8],
    ]);
    expect(original.sets[1].completed).toBe(false);
  });

  it('returns an equal copy when no set has that number', () => {
    const original = exercise('a', [set(1)]);
    const updated = withSetReplaced(original, set(9, { completed: true }));
    expect(updated).not.toBe(original);
    expect(updated).toEqual(original);
  });
});

describe('finishing', () => {
  it('counts the open sets across every exercise', () => {
    const exercises = [
      exercise('a', [set(1, { completed: true }), set(2)]),
      exercise('b', [set(1), set(2, { completed: true, skipped: true }), set(3)]),
    ];
    expect(countOpenSets(exercises)).toBe(3);
    expect(countOpenSets([])).toBe(0);
  });

  it('warns about open sets in singular and plural', () => {
    expect(openSetsWarning(1)).toBe(
      '1 set still open.\n\n' +
        'They will be saved as not completed and left out of your stats.\n\n' +
        'OK — save anyway.  Cancel — go back and finish them.',
    );
    expect(openSetsWarning(3).startsWith('3 sets still open.')).toBe(true);
  });

  it('stores bodyweight with one decimal and drops empty or non-positive values', () => {
    expect(roundBodyWeight(72.34)).toBe(72.3);
    expect(roundBodyWeight(72.35)).toBe(72.4);
    expect(roundBodyWeight(0)).toBeUndefined();
    expect(roundBodyWeight(-1)).toBeUndefined();
    expect(roundBodyWeight(null)).toBeUndefined();
  });

  it('measures days since the last weigh-in, Infinity when there was none', () => {
    const nowMs = new Date('2026-10-22T12:00:00.000Z').getTime();
    expect(daysSince('2026-10-15T12:00:00.000Z', nowMs)).toBe(7);
    expect(daysSince(undefined, nowMs)).toBe(Infinity);
    expect(daysSince(null, nowMs)).toBe(Infinity);
  });
});

describe('summary counts', () => {
  const ex = exercise('a', [
    set(1, { isWarmup: true, weightKg: 20, completed: true }),
    set(2, { weightKg: 50, completed: true }),
    set(3, { weightKg: 55, completed: true, skipped: true }),
    set(4, { weightKg: 60 }),
    set(5, { isWarmup: true, weightKg: 30, completed: true, skipped: true }),
  ]);

  it('max weight: performed work sets only (not warm-ups, skipped or open sets)', () => {
    expect(maxWorkWeight(ex)).toBe(50);
    expect(maxWorkWeight(exercise('b', [set(1, { isWarmup: true, completed: true })]))).toBe(0);
  });

  it('work and warm-up counts leave skipped sets out but keep open ones', () => {
    expect(workSetCount(ex)).toBe(2);
    expect(warmupSetCount(ex)).toBe(1);
  });
});
