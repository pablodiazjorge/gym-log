/**
 * Invented example data for the e2e tests. Shaped like the v2 export format
 * (English template ids, see ADR-0012); it describes nobody.
 */

interface DemoSet {
  setNumber: number;
  isWarmup: boolean;
  weightKg: number;
  reps: number;
  rir: number;
  completed: boolean;
  skipped: boolean;
}

function sets(work: [weightKg: number, reps: number][], warmup?: [number, number]): DemoSet[] {
  const all: DemoSet[] = [];
  if (warmup) {
    all.push({
      setNumber: 1,
      isWarmup: true,
      weightKg: warmup[0],
      reps: warmup[1],
      rir: 4,
      completed: true,
      skipped: false,
    });
  }
  for (const [weightKg, reps] of work) {
    all.push({
      setNumber: all.length + 1,
      isWarmup: false,
      weightKg,
      reps,
      rir: 2,
      completed: true,
      skipped: false,
    });
  }
  return all;
}

/** One finished push session, logged on 6 October 2026 at 18:30 UTC */
export const demoPushSession = {
  id: 'ws-2026-10-06-push-4821',
  date: '2026-10-06T18:30:00.000Z',
  dayType: 'push',
  completed: true,
  durationMinutes: 52,
  exercises: [
    {
      templateId: 'incline-machine-press',
      exerciseName: 'Incline Machine Press',
      restSeconds: 120,
      sets: sets(
        [
          [50, 10],
          [50, 9],
          [45, 10],
        ],
        [30, 12],
      ),
    },
    {
      templateId: 'pec-deck',
      exerciseName: 'Pec Deck / Chest Fly Machine',
      restSeconds: 90,
      sets: sets([
        [35, 12],
        [35, 12],
        [35, 11],
      ]),
    },
  ],
};
