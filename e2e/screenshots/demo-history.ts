/**
 * Eight invented weeks of push / pull / legs for the README screenshots. The
 * numbers are made up and deterministic (no randomness), so every run draws
 * the same pictures; the data describes nobody and carries no body metrics.
 */

/** "Now" for the screenshots: Wednesday 21 October 2026, 17:30 UTC */
export const DEMO_NOW = new Date('2026-10-21T17:30:00.000Z');

const DAY_MS = 86_400_000;
const WEEKS = 8;

interface Lift {
  templateId: string;
  exerciseName: string;
  /** Work-set weight in week 1, and the weekly step after it */
  startKg: number;
  stepKg: number;
  workSets: number;
  reps: number;
  warmup?: boolean;
  restSeconds: number;
}

const DAYS: { dayType: 'push' | 'pull' | 'legs'; weekday: number; lifts: Lift[] }[] = [
  {
    dayType: 'push',
    weekday: 0, // Monday
    lifts: [
      {
        templateId: 'incline-machine-press',
        exerciseName: 'Incline Machine Press',
        startKg: 45,
        stepKg: 1.25,
        workSets: 3,
        reps: 9,
        warmup: true,
        restSeconds: 150,
      },
      {
        templateId: 'pec-deck',
        exerciseName: 'Pec Deck / Chest Fly Machine',
        startKg: 30,
        stepKg: 1.25,
        workSets: 3,
        reps: 12,
        restSeconds: 90,
      },
      {
        templateId: 'incline-bench-lateral-raises',
        exerciseName: 'Incline Bench Lateral Raises',
        startKg: 6,
        stepKg: 0.25,
        workSets: 3,
        reps: 14,
        restSeconds: 75,
      },
      {
        templateId: 'cable-triceps-pushdown',
        exerciseName: 'Cable Triceps Pushdown',
        startKg: 20,
        stepKg: 0.75,
        workSets: 3,
        reps: 12,
        restSeconds: 75,
      },
    ],
  },
  {
    dayType: 'pull',
    weekday: 2, // Wednesday
    lifts: [
      {
        templateId: 'lat-pulldown-wide-grip',
        exerciseName: 'Lat Pulldown (bar & straps, wide pronated grip)',
        startKg: 50,
        stepKg: 1.25,
        workSets: 3,
        reps: 10,
        warmup: true,
        restSeconds: 150,
      },
      {
        templateId: 't-bar-row',
        exerciseName: 'T-Bar Row (neutral shoulder-width grip)',
        startKg: 35,
        stepKg: 1.25,
        workSets: 3,
        reps: 10,
        restSeconds: 120,
      },
      {
        templateId: 'incline-bench-curl',
        exerciseName: 'Incline Bench Biceps Curl',
        startKg: 10,
        stepKg: 0.25,
        workSets: 3,
        reps: 11,
        restSeconds: 75,
      },
      {
        templateId: 'rear-delt-fly',
        exerciseName: 'Rear Delt Fly',
        startKg: 25,
        stepKg: 0.75,
        workSets: 3,
        reps: 14,
        restSeconds: 60,
      },
    ],
  },
  {
    dayType: 'legs',
    weekday: 4, // Friday
    lifts: [
      {
        templateId: 'machine-hack-squat',
        exerciseName: 'Machine Hack Squat',
        startKg: 60,
        stepKg: 2.5,
        workSets: 3,
        reps: 8,
        warmup: true,
        restSeconds: 180,
      },
      {
        templateId: 'seated-leg-curl',
        exerciseName: 'Seated Leg Curl',
        startKg: 35,
        stepKg: 1.25,
        workSets: 3,
        reps: 11,
        restSeconds: 90,
      },
      {
        templateId: 'hip-thrust',
        exerciseName: 'Hip Thrust',
        startKg: 70,
        stepKg: 2.5,
        workSets: 3,
        reps: 10,
        restSeconds: 120,
      },
      {
        templateId: 'standing-calf-raise',
        exerciseName: 'Standing Machine Calf Raise',
        startKg: 50,
        stepKg: 1.25,
        workSets: 2,
        reps: 14,
        restSeconds: 60,
      },
    ],
  },
];

/** Round to the 1.25 kg plates the progression engine assumes */
const plate = (kg: number) => Math.round(kg / 1.25) * 1.25;

function setsFor(lift: Lift, week: number) {
  const weightKg = plate(lift.startKg + lift.stepKg * week);
  const sets = [];
  if (lift.warmup) {
    sets.push({
      setNumber: 1,
      isWarmup: true,
      weightKg: plate(weightKg * 0.6),
      reps: 10,
      rir: 4,
      completed: true,
      skipped: false,
    });
  }
  for (let i = 0; i < lift.workSets; i++) {
    // The last set of each exercise loses a rep, the way real sets do
    const reps = i === lift.workSets - 1 ? lift.reps - 1 : lift.reps;
    sets.push({
      setNumber: sets.length + 1,
      isWarmup: false,
      weightKg,
      reps,
      rir: i === 0 ? 2 : 1,
      completed: true,
      skipped: false,
    });
  }
  return sets;
}

/** 24 finished sessions: Monday push, Wednesday pull, Friday legs, eight weeks back from DEMO_NOW */
export function demoHistory() {
  // Monday of the first week, at 18:00 UTC
  const firstMonday = new Date('2026-08-24T18:00:00.000Z').getTime();
  const sessions = [];
  for (let week = 0; week < WEEKS; week++) {
    for (const day of DAYS) {
      const date = new Date(firstMonday + (week * 7 + day.weekday) * DAY_MS);
      if (date.getTime() > DEMO_NOW.getTime()) continue;
      const stamp = date.toISOString();
      sessions.push({
        id: `ws-${stamp.slice(0, 10)}-${day.dayType}-${String(1000 + week * 10 + day.weekday)}`,
        date: stamp,
        dayType: day.dayType,
        completed: true,
        durationMinutes: 48 + ((week + day.weekday) % 4) * 3,
        exercises: day.lifts.map((lift) => ({
          templateId: lift.templateId,
          exerciseName: lift.exerciseName,
          restSeconds: lift.restSeconds,
          sets: setsFor(lift, week),
        })),
      });
    }
  }
  return sessions;
}
