import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import {
  Insight,
  buildInsights,
  formatDayMonth,
  formatShortDate,
} from '../../core/services/analysis-insights.util';
import {
  ExerciseTrendRow,
  MUSCLE_GROUP_LABELS,
  TREND_MIN_POINTS,
  bestRepsSeriesForExercise,
  buildExerciseTrendRows,
  completedSessionsAsc,
  e1rmSeriesForExercise,
  lastSessionAvgRir,
  workSets,
} from '../../core/services/analysis.util';
import { RoutineService } from '../../core/services/routine.service';
import { StorageService } from '../../core/services/storage.service';
import { Icon } from '../../shared/components/icon';
import { IconName } from '../../shared/components/icon-paths';
import { categoryBadgeClass, themeToken } from '../../shared/theme';

// The app's only Chart.js consumer — registered here so the /analysis chunk
// stays chart-free.
Chart.register(...registerables);

interface StatTile {
  label: string;
  value: string;
  sub?: string;
}

interface RecentSessionRow {
  sessionId: string;
  date: string;
  summary: string;
  value: string;
}

interface ChartSeries {
  labels: string[];
  data: number[];
  tooltips: string[];
  yPadding: number;
}

/**
 * Per-exercise progress: e1RM chart (best reps for bodyweight exercises),
 * PR-relevant stat tiles, this exercise's advice card and its recent
 * sessions. Deep-linkable at /analysis/exercise/:templateId.
 */
@Component({
  selector: 'app-exercise-detail',
  imports: [RouterLink, Icon],
  templateUrl: './exercise-detail.html',
  styleUrl: './exercise-detail.css',
})
export class ExerciseDetail {
  private readonly storage = inject(StorageService);
  private readonly byId = new Map(
    inject(RoutineService)
      .getAllExercises()
      .map((t) => [t.id, t]),
  );

  readonly templateId: string = inject(ActivatedRoute).snapshot.params['templateId'];

  readonly sessions = this.storage.sessions;

  readonly row = computed<ExerciseTrendRow | undefined>(() =>
    buildExerciseTrendRows(this.sessions(), this.byId).find(
      (r) => r.templateId === this.templateId,
    ),
  );

  private readonly e1rmPoints = computed(() =>
    e1rmSeriesForExercise(this.templateId, this.sessions()),
  );
  private readonly repsPoints = computed(() =>
    bestRepsSeriesForExercise(this.templateId, this.sessions()),
  );

  readonly trendMinPoints = TREND_MIN_POINTS;

  readonly headerCaption = computed(() => {
    const row = this.row();
    if (!row) return '';
    const first = row.metric === 'e1rm' ? this.e1rmPoints()[0] : this.repsPoints()[0];
    const count = row.sessionsCount === 1 ? '1 session' : `${row.sessionsCount} sessions`;
    return first ? `${count} · since ${formatDayMonth(first.date)}` : count;
  });

  readonly chartTitle = computed(() =>
    this.row()?.metric === 'reps' ? 'Best reps per session' : 'Estimated 1RM',
  );

  // ─── Stat tiles ───

  readonly tiles = computed<StatTile[]>(() => {
    const row = this.row();
    if (!row) return [];
    const avgRir = lastSessionAvgRir(this.templateId, this.sessions());
    const rirTile: StatTile = {
      label: 'Avg RIR last session',
      value: avgRir != null ? `${avgRir}` : '—',
    };

    if (row.metric === 'e1rm') {
      const points = this.e1rmPoints();
      const best = points.reduce((a, b) => (b.e1rm >= a.e1rm ? b : a));
      const last = points[points.length - 1];
      return [
        { label: 'Best e1RM', value: `${best.e1rm} kg`, sub: formatShortDate(best.date) },
        { label: 'Best weight', value: this.heaviestSetLabel() },
        { label: 'Last top set', value: `${last.topWeightKg} kg × ${last.topReps}` },
        rirTile,
      ];
    }

    const points = this.repsPoints();
    const best = points.reduce((a, b) => (b.reps >= a.reps ? b : a));
    const last = points[points.length - 1];
    return [
      { label: 'Best reps', value: `${best.reps}`, sub: formatShortDate(best.date) },
      { label: 'Last best', value: `${last.reps} reps` },
      { label: 'Sessions', value: `${row.sessionsCount}` },
      rirTile,
    ];
  });

  /** Heaviest work set ever, with the most reps done at that weight */
  private heaviestSetLabel(): string {
    let weight = 0;
    let reps = 0;
    for (const session of completedSessionsAsc(this.sessions())) {
      const exercise = session.exercises.find((e) => e.templateId === this.templateId);
      if (!exercise) continue;
      for (const s of workSets(exercise)) {
        if (s.weightKg > weight || (s.weightKg === weight && s.reps > reps)) {
          weight = s.weightKg;
          reps = s.reps;
        }
      }
    }
    return weight > 0 ? `${weight} kg × ${reps}` : '—';
  }

  // ─── Advice card ───

