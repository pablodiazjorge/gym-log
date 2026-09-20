import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toPng } from 'html-to-image';
import {
  Insight,
  InsightKind,
  buildInsights,
  formatDayMonth,
} from '../../core/services/analysis-insights.util';
import {
  BalanceRow,
  ExerciseTrendRow,
  MUSCLE_GROUP_LABELS,
  TREND_MIN_POINTS,
  addWeeksToMonday,
  balanceRows,
  buildExerciseTrendRows,
  currentMondayLocal,
  mondayOfWeekLocal,
  sessionCountInWeek,
  weeklyMuscleGroupSets,
} from '../../core/services/analysis.util';
import { RoutineService } from '../../core/services/routine.service';
import { StorageService } from '../../core/services/storage.service';
import { Icon } from '../../shared/components/icon';
import { IconName } from '../../shared/components/icon-paths';
import { categoryBadgeClass, themeToken } from '../../shared/theme';
import { BalanceCard } from './balance-card';

/** Insight cards shown before "Show more" */
const INSIGHTS_VISIBLE_CAP = 6;

const INSIGHT_ICONS: Record<InsightKind, IconName> = {
  pr: 'flame',
  stagnation: 'alert-triangle',
  'rir-rising': 'zap',
  'volume-drop': 'arrow-down',
};

/** Complete literals only (Tailwind scanner rule — see shared/theme.ts) */
const INSIGHT_ICON_CLASSES: Record<InsightKind, string> = {
  pr: 'bg-emerald-500/10 text-emerald-400',
  stagnation: 'bg-amber-500/10 text-amber-400',
  'rir-rising': 'bg-amber-500/10 text-amber-400',
  'volume-drop': 'bg-rose-500/10 text-rose-400',
};

/**
 * The coach view: three questions, top to bottom — is my training balanced
 * (weekly hard sets per muscle group), what needs attention (PRs, stalls,
 * drops), and am I progressing (exercises ranked by e1RM trend). All math
 * lives in analysis.util.ts / analysis-insights.util.ts.
 */
@Component({
  selector: 'app-analysis',
  imports: [RouterLink, Icon, BalanceCard],
  templateUrl: './analysis.html',
})
export class Analysis {
  private readonly storage = inject(StorageService);
  /** Catalog lookup — static data, built once */
  private readonly byId = new Map(
    inject(RoutineService)
      .getAllExercises()
      .map((t) => [t.id, t]),
  );

  readonly analysisContainer = viewChild<ElementRef<HTMLDivElement>>('analysisContainer');

  readonly sessions = this.storage.sessions;
  readonly totalSessions = computed(() => this.sessions().filter((s) => s.completed).length);

  // ─── Weekly balance ───

  /** Captured once — the page is short-lived (same convention as the dashboard) */
  private readonly currentMonday = currentMondayLocal();

  readonly weekOffset = signal(0);
  readonly selectedMonday = computed(() =>
    addWeeksToMonday(this.currentMonday, -this.weekOffset()),
  );
  readonly isCurrentWeek = computed(() => this.weekOffset() === 0);

  private readonly earliestMonday = computed(() => {
    const completed = this.sessions().filter((s) => s.completed);
    if (completed.length === 0) return null;
    return completed.map((s) => mondayOfWeekLocal(s.date)).sort()[0];
  });

  readonly canGoBack = computed(() => {
    const earliest = this.earliestMonday();
    return earliest != null && this.selectedMonday() > earliest;
  });

  readonly weekLabel = computed(() =>
    this.isCurrentWeek()
      ? 'This week'
      : `Week of ${formatDayMonth(`${this.selectedMonday()}T12:00:00`)}`,
  );

  readonly sessionsLabel = computed(() => {
    const n = sessionCountInWeek(this.sessions(), this.selectedMonday());
    const base = n === 1 ? '1 session' : `${n} sessions`;
    return this.isCurrentWeek() ? `${base} · in progress` : base;
  });

  readonly balance = computed<BalanceRow[]>(() =>
    balanceRows(weeklyMuscleGroupSets(this.sessions(), this.byId, this.selectedMonday())),
  );

  prevWeek(): void {
    if (this.canGoBack()) this.weekOffset.update((o) => o + 1);
  }

  nextWeek(): void {
    this.weekOffset.update((o) => Math.max(0, o - 1));
  }

  // ─── Needs attention ───

  readonly insights = computed<Insight[]>(() =>
    buildInsights(this.sessions(), this.byId, Date.now()),
  );
  readonly insightsExpanded = signal(false);
  readonly visibleInsights = computed(() =>
    this.insightsExpanded() ? this.insights() : this.insights().slice(0, INSIGHTS_VISIBLE_CAP),
  );
  readonly hiddenInsightCount = computed(() =>
    Math.max(0, this.insights().length - INSIGHTS_VISIBLE_CAP),
  );

  toggleInsights(): void {
    this.insightsExpanded.update((v) => !v);
  }

  // ─── Progress by exercise ───

  private readonly trendRows = computed(() => buildExerciseTrendRows(this.sessions(), this.byId));

  /** Exercises with a computable trend, best movers first */
  readonly rankedRows = computed(() =>
    this.trendRows()
      .filter((r) => r.trend.hasEnoughData)
      .sort((a, b) => (b.trend.pctChange ?? 0) - (a.trend.pctChange ?? 0)),
  );

  /** Not enough sessions for a trend yet — most recently trained first */
  readonly buildingRows = computed(() =>
    this.trendRows()
      .filter((r) => !r.trend.hasEnoughData)
      .sort(
        (a, b) => new Date(b.lastTrainedDate).getTime() - new Date(a.lastTrainedDate).getTime(),
      ),
  );

  readonly trendMinPoints = TREND_MIN_POINTS;

  // ─── Presentation helpers ───

  insightIcon(insight: Insight): IconName {
    return INSIGHT_ICONS[insight.kind];
  }

  insightIconClass(insight: Insight): string {
    return INSIGHT_ICON_CLASSES[insight.kind];
  }

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

  valueLabel(row: ExerciseTrendRow): string {
    return row.metric === 'e1rm' ? `e1RM ${row.lastValue} kg` : `best ${row.bestValue} reps`;
  }

  badgeClass(row: ExerciseTrendRow): string {
    return categoryBadgeClass(row.category ?? '');
  }

  groupLabel(row: ExerciseTrendRow): string {
    return MUSCLE_GROUP_LABELS[row.group];
  }

  // ─── Export ───

  async exportReport(): Promise<void> {
    const element = this.analysisContainer()?.nativeElement;
    if (!element) return;

    try {
      const dataUrl = await toPng(element, {
        backgroundColor: themeToken('--color-surface-0'),
        pixelRatio: 2,
        cacheBust: true,
      });

      const link = document.createElement('a');
      link.download = `gym_report_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export the report.');
    }
  }
}
