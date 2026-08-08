// ─── Exercise catalog ───
//
// Master list of all exercises, merged from the per-muscle-group data files.
// Ids are stable English slugs (ADR-0012); the user enables a subset via the
// Exercise Library (ADR-0011). Docs mirror: docs/exercises/*.md.

import { ExerciseTemplate } from '../../models/workout.model';
import { CHEST_EXERCISES } from './chest';
import { SHOULDERS_EXERCISES } from './shoulders';
import { TRICEPS_EXERCISES } from './triceps';
import { BACK_EXERCISES } from './back';
import { BICEPS_EXERCISES } from './biceps';
import { ABS_EXERCISES } from './abs';
import { QUADS_EXERCISES } from './quads';
import { HAMSTRINGS_GLUTES_EXERCISES } from './hamstrings-glutes';
import { CALVES_EXERCISES } from './calves';

export const EXERCISE_CATALOG: ExerciseTemplate[] = [
  ...CHEST_EXERCISES,
  ...SHOULDERS_EXERCISES,
  ...TRICEPS_EXERCISES,
  ...BACK_EXERCISES,
  ...BICEPS_EXERCISES,
  ...ABS_EXERCISES,
  ...QUADS_EXERCISES,
  ...HAMSTRINGS_GLUTES_EXERCISES,
  ...CALVES_EXERCISES,
];
