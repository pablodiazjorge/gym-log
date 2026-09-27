# ADR-0014: History edits correct the record — the live-session rules do not apply

Date: 2026-09-27
Status: Accepted

## Context

ADR-0013 protects an *in-progress* session: a completed set is a record, the way to drop one is
Skip, and only the last still-open set can be removed. Those rules assume the record is right and
the session is still happening. But records go wrong — a typo'd weight, a set logged twice, an
exercise forgotten entirely — and the only remedies were deleting the whole session or exporting,
hand-editing JSON and re-importing. History (`/history/:sessionId`) was read-only.

## Decision

The session detail gains an **Edit** mode, governed by the inverse principle: *the record itself
is what is being fixed*, so protections against changing records do not apply there.

- **Everything acts on a deep-cloned draft; nothing persists until Save.** Cancel (with a
  confirm when dirty) is the undo for every edit, so there are no per-edit confirms.
- **Any set may be edited or removed**, including completed and middle ones; removals renumber
  (`history-edit.util.ts`, pure and tested per ADR-0010). Set editing reuses `app-set-input`
  (promoted to `shared/components/`, like the picker before it): a saved set renders as its
  compact row, tapping reopens it — the same reopen-and-fix gesture the workout already taught.
- **Exercises can be added** (shared `app-exercise-picker`, duplicates excluded because the
  views track by `templateId`) **and removed**. A forgotten exercise starts with one open set
  seeded from the template's defaults.
- **Session fields are editable too**: date (calendar day changes, time of day is preserved so
  same-day ordering and local-week bucketing stay honest), duration, bodyweight, notes.
- **Save normalizes**: every remaining set is closed (skipped stays skipped), numbering is
  sequential, and an exercise left with no sets is dropped — kept, it would become that
  template's most recent history and pre-fill the next session from nothing (the same shadowing
  ADR-0013 guards against).

## Consequences

- Analytics, the coach view and progression pre-fills all derive from the sessions signal, so a
  correction propagates everywhere immediately — including `getLastExerciseHistory`, meaning an
  edit to the latest occurrence of an exercise deliberately changes the next session's pre-fill.
- ADR-0013 stands untouched for the live session; the two screens embody different intents
  (logging honestly vs. repairing the log) and share their building blocks, not their rules.
- Skipped stays the honest marker for "planned but not done"; deletion in history is for
  "never happened / logged wrong".
