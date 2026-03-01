# Architecture

## Goal

Provide a single production-style platform for multimodal agents that can:

1. See (`image/video/screen` inputs),
2. Hear (`audio` input and transcription),
3. Speak (`audio` output with realtime turn handling),
4. Act (`UI Navigator` execution with approvals and policy controls).

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
   - Session/device/skills/approval management
4. Domain agents
   - `agents/live-agent`
   - `agents/storyteller-agent`
   - `agents/ui-navigator-agent`
5. Frontend
   - `apps/demo-frontend` for judged demo and operator visibility

## Category Mapping

1. Live Agent
   - Realtime voice path, interruption, translation, negotiation
   - Context compaction and truncation/delete controls
2. Creative Storyteller
   - Planner + branch + media jobs (image/video/tts)
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
4. CI release gates and artifact revalidation workflows

## Source Docs

1. Protocol contract: `docs/ws-protocol.md`
2. Demo runbook: `docs/judge-runbook.md`
3. Local profile: `docs/local-development.md`
4. Transport V2 spike: `docs/webrtc-v2-spike.md`
