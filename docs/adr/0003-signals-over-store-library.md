# ADR-0003: Signals per service, no store library

Date: 2026-08-08
Status: Accepted

## Context

App-wide state is small (sessions, current session, routines, profile) and naturally
service-owned. Angular Signals cover reactive reads in templates without extra machinery.

## Decision

Each persistence-backed service exposes its data as public `signal()`s; components inject services
directly and read signals in templates. No NgRx or other store abstraction.

## Consequences

- Minimal boilerplate; state and its persistence live in one place per concern.
- No time-travel debugging or action log — acceptable at this scale.
- If cross-service state coordination grows complex, revisit.
