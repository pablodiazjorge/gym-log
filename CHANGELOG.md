# Changelog

Notable changes to gym-log. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and versions follow [Semantic Versioning](https://semver.org/). There are no tags yet: each
version below is the tip of its `release/*` branch, and the numbers in brackets are the commit
prefixes of the history before Conventional Commits.

## [Unreleased]

### Added

- MIT license.
- CI on every push and pull request: lint, typecheck, unit tests and build, then the e2e suite
  ([ADR-0015](docs/adr/0015-ci-pipeline.md)).
- Playwright end-to-end tests for three flows — a full workout, export → delete → import, and an
  invalid routine rejected until fixed — on mobile and desktop, with axe
  ([ADR-0016](docs/adr/0016-e2e-for-the-key-flows.md)).
- README screenshots drawn from invented data (`npm run screenshots`), this changelog and a
  [five-minute walkthrough](docs/walkthrough.md).
- Editing a saved session from History ([ADR-0014](docs/adr/0014-history-edits-correct-the-record.md)) [033].
- Analysis redesigned as a coach view: training balance, what needs attention, progress by
  exercise [032].
- Customizable Home: pin any routine, built-in or custom [031].
- Girths in body check-ins [030]; body check-ins outside a session [019].
- "Coach" theme: color tokens, self-hosted font, icon system and a floating dock, applied to
  every screen [022–029].
- In-session edits: swap the exercise, add or drop a set, without touching the routine
  ([ADR-0013](docs/adr/0013-in-session-edits-never-touch-the-routine.md)) [021].

### Changed

- `strict` and `strictTemplates` are explicit in `tsconfig.json`.
- The pure part of the workout flow lives in `workout-flow.util.ts`, with tests.
- Secondary and destructive text colors meet WCAG AA contrast.
- Node.js range declared in `engines` (`^22.22.3 || ^24.15.0 || >=26.0.0`, Angular 22's).
- Build-process notes moved to [docs/process/](docs/process/).

### Fixed

- The profile and custom routines loaded from `localStorage` are validated; malformed ones are
  set aside under a quarantine key instead of breaking the app.
- Icon-only buttons and set inputs have accessible names, and the routine card no longer nests
  a button inside a button.
- The specs typecheck again; the checks against the author's real exports are opt-in
  (`GYM_LOG_REAL_DATA=1`).
- The 28 bugs confirmed by the audit of 14 August 2026 [018–019]
  ([docs/process/](docs/process/)).

## [1.0.0] - 2026-08-08

### Added

- Adaptive progression engine and user profile: experience level, frame-size assessment and
  strength standards, RIR-driven targets ([ADR-0007](docs/adr/0007-advisory-progression.md)) [015].
- Curated exercise catalog with a user-enabled subset
  ([ADR-0011](docs/adr/0011-curated-catalog-with-enabled-subset.md)) [016].
- Architecture notes, the first ten ADRs and unit tests for the critical logic [014].

### Changed

- **Breaking:** export format 2.0 — English exercise ids, no day variants
  ([ADR-0012](docs/adr/0012-v2-format-clean-break.md)). Older exports have to be converted first
  ([docs/migration-v2.md](docs/migration-v2.md)) [016].

## [0.0.1] - 2026-08-05

### Added

- First version: built-in Push / Pull / Legs / Abs days with alternative exercises, guided set
  logging, skipped sets, session notes, history, analysis and JSON export/import [001–009].
- The Additional flow for one-off exercises outside any routine [010].
- Custom routines, alongside the built-in days
  ([ADR-0005](docs/adr/0005-builtin-and-custom-routines.md)) [013].

[Unreleased]: https://github.com/pablodiazjorge/gym-log/compare/release/1.0.0...HEAD
[1.0.0]: https://github.com/pablodiazjorge/gym-log/compare/release/0.0.1...release/1.0.0
[0.0.1]: https://github.com/pablodiazjorge/gym-log/tree/release/0.0.1
