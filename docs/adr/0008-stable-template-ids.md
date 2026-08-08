# ADR-0008: Exercise template ids are stable identifiers, exempt from renames

Date: 2026-08-08
Status: Accepted

## Context

`ExerciseTemplate.id` slugs are Spanish-derived (e.g. `press-inclinado-maquina`) and referenced as
`WorkoutExercise.templateId` from every historical session in real users' localStorage. The
English rewrite could have "cleaned them up" — silently breaking history matching, progression
lookups and analytics with no migration path.

## Decision

Template ids are internal opaque keys, never renamed. Only human-facing `name`/`notes`/labels were
translated. Logged sessions additionally snapshot `exerciseName` at logging time, so old sessions
legitimately keep Spanish display names.

## Consequences

- Zero data migration; all history keeps working.
- Some ids read as Spanish slugs forever — harmless, they are never shown to the user.
- New exercises should get English slugs going forward.
