# Biceps Exercises

> Source of truth: `src/app/core/data/exercises/biceps.ts`. Update both together.

| ID | English | Spanish | Equipment | Type | Hypertrophy | Strength | Step (kg) | Built-in day | Notes |
|---|---|---|---|---|---|---|---|---|---|
| incline-bench-curl | Incline Bench Biceps Curl | Curl de bíceps en banco inclinado | dumbbell | Isolation | 10-12 | — | 2.0 | ✓ | — |
| hammer-curl | Hammer Curl | Curl martillo | dumbbell | Isolation | 10-12 | — | 2.0 | ✓ | — |
| barbell-curl | Barbell Curl | Curl de bíceps con barra | barbell | Isolation | 10-15 | — | 2.5 | — | — |
| ez-bar-curl | EZ-Bar Curl | Curl de bíceps con barra Z | barbell | Isolation | 10-15 | — | 2.5 | — | — |
| cable-curl | Cable Curl | Curl de bíceps en polea | cable | Isolation | 10-15 | — | 2.5 | — | — |
| machine-preacher-curl | Machine Preacher Curl | Curl predicador en máquina | machine | Isolation | 10-15 | — | 2.5 | — | — |
| concentration-curl | Concentration Curl | Curl concentrado | dumbbell | Isolation | 10-15 | — | 2.0 | — | — |

## Conditions

All entries except Concentration Curl share the `pull-curl` choiceGroup: the two legacy curls (Incline Bench Biceps Curl, Hammer Curl) plus Barbell Curl, EZ-Bar Curl, Cable Curl and Machine Preacher Curl are alternatives for the single curl slot of the built-in Pull day, so its selector offers them as a pick-one choice. Concentration Curl has no choiceGroup and is a standalone catalog entry that never auto-joins the built-in day.
