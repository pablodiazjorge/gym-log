# ADR-0009: No CI pipeline; manual deploy to Vercel

Date: 2026-08-08
Status: Accepted

## Context

Solo developer, low deploy frequency, explicit preference to avoid GitHub Actions overhead for a
personal project. The app is already deployed on Vercel from the main branch.

## Decision

No CI/CD automation in the repo. Build, lint and tests are run locally (`npm run build`,
`npm run lint`, `npm test`) before a manual deploy.

## Consequences

- Zero pipeline maintenance; deploys stay a conscious, manual act.
- Nothing enforces green tests before deploy — discipline required.
- Easy to add CI later without restructuring anything.
