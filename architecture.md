# Architecture

## Overview

Gym Tracker is a personal, single-user, mobile-first workout tracker. It is a **pure client-side
Angular application**: there is no backend, no database server and no authentication — by design
(see [ADR-0001](docs/adr/0001-client-only-architecture.md)). Everything runs in the browser:

```
UI (standalone components, Tailwind)
        │  read signals / call methods
        ▼
Core services (signal-backed, providedIn: 'root')
        │  JSON serialize
        ▼
localStorage  ←→  manual JSON export/import (backup & analysis channel)
```

## System context

- **Who**: a single user (the author), logging workouts on a phone at the gym.
- **Where**: static hosting (Vercel), deployed manually from the main branch — no CI
  ([ADR-0009](docs/adr/0009-no-ci-pipeline.md)).
- **Data flow**: data never leaves the device except through the explicit JSON export, which is
  simultaneously the backup mechanism and the input for external analysis (the schema is kept
  intentionally flat and pandas/AI-friendly).

## Project structure

```
src/app/
├── core/
│   ├── models/          # pure domain interfaces, no logic
│   │   ├── workout.model.ts      # sessions / exercises / sets + export schema
│   │   ├── routine.model.ts      # saved routines (built-in + custom)
│   │   ├── profile.model.ts      # user profile, frame size, experience level
│   │   └── progression.model.ts  # suggestion types
│   └── services/
│       ├── storage.service.ts          # sessions persistence (localStorage)
│       ├── routine.service.ts          # hardcoded exercise catalog + built-in days
│       ├── routine-library.service.ts  # user-created custom routines (CRUD)
│       ├── profile.service.ts          # user profile persistence + level resolution
│       ├── progression.util.ts         # PURE progression math (no Angular) — unit-tested
│       ├── progression.service.ts      # orchestration: history + profile → suggestions
│       ├── analytics.service.ts        # charts, metrics, stagnation detection
│       └── export.service.ts           # JSON export/import
├── features/            # one folder per routed screen
│   ├── dashboard/       # home: quick-start cards, resume banner, export/import
│   ├── workout/         # guided logging flow (day-based or routine-based)
│   ├── routines/        # routines list + editor
│   ├── profile/         # profile form + computed level panel
│   ├── history/         # session list + detail
│   ├── analysis/        # Chart.js dashboards + PNG export
│   └── additional/      # ephemeral ad-hoc logging
└── shared/components/   # cross-feature UI (header)
```

Convention: **models hold no logic, services own state and persistence, components stay thin**.
New algorithmic logic goes into pure `*.util.ts` files so it can be unit-tested without Angular.

## State management

Signal-per-service pattern ([ADR-0003](docs/adr/0003-signals-over-store-library.md)): each
persistence-backed service exposes its data as public `signal()`s (`StorageService.sessions`,
`RoutineLibraryService.customRoutines`, `ProfileService.profile`); components inject services with
`inject()` and read signals directly in templates. No global store library. Zoneless change
detection throughout ([ADR-0004](docs/adr/0004-standalone-zoneless.md)).

## Data model

Four localStorage keys:

| Key                   | Content                       | Owner                   |
| --------------------- | ----------------------------- | ----------------------- |
| `gym_sessions`        | `WorkoutSession[]` (history)  | `StorageService`        |
| `gym_current_session` | in-progress session autosave  | `StorageService`        |
| `gym_custom_routines` | user-created `Routine[]`      | `RoutineLibraryService` |
| `gym_user_profile`    | `UserProfile`                 | `ProfileService`        |

The export file (`ExportData`) bundles `sessions`, `user?` and `routines?` — everything needed to
restore on a new device ([ADR-0002](docs/adr/0002-localstorage-plus-json-export.md)). The session
schema is append-only: new fields are always optional so historical data parses unchanged. Exercise
`templateId` slugs are stable opaque keys, never renamed
([ADR-0008](docs/adr/0008-stable-template-ids.md)). A sample export lives in
[docs/sample-data/](docs/sample-data/).

## Key flows

**Starting a workout.** Two entry points funnel into the same `Workout` component:
`/workout/:dayType` (built-in day cards, with live choice-group selection) and
`/workout/routine/:routineId` (saved custom routines, choices already resolved at authoring time).
Both build the session through one path that asks `ProgressionService` for per-exercise suggested
targets ([ADR-0005](docs/adr/0005-builtin-and-custom-routines.md)).

**Progression suggestions.** `progression.util.ts` implements double progression autoregulated by
RIR trend: hold / add reps / add weight / aggressive step, scaled by experience level, preserving
the user's own set-to-set decline pattern from the last session. Per-session weight steps are also
scaled by weekly training frequency (auto-detected from the last 3 weeks, overridable per category
in the profile) so weekly progression stays constant across splits, and the profile's training
focus (hypertrophy / strength / maintenance) moves the rep threshold at which weight goes up.
Suggestions only pre-fill editable fields — nothing is enforced
([ADR-0007](docs/adr/0007-advisory-progression.md)).

**Export / import.** Export downloads a single JSON with sessions + profile + custom routines.
Import merges sessions/routines by id (skipping duplicates) and only adopts the profile when none
exists locally.

## Decisions (ADR index)

| ADR                                                       | Decision                                             |
| --------------------------------------------------------- | ---------------------------------------------------- |
| [0001](docs/adr/0001-client-only-architecture.md)         | Client-only architecture, no backend                 |
| [0002](docs/adr/0002-localstorage-plus-json-export.md)    | localStorage + JSON export/import as backup channel  |
| [0003](docs/adr/0003-signals-over-store-library.md)       | Signals per service, no store library                |
| [0004](docs/adr/0004-standalone-zoneless.md)              | Standalone components, zoneless change detection     |
| [0005](docs/adr/0005-builtin-and-custom-routines.md)      | Built-in catalog coexists with custom routines       |
| [0006](docs/adr/0006-additional-flow-stays-ephemeral.md)  | `/additional` stays ephemeral, separate from routines |
| [0007](docs/adr/0007-advisory-progression.md)             | Progression suggestions are advisory, never enforced |
| [0008](docs/adr/0008-stable-template-ids.md)              | Exercise template ids are stable, exempt from renames |
| [0009](docs/adr/0009-no-ci-pipeline.md)                   | No CI pipeline; manual deploy to Vercel              |
| [0010](docs/adr/0010-narrow-testing-scope.md)             | Tests target critical logic only                     |

## Non-goals

- Multi-user, accounts, auth
- Backend sync / cloud storage / conflict resolution
- i18n framework (single-language English UI)
- e2e test suite or coverage mandates
- Native app packaging
