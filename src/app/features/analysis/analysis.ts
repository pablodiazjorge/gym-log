import {
  Component,
  inject,
  signal,
  computed,
  effect,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { toPng } from 'html-to-image';
import { AnalyticsService, ExerciseMetrics, GlobalMetrics } from '../../core/services/analytics.service';
import { StorageService } from '../../core/services/storage.service';
import { WorkoutSession } from '../../core/models/workout.model';

// Register all Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-analysis',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './analysis.html',
  styleUrl: './analysis.css',
})
export class Analysis implements AfterViewInit, OnDestroy {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly storage = inject(StorageService);

  readonly analysisContainer = viewChild<ElementRef<HTMLDivElement>>('analysisContainer');

  readonly sessions = this.storage.sessions;
  readonly totalSessions = computed(() =>
    this.sessions().filter((s) => s.completed).length,
  );

  // Available exercises from data
  readonly availableExercises = computed(() => {
    const completed = this.sessions().filter((s) => s.completed);
    const seen = new Map<string, string>();
    for (const session of completed) {
      for (const ex of session.exercises) {
        if (!seen.has(ex.templateId)) {
          seen.set(ex.templateId, ex.exerciseName);
        }
      }
    }
    return [...seen.entries()].map(([templateId, exerciseName]) => ({
      templateId,
      exerciseName,
    }));
  });

  readonly selectedExercise = signal<string>('');

  readonly globalMetrics = computed<GlobalMetrics>(() =>
    this.analyticsService.getGlobalMetrics(this.sessions()),
  );

  readonly metrics = computed<ExerciseMetrics>(() => {
    const id = this.selectedExercise();
    if (!id) {
      return this.emptyMetrics();
    }
    return this.analyticsService.getExerciseMetrics(id, this.sessions());
  });

  readonly warnings = computed(() => this.globalMetrics().warningFlags);

  readonly currentBodyWeight = computed(() => {
    const bw = this.globalMetrics().bodyWeightProgression;
    return bw.length > 0 ? bw[bw.length - 1].weight : '—';
  });

  // Variant comparison for Pull
  readonly pullComparison = computed(() => {
    const gm = this.globalMetrics();
    return {
      pullA: {
        avgVolume: gm.variantComparison.pullA.avgVolume,
        avgWeight: gm.variantComparison.pullA.avgWeight,
      },
      pullB: {
        avgVolume: gm.variantComparison.pullB.avgVolume,
        avgWeight: gm.variantComparison.pullB.avgWeight,
      },
      winner: gm.variantComparison.pullWinner,
    };
  });

  private readonly viewReady = signal(false);
  private weightChart: Chart | null = null;
  private volumeChart: Chart | null = null;

  constructor() {
    // Set default exercise to first available
    effect(() => {
      const exercises = this.availableExercises();
      const current = this.selectedExercise();
      if (exercises.length > 0 && !current) {
        this.selectedExercise.set(exercises[0].templateId);
      }
    });

    // Reactively update weight chart when exercise or sessions change (after view is ready)
    effect(() => {
      const id = this.selectedExercise();
      const sessions = this.sessions();
      const ready = this.viewReady();
      if (id && ready) {
        // Use requestAnimationFrame to ensure DOM is stable
        requestAnimationFrame(() => this.updateWeightChart(id, sessions));
      }
    });
  }

  ngAfterViewInit(): void {
    // Mark view as ready so the effect can start reacting
    this.viewReady.set(true);
    // Create initial charts
    requestAnimationFrame(() => this.createCharts());
  }

  ngOnDestroy(): void {
    this.weightChart?.destroy();
    this.volumeChart?.destroy();
  }

  onExerciseChange(): void {
    // Handled by effect
  }

  private emptyMetrics(): ExerciseMetrics {
    return {
      templateId: '',
      exerciseName: '—',
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
      rirTrend: 'estable',
      weeksSinceLastPR: 0,
      isStagnant: false,
      recommendation: '',
    };
  }

  private createCharts(): void {
    const sessions = this.sessions();
    const id = this.selectedExercise();

    // Weight progression chart
    if (id) {
      this.updateWeightChart(id, sessions);
    }

    // Volume chart
    const volCtx = document.getElementById('volumeChart') as HTMLCanvasElement | null;
    if (volCtx) {
      this.volumeChart?.destroy();
      const volData = this.analyticsService.getWeeklyVolumeChartData(sessions);
      this.volumeChart = new Chart(volCtx, {
        type: 'bar',
        data: {
          labels: volData.labels,
          datasets: [
            {
              label: 'Volumen semanal (kg)',
              data: volData.data,
              backgroundColor: '#10b981',
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: {
              ticks: { color: '#9ca3af', maxTicksLimit: 8 },
              grid: { color: '#1f2937' },
            },
            y: {
              ticks: { color: '#9ca3af' },
              grid: { color: '#1f2937' },
            },
          },
        },
      });
    }
  }

  private updateWeightChart(templateId: string, sessions: WorkoutSession[]): void {
    const ctx = document.getElementById('weightChart') as HTMLCanvasElement | null;
    if (!ctx) return;

    this.weightChart?.destroy();

    const chartData = this.analyticsService.getWeightChartData(templateId, sessions);

    if (chartData.data.length === 0) {
      return;
    }

    this.weightChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [
          {
            label: 'Peso máximo (kg)',
            data: chartData.data,
            borderColor: '#34d399',
            backgroundColor: 'rgba(52, 211, 153, 0.15)',
            borderWidth: 2,
            pointBackgroundColor: '#34d399',
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
        },
        scales: {
          x: {
            ticks: { color: '#9ca3af', maxTicksLimit: 8 },
            grid: { color: '#1f2937' },
          },
          y: {
            ticks: { color: '#9ca3af' },
            grid: { color: '#1f2937' },
            min: Math.max(0, Math.min(...chartData.data) - 10),
          },
        },
      },
    });
  }

  async exportReport(): Promise<void> {
    const element = this.analysisContainer()?.nativeElement;
    if (!element) return;

    try {
      const dataUrl = await toPng(element, {
        backgroundColor: '#030712',
        pixelRatio: 2,
        cacheBust: true,
      });

      const link = document.createElement('a');
      link.download = `gym_report_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export error:', err);
      alert('Error al exportar el informe.');
    }
  }
}
