# Product Backlog

This document turns the product strategy from
`docs/product-master-plan.md` into a concrete implementation backlog.

Use it as the working queue for product and engineering decisions.

## Source of Truth

This backlog is the execution queue. If it conflicts with
`docs/product-master-plan.md`, follow the master plan.

The backlog exists to ship `AI Action Desk` by priority, not to preserve old
challenge-mode framing.

## How To Use This Backlog

Rules:

1. Complete `P0` before broadening scope.
2. Prefer shipping one thin vertical slice through the whole stack over
   partially upgrading every subsystem at once.
3. Every task should end with:
   - code change,
   - test coverage,
   - docs update if behavior changes,
   - clear acceptance criteria.
4. If a task adds surface area without improving a target metric, defer it.

## Current Product Wedge

The product to build first is:

`AI Action Desk for multilingual service teams`

The first commercial playbooks should stay centered on:

1. lead qualification,
2. appointment or consultation booking,
3. document and form collection.

## P0 - Must Ship

These tasks directly support the revenue wedge and runtime reliability.

### P0.1 Product Narrative Refactor

Goal:

Make the repo, demo, and UI explain one product instead of three loosely
connected capabilities.

Files:

1. `README.md`
2. `docs/operator-guide.md`
3. `apps/demo-frontend/public/app.js`

Tasks:

1. Replace broad "three categories" first-run messaging with `AI Action Desk`
   framing.
2. Reword the main live entry points around the three primary playbooks:
   qualification, booking, document collection.
3. Keep Storyteller in navigation, but reframe it in UI copy as `Simulation Lab`
   or `Training Lab` where appropriate.

Acceptance:

1. The home/demo surface can be explained in one sentence.
2. The primary user path lands in `Live + Actions`, not in mode confusion.
3. Storyteller remains accessible but is no longer the main product promise.

Validation:

1. `npm run build`
2. targeted frontend alignment tests if touched

### P0.2 Persistent Browser Runtime

Goal:

Upgrade `ui-executor` from per-task browser handling toward a persistent action
runtime with better state carryover.

Files:

1. `apps/ui-executor/src/index.ts`
2. `apps/ui-executor/src/browser-jobs.ts`
3. `apps/ui-executor/src/runtime-config-store.ts`
4. `apps/ui-executor/src/contracts/*`

Tasks:

1. Introduce a durable browser-session abstraction for resumable jobs.
2. Separate browser lifecycle from single-command execution flow.
3. Preserve run-safe session state for a job when policy allows it.
4. Record explicit session metadata in browser job state.

Acceptance:

1. A resumable browser job can continue without rebuilding the full browser
   context on every step.
2. Session state is explicit in logs and job metadata.
3. Failure paths remain safe and deterministic.

Validation:

1. `tests/unit/ui-executor-browser-jobs.test.ts`
2. `tests/unit/ui-executor-runtime-config-store.test.ts`
3. `npm run build`

### P0.3 Stable UI Ref System

Goal:

Give the UI executor a more robust element addressing model.

Files:

1. `apps/ui-executor/src/grounding.ts`
2. `apps/ui-executor/src/index.ts`
3. `agents/ui-navigator-agent/src/index.ts`

Tasks:

1. Add a stable ref-map format for actionable elements.
2. Add stale-ref detection before executing browser actions.
3. Improve fallback handling when SPA mutations invalidate earlier grounding.
4. Return actionable recovery messages such as "refresh snapshot", "ask for
   confirmation", or "need stronger grounding".

Acceptance:

1. The executor can distinguish stale grounding from generic action failure.
2. UI runs fail with actionable recovery instructions instead of opaque errors.
3. Planner and executor exchange a stable ref representation.

Validation:

1. `tests/unit/ui-executor-grounding.test.ts`
2. `tests/unit/ws-protocol-ui-grounding-note.test.ts`
3. `npm run build`

### P0.4 Post-Action Verification

Goal:

The agent should prove that the intended action actually happened.

Files:

1. `apps/ui-executor/src/index.ts`
2. `agents/ui-navigator-agent/src/index.ts`
3. `shared/contracts/src/*`

Tasks:

1. Add an explicit verification phase after meaningful UI actions.
2. Define verification outcomes:
   - verified,
   - partially_verified,
   - unverified,
   - blocked_pending_approval.
