# ADR-0013: In-session edits act on the live session, never on the routine

Date: 2026-08-30
Status: Accepted

## Context

A routine fixes the plan (ADR-0005), and a workout started from one mirrored it exactly: the
only way to deviate was to *skip* a set. The gym does not always cooperate — a machine is taken,
time runs out, a set feels like one too many, or a variation has to stand in for the planned
exercise. The user's workaround was to log the stand-in under the planned exercise's id, which
poisons that exercise's history (and, with the progression engine off, the next session's verbatim
pre-fill). Adding a set beyond the routine's count was impossible outright.

## Decision

The workout screen gains three edits — **swap exercise**, **add set**, **remove set** — with these
rules:

- **They edit the live `WorkoutSession` only.** The routine that started it is never modified; a
  deliberate change to the plan is made in the routine editor, not mid-workout.
- **Performed work is never lost by a swap.** If no *work* set of the current exercise was
  performed (`completed && !skipped && !isWarmup`), the replacement takes its place — a lone
  warm-up is not work, and an exercise kept with only a warm-up would become that template's
  latest history and pre-fill the next session at 0 kg. Otherwise the original keeps its
  performed sets (warm-ups included) and the replacement is inserted right after it
  (`swapExercise()`). Pending and skipped slots of the original are dropped — they were never
  done.
- **A swapped-in exercise is pre-filled like a new session would pre-fill it** (progression
  suggestion, or last-session copy under the profile toggle), with the *template's* set count:
  the routine never planned this exercise, so it has no authority over its shape
  (`planIsAuthoritative = false`).
- **Only the last, still-open set can be removed**, and never the only one. A completed set is a
  record; the way to drop one that already happened is still Skip.
- **The picker excludes exercises already in the session.** Progress dots and the summary
  `track` by `templateId`; a duplicate would collide. The picker itself is a shared component
  (`app-exercise-picker`) so the routine editor and the swap offer the same list and rules.
- The edit logic is pure and unit-tested (`session-edit.util.ts`, per ADR-0010); the component
  only wires it to signals and persists through `StorageService.saveCurrentSession`.

## Consequences

- A session can now differ from its routine — history shows what was done, the routine still
  shows what was planned, and both are honest.
- Exercise history stays clean: a stand-in is logged under its own id, so neither analytics nor
  the next pre-fill inherit numbers from a different movement.
- Skipped sets dropped by a swap disappear from that session's record (the exercise keeps only
  performed sets). Accepted: a skip on an exercise the user abandoned carries no information.
- The additional-exercise flow (ADR-0006) is unaffected; it never had a routine to deviate from.
