# Calves Exercises

> Source of truth: `src/app/core/data/exercises/calves.ts`. Update both together.

| ID | English | Spanish | Equipment | Type | Hypertrophy | Strength | Step (kg) | Built-in day | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `standing-calf-raise` | Standing Machine Calf Raise | Elevación de gemelos de pie en máquina | machine | Isolation | 15-20 | — | 2.5 | ✓ | — |
| `seated-calf-raise` | Seated Calf Raise | Elevación de gemelos sentado | machine | Isolation | 15-20 | — | 2.5 | ✓ | — |
| `leg-press-calf-raise` | Leg Press Calf Raise | Elevación de gemelos en prensa | machine | Isolation | 12-20 | — | 5.0 | — | — |
| `single-leg-dumbbell-calf-raise` | Single-Leg Dumbbell Calf Raise | Elevación de gemelo a una pierna con mancuerna | dumbbell | Isolation | 12-20 | — | 2.0 | — | — |
| `smith-machine-calf-raise` | Smith Machine Calf Raise | Elevación de gemelos en multipower | smith | Isolation | 12-20 | — | 2.5 | — | — |

## Conditions

Exercises sharing `choiceGroup: 'legs-calves'` (Standing Machine Calf Raise, Seated Calf Raise, Leg Press Calf Raise, Single-Leg Dumbbell Calf Raise) are alternatives in the built-in Legs day selector — the user picks one calf movement per session. Smith Machine Calf Raise has no choiceGroup and appears only in custom routines. Every calf exercise here is isolation work, so none carry a strength rep range — the engine treats them all as hypertrophy-range-only.
