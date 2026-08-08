import { Injectable, inject } from '@angular/core';
import { ExerciseProgressionSuggestion } from '../models/progression.model';
import { ExerciseTemplate } from '../models/workout.model';
import { AnalyticsService } from './analytics.service';
import { ProfileService } from './profile.service';
import { StorageService } from './storage.service';
import { suggestNextSessionSets } from './progression.util';

/**
 * Thin orchestration layer for next-session progression suggestions.
 * All math lives in progression.util.ts (pure functions); this service only
 * gathers each exercise's history, RIR trend and the user's resolved level.
 * Suggestions are advisory pre-fills — never enforced (ADR-0007).
 */
@Injectable({ providedIn: 'root' })
export class ProgressionService {
  private readonly storage = inject(StorageService);
  private readonly profileService = inject(ProfileService);
  private readonly analytics = inject(AnalyticsService);

  /** Build a suggestion for every template, keyed by templateId */
  getSuggestionsForTemplates(
    templates: ExerciseTemplate[],
  ): Map<string, ExerciseProgressionSuggestion> {
    const sessions = this.storage.sessions();
    const result = new Map<string, ExerciseProgressionSuggestion>();

    for (const template of templates) {
      const history = this.storage.getLastExerciseHistory(template.id);
      const lastSets = history?.exercise.sets ?? [];

      const metrics = this.analytics.getExerciseMetrics(template.id, sessions);
      const completedWork = lastSets.filter((s) => !s.isWarmup && s.completed && !s.skipped);
      const avgRecentRir =
        completedWork.length > 0
          ? completedWork.reduce((sum, s) => sum + s.rir, 0) / completedWork.length
          : 0;

      const level = this.profileService.getResolvedLevel(template.category);
      const suggestion = suggestNextSessionSets({
        template,
        lastSets,
        level,
        rirTrend: metrics.rirTrend,
        avgRecentRir,
      });

      result.set(template.id, {
        templateId: template.id,
        exerciseName: template.name,
        restSeconds: history?.exercise.restSeconds,
        setTargets: suggestion.targets,
        basis: suggestion.basis,
        action: suggestion.action,
        rationale: suggestion.rationale,
      });
    }

    return result;
  }
}
