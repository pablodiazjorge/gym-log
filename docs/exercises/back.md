# Back Exercises

> Source of truth: `src/app/core/data/exercises/back.ts`. Update both together.

| ID | English | Spanish | Equipment | Type | Hypertrophy | Strength | Step (kg) | Built-in day | Notes |
|---|---|---|---|---|---|---|---|---|---|
| lat-pulldown-wide-grip | Lat Pulldown (bar & straps, wide pronated grip) | Jalón al pecho (barra y agarre ancho prono) | cable | Compound | 6-10 | 4-8 | 2.5 | ✓ | — |
| lat-pulldown-mag-neutral | Lat Pulldown (wide MAG grip, neutral) | Jalón al pecho (agarre MAG ancho neutro) | cable | Compound | 6-10 | 4-8 | 2.5 | ✓ | — |
| pronated-pull-ups | Pronated-Grip Pull-Ups | Dominadas con agarre prono | bodyweight | Compound | 6-10 | 4-6 | 2.5 | ✓ | Wide pronated grip. If you cannot reach 6 reps, use a band or negative reps. |
| single-arm-lat-pulldown | Single-Arm Lat Pulldown | Jalón unilateral a una mano | cable | Compound | 8-12 | — | 2.5 | ✓ | Unilateral — no strength range. Grab the single handle, pull toward the chest, elbow close to the body. |
| t-bar-row | T-Bar Row (neutral shoulder-width grip) | Remo en T (agarre neutro a la anchura de hombros) | machine | Compound | 8-12 | 4-8 | 2.5 | ✓ | — |
| converging-pulldown-machine | Converging Pulldown Machine | Jalón convergente en máquina | machine | Compound | 6-12 | 4-8 | 2.5 | — | — |
| neutral-grip-pull-up | Neutral-Grip Pull-Up | Dominadas con agarre neutro | bodyweight | Compound | 6-12 | 4-6 | 2.5 | — | — |
| chin-up | Chin-Up | Dominadas con agarre supino | bodyweight | Compound | 6-12 | 4-6 | 2.5 | — | — |
| barbell-row | Barbell Row | Remo con barra | barbell | Compound | 8-12 | 3-6 | 2.5 | — | — |
| one-arm-dumbbell-row | One-Arm Dumbbell Row | Remo con mancuerna a una mano | dumbbell | Compound | 8-12 | — | 2.0 | — | Unilateral — no strength range. |
| seated-cable-row | Seated Cable Row | Remo sentado en polea | cable | Compound | 8-12 | 4-8 | 2.5 | — | — |
| chest-supported-machine-row | Chest-Supported Machine Row | Remo en máquina con apoyo de pecho | machine | Compound | 8-12 | 4-8 | 2.5 | — | — |
| straight-arm-cable-pulldown | Straight-Arm Cable Pulldown | Pullover en polea con brazos rectos | cable | Isolation | 10-15 | — | 2.5 | — | — |

## Conditions

The eight `pull-main` entries — the four legacy pulldown/pull-up variants plus Converging Pulldown Machine, Neutral-Grip Pull-Up and Chin-Up — share the `pull-main` choiceGroup: they are alternatives for the main vertical-pull slot, so the built-in Pull day selector offers them as a pick-one choice and only the enabled option appears in the day. The rows (T-Bar, Barbell, One-Arm Dumbbell, Seated Cable, Chest-Supported Machine) and the Straight-Arm Cable Pulldown have no choiceGroup and stand alone; the non-legacy ones are catalog-only and never auto-join the built-in day.
