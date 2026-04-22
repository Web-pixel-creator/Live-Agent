# AGENTS

This repository is a production-oriented multimodal agent platform.

## Product Scope

The system covers three challenge categories in one architecture:

1. Live Agent: realtime conversation, interruption, translation, negotiation.
2. Creative Storyteller: text/audio/image/video narrative pipeline.
3. UI Navigator: computer-use planning/execution with safety controls.

## Runtime Topology

1. `apps/realtime-gateway`: websocket ingress, live bridge, transport diagnostics.
2. `agents/orchestrator`: intent routing, idempotency/replay boundary, delegation.
3. `apps/api-backend`: REST control plane, operator summary, governance/skills/device APIs.
4. `agents/*`: domain logic (`live-agent`, `storyteller-agent`, `ui-navigator-agent`).
5. `apps/demo-frontend`: judge/operator-facing UI.

## Commercial Wedge

The current product is not a general multimodal platform. The current product is:

`AI Action Desk for immigration teams`

Primary critical-path workflows:

1. lead qualification
2. consultation booking
3. missing-document follow-up
4. CRM prep and human handoff

If a change does not improve one of those workflows, help the primary ICP right
now, or reduce operator manual work, it should not be on the current critical
path.

## Agent Operating Discipline

Use this file plus `README.md` and `docs/product-master-plan.md` as the
repo-owned source of truth.

External references:

1. `agents-md-main`
2. `andrej-karpathy-skills-main`

Those references are methodological overlays, not runtime dependencies and not
replacement source-of-truth documents.

Required behavior when working in this repo:

1. no flattery, no fabrication, no silent assumption when the ambiguity matters
2. think before coding, state the success criteria, then verify them
3. touch only what the task requires; avoid drive-by refactors
4. prefer the minimum reversible change over broad rewrites
5. keep primary product UX clean; move deep runtime/compliance detail into
   secondary support surfaces when possible

## Primary UX Rule

The primary app shell should stay aligned with the `hello-friend` product IA
unless the user explicitly approves a divergence:

1. `/app`
2. `/app/console`
3. `/app/simulation`
4. `/app/nodes`
5. `/bundle/:id`
6. `/evidence/:id`

Repo-owned runtime, replay, compliance, and diagnostics depth should remain
available, but should not be forced into the main shell when that breaks the
product-first layout.

## External Adoption Filter

Only adopt external projects when they strengthen the current wedge and fit the
repo-owned architecture.

Current priorities:

1. `Euphony` for internal replay / evidence / structured session inspection
2. `Rowboat`-style ideas for inspectable `Case Wiki` / `Case Vault` memory
3. `CubeSandbox` as a later secure execution backend spike for untrusted
   browser or tool execution

Not on the current critical path:

1. `OpenMythos`
2. broad model-portfolio work without direct wedge payoff
3. `MiniMax-M2.7` on the live customer path
4. engineering-methodology repos as product dependencies

## Engineering Rules

1. Keep request/reply contracts stable (`shared/contracts`, `docs/ws-protocol.md`).
2. Keep evidence lanes deterministic (`summary.json`, `badge-details.json`, release artifacts).
3. Changes that affect behavior must update tests and docs in the same PR.
4. Prefer additive, reversible changes over broad rewrites.

## Required Validation

At minimum:

```bash
npm run test:unit
npm run build
```

For release-impacting changes:

```bash
npm run verify:release
```

## Key Documentation

1. `docs/architecture.md`
2. `docs/external-adoption-priorities.md`
3. `docs/operator-guide.md`
4. `docs/local-development.md`
5. `docs/judge-runbook.md`
6. `docs/ws-protocol.md`
