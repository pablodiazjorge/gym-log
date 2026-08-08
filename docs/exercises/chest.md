# Chest Exercises

> Source of truth: `src/app/core/data/exercises/chest.ts`. Update both together.

| ID | English | Spanish | Equipment | Type | Hypertrophy | Strength | Step (kg) | Built-in day | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `incline-machine-press` | Incline Machine Press | Press inclinado en máquina | Machine | Compound | 6-12 | 4-8 | 2.5 | ✓ | — |
| `flat-machine-press` | Flat Press | Press plano en máquina | Machine | Compound | 6-12 | 4-8 | 2.5 | ✓ | — |
| `incline-smith-press` | Incline Smith Press | Press inclinado en multipower | Smith | Compound | 6-12 | 3-6 | 2.5 | ✓ | — |
| `pec-deck` | Pec Deck / Chest Fly Machine | Contractora de pecho (pec deck) | Machine | Isolation | 12-15 | — | 2.5 | ✓ | — |
| `flat-barbell-bench-press` | Flat Barbell Bench Press | Press de banca plano con barra | Barbell | Compound | 6-12 | 3-6 | 2.5 | — | — |
| `flat-dumbbell-press` | Flat Dumbbell Press | Press plano con mancuernas | Dumbbell | Compound | 6-12 | 4-8 | 2.0 | — | — |
| `incline-barbell-bench-press` | Incline Barbell Bench Press | Press inclinado con barra | Barbell | Compound | 6-12 | 3-6 | 2.5 | — | — |
| `incline-dumbbell-press` | Incline Dumbbell Press | Press inclinado con mancuernas | Dumbbell | Compound | 6-12 | 4-8 | 2.0 | — | — |
| `converging-chest-press-machine` | Converging Chest Press Machine | Press de pecho convergente en máquina | Machine | Compound | 6-12 | 4-8 | 2.5 | — | — |
| `cable-crossover-high-to-low` | Cable Crossover (High-to-Low) | Cruce de poleas de arriba abajo | Cable | Isolation | 10-15 | — | 2.5 | — | — |
| `flat-dumbbell-fly` | Flat Dumbbell Fly | Aperturas planas con mancuernas | Dumbbell | Isolation | 10-15 | — | 2.0 | — | — |
| `chest-dips` | Chest Dips | Fondos en paralelas para pecho | Bodyweight | Compound | 6-12 | 4-8 | 2.5 | — | Add weight with a dip belt once bodyweight sets exceed the rep range. |

## Conditions

All chest press variations share the `push-main` choice group: `incline-machine-press`, `flat-machine-press`, `incline-smith-press`, `flat-barbell-bench-press`, `flat-dumbbell-press`, `incline-barbell-bench-press`, `incline-dumbbell-press`, and `converging-chest-press-machine`. Exercises in a choice group are mutually exclusive alternatives — the built-in Push day selector offers them as interchangeable options for the main chest slot, and only one is performed per session. `chest-dips`, `cable-crossover-high-to-low`, and `flat-dumbbell-fly` have no choice group; the legacy `pec-deck` is a fixed isolation slot on the built-in Push day.
