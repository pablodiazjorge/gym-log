# A five-minute walkthrough

A guided tour for someone reading the code for the first time: what the app is, where things
live, three decisions that shaped it, and one thing I would do differently.

## 1. What it is (30 seconds)

A workout tracker used on a phone between sets. It is a pure client-side Angular 22 app: no
backend, no accounts, everything in `localStorage`, with a JSON export as the backup. The
interesting part is not the CRUD — it is the progression engine that pre-fills the next session
and the care taken so that a bad record never poisons it.

Try it at [gym-log.pablodiazjorge.com](https://gym-log.pablodiazjorge.com/), or run it with
`npm install && npm start`.

## 2. Map of the code (1.5 minutes)

```
routes (app.routes.ts, every screen lazy-loaded)
   │
features/*            thin standalone components, signals in templates
   │  inject()
core/services/*       one signal-backed service per piece of state (ADR-0003)
   │                  storage · routines · profile · check-ins · export
   │  pure functions
core/services/*.util.ts, features/*/*.util.ts    the logic, unit-tested without Angular
   │
localStorage  ⇄  JSON export / import (validated on the way in)
```

Five files tell most of the story:

| File | Why it matters |
| --- | --- |
| `core/services/progression.util.ts` | The engine: double progression autoregulated by RIR, scaled by level, training frequency and focus. Pure functions, every tunable a named constant. |
| `core/services/progression.service.ts` | Feeds the engine from history and the profile, one suggestion per exercise. |
| `features/workout/workout.ts` + `workout-flow.util.ts` | The guided session: the component wires signals and dialogs; the util builds, resumes and finishes the session. |
| `core/services/storage.service.ts` | Sessions in `localStorage`, with `isValidSession` and a quarantine key for anything malformed. |
| `core/services/export.service.ts` | The backup file: one JSON with everything the user authored, checked entry by entry on import. |

The `e2e/` folder shows the same app from the outside: three flows a user actually performs.

## 3. Three decisions (2.5 minutes)

**No backend; the export file is the backup** ([ADR-0001](adr/0001-client-only-architecture.md),
[ADR-0002](adr/0002-localstorage-plus-json-export.md)). Zero hosting cost, instant, offline.
The price is that durability is the user's job and every byte read back is untrusted: a
truncated or hand-edited value used to crash History with no way out. So every store validates
what it loads and imports, and sessions, routines and the profile set aside what they cannot use
under a quarantine key instead of losing it silently.

**Suggestions are advisory, and the record stays honest**
([ADR-0007](adr/0007-advisory-progression.md), [ADR-0013](adr/0013-in-session-edits-never-touch-the-routine.md),
[ADR-0014](adr/0014-history-edits-correct-the-record.md)). The engine only pre-fills editable
fields; what the user logs is what feeds the next calculation. Because the engine learns from
history, the rules around history matter: a swapped-in exercise is logged under its own id, an
exercise holding only a warm-up never becomes its latest history, and correcting a past session
is a separate mode with its own rules.

**Test where the risk is** ([ADR-0016](adr/0016-e2e-for-the-key-flows.md),
[ADR-0015](adr/0015-ci-pipeline.md)). Unit tests target the math and the data guards, without
TestBed. Three hand-written Playwright flows cover what the app is for — a full workout, the
backup round trip and the routine editor's validation — on a phone and a desktop viewport, with
axe on every screen they cross. CI runs all of it on each pull request.

## 4. One thing I would do differently (1 minute)

Start with CI, an end-to-end test and an accessibility check on day one. For its first months
the repository had none ([ADR-0009](adr/0009-no-ci-pipeline.md)), and it showed when they
arrived: the specs had quietly stopped typechecking (Vitest strips types, so everything still
passed), and the first axe run found number inputs and icon buttons with no accessible name and
secondary text at 3.5:1 contrast. None of it was hard to fix; all of it was invisible without
the tooling.

## 5. Where to go next

- [architecture.md](../architecture.md) — conventions, data model, key flows, the ADR index.
- [docs/exercises/README.md](exercises/README.md) — the progression decision matrix.
- [CHANGELOG.md](../CHANGELOG.md) — what changed, release by release.
