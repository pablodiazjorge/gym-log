# ADR-0016: Unit tests for critical logic, end-to-end tests for the three key flows

Date: 2026-10-22
Status: Accepted — supersedes ADR-0010

## Context

ADR-0010 kept testing to pure logic and data integrity, with no DOM tests and no e2e suite: UI
regressions would be caught by daily use. That bet has two weak spots.

- Daily use is one person, one phone and the paths they take that week. The guided workout,
  the backup round trip and the routine editor are what the app is for, and nothing checked them
  as a whole — not even when the workout component was split (`workout-flow.util.ts`).
- Nothing checked accessibility. The first axe run on those flows found critical and serious
  problems that daily use could never surface: number inputs and icon-only buttons without an
  accessible name, a button nested inside another, and secondary text at 3.5:1. They were fixed
  before this suite started gating.

## Decision

Unit tests keep the scope ADR-0010 gave them: Vitest without TestBed, aimed at the progression
math, the pure helpers (`*.util.ts`) and the guards that protect stored and imported data. No
DOM or snapshot tests, no coverage mandate.

On top of that, Playwright drives the real app (`e2e/`, `npm run test:e2e`, which starts the dev
server) through three flows, written by hand to read like the steps a user takes:

- **Complete workout** — Home → built-in Abs day → pick an exercise → close every set → summary →
  save → the session is on Home and in History.
- **Backup round trip** — export → delete the session in History → import the file → it is back.
- **Invalid routine** — saving an empty routine shows both errors and stays put; a name alone
  still fails; with one exercise it saves.

Rules:

- Two projects: `mobile` (Pixel 7, how the app is really used) and `desktop` (Desktop Chrome).
  Chromium only.
- Every test starts from an empty browser profile and seeds what it needs through localStorage,
  with invented data (`e2e/support/demo-data.ts`) — never the author's real exports.
- `@axe-core/playwright` scans every screen the flows cross. Serious and critical violations
  fail the test; moderate and minor ones are not gated.
- CI runs the suite in its own job after `verify` (ADR-0015) and keeps the HTML report when it
  fails.

## Consequences

- A regression in the main flows, or a new serious accessibility violation on them, fails the
  pull request instead of reaching the gym.
- The tests find elements by role and visible text, so renaming a button or a label means
  updating a test. That is deliberate: those names are what a user, and a screen reader, rely on.
- Screens outside the three flows (analysis, profile, check-ins, exercise library, additional
  exercises) are not scanned yet, and moderate findings stay open: the viewport meta disables
  pinch zoom, the workout screen has two `main` landmarks, and Home skips a heading level.
- CI takes a couple of minutes longer, and only Chromium is covered.
