# ADR-0001: Client-only architecture, no backend

Date: 2026-08-08
Status: Accepted

## Context

Personal single-user tool used on a phone at the gym. It must load instantly, work offline, and
require zero hosting/maintenance beyond static files.

## Decision

Pure client-side Angular application. All logic and state live in the browser; hosting is static
(Vercel). No API, no database server, no auth.

## Consequences

- Zero operational cost and no server to maintain or secure.
- Works offline once loaded; instant interactions.
- Data durability depends entirely on the browser profile → mitigated by ADR-0002.
- Multi-device sync is explicitly out of scope.