3. Surface verification results in user-safe output and operator evidence.

Acceptance:

1. A run does not count as success merely because a click happened.
2. Verification state is present in task output and operator summary.

Validation:

1. `tests/unit/ui-navigator-sandbox.test.ts`
2. `tests/unit/runtime-browser-jobs-api-alignment.test.ts`
3. `tests/unit/contracts.test.ts`

### P0.5 Replay Bundle For UI Runs

Goal:

Every meaningful UI run should leave a clean replay trail.

Files:

1. `apps/ui-executor/src/browser-jobs.ts`
2. `apps/api-backend/src/*`
3. `docs/operator-guide.md`

Tasks:

1. Persist screenshots, step summaries, verification result, and target URL per
   run.
2. Standardize replay metadata shape for operator viewing and export.
3. Make replay artifacts accessible from operator and release evidence paths.

Acceptance:

1. Operators can inspect a run without opening raw logs.
2. Replay data is consistent enough to use in bug reports and release evidence.

Validation:

1. `tests/unit/runtime-browser-jobs-api-alignment.test.ts`
2. `tests/unit/frontend-operator-browser-workers-alignment.test.ts`

### P0.6 Role Graph In Orchestrator

Goal:

Replace implicit "one big agent turn" behavior with explicit staged execution.

Files:

1. `agents/orchestrator/src/orchestrate.ts`
2. `agents/orchestrator/src/router.ts`
3. `agents/orchestrator/src/workflow-store.ts`
4. `agents/orchestrator/src/assistive-router.ts`

Tasks:

1. Introduce execution stages such as:
   - intake,
   - planning,
   - safety_review,
   - execution,
   - verification,
   - reporting.
2. Store current stage and active role in workflow state.
3. Expose stage-aware status to API and operator surfaces.

Acceptance:

1. Every meaningful run has a visible current stage.
2. Operators can tell whether a run is waiting on planning, approval,
   execution, or verification.

Validation:

1. `tests/unit/orchestrator-workflow-store.test.ts`
2. `tests/unit/runtime-workflow-control-plane.test.ts`
3. `tests/unit/operator-summary-*alignment.test.ts` for impacted fields

### P0.7 Vertical Playbooks

Goal:

Turn generic capabilities into sellable role packages.

Files:

1. `shared/skills`
2. `configs/*` if needed for role definitions
3. `README.md`
4. `docs/product-master-plan.md`

Tasks:

Add the first three role bundles:

1. multilingual lead qualifier,
2. consultation booking assistant,
3. document collection assistant.

Each playbook should define:

1. input expectations,
2. approval boundaries,
3. browser action scope,
4. success metrics,
5. failure and escalation policy.

Acceptance:

1. The product demo can be run using named playbooks instead of abstract modes.
2. Each playbook maps cleanly to one buyer problem.

Validation:

1. `tests/unit/skills-*`
2. `tests/unit/managed-skills-registry*`

### P0.8 Promptfoo Eval Plane

Goal:

Make prompt and workflow quality measurable.

Files:

1. new folder: `evals/` or `configs/evals/`
2. `package.json`
3. release scripts in `scripts/`

Tasks:

1. Introduce `promptfoo` configs for:
   - translation,
   - negotiation,
   - research,
   - UI safety.
2. Add CI-ready commands for eval runs.
3. Add at least one release gate that fails when workflow quality regresses.

Acceptance:

1. Workflow quality can be compared across model and prompt variants.
2. Regressions are caught before release.

Validation:

1. eval run commands execute locally
2. `npm run build`

### P0.9 Red-Team Bundle

Goal:

Harden the action agent against unsafe requests and prompt attacks.

Files:

1. eval configs
2. `agents/live-agent/src/index.ts`
3. `agents/ui-navigator-agent/src/index.ts`
4. `apps/ui-executor/src/sandbox-policy.ts`

Tasks:

1. Add adversarial prompts for:
   - secret extraction,
   - destructive browser actions,
   - approval bypass,
   - prompt injection from page content.
2. Score pass/fail conditions.
3. Feed results into release readiness.

Acceptance:

1. Unsafe requests are consistently blocked, escalated, or sandboxed.
2. Prompt injection handling is measurable.

Validation:

1. new eval commands
2. impacted policy tests

## P1 - Strong Follow-Up

These tasks sharpen differentiation and operational quality.

