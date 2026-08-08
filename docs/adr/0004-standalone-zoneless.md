# ADR-0004: Standalone components, zoneless change detection

Date: 2026-08-08
Status: Accepted

## Context

Angular 22 supports NgModule-based and standalone architectures, and zone-based or zoneless change
detection. Solo project; simplicity and small bundles matter more than legacy compatibility.

## Decision

Standalone components only (lazy-loaded via `loadComponent`), `provideZonelessChangeDetection()`,
signal-driven templates.

## Consequences

- Smaller bundles, simpler mental model, no NgModule ceremony.
- All async UI updates must flow through signals (they do).
- Third-party libraries relying on zone.js patching are avoided.
