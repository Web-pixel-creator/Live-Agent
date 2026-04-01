# Architecture

## Goal

Provide a single production-style platform for `AI Action Desk` and
`Simulation Lab`.

If this document drifts from the product strategy, follow:

1. `docs/product-master-plan.md`
2. `docs/product-backlog.md`

The three challenge categories are internal capability lanes, not separate
product promises. The platform should be explained as one system that can:

1. See (`image/video/screen` inputs),
2. Hear (`audio` input and transcription),
3. Speak (`audio` output with realtime turn handling),
4. Act (`UI Navigator` execution with approvals and policy controls).

## Source of Truth

This document describes the runtime implementation of the product. The product
definition lives in `docs/product-master-plan.md`.

## Core Services

1. `apps/realtime-gateway`
   - WebSocket ingress (`/realtime`)
   - Live bridge and interruption lifecycle
   - Session binding + serial lane + replay handling
2. `agents/orchestrator`
   - Intent routing and delegation across agent domains
   - Idempotency and task lifecycle orchestration
3. `apps/api-backend`
   - REST control plane
   - Operator summary and governance APIs
   - Operator-facing workflow control-plane proxy for orchestrator/runtime surfaces, with redacted `apiKeyConfigured` exposure instead of raw assistive-router secrets and provider-aware assistive-router posture (`provider`, `model`, `budgetPolicy`, `promptCaching`, `watchlistEnabled`)
   - Operator-facing bootstrap doctor/auth-profile proxy for repo-owned provider posture, device bootstrap readiness, fallback coverage, and credential rotation state (`/v1/runtime/bootstrap-status`, `/v1/runtime/auth-profiles`, `/v1/runtime/auth-profiles/rotate`)
   - Operator-facing browser worker control-plane proxy for repo-owned `ui-executor` background jobs (`/v1/runtime/browser-jobs`, inspect, resume, cancel) with audit-safe operator actions
   - Session/device/skills/approval management
4. Domain agents
   - `agents/live-agent`
   - `agents/storyteller-agent` with repo-owned runtime media-mode override and `image_edit` continuity posture surfaced through orchestrator control plane
   - `agents/ui-navigator-agent`
   - `apps/ui-executor` as remote HTTP execution adapter with independent runtime sandbox preflight (origin/path policy + setup marker guard), repo-owned runtime control-plane override for deterministic force-simulation/sandbox drills, and resumable background browser worker orchestration for long-horizon UI jobs
   - `shared/skills` as the repo-owned skill runtime/catalog layer (`workspace`, `bundled`, `managed`, plus curated `personas` and `recipes`)
5. Frontend
   - `apps/demo-frontend` for judged demo and operator visibility
   - `Operator Session Ops` support lane for purpose-gated high-risk actions, session replay, and cross-agent discovery snapshots

## Category Mapping

These are implementation lanes under the product, not separate products.

1. Live Agent
   - Realtime voice path, interruption, translation, negotiation, grounded research
   - Context compaction and truncation/delete controls
2. Creative Storyteller
   - Planner + branch + media jobs (image/video/tts)
   - `Simulation Lab` for training, rehearsal, and scenario generation
   - Gemini-first TTS path with provider-pinned Deepgram fallback metadata for audit and release evidence
   - Cache/fallback strategy for deterministic demos
3. UI Navigator
   - Computer-use planning with action execution
   - Loop protection, sandbox policy, approval gates, damage-control rules

## Reliability Model

1. Strict contract envelopes (`EventEnvelope`) across WS flows
2. Idempotency/versioning for mutable API paths
3. Release evidence artifacts:
   - `artifacts/demo-e2e/summary.json`
   - `artifacts/demo-e2e/badge-details.json`
   - `artifacts/release-evidence/report.json`
   - `artifacts/release-evidence/manifest.json`
4. Repo-owned controlled fault profiles (`configs/runtime.fault-profiles.json`) for drain/fallback/sandbox/approval drills, with explicit execution plans, request templates, script templates, and chained follow-up context for API-executable recovery flows
5. Repo-owned workflow control-plane contracts for assistive-router / workflow-store runtime state, exposed locally by orchestrator and operator-facing through `api-backend` with secret-safe redaction and multi-provider reasoning defaults (`Gemini` judged-default, `OpenAI` / `Anthropic` / `DeepSeek` secondary non-judged lanes, `Moonshot` watchlist)
6. Repo-owned bootstrap doctor/auth-profile contract for runtime bootstrap: provider readiness, auth-profile routing, device bootstrap readiness, and fallback posture are inspectable and operator-rotatable without exposing raw secrets
7. Repo-owned async browser worker contract in `ui-executor`, including checkpoints, traces, resumable/cancelable control-plane actions, and operator-facing queue summaries for long-running browser tasks
8. Repo-owned runtime surface contract in `api-backend`: `runtime surface inventory` mirrors agents, routes, playbooks, evidence lanes, and runtime/control-plane capabilities from source-backed registries, while `runtime surface readiness` overlays bootstrap doctor, runtime diagnostics, service/device coverage, and evidence posture into one operator-safe `ready / degraded / critical` verdict; the same layer now also exposes a repo-owned runtime session replay mirror for selected-session status, approvals, replay counters, resume-ready or blocked-by posture, a human-readable next operator action, an explicit next action target, the latest verified proof pointer and stage, compact booking/follow-up/handoff metadata, a workflow boundary summary, boundary owner, approval gate, recovery path hint, recovery handoff, a repo-owned recovery drill summary for failed workflow boundaries, and workflow linkage through one operator-safe snapshot instead of stitching `/v1/sessions`, `/v1/events`, `/v1/runs`, and `/v1/runtime/workflow-config` by hand. In the frontend, Operator Console mirrors that replay snapshot twice: deeper `Operator Session Ops` owns loading/export, while the compact `Session Boundary` card keeps resume posture, workflow boundary, explicit `Boundary Owner`, `Approval Gate`, `Next Action`, `Latest Proof`, `Recovery`, and `Handoff` rows visible in the first runtime scan, with its primary CTA following the repo-owned next action target. `scripts/runtime-surface-snapshot.mjs` emits the inventory/readiness pair into `artifacts/runtime/runtime-surface-snapshot.json` for portable offline/local/CI inspection, `scripts/runtime-surface-parity-check.mjs` validates that artifact against `configs/runtime-surface-manifest.json`, and `scripts/runtime-surface-doc-drift-check.mjs` verifies that package/docs claims still match the repo-owned runtime-surface routes, scripts, and artifacts
8. Repo-owned operator session-ops contract in the frontend + API audit lane: purpose declarations, session replay, and cross-agent discovery are exportable and attach to high-risk operator audit records
9. CI release gates and artifact revalidation workflows

## Source Docs

1. Protocol contract: `docs/ws-protocol.md`
2. Demo runbook: `docs/judge-runbook.md`
3. Local profile: `docs/local-development.md`
4. Transport V2 spike: `docs/webrtc-v2-spike.md`

