# Exercise Catalog

Master documentation for the exercise catalog. The **source of truth is the TypeScript data** in
`src/app/core/data/exercises/*.ts` (validated by `exercise-catalog.spec.ts`); these .md files
mirror it for readability — update both together.

## Groups

| Group | Doc | Data file |
|---|---|---|
| Chest | [chest.md](chest.md) | `chest.ts` |
| Back | [back.md](back.md) | `back.ts` |
| Shoulders | [shoulders.md](shoulders.md) | `shoulders.ts` |
| Biceps | [biceps.md](biceps.md) | `biceps.ts` |
| Triceps | [triceps.md](triceps.md) | `triceps.ts` |
| Quads | [quads.md](quads.md) | `quads.ts` |
| Hamstrings & Glutes | [hamstrings-glutes.md](hamstrings-glutes.md) | `hamstrings-glutes.ts` |
| Calves | [calves.md](calves.md) | `calves.ts` |
| Abs | [abs.md](abs.md) | `abs.ts` |

## Conventions

- **Ids are stable English kebab-case slugs** referenced by logged history — never rename
  ([ADR-0012](../adr/0012-v2-format-clean-break.md); pre-v2 Spanish ids map via
  [migration-v2.md](../migration-v2.md)).
- **Built-in day flag**: only the original members carry `builtInDay: true`. Catalog extras never
  auto-join a built-in day; they can only appear there as *enabled* alternatives of a
  `choiceGroup` (ADR-0011).
- **Rep ranges by type**: compounds 6-12 hypertrophy; isolation 10-15; calves 12-20; abs 8-20
  depending on movement (crunch-style 12-20, leg-raise/rollout-style 8-15). Strength ranges:
  barbell/Smith presses and squats 3-6 (Smith squat 4-6), machine/cable compounds 4-8, weighted
  dips 4-8, pull-up family 4-6. They exist **only** on compounds where heavy bilateral loading is
  sensible — unilateral or technique-limited compounds (Bulgarian split squat, single-leg RDL,
  single-arm pulldown/row, walking lunges, good morning, goblet squat) deliberately have none and
  always run their hypertrophy range.
- **Weight increments** (`weightIncrementKg`): barbell/Smith/machine/cable 2.5, dumbbell 2.0,
  leg-press-style machines 5.0, bodyweight+load 2.5.
- **Enablement**: users activate a subset via the Exercise Library view
  (`gym_enabled_exercises`); only enabled exercises appear in the pickers. Default = the
  built-in day members.

## Progression engine — decision matrix

How `suggestNextSessionSets` behaves per focus and exercise type. "Range" is the effective rep
range (strength focus on a compound with a defined strength range uses that range; everything
else uses the hypertrophy range). Fatigue gates run first in every mode.

| Condition (evaluated in order) | Hypertrophy | Strength (compound) | Strength (isolation) | Maintenance |
|---|---|---|---|---|
| RIR trend falling, or avg RIR < min − 0.5 | HOLD | HOLD | HOLD | HOLD |
| Intermediate/advanced and avg RIR < min | HOLD | HOLD | HOLD | HOLD |
| Last reps far outside effective range (±2) | e1RM reload¹ | e1RM reload¹ | e1RM reload¹ | — (holds) |
| RIR rising and avg RIR > max + 0.5 | +weight ×2² | +weight ×2 | +weight ×1² | +1 rep³ |
| Reps ≥ weight threshold⁴ | +weight, reps→min | +weight, reps→min | +weight, reps→min | HOLD |
| Otherwise | +1 rep | +1 rep | +1 rep | HOLD |

1. Range transition — last performance sits far outside the effective range (after a focus
   switch, or a big overshoot): load recalculated from estimated 1RM for the midpoint of the
   range at target RIR; per-set rep deltas reset. Never fires when the fatigue gates said HOLD.
2. The aggressive double step applies to compounds only; isolation takes a single step.
3. Maintenance only adds a rep when RIR clearly decayed above target — never weight.
4. Weight threshold: range **ceiling** for hypertrophy and all isolation; range **midpoint** for
   strength-focus compounds.

Per-session weight steps scale by experience level (beginner 2.5% / intermediate 2% / advanced
1.25%) × frequency scale (1/weekly-frequency, capped 0.5-1.5), rounded to the exercise's
increment with a guaranteed minimum of one increment. Every branch above is pinned by
`progression.util.spec.ts`.