### P1.1 Storyteller To Simulation Lab

Goal:

Turn storyteller into a training and rehearsal engine.

Files:

1. `agents/storyteller-agent/src/index.ts`
2. `agents/storyteller-agent/src/media-jobs.ts`
3. `apps/demo-frontend/public/app.js`

Tasks:

1. Add explicit simulation modes for:
   - sales rehearsal,
   - support rehearsal,
   - onboarding simulation,
   - negotiation drill.
2. Add role-aware scenario generation.
3. Keep media optional so simulation remains fast when needed.

Acceptance:

1. Storyteller can generate business-useful simulations, not only creative
   scenes.
2. UI copy reflects `Simulation Lab` use.

Validation:

1. `tests/unit/storyteller-*`
2. `tests/unit/frontend-story-*`

### P1.2 Operator Stage Awareness

Goal:

Make the operator console more useful for real customer operations.

Files:

1. `apps/demo-frontend/public/app.js`
2. `apps/api-backend/src/*`
3. `docs/operator-guide.md`

Tasks:

1. Show stage, active role, verification status, and approval boundary in the
   operator summary.
2. Add filtered views for:
   - awaiting approval,
   - verification failed,
   - browser run incomplete,
   - escalation required.

Acceptance:

1. Operators can understand the current bottleneck without opening deep logs.

Validation:

1. impacted frontend operator alignment tests

### P1.3 Source-Driven Runtime Docs

Goal:

Reduce drift between runtime behavior and docs.

Files:

1. `README.md`
2. `docs/operator-guide.md`
3. scripts that generate evidence or manifests

Tasks:

1. Generate or validate selected docs from runtime metadata where practical.
2. Add doc drift tests for runtime-facing commands, routes, and exported
   evidence fields.

Acceptance:

1. Runtime docs cannot silently diverge from real behavior.

### P1.4 Internal Review Factory

Goal:

Adopt a `gstack`-style engineering workflow for your own team.

Files:

1. new internal workflow docs or prompts under `docs/` or `shared/skills/`
2. release scripts under `scripts/`

Tasks:

1. Add internal review templates for:
   - product rethink,
   - engineering review,
   - QA review,
   - release doc update.
2. Use them as contributor instructions, not customer features.

Acceptance:

1. The repo has a repeatable internal process for shipping agent features safely.

## P2 - Expansion

These are valuable, but only after the wedge is working.

### P2.1 Channel Expansion

Goal:

Extend the assistant into more entry points after the core wedge is stable.

Files:

1. channel adapters in API/backend or future connector layer

Tasks:

1. Add channel-specific ingestion for the winning customer segment.
2. Keep action and approval logic shared.

### P2.2 Managed Partner Skills

Goal:

Open the platform for trusted partner extensions later.

Files:

1. `shared/skills`
2. skills marketplace and registry APIs

Tasks:

1. Add partner-grade playbooks and skill bundles.
2. Keep signing and installation governance strict.

### P2.3 Local-First Runtime Profile

Goal:

Improve cost, privacy, and offline posture where it helps the wedge.

Files:

1. `docs/local-first-profile.md`
2. runtime provider strategy files

Tasks:

1. Expand local or hybrid runtime paths only for proven customer needs.

## Suggested Build Order

Take the next sequence literally unless blocked:

1. `P0.1` Product Narrative Refactor
2. `P0.7` Vertical Playbooks
3. `P0.2` Persistent Browser Runtime
4. `P0.3` Stable UI Ref System
5. `P0.4` Post-Action Verification
6. `P0.5` Replay Bundle
7. `P0.6` Role Graph
8. `P0.8` Promptfoo Eval Plane
9. `P0.9` Red-Team Bundle
10. `P1.1` Storyteller To Simulation Lab
11. `P1.2` Operator Stage Awareness

## Sprint Heuristic

A good sprint contains:

1. one commercial wedge improvement,
2. one runtime reliability improvement,
3. one eval or safety improvement.

Avoid sprints made entirely of:

1. UI polish without workflow lift,
2. model experimentation without evals,
3. new capability lanes without clear buyer value.

## Done Means Done

Do not mark backlog items complete unless all are true:

1. code shipped,
2. tests added or updated,
3. docs updated,
4. acceptance criteria met,
5. user or operator evidence path exists when behavior changed.
