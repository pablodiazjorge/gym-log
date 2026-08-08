# Abs Exercises

> Source of truth: `src/app/core/data/exercises/abs.ts`. Update both together.

| ID | English | Spanish | Equipment | Type | Hypertrophy | Strength | Step (kg) | Built-in day | Notes |
|---|---|---|---|---|---|---|---|---|---|
| hanging-leg-raises | Hanging Leg Raises | Elevaciones de piernas colgado en barra | bodyweight | Isolation | 8-15 | — | 2.5 | ✓ | — |
| cable-crunch | Cable Crunch | Crunch en polea | cable | Isolation | 8-15 | — | 2.5 | ✓ | — |
| dragon-flag | Dragon Flag | Dragon flag | bodyweight | Isolation | 6-12 | — | 2.5 | ✓ | — |
| machine-crunch | Machine Crunch | Crunch en máquina | machine | Isolation | 12-20 | — | 2.5 | — | — |
| lying-leg-raises | Lying Leg Raises | Elevaciones de piernas tumbado | bodyweight | Isolation | 8-15 | — | 2.5 | — | — |
| ab-wheel-rollout | Ab Wheel Rollout | Rueda abdominal | bodyweight | Isolation | 8-15 | — | 2.5 | — | — |
| plank | Plank | Plancha | bodyweight | Isolation | 30-60 | — | 2.5 | — | Reps are recorded as seconds held per set (30-60 s), not repetitions. |
| cable-woodchop | Cable Woodchop | Leñador en polea | cable | Isolation | 10-15 | — | 2.5 | — | Perform 10-15 reps per side each set. |

## Conditions

The six `abs-main` entries — the three legacy exercises (Hanging Leg Raises, Cable Crunch, Dragon Flag) plus Machine Crunch, Lying Leg Raises and Ab Wheel Rollout — share the `abs-main` choiceGroup: they are alternatives for the main slot of the built-in Abs day, so its selector offers them as a pick-one choice and only the enabled option appears in the day. Plank and Cable Woodchop have no choiceGroup; they are standalone catalog entries that never auto-join the built-in day. Abs exercises never carry strength rep ranges.
