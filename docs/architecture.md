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
- Operator-facing bootstrap doctor/auth-profile proxy for repo-owned provider posture, device bootstrap readiness, fallback coverage, live direct bootstrap posture, browser-direct replay proof ingest, and credential rotation state (`/v1/runtime/bootstrap-status`, `/v1/runtime/live/capabilities`, `/v1/runtime/live/session-token`, `/v1/runtime/live/session-events`, `/v1/runtime/auth-profiles`, `/v1/runtime/auth-profiles/rotate`)
   - Operator-facing browser worker control-plane proxy for repo-owned `ui-executor` background jobs (`/v1/runtime/browser-jobs`, inspect, resume, cancel) with audit-safe operator actions
   - Session/device/skills/approval management
4. Domain agents
   - `agents/live-agent`
   - `agents/storyteller-agent` with repo-owned runtime media-mode override and `image_edit` continuity posture surfaced through orchestrator control plane
   - `agents/ui-navigator-agent`
- `apps/ui-executor` as remote HTTP execution adapter with independent runtime sandbox preflight (origin/path policy + setup marker guard), repo-owned runtime control-plane override for deterministic force-simulation/sandbox drills, resumable background browser worker orchestration for long-horizon UI jobs, and one-pass stale-ref selector healing from `refMap` id/name/label hints before escalating `staleRefTargets`
   - `shared/skills` as the repo-owned skill runtime/catalog layer (`workspace`, `bundled`, `managed`, plus curated `personas` and `recipes`)
