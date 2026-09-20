import { Injectable } from '@angular/core';
import { WorkoutSession, WorkoutExercise, WorkoutSet } from '../models/workout.model';
import { BodyMeasurement } from '../models/measurement.model';
import { BodyWeightPoint, mergeWeightSeries } from './measurement.service';

// ─── Analytics interfaces ───

export interface WeightPoint {
  date: string;
  maxWeight: number;
}

export interface VolumePoint {
  date: string;
  volume: number;
}

export interface ExerciseMetrics {
  templateId: string;
  exerciseName: string;
  sessionsCount: number;
  firstDate: string;
  lastDate: string;

  // Weight progression
  maxWeightEver: number;
  maxWeightDate: string;
  currentMaxWeight: number;
  weightProgression: WeightPoint[];

  // Volume
  totalVolumeEver: number;
  avgVolumePerSession: number;
  volumeProgression: VolumePoint[];

  // Reps
  avgRepsPerSet: number;
  maxRepsInSet: number;

  // RIR
  avgRir: number;
  rirTrend: 'rising' | 'falling' | 'stable';

  // Stagnation
  weeksSinceLastPR: number;
  isStagnant: boolean;
  recommendation: string;
}

export interface WeeklyVolumeEntry {
  weekStart: string;
  totalVolume: number;
  dayTypeBreakdown: Record<string, number>;
}

export interface GlobalMetrics {
  totalSessions: number;
  totalExercises: number;
  totalSets: number;
  totalWorkoutsByDayType: {
    push: number;
    pull: number;
    legs: number;
    abs: number;
    additional: number;
    routine: number;
  };

  // Frequency
  avgSessionsPerWeek: number;
  consistencyScore: number;

  // Weekly volume
  weeklyVolume: WeeklyVolumeEntry[];

  // Bodyweight — sessions and body check-ins merged, oldest first
  bodyWeightProgression: BodyWeightPoint[];

  /** Waist readings, oldest first. Only body check-ins carry these. */
  waistProgression: { date: string; waistCm: number }[];

  // Trends
  isProgressing: boolean;
  warningFlags: string[];
}

