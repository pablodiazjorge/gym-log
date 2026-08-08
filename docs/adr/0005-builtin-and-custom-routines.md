# ADR-0005: Built-in catalog coexists with user-created custom routines

Date: 2026-08-08
Status: Accepted

## Context

The original spec (see [docs/history/project_plan.md](../history/project_plan.md)) deliberately
hardcoded the PPL+Abs routine to avoid UI complexity. Real daily use revealed the need for
user-configurable routines (own sets/reps/RIR/rest per exercise) without losing the zero-friction
built-in quick start.

## Decision

Two services with distinct responsibilities:

- `RoutineService` keeps owning the hardcoded exercise catalog and the 4 built-in days (read-only),
  and derives them as `Routine` objects at read time (`getBuiltInRoutines()`).
- `RoutineLibraryService` owns persisted user-created `Routine` records (localStorage key
  `gym_custom_routines`), where each exercise carries its own author-configured targets.

Both are listed together in the Routines tab; built-ins are non-deletable but can be
"duplicated to customize". Both start workouts through the same generalized `Workout` component —
built-in days keep their live choice-group selection UX, saved routines skip it (choices were
resolved at authoring time).

## Consequences

- No duplicated "start workout" logic; one session-creation path.
- Built-ins stay maintainable in code; custom routines are real user data (included in exports).
- The catalog remains the single source of exercise definitions; routines reference it by
  `templateId` (see ADR-0012).
