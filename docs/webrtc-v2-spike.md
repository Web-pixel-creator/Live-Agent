# WebRTC V2 Transport Spike (T-223)

Date: 2026-02-22

Scope: technical spike only. No MVP transport migration in this change set.

## Objective

1. Compare WebSocket-first transport against a future WebRTC path for live audio/video.
2. Define migration seam and rollout strategy without destabilizing current challenge baseline.
3. Document risks, metrics, and cutover gates.

## Current MVP Baseline

1. Transport: WebSocket (`apps/realtime-gateway`) with session binding and serial lane guarantees.
2. Live bridge: Gemini Live API integration with interruption handling and watchdog recovery.
3. Verified policy gate: `demo:e2e:fast` + `demo:e2e:policy` green on WebSocket baseline.

## Spike Findings

1. WebSocket is sufficient for MVP voice round-trip SLO in current deployment profile.
2. WebRTC is expected to improve resilience on lossy/high-jitter links for continuous audio/video.
3. Migration complexity is concentrated in:
   - media framing/session negotiation
   - ICE/STUN/TURN operations
   - server-side observability and diagnostics parity
4. Operational complexity of WebRTC is materially higher than WebSocket and should be staged after core judged demo stability.

## Adapter Seam (Planned)

Introduce a transport adapter boundary in gateway:

1. `transport=websocket` (current default)
2. `transport=webrtc` (future experimental path)

Shared contracts to preserve:

1. `EventEnvelope` correlation context (`userId/sessionId/runId`)
2. idempotent orchestrator request behavior
3. session lifecycle events and operator observability

## Migration Plan (V2)

Phase 1: Experimental path behind flag

1. Add `GATEWAY_TRANSPORT_MODE=websocket|webrtc`.
2. Implement WebRTC ingestion path as opt-in.
3. Mirror KPI telemetry and error taxonomy from WebSocket path.

Phase 2: Shadow validation

1. Run selected sessions in shadow mode and compare KPI deltas.
2. Validate interruption latency, reconnect behavior, and session mismatch protections.

Phase 3: Gradual rollout

1. Start with low-risk sessions and limited percentage.
2. Keep instant rollback to WebSocket.
3. Promote only after stable p95 and error budgets.

## KPI Gates for Promotion

1. Interruption reaction latency: no regression vs WebSocket baseline.
2. End-to-end voice round-trip p95: within target budget.
3. Error rate (transport + orchestration): no material increase.
4. Session binding integrity: 100% parity with existing mismatch guards.

## Risks and Mitigations

1. NAT/TURN complexity: deploy managed TURN and explicit timeout policy.
2. Debuggability regression: keep structured diagnostics equivalent to WebSocket path.
3. Rollout blast radius: use feature flag + canary + immediate fallback.

## Decision

1. Keep WebSocket as MVP transport.
2. Proceed with WebRTC only as V2 flagged migration.
3. Do not alter challenge demo baseline transport in current release.

