# ADR-0006: The /additional ad-hoc flow stays ephemeral and separate

Date: 2026-08-08
Status: Accepted

## Context

With saved custom routines (ADR-0005), the free-form `/additional` flow could have been merged
into the routines feature or extended with "save as routine".

## Decision

`/additional` remains a purely in-session, non-persisted, generic multi-select logging flow. The
reuse need is served by the Routines feature instead.

## Consequences

- `/additional` stays simple and fast for true one-off logging.
- Two entry points with clearly distinct purposes (browse-and-launch vs. ephemeral flow).
