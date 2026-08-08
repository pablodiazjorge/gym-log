# Quads Exercises

> Source of truth: `src/app/core/data/exercises/quads.ts`. Update both together.

| ID | English | Spanish | Equipment | Type | Hypertrophy | Strength | Step (kg) | Built-in day | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `machine-hack-squat` | Machine Hack Squat | Hack squat en máquina | machine | Compound | 6-10 | 4-8 | 5.0 | ✓ | — |
| `incline-leg-press` | Incline Leg Press | Prensa inclinada | machine | Compound | 6-10 | 4-8 | 5.0 | ✓ | Feet low, shoulder-width. Controlled range, lower back supported. |
| `weighted-squats-home` | Weighted Squats (home) | Sentadillas lastradas (casa) | bodyweight | Compound | 10-15 | — | 2.5 | ✓ | With a weighted backpack or dumbbells at home. Deep controlled range. |
| `smith-bulgarian-split-squat` | Smith Bulgarian Split Squat | Búlgara en multipower | smith | Compound | 8-12 | — | 2.5 | ✓ | — |
| `barbell-back-squat` | Barbell Back Squat | Sentadilla trasera con barra | barbell | Compound | 6-10 | 3-6 | 2.5 | — | — |
| `barbell-front-squat` | Barbell Front Squat | Sentadilla frontal con barra | barbell | Compound | 6-10 | 3-6 | 2.5 | — | — |
| `smith-machine-squat` | Smith Machine Squat | Sentadilla en multipower | smith | Compound | 6-10 | 4-6 | 2.5 | — | — |
| `goblet-squat` | Goblet Squat | Sentadilla goblet | dumbbell | Compound | 6-12 | — | 2.0 | — | — |
| `pendulum-squat` | Pendulum Squat | Sentadilla péndulo | machine | Compound | 6-10 | 4-8 | 5.0 | — | — |
| `walking-lunges` | Walking Lunges | Zancadas caminando | dumbbell | Compound | 6-12 | — | 2.0 | — | — |
| `leg-extension` | Leg Extension | Extensión de cuádriceps | machine | Isolation | 10-15 | — | 2.5 | — | — |

## Conditions

Exercises sharing `choiceGroup: 'legs-main'` (Machine Hack Squat, Incline Leg Press, Weighted Squats (home), Barbell Back Squat, Barbell Front Squat, Smith Machine Squat, Goblet Squat, Pendulum Squat) are alternatives in the built-in Legs day selector — the user picks one main squat-pattern movement per session. `smith-bulgarian-split-squat` sits alone in `choiceGroup: 'legs-split-squat'` as the optional extra unilateral slot. Some compounds intentionally have no strength range: Weighted Squats (home) and Goblet Squat are capped by their loading method (backpack/dumbbell ceiling), and Smith Bulgarian Split Squat and Walking Lunges are unilateral balance work — the engine treats those as hypertrophy-range-only.