  readonly insight = computed<Insight | undefined>(() =>
    buildInsights(this.sessions(), this.byId, Date.now()).find(
      (i) => i.templateId === this.templateId && i.kind !== 'pr',
    ),
  );

  adviceBorderClass(insight: Insight): string {
    // Complete literals only (Tailwind scanner rule — see shared/theme.ts)
    switch (insight.kind) {
      case 'stagnation':
      case 'rir-rising':
        return 'border-amber-500';
      default:
        return 'border-rose-500';
    }
  }

  // ─── Recent sessions ───

  readonly recentSessions = computed<RecentSessionRow[]>(() => {
    const row = this.row();
    if (!row) return [];
    const valueBySession = new Map<string, string>(
      row.metric === 'e1rm'
        ? this.e1rmPoints().map((p) => [p.sessionId, `${p.e1rm} kg`])
        : this.repsPoints().map((p) => [p.sessionId, `${p.reps} reps`]),
    );

    const ordered = completedSessionsAsc(this.sessions());
    const rows: RecentSessionRow[] = [];
    for (let i = ordered.length - 1; i >= 0 && rows.length < 5; i--) {
      const session = ordered[i];
      const exercise = session.exercises.find((e) => e.templateId === this.templateId);
      if (!exercise) continue;
      const sets = workSets(exercise);
      if (sets.length === 0) continue;
      rows.push({
        sessionId: session.id,
        date: formatShortDate(session.date),
        summary: sets
          .map((s) => (s.weightKg > 0 ? `${s.weightKg}×${s.reps}` : `${s.reps}`))
          .join(' · '),
        value: valueBySession.get(session.id) ?? '',
      });
    }
    return rows;
  });

  // ─── Chart (viewChild signal + effect: creates when the canvas renders,
  //     updates in place when sessions change, no rAF and no DOM lookups) ───

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('progressChart');
  private chart: Chart | null = null;

  private readonly chartSeries = computed<ChartSeries>(() => {
    const row = this.row();
    if (!row) return { labels: [], data: [], tooltips: [], yPadding: 0 };
    if (row.metric === 'e1rm') {
      const points = this.e1rmPoints();
      return {
        labels: points.map((p) => p.date.split('T')[0]),
        data: points.map((p) => p.e1rm),
        tooltips: points.map((p) => `${p.e1rm} kg est. · ${p.topWeightKg} kg × ${p.topReps}`),
        yPadding: 10,
      };
    }
    const points = this.repsPoints();
    return {
      labels: points.map((p) => p.date.split('T')[0]),
      data: points.map((p) => p.reps),
      tooltips: points.map((p) => `${p.reps} reps`),
      yPadding: 2,
    };
  });

  constructor() {
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      const series = this.chartSeries();
      if (!canvas || series.data.length === 0) return;
      untracked(() => {
        if (!this.chart) {
          this.chart = this.createChart(canvas, series);
        } else {
          this.chart.data.labels = series.labels;
          this.chart.data.datasets[0].data = series.data;
          this.chart.options.scales!['y']!.min = this.yMin(series);
          this.chart.update();
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  private yMin(series: ChartSeries): number {
    return Math.max(0, Math.min(...series.data) - series.yPadding);
  }

  private createChart(canvas: HTMLCanvasElement, series: ChartSeries): Chart {
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: series.labels,
        datasets: [
          {
            data: series.data,
            borderColor: themeToken('--color-accent'),
            backgroundColor: themeToken('--color-chart-accent-soft'),
            borderWidth: 2,
            pointBackgroundColor: themeToken('--color-accent'),
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              // Reads the computed, so an in-place update refreshes tooltips too
              label: (ctx) => this.chartSeries().tooltips[ctx.dataIndex] ?? '',
            },
          },
        },
        scales: {
          x: {
            ticks: { color: themeToken('--color-chart-tick'), maxTicksLimit: 8 },
            grid: { color: themeToken('--color-chart-grid') },
          },
          y: {
            ticks: { color: themeToken('--color-chart-tick') },
            grid: { color: themeToken('--color-chart-grid') },
            min: this.yMin(series),
          },
        },
      },
    });
  }

  // ─── Presentation helpers ───

  trendIcon(row: ExerciseTrendRow): IconName {
    switch (row.trend.direction) {
      case 'up':
        return 'arrow-up';
      case 'down':
        return 'arrow-down';
      default:
        return 'minus';
    }
  }

  trendClass(row: ExerciseTrendRow): string {
    switch (row.trend.direction) {
      case 'up':
        return 'text-emerald-400';
      case 'down':
        return 'text-rose-400';
      default:
        return 'text-gray-400';
    }
  }

  trendLabel(row: ExerciseTrendRow): string {
    const pct = row.trend.pctChange ?? 0;
    return `${pct > 0 ? '+' : ''}${pct}%`;
  }

  badgeClass(row: ExerciseTrendRow): string {
    return categoryBadgeClass(row.category ?? '');
  }

  groupLabel(row: ExerciseTrendRow): string {
    return MUSCLE_GROUP_LABELS[row.group];
  }
}
