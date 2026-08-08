# ADR-0010: Testing scope is intentionally narrow — critical logic only

Date: 2026-08-08
Status: Accepted

## Context

Solo personal project; heavy test-authoring overhead is not proportional to risk. The genuinely
risky code is the algorithmic core (progression math, level classification) and data-integrity
logic (routine CRUD/validation, built-in derivation) — not template rendering.

## Decision

Unit tests (Vitest, no Angular TestBed) target: `progression.util.ts` (every decision-table
branch, boundary values, a regression pin on the frame-adjustment direction),
`RoutineLibraryService` (validation, deep-clone duplication, import dedup) and
`RoutineService.getBuiltInRoutines()` (derivation stability). No DOM/snapshot tests, no e2e suite,
no coverage mandate.

## Consequences

- Fast, dependency-light test runs; the highest-value logic is pinned.
- UI regressions are caught by daily real use, not automation — accepted trade-off.
- New algorithmic code should follow the same pattern: pure function + spec.