// ─── Service ───

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  // ─── Private helpers ───

  /**
   * Only completed work sets (no warmups, no skipped). Skipped sets stay
   * `completed: true` by design, so without the `!s.skipped` guard they entered
   * every metric as a real 0 kg × 0 rep set — and fed rirTrend back into the
   * progression engine.
   */
  private getWorkSets(exercise: WorkoutExercise): WorkoutSet[] {
    return exercise.sets.filter((s) => !s.isWarmup && s.completed && !s.skipped);
  }

  /** Volume of one set: weight × reps */
  private getSetVolume(set: WorkoutSet): number {
    return set.weightKg * set.reps;
  }

  /** Monday of the week containing a date */
  private getMondayOfWeek(dateStr: string): string {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  }

  // ─── Chart-ready data ───

  getWeightChartData(
    templateId: string,
    sessions: WorkoutSession[],
  ): { labels: string[]; data: number[] } {
    const sorted = [...sessions]
      .filter((s) => s.completed)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const labels: string[] = [];
    const data: number[] = [];

    for (const session of sorted) {
      const exercise = session.exercises.find((e) => e.templateId === templateId);
      if (!exercise) continue;
      const workSets = this.getWorkSets(exercise);
      if (workSets.length === 0) continue;
      const maxWeight = Math.max(...workSets.map((s) => s.weightKg));
      labels.push(session.date.split('T')[0]);
      data.push(maxWeight);
    }

    return { labels, data };
  }

  getWeeklyVolumeChartData(sessions: WorkoutSession[]): {
    labels: string[];
    data: number[];
  } {
    const weeklyMap = new Map<string, number>();
    const completed = sessions.filter((s) => s.completed);

    for (const session of completed) {
      const monday = this.getMondayOfWeek(session.date);
      let vol = 0;
      for (const ex of session.exercises) {
        vol += this.getWorkSets(ex).reduce((sum, s) => sum + this.getSetVolume(s), 0);
      }
      weeklyMap.set(monday, (weeklyMap.get(monday) ?? 0) + vol);
    }

    const sorted = [...weeklyMap.entries()].sort(([a], [b]) => a.localeCompare(b));

    return {
      labels: sorted.map(([monday]) => monday),
      data: sorted.map(([, vol]) => vol),
    };
  }

  // ─── Per-exercise metrics ───

  getExerciseMetrics(
    templateId: string,
    sessions: WorkoutSession[],
  ): ExerciseMetrics {
    const completedSessions = sessions
      .filter((s) => s.completed)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const relevantSessions = completedSessions.filter((s) =>
      s.exercises.some((e) => e.templateId === templateId),
    );

    const exerciseName =
      relevantSessions[0]?.exercises.find((e) => e.templateId === templateId)
        ?.exerciseName ?? 'Unknown';

    if (relevantSessions.length === 0) {
      return {
        templateId,
        exerciseName,
        sessionsCount: 0,
        firstDate: '',
        lastDate: '',
        maxWeightEver: 0,
        maxWeightDate: '',
        currentMaxWeight: 0,
        weightProgression: [],
        totalVolumeEver: 0,
        avgVolumePerSession: 0,
        volumeProgression: [],
        avgRepsPerSet: 0,
        maxRepsInSet: 0,
        avgRir: 0,
        rirTrend: 'stable',
        weeksSinceLastPR: 0,
        isStagnant: false,
        recommendation: 'Not enough data',
      };
    }

    // All-time max weight
    let maxWeightEver = 0;
    let maxWeightDate = '';
    const weightProgression: WeightPoint[] = [];

    for (const session of relevantSessions) {
      const exercise = session.exercises.find((e) => e.templateId === templateId)!;
      const workSets = this.getWorkSets(exercise);
      if (workSets.length === 0) continue;
      const sessionMaxWeight = Math.max(...workSets.map((s) => s.weightKg));
      weightProgression.push({ date: session.date, maxWeight: sessionMaxWeight });
      if (sessionMaxWeight > maxWeightEver) {
        maxWeightEver = sessionMaxWeight;
        maxWeightDate = session.date;
      }
    }

    const currentMaxWeight =
      weightProgression.length > 0
        ? weightProgression[weightProgression.length - 1].maxWeight
        : 0;

    // Volume
    let totalVolumeEver = 0;
    const volumeProgression: VolumePoint[] = [];

    for (const session of relevantSessions) {
      const exercise = session.exercises.find((e) => e.templateId === templateId)!;
      const workSets = this.getWorkSets(exercise);
      const vol = workSets.reduce((sum, s) => sum + this.getSetVolume(s), 0);
      totalVolumeEver += vol;
      volumeProgression.push({ date: session.date, volume: vol });
    }

    const avgVolumePerSession =
      relevantSessions.length > 0
        ? Math.round(totalVolumeEver / relevantSessions.length)
        : 0;

    // Reps
    let totalReps = 0;
    let totalSets = 0;
    let maxRepsInSet = 0;

    for (const session of relevantSessions) {
      const exercise = session.exercises.find((e) => e.templateId === templateId)!;
      const workSets = this.getWorkSets(exercise);
      for (const set of workSets) {
        totalReps += set.reps;
        totalSets++;
        if (set.reps > maxRepsInSet) maxRepsInSet = set.reps;
      }
    }

    const avgRepsPerSet = totalSets > 0 ? totalReps / totalSets : 0;

    // RIR
    let totalRir = 0;
    let rirCount = 0;
    const rirPerSession: { date: string; avgRir: number }[] = [];

    for (const session of relevantSessions) {
      const exercise = session.exercises.find((e) => e.templateId === templateId)!;
      const workSets = this.getWorkSets(exercise);
      let sessionRir = 0;
      let sessionRirCount = 0;
      for (const set of workSets) {
        sessionRir += set.rir;
        sessionRirCount++;
      }
      if (sessionRirCount > 0) {
        rirPerSession.push({
          date: session.date,
          avgRir: sessionRir / sessionRirCount,
        });
        totalRir += sessionRir;
        rirCount += sessionRirCount;
      }
    }

    const avgRir = rirCount > 0 ? totalRir / rirCount : 0;

    // RIR trend: last 3 sessions vs previous 3
    let rirTrend: 'rising' | 'falling' | 'stable' = 'stable';
    if (rirPerSession.length >= 4) {
      const recent = rirPerSession.slice(-3);
      const previous = rirPerSession.slice(-6, -3);
      const recentAvg = recent.reduce((sum, r) => sum + r.avgRir, 0) / recent.length;
      const previousAvg =
        previous.reduce((sum, r) => sum + r.avgRir, 0) / previous.length;
      const diff = recentAvg - previousAvg;
      if (diff > 0.3) rirTrend = 'rising';
      else if (diff < -0.3) rirTrend = 'falling';
      else rirTrend = 'stable';
    }

    // Stagnation detection
    const stagnation = this.detectStagnation({
      templateId,
      exerciseName,
      sessionsCount: relevantSessions.length,
      firstDate: relevantSessions[0].date,
      lastDate: relevantSessions[relevantSessions.length - 1].date,
      maxWeightEver,
      maxWeightDate,
      currentMaxWeight,
      weightProgression,
      totalVolumeEver,
      avgVolumePerSession,
      volumeProgression,
      avgRepsPerSet,
      maxRepsInSet,
      avgRir,
      rirTrend,
      weeksSinceLastPR: 0,
      isStagnant: false,
      recommendation: '',
    });

    return {
      templateId,
      exerciseName,
      sessionsCount: relevantSessions.length,
      firstDate: relevantSessions[0].date,
      lastDate: relevantSessions[relevantSessions.length - 1].date,
      maxWeightEver,
      maxWeightDate,
      currentMaxWeight,
      weightProgression,
      totalVolumeEver,
      avgVolumePerSession,
      volumeProgression,
      avgRepsPerSet,
      maxRepsInSet,
      avgRir,
      rirTrend,
      weeksSinceLastPR: stagnation.weeks,
      isStagnant: stagnation.isStagnant,
      recommendation: stagnation.suggestion,
    };
  }

  // ─── Metrics for every exercise ───

  getAllExercisesMetrics(sessions: WorkoutSession[]): ExerciseMetrics[] {
    const completed = sessions.filter((s) => s.completed);
    const templateIds = new Set<string>();
    const exerciseNames = new Map<string, string>();

    for (const session of completed) {
      for (const ex of session.exercises) {
        if (!templateIds.has(ex.templateId)) {
          templateIds.add(ex.templateId);
          exerciseNames.set(ex.templateId, ex.exerciseName);
        }
      }
    }

    return [...templateIds].map((id) => this.getExerciseMetrics(id, sessions));
  }

  // ─── Stagnation detection ───

  detectStagnation(metrics: ExerciseMetrics): {
    isStagnant: boolean;
    weeks: number;
    suggestion: string;
  } {
    const progression = metrics.weightProgression;
    if (progression.length < 2) {
      return { isStagnant: false, weeks: 0, suggestion: 'Not enough data' };
    }

    // Weeks since last PR. maxWeightDate stays empty for bodyweight exercises
    // (their max never beats the initial 0), and `new Date('')` → NaN, which
    // Math.max propagates all the way to a literal "NaN" on screen.
    const lastPRDate = new Date(metrics.maxWeightDate);
    if (!metrics.maxWeightDate || Number.isNaN(lastPRDate.getTime())) {
      return { isStagnant: false, weeks: 0, suggestion: 'No weight PR to track — progress by reps' };
    }
    const today = new Date();
    const weeksSinceLastPR = Math.max(
      0,
      Math.floor((today.getTime() - lastPRDate.getTime()) / (7 * 86400000)),
    );

    // Max weight flat over the last 3 sessions?
    const lastThree = progression.slice(-3);
    let isStagnant = false;
    if (lastThree.length >= 3) {
      const weights = lastThree.map((p) => p.maxWeight);
      const allSame = weights.every((w) => w === weights[0]);
      const notIncreasing = weights.every(
        (w, i) => i === 0 || w <= weights[i - 1],
      );
      isStagnant = allSame || (notIncreasing && weeksSinceLastPR >= 3);
    }

    // Suggestion based on weeks stagnant
    let suggestion: string;
    if (!isStagnant) {
      suggestion = 'Still progressing, keep it up';
    } else if (weeksSinceLastPR < 3) {
      suggestion = 'Hold steady — could just be adaptation';
    } else if (weeksSinceLastPR <= 4) {
      suggestion = 'Try +1 rep or +1 kg next time';
    } else if (weeksSinceLastPR <= 6) {
      suggestion = 'Review technique, rest or nutrition';
    } else {
      suggestion = 'Consider swapping the exercise or a deload';
    }

    return { isStagnant, weeks: weeksSinceLastPR, suggestion };
  }

  // ─── Global metrics ───

  getGlobalMetrics(
    sessions: WorkoutSession[],
    measurements: BodyMeasurement[] = [],
  ): GlobalMetrics {
    const completed = sessions
      .filter((s) => s.completed)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalSessions = completed.length;

    // Count per dayType
    const totalWorkoutsByDayType = { push: 0, pull: 0, legs: 0, abs: 0, additional: 0, routine: 0 };
    const uniqueExercises = new Set<string>();
    let totalSets = 0;

    for (const session of completed) {
      totalWorkoutsByDayType[session.dayType]++;
      for (const ex of session.exercises) {
        uniqueExercises.add(ex.templateId);
        totalSets += this.getWorkSets(ex).length;
      }
    }

    const totalExercises = uniqueExercises.size;

    // Average sessions per week
    let avgSessionsPerWeek = 0;
    if (completed.length >= 2) {
      const firstDate = new Date(completed[0].date);
      const lastDate = new Date(completed[completed.length - 1].date);
      const totalWeeks = Math.max(
        1,
        (lastDate.getTime() - firstDate.getTime()) / (7 * 86400000),
      );
      avgSessionsPerWeek = Math.round((totalSessions / totalWeeks) * 10) / 10;
    }

    // Consistency: based on days between sessions of the same type
    let consistencyScore = 100;
    if (completed.length >= 4) {
      const typeGaps: number[] = [];
      for (const type of ['push', 'pull', 'legs', 'abs'] as const) {
        const typeSessions = completed.filter((s) => s.dayType === type);
        for (let i = 1; i < typeSessions.length; i++) {
          const gap =
            (new Date(typeSessions[i].date).getTime() -
              new Date(typeSessions[i - 1].date).getTime()) /
            86400000;
          typeGaps.push(gap);
        }
      }
      if (typeGaps.length > 0) {
        const avgGap = typeGaps.reduce((a, b) => a + b, 0) / typeGaps.length;
        const deviation = Math.abs(avgGap - 7); // ideal is every 7 days
        consistencyScore = Math.max(0, Math.min(100, 100 - deviation * 10));
      }
    }

    // Weekly volume
    const weeklyMap = new Map<
      string,
      { total: number; breakdown: Record<string, number> }
    >();
    for (const session of completed) {
      const monday = this.getMondayOfWeek(session.date);
      if (!weeklyMap.has(monday)) {
        weeklyMap.set(monday, {
          total: 0,
          breakdown: { push: 0, pull: 0, legs: 0, abs: 0 },
        });
      }
      const entry = weeklyMap.get(monday)!;
      for (const ex of session.exercises) {
        const vol = this.getWorkSets(ex).reduce(
          (sum, s) => sum + this.getSetVolume(s),
          0,
        );
        entry.total += vol;
        entry.breakdown[session.dayType] =
          (entry.breakdown[session.dayType] ?? 0) + vol;
      }
    }

    const weeklyVolume: WeeklyVolumeEntry[] = [...weeklyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, entry]) => ({
        weekStart,
        totalVolume: entry.total,
        dayTypeBreakdown: entry.breakdown,
      }));

    // Bodyweight — sessions and check-ins share one series (see mergeWeightSeries)
    const bodyWeightProgression = mergeWeightSeries(completed, measurements);

    const waistProgression = measurements
      .filter((m) => m.waistCm != null)
      .map((m) => ({ date: m.date, waistCm: m.waistCm! }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Overall trend: compare last 2 full weeks
    let isProgressing = true; // default: assume progress with little data
    if (weeklyVolume.length >= 2) {
      const last = weeklyVolume[weeklyVolume.length - 1].totalVolume;
      const prev = weeklyVolume[weeklyVolume.length - 2].totalVolume;
      isProgressing = last > prev;
    }

    // Warning flags
    const warningFlags: string[] = [];
    const allMetrics = this.getAllExercisesMetrics(sessions);

    for (const m of allMetrics) {
      if (m.isStagnant && m.weeksSinceLastPR >= 4) {
        warningFlags.push(
          `Stagnation on ${m.exerciseName} (${m.weeksSinceLastPR} weeks without a PR)`,
        );
      }
      if (m.rirTrend === 'rising' && m.weeksSinceLastPR >= 3) {
        warningFlags.push(
          `${m.exerciseName}: RIR rising without progression — intensity may be too low`,
        );
      }
    }

    // Check whether any dayType's volume dropped significantly
    if (weeklyVolume.length >= 4) {
      const recent4 = weeklyVolume.slice(-4);
      const prev4 = weeklyVolume.slice(-8, -4);
      if (prev4.length >= 2) {
        for (const type of ['push', 'pull', 'legs', 'abs'] as const) {
          const recentAvg =
            recent4.reduce(
              (s, w) => s + (w.dayTypeBreakdown[type] ?? 0),
              0,
            ) / recent4.length;
          const prevAvg =
            prev4.reduce((s, w) => s + (w.dayTypeBreakdown[type] ?? 0), 0) /
            prev4.length;
          if (prevAvg > 0 && recentAvg < prevAvg * 0.8) {
            const pct = Math.round((1 - recentAvg / prevAvg) * 100);
            warningFlags.push(`${capitalize(type)} volume dropped ${pct}%`);
          }
        }
      }
    }

    return {
      totalSessions,
      totalExercises,
      totalSets,
      totalWorkoutsByDayType,
      avgSessionsPerWeek,
      consistencyScore: Math.round(consistencyScore),
      weeklyVolume,
      bodyWeightProgression,
      waistProgression,
      isProgressing,
      warningFlags,
    };
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
