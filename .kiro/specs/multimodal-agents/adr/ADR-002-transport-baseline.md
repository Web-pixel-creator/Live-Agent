# ADR-002: Transport Baseline for MVP

- Status: Accepted
- Date: 2026-02-19
- Owners: Realtime Team

## Context

MVP requires low-latency bidirectional communication for voice-first interactions, interruption signals, and event streaming to UI clients.

## Decision

1. Baseline client transport in MVP is WebSocket.
2. Live API bridge inside backend remains stateful WebSocket bidi-streaming.
3. WebRTC is optional and can be enabled per client platform as a V2 enhancement.
4. Event envelope format is transport-agnostic and remains identical for WS and future WebRTC data channels.

## Consequences

Positive:

1. Faster implementation with fewer moving parts in MVP.
2. Uniform protocol across browser and non-browser clients.
3. Easier traceability and debugging.

Tradeoffs:

1. Some browser scenarios may have slightly higher media latency than optimized WebRTC paths.
2. Future WebRTC introduction needs adapter layer.

## Implementation Notes

1. Keep canonical envelope in `shared/contracts`.
2. Maintain heartbeat and reconnect policies at gateway level.
3. Preserve compatibility hooks for optional WebRTC rollout in V2.

