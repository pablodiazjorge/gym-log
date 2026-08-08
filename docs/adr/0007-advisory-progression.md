# ADR-0007: Progression suggestions are advisory, never enforced

Date: 2026-08-08
Status: Accepted

## Context

Auto-filled next-session targets (weight/reps per set) could either hard-constrain input or simply
pre-fill it. The formulas involved (blended Epley/Brzycki 1RM, RIR autoregulation, frame-adjusted
strength standards) are reasonable heuristics — not exact science.

## Decision

Suggestions only pre-fill the same editable fields the user always had; nothing is locked. What the
user actually logs — not what was suggested — feeds the next calculation. The algorithm lives in
pure, unit-tested functions (`progression.util.ts`) with every tunable as a named constant.

## Consequences

- Reality always wins over the model; a bad suggestion costs one tap to fix.
- The engine self-corrects: logged RIR/weights drive the next suggestion.
- Constants (step percentages, frame factors, thresholds) are easy to recalibrate after real use.
