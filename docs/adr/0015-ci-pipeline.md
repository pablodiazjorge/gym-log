# ADR-0015: CI runs lint, typecheck, tests and build on every push and pull request

Date: 2026-10-22
Status: Accepted — supersedes ADR-0009

## Context

ADR-0009 kept the repository without CI: a solo project with rare deploys, where `npm run build`,
`npm run lint` and `npm test` were run by hand before a manual deploy. Two things changed:

- Manual discipline did not catch everything. Nothing ever ran the TypeScript compiler over the
  specs, and they had quietly stopped typechecking: a stale second argument left over from the
  removed day variants (ADR-0012) and a `node:fs` import without Node types. Vitest strips types,
  so every test still passed.
- Changes now arrive through branches and pull requests, one Conventional Commit at a time, and
  the repository is public. A pull request without an automatic check asks the reader to trust
  that someone ran the commands.

## Decision

A single GitHub Actions workflow, `.github/workflows/ci.yml`, on every push to `master` and on
every pull request:

- one `verify` job on `ubuntu-latest`: `npm ci`, then `npm run lint`, `npm run typecheck`
  (`tsc --noEmit` over the app and the spec projects), `npm test` and `npm run build`;
- Node comes from `.nvmrc`, inside the range Angular 22 supports;
- read-only token permissions, and a newer push to the same branch cancels the run in progress;
- `npm run verify` chains the same four steps for running them locally before a push;
- the checks that read the author's real exports stay out of CI: those files live in the
  git-ignored `docs/personal-progress/`, so they only run on request (`GYM_LOG_REAL_DATA=1`).

Deployment does not change: static hosting on Vercel, as in ADR-0001 and ADR-0009. Requiring the
`verify` check before merging is a branch ruleset on `master`, configured in the GitHub settings
rather than in the repository.

## Consequences

- Type errors, lint errors, failing tests and broken builds show up on the pull request, before
  anything reaches `master`.
- Every push costs a few minutes of runner time, and the pinned action versions need an
  occasional bump.
- The workflow is the place to add later checks (end-to-end tests, accessibility) without
  restructuring anything — the upside ADR-0009 already anticipated.
