import { Component, input, output } from '@angular/core';
import { BalanceRow } from '../../core/services/analysis.util';
import { Icon } from '../../shared/components/icon';

/**
 * Weekly hard-set balance per muscle group: a week pager and one bar per
 * group against its advisory band. Purely presentational — CSS bars, no
 * chart library — so it re-renders reactively and exports cleanly to PNG.
 */
@Component({
  selector: 'app-balance-card',
  imports: [Icon],
  templateUrl: './balance-card.html',
})
export class BalanceCard {
  readonly rows = input.required<BalanceRow[]>();
  readonly weekLabel = input.required<string>();
  readonly sessionsLabel = input.required<string>();
  readonly canGoBack = input.required<boolean>();
  readonly isCurrentWeek = input.required<boolean>();

  readonly prevWeek = output<void>();
  readonly nextWeek = output<void>();

  /** Bar scale leaves headroom past the band so 'over' visibly overshoots it */
  private scaleOf(row: BalanceRow): number {
    return Math.max(row.band ? row.band.max * 1.25 : 0, row.count, 1);
  }

  fillPct(row: BalanceRow): number {
    return Math.min(100, (row.count / this.scaleOf(row)) * 100);
  }

  bandLeftPct(row: BalanceRow): number {
    return row.band ? (row.band.min / this.scaleOf(row)) * 100 : 0;
  }

  bandWidthPct(row: BalanceRow): number {
    return row.band ? ((row.band.max - row.band.min) / this.scaleOf(row)) * 100 : 0;
  }

  /** Complete literals only (Tailwind scanner rule — see shared/theme.ts) */
  barClass(row: BalanceRow): string {
    if (row.group === 'unknown') return 'bg-gray-600';
    switch (row.status) {
      case 'in':
        return 'bg-emerald-500';
      case 'under':
      case 'over':
        return 'bg-amber-400';
      default:
        return 'bg-gray-700';
    }
  }

  countLabel(row: BalanceRow): string {
    return row.band ? `${row.count} / ${row.band.min}–${row.band.max}` : `${row.count}`;
  }
}
