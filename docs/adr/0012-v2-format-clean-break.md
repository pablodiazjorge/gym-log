# ADR-0012: One-time v2 format clean break (English ids, no dayVariant)

Date: 2026-08-08
Status: Accepted — supersedes ADR-0008

## Context

ADR-0008 froze the Spanish-derived exercise id slugs to protect the user's existing logged
history, and the dead A/B day-variant system survived from the original spec for the same reason.
Both were compatibility scaffolding polluting the codebase: permanent "never rename" warnings,
mixed-language ids next to English ones, unused `dayVariant` fields and analytics
(`compareVariants`), and a dead `getLastSessionForDay` pre-fill path. The user chose a one-time
external data migration over carrying that debt.

## Decision

Break the data format once, cleanly (export `version: "2.0"`):

- All 24 Spanish-derived ids renamed to English slugs (full mapping in
  [docs/migration-v2.md](../migration-v2.md)); ids remain stable opaque keys from here on.
- `dayVariant` removed from `WorkoutSession`, `DayInfo` and `ExerciseTemplate`; the A/B variant
  analytics (`VariantComparison`, `compareVariants`) and the unused `getLastSessionForDay` are
  deleted.
- The app performs **no runtime migration**: existing localStorage/export data in the old format
  is converted externally by the user (the mapping doc is the contract for that conversion).

## Consequences

- Single-language, self-describing ids; no permanent rename-exemption rule to remember.
- Old exports/localStorage are NOT readable meaningfully until converted (old ids simply won't
  match the catalog; old `dayVariant` keys are ignored on parse).
- Future id changes are again forbidden — but now the rule guards clean ids, not an apology.
