# Hamstrings & Glutes Exercises

> Source of truth: `src/app/core/data/exercises/hamstrings-glutes.ts`. Update both together.

| ID | English | Spanish | Equipment | Type | Hypertrophy | Strength | Step (kg) | Built-in day | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `seated-leg-curl` | Seated Leg Curl | Curl femoral sentado | machine | Isolation | 12-15 | — | 2.5 | ✓ | — |
| `single-leg-rdl` | Single-Leg RDL | Peso muerto rumano a una pierna | dumbbell | Compound | 10-12 | — | 2.0 | ✓ | Torso straight, rear leg as counterweight. |
| `hip-thrust` | Hip Thrust | Hip thrust | barbell | Compound | 10-12 | 5-8 | 2.5 | ✓ | — |
| `machine-hip-abduction` | Machine Hip Abduction | Abductores en máquina | machine | Isolation | 15-20 | — | 2.5 | ✓ | Lean 10-20° forward. Pause at peak contraction. |
| `barbell-romanian-deadlift` | Barbell Romanian Deadlift | Peso muerto rumano con barra | barbell | Compound | 6-10 | 3-6 | 2.5 | — | — |
| `dumbbell-romanian-deadlift` | Dumbbell Romanian Deadlift | Peso muerto rumano con mancuernas | dumbbell | Compound | 6-12 | — | 2.0 | — | — |
| `conventional-deadlift` | Conventional Deadlift | Peso muerto convencional | barbell | Compound | 6-10 | 3-5 | 2.5 | — | — |
| `lying-leg-curl` | Lying Leg Curl | Curl femoral tumbado | machine | Isolation | 10-15 | — | 2.5 | — | — |
| `good-morning` | Good Morning | Buenos días con barra | barbell | Compound | 6-12 | — | 2.5 | — | — |
| `machine-hip-thrust` | Machine Hip Thrust | Hip thrust en máquina | machine | Compound | 6-12 | 5-8 | 5.0 | — | — |
| `cable-glute-kickback` | Cable Glute Kickback | Patada de glúteo en polea | cable | Isolation | 10-15 | — | 2.5 | — | — |

## Conditions

Exercises sharing `choiceGroup: 'legs-femoral'` (Seated Leg Curl, Single-Leg RDL, Barbell Romanian Deadlift, Dumbbell Romanian Deadlift, Conventional Deadlift, Lying Leg Curl) are alternatives in the built-in Legs day selector for the hamstring slot, and `choiceGroup: 'legs-glute'` (Hip Thrust, Machine Hip Abduction, Machine Hip Thrust, Cable Glute Kickback) works the same way for the glute slot — pick one per group per session. Good Morning has no choiceGroup and appears only in custom routines. Some compounds intentionally have no strength range: Single-Leg RDL is unilateral balance work, Dumbbell Romanian Deadlift is capped by dumbbell loading, and Good Morning is technique-limited — the engine treats those as hypertrophy-range-only.
