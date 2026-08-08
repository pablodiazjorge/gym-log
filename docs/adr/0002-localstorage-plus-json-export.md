# ADR-0002: localStorage as persistence, JSON export/import as the backup channel

Date: 2026-08-08
Status: Accepted

## Context

With no backend (ADR-0001) there is no server-side durability. The user still needs backups, a
path to move data between devices, and a data format suitable for external analysis
(Python/pandas, AI tools).

## Decision

localStorage is the source of truth (keys: `gym_sessions`, `gym_current_session`,
`gym_custom_routines`, `gym_user_profile`). Manual JSON export/import is the only backup and
transfer mechanism, and the export bundles **everything user-authored** — sessions, profile and
custom routines. The schema is kept flat and analysis-friendly, and evolves append-only: new
fields are always optional so old data and old exports keep parsing.

## Consequences

- Simple, dependency-free persistence; the export file doubles as the analysis interface.
- The user is responsible for exporting regularly (no auto-backup).
- Clearing browser data destroys anything not exported.
- Schema changes must never rename or remove existing fields.
