# Gym Tracker

A mobile-first workout tracker built for the gym floor: log sets in seconds, get calculated
progression targets for your next session, and keep every byte of your data on your own device.

## Screenshots

<!-- TODO: add screenshots to docs/screenshots/ -->
<!-- ![Dashboard](docs/screenshots/dashboard.png) -->
<!-- ![Workout](docs/screenshots/workout.png) -->
<!-- ![Analysis](docs/screenshots/analysis.png) -->

## Features

- **One-tap quick start** — built-in Push / Pull / Legs / Abs days with alternative-exercise
  choices at the start of each session.
- **Custom routines** — build fully-configured routines (per-exercise sets, rep ranges, RIR
  targets, rest time) and start them with one tap from the Routines tab.
- **Guided logging flow** — one exercise at a time, big touch targets, +/- steppers for weight,
  reps, RIR, partial reps and eccentric seconds; per-exercise rest time; autosave and resume for
  in-progress sessions.
- **Calculated progression targets** — the next session is pre-filled with computed targets
  (double progression autoregulated by your RIR trend), scaled to your experience level and
  preserving your own set-to-set weight-drop pattern. Always editable, never enforced.
- **User profile** — simple mode (pick your level) or advanced mode (wrist/ankle frame-size
  assessment + estimated 1RM from reference lifts, classified against frame-adjusted strength
  standards, per movement category).
- **History & analysis** — session history and detail views, weight/volume progression charts,
  weekly volume, RIR trend, stagnation detection with recommendations, PNG report export.
- **JSON export/import** — one file containing your sessions, profile and custom routines; the
  flat, analysis-friendly schema doubles as the input for external analysis (Python/pandas, AI).
- **Ad-hoc logging** — the Additional flow for free-form one-off workouts outside any routine.
- **Exercise library** — a curated catalog (~85 exercises, EN/ES names + descriptions, grouped by
  muscle) where you enable the exercises available in your pickers; each entry carries its own
  engine metadata (compound/isolation, per-focus rep ranges, load increment). See
  [docs/exercises/](docs/exercises/).

## Tech stack

- [Angular 22](https://angular.dev) — standalone components, Signals, zoneless change detection
- TypeScript
- [Tailwind CSS v4](https://tailwindcss.com)
- [Chart.js](https://www.chartjs.org) + [html-to-image](https://github.com/bubkoo/html-to-image)
- `localStorage` persistence — **no backend**
- [Vitest](https://vitest.dev) for unit tests, [angular-eslint](https://github.com/angular-eslint/angular-eslint) for linting

See [architecture.md](architecture.md) for the reasoning behind each choice.

## Getting started

Prerequisites: Node.js 20+ and npm.

```bash
npm install
npm start        # dev server at http://localhost:4200
npm run build    # production build to dist/
npm test         # unit tests (Vitest)
npm run lint     # ESLint
```

No environment variables or configuration needed — there is no backend.

## Project structure

```
src/app/
├── core/
│   ├── models/      # domain interfaces (workout, routine, profile, progression)
│   └── services/    # signal-backed services (storage, routines, progression, analytics, export)
├── features/        # one folder per routed screen (dashboard, workout, routines, ...)
└── shared/          # cross-feature UI (header)
```

Full conventions and rationale in [architecture.md](architecture.md).

## Data & privacy

All data lives in your browser's `localStorage`. Nothing is ever sent anywhere. The only way data
leaves (or enters) the device is the explicit JSON export/import — which is also your backup
mechanism: export regularly.

## Architecture

The app is a pure client-side Angular application with signal-based state and localStorage
persistence. Design decisions are documented as ADRs — see [architecture.md](architecture.md) and
[docs/adr/](docs/adr/).

## Roadmap / known limitations

- Single-device only — no sync; export/import is the transfer mechanism.
- Progression math uses a single global plate increment (1.25 kg); per-exercise increments are a
  natural follow-up.
- Strength-standard classification is calibrated for free-weight reference lifts; machine numbers
  make it approximate.
- No e2e test suite (deliberate — see ADR-0010).
