# ADR-0011: Curated exercise catalog with a user-enabled subset

Date: 2026-08-08
Status: Accepted

## Context

The original catalog held ~27 machine-specific exercises. Real movements have many valid
variations (a flat press: barbell, dumbbell, Smith, converging machine, pec deck, cables...),
but listing ~85 exercises in every picker would bury the handful actually in use. Built-in days
must also not absorb every new catalog entry of their category.

## Decision

A curated master catalog (~85 exercises, `src/app/core/data/exercises/*`, EN/ES names +
descriptions + per-type engine metadata, mirrored in `docs/exercises/*.md`) combined with a
user-enabled subset persisted under `gym_enabled_exercises` (default = the original built-in day
members). Pickers (routine editor, /additional, built-in day choice groups) show enabled
exercises only; catalog extras join a built-in day solely as enabled `choiceGroup` alternatives,
with a never-empty fallback. Enabled ids travel in the JSON export.

## Consequences

- Pickers stay short and personal; the repertoire grows by flipping a toggle, not by code edits.
- Built-in days keep their exact current composition until the user opts into variations.
- Every catalog entry carries engine metadata (compound/isolation, per-focus rep ranges, load
  increment), so progression rules are per-exercise data, not code.
- Adding future exercises = one data entry + one docs row (integrity-checked by
  `exercise-catalog.spec.ts`).