5. Frontend
   - `apps/demo-frontend` for judged demo and operator visibility
   - `Operator Session Ops` support lane for purpose-gated high-risk actions, session replay, compiled `Case Wiki` snapshots, operator note append, and cross-agent discovery snapshots

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
6. Repo-owned bootstrap doctor/auth-profile contract for runtime bootstrap: provider readiness, auth-profile routing, device bootstrap readiness, fallback posture, live direct bootstrap posture (`relay` vs `direct_live`, provider/model, fallback reason, session-token bootstrap), and browser-direct replay proof ingest (`session-events`) are inspectable and operator-rotatable without exposing raw secrets
7. Repo-owned async browser worker contract in `ui-executor`, including checkpoints, traces, resumable/cancelable control-plane actions, and operator-facing queue summaries for long-running browser tasks
8. Repo-owned runtime surface contract in `api-backend`: `runtime surface inventory` mirrors agents, routes, playbooks, evidence lanes, and runtime/control-plane capabilities from source-backed registries, while `runtime surface readiness` overlays bootstrap doctor, runtime diagnostics, service/device coverage, and evidence posture into one operator-safe `ready / degraded / critical` verdict. The same layer exposes a repo-owned runtime session replay mirror for selected-session status, approvals, replay counters, resume-ready or blocked-by posture, next operator action/target/workspace, primary-step state, step progress/path, latest verified proof pointer and stage, compact booking/follow-up/handoff metadata, workflow boundary summary, boundary owner, approval gate, recovery path hint, recovery handoff, recovery drill summary, nullable `live transport` evidence for the actually used `relay` vs `direct_live` path, latest first-audio/first-output latency, a compact fallback-event count, a root `evidenceSignature` envelope for tamper-evident exports, and workflow linkage through one operator-safe snapshot instead of stitching `/v1/sessions`, `/v1/events`, `/v1/runs`, and `/v1/runtime/workflow-config` by hand. It now also exposes a repo-owned `Case Wiki` route (`GET /v1/runtime/case-wiki`) plus operator note append route (`POST /v1/runtime/case-wiki/notes`) so compiled case memory can be built from raw runtime evidence without inventing a second ad hoc storage plane.
8.1. Stale-refresh recovery is documented through the structured refresh state contract (`refreshState`): `action`, `targetState`, summary hints, `followupPath`, `followupTree`, and compatibility metadata.
8.2. Operator clients should prefer `refreshState.followupTree` and `refreshState.followupPath` for the refresh recovery followup path; the flat `refreshEscalation...` projection remains transitional for older consumers.
8.3. In the frontend, `Operator Session Ops` owns replay loading/export, while the compact `Session Boundary` card shows the structured `After refresh` ladder and keeps resume posture, workflow boundary, proof, recovery, handoff, checklist, primary-step CTA, and current `live transport` posture visible in the first runtime scan.
8.4. `scripts/runtime-surface-snapshot.mjs` emits the inventory/readiness pair into `artifacts/runtime/runtime-surface-snapshot.json`, `scripts/runtime-surface-parity-check.mjs` validates it against `configs/runtime-surface-manifest.json`, and `scripts/runtime-surface-doc-drift-check.mjs` verifies that package/docs claims still match the repo-owned runtime-surface routes, scripts, and artifacts.
8.5. Repo-owned operator session-ops contract in the frontend + API audit lane: purpose declarations, session replay, compiled `Case Wiki` memory, and cross-agent discovery are exportable/inspectable and attach to high-risk operator audit records. The same compiled `Case Wiki` snapshot also feeds operator-facing `Case Wiki Evidence`, `Case Wiki Focused Handoff`, and `Case Wiki Focused Routing` preview cards inside `Operator Session Ops` and a compact `Case Workspace` summary card, so product-facing triage can reuse operator-safe compiled memory instead of re-reading raw replay lines; both surfaces can expose summary posture plus a compact evidence rail (`top proof`, `key entity`) from the repo-owned `highlights` block, a short repo-owned `evidencePack` (`proofs`, `entities`, `questions`, `sourceRefs`), a backend-built `handoffPack` for compact proof/question handoff posture, a backend-built `detailPack` for proof/question detail rows and per-item badges, a backend-built `routingPack` for compact proof/question route + CTA posture, a backend-built `actionPack` for copy-ready proof/question mini-actions, a backend-built `focusPack` for focus summaries, chip labels, chip titles, drilldowns, and handoff previews, a backend-built `previewPack` for pack/ref/proof/question/handoff summary strings, a backend-built `workspacePack` for the top `Case Workspace` summary card fields plus compact open-question, timeline, and per-case cost strings, plus structured `workspacePack.costSummary` unit-economics evidence (`tokens`, `liveMinutes`, `uiExecutorMinutes`, `storageMb`, priced USD components when configured), a backend-built `operatorPreviewPack` for the compact `Case Wiki Overview` / `Case Wiki Evidence` / `Case Wiki Open Questions` / `Case Wiki Compliance` / `Case Wiki Audit` / `Case Wiki Timeline` operator panes, clickable proof/question focus chips sourced from `focusPack`, expandable proof/question detail rows, compact per-item badges, source-aware `Copy handoff` / `Copy refs` mini-actions, one-tap jumps into the operator focused routing block, source-linked handoff/routing previews plus a ready-to-run one-click routing CTA on the same compiled snapshot, and one top-level `compliance` posture for governance template, redaction, retention, and signing expectations, while exports can carry the currently focused handoff block, focused routing block, workspace card model, top-level compliance posture, audit trail, and operator preview payload when the operator narrows the case to one proof or question.
8.5.1. The same compiled snapshot now also carries a repo-owned `compliance` posture plus `auditLog`, alongside `operatorPreviewPack.compliance` and `operatorPreviewPack.audit`, so governance template/redaction/retention/signing posture, approval audit rows, operator note inserts, workflow refreshes, and runtime verification updates become one compact `Compliance` + `Audit` lane (`actor`, `source`, `action`, `field`, `oldValue`, `newValue`, `reason`, `sourceRefs`) instead of forcing downstream tooling to diff raw replay lines.
8.6. Case Workspace default Case Wiki focus is serialized as backend-built `workspacePack.defaultFocus` derived from repo-owned `highlights` plus `focusPack` until an operator explicitly selects a proof/question chip, keeping product-facing drilldown, copy/open actions, handoff preview, and active chip state on the same compiled blocker/proof posture as the operator-safe snapshot while the frontend fallback remains only for older snapshots.
8.7. `live-agent` conversation turns now accept compiled Case Wiki snapshots through `payload.input.caseWiki`, `caseWikiSnapshot`, `runtimeCaseWiki`, `compiledCaseWiki`, or `context.caseWiki` and place that compiled memory above session summaries and recent transcript turns in the runtime prompt. Diagnostics expose `contextSource: "caseWiki"` plus the active focus, blocker, next action, summary, and source refs when this layer is present; raw transcript/session memory remains the fallback evidence lane. Orchestrator delegation preserves the same `caseWiki` payload so specialist agents do not lose compiled memory on route handoff.
8.8. Runtime Case Wiki snapshots and runtime session replay mirror snapshots now include additive tamper-evidence metadata through `evidenceSignature`: canonical JSON SHA256 is always emitted, and `api-backend` signs the snapshot with Ed25519 when `RUNTIME_EVIDENCE_SIGNING_ENABLED=true` and a runtime evidence private key is configured. Local/dev snapshots without a signing key remain `unsigned` but still expose the canonical payload hash for deterministic artifact comparison.
8.9. Runtime diagnostics now produce an additive latency SLO rollup for `liveFirstAudioP95`, `navigatorStepP95`, and `caseWikiQueryP95`, using recent replay events when available and service operation p95 metrics as fallback evidence. The same diagnostics contract also exposes runtime evidence signing posture (`enabled`, `keyState`, `expectedSignatureStatus`, `publicKeyFingerprint`) and raises `evidence_signing_key_unavailable` when the signer is enabled without a valid key. Breaches are projected into Runtime Guardrails `activeSignals` and the demo/release evidence lane so production proof covers live transport, UI action, compiled memory query latency, and evidence-signing readiness instead of only service presence.
8.10. Orchestrator route admission now consumes `CaseWiki.workspacePack.costSummary` when compiled memory is present. The workflow `costGuard` keeps normal routing within budget, switches high-but-allowed cases to deterministic routing plus a `runtimeBudgetGuard.shortContextPreferred` hint, and pauses hard-limit cases at an approval gate before invoking downstream route agents when approval is required.
9. CI release gates and artifact revalidation workflows

## Source Docs

1. Protocol contract: `docs/ws-protocol.md`
2. Demo runbook: `docs/judge-runbook.md`
3. Local profile: `docs/local-development.md`
4. Transport V2 spike: `docs/webrtc-v2-spike.md`
