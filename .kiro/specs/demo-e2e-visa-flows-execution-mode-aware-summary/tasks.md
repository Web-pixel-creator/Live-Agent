# Implementation Plan

## Overview

This follow-up fixes the final validation layer opened by
`.kiro/specs/demo-e2e-browser-job-paused-race-condition/`.

The previous fix removed the polling timeout. This plan makes
`summarizeNavigatorVisaFlowResults()` and its downstream gates
execution-mode-aware without weakening real-Playwright release proof.

## Cross-cutting Rules

- Touch only navigator visa-flow scripts, their unit tests, and release / PR
  gate consumers that directly read the navigator visa-flow artifact.
- Do not touch local-services dispatcher product files.
- Do not modify `LiveDesk.tsx`, local-services adapters, local-services API
  persistence, outreach execution pack, or setup/dashboard UI.
- Do not remove `ui.navigator.visa_vertical_flows` from release-strict
  workflows.
- Do not fake real persistent-session or replay-bundle proof in simulation.
- Keep all schema changes additive.

## Tasks

- [ ] 1. Capture current failure shape and consumer map
  - Inspect CI run `26368008011` and any locally generated
    `artifacts/demo-e2e/navigator-visa-flows.json`.
  - Map every consumer of `validated`, `persistentSessionCount`,
    `replayBundleCount`, and `navigatorVisaFlowsValidated`.
  - Confirm which workflows are PR-quality simulation lanes and which are
    release-strict real-Playwright lanes.
  - DoD: consumer list is recorded in this spec or the PR description before
    code changes.

- [ ] 2. Add failing unit coverage for the summary layer
  - In `tests/unit/demo-e2e-navigator-visa-flows.test.ts`, add a test showing
    that simulated successful flow results currently produce
    `validated === false` because real persistent-session / replay criteria are
    incorrectly applied.
  - Add preservation coverage for all-real-Playwright successful results.
  - DoD: the simulation test fails before the implementation change; the
    real-Playwright preservation test documents current strict behavior.

- [ ] 3. Refactor `summarizeNavigatorVisaFlowResults()` additively
  - Add `validationMode`, `executionModeCounts`,
    `realPlaywrightValidated`, `simulatedValidated`, and
    `strictPersistentSessionValidated`.
  - Keep existing counters and existing real-Playwright strict criteria.
  - Let simulation validate only the simulation contract; do not inflate
    persistent or replay counters.
  - DoD: summary artifact is mode-aware and remains backward-compatible.

- [ ] 4. Update downstream gates deliberately
  - Update `scripts/demo-e2e.ps1` and release-readiness consumers so PR Quality
    can accept explicit simulation proof while release-strict still requires
    real persistent-session proof.
  - Add / update tests for the split behavior.
  - DoD: PR-quality simulation acceptance and release-strict real-proof
    requirements are both covered by tests.

- [ ] 5. Validate and push
  - Run targeted unit tests:
    `node --import tsx --test tests/unit/demo-e2e-navigator-visa-flows.test.ts`
  - Run `npm run test:unit`.
  - Run `npm run build`.
  - If release gate consumers changed, run `npm run verify:release`.
  - Push a single focused commit.
  - DoD: CI failure moves off the navigator visa-flow validation layer or PR
    Quality turns green without weakening release-strict proof.

