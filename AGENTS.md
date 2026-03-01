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
2. `docs/operator-guide.md`
3. `docs/local-development.md`
4. `docs/judge-runbook.md`
5. `docs/ws-protocol.md`
