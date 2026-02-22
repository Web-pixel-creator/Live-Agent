# WebSocket Protocol (Frontend <-> Realtime Gateway)

## Scope

This document is the single authoritative protocol contract for frontend integration with `apps/realtime-gateway` over `ws(s)://<host>/realtime`.

Transport baseline:

1. MVP transport is WebSocket only.
2. WebRTC is deferred to V2 and is not required for judged demo flows.

## Envelope Contract

Every frame (both directions) MUST be an `EventEnvelope`:

```json
{
  "id": "uuid",
  "userId": "string-optional",
  "sessionId": "string",
  "runId": "string-optional",
  "type": "string",
  "source": "frontend|gateway|orchestrator|agent|tool",
  "ts": "ISO-8601",
  "payload": {}
}
```

Rules:

1. `sessionId` is mandatory.
2. `userId` MAY be omitted by client after socket binding is established.
3. `runId` is operation-level and SHOULD be stable per user request.
4. `type` drives routing and behavior.

## Session Binding And Serial Lane

1. On first valid inbound frame, gateway binds socket to `(sessionId, userId)`.
2. Later frames with different `sessionId` are rejected (`GATEWAY_SESSION_MISMATCH`).
3. Later frames with different explicit `userId` are rejected (`GATEWAY_USER_MISMATCH`).
4. Inbound frames are processed in a per-socket serial lane to prevent race conditions.

## Client -> Gateway Events

Supported event types:

1. `orchestrator.request`
2. `live.audio`
3. `live.video`
4. `live.text`
5. `live.turn.end`
6. `live.interrupt`
7. `live.setup` (optional Gemini setup override payload)

Notes:

1. `live.audio` is expected as PCM16 base64 chunks with `sampleRate=16000` in current frontend/gateway baseline.
2. `orchestrator.request` SHOULD carry stable request identity (`runId` and/or `payload.idempotencyKey`) for replay safety.

## Gateway -> Client Events

### Connection and Session

1. `gateway.connected`
2. `session.state`
3. `gateway.error`

`session.state` values:

1. `socket_connected`
2. `session_bound`
3. `live_forwarded`
4. `orchestrator_dispatching`
5. `orchestrator_pending_approval`
6. `orchestrator_completed`
7. `orchestrator_failed`
8. `text_fallback`

### Orchestration and Tasks

1. `orchestrator.response`
2. `task.started`
3. `task.progress`
4. `task.completed`
5. `task.failed`
6. `gateway.request_replayed`

### Live Bridge Output and Metrics

1. `live.output`
2. `live.turn.completed`
3. `live.turn.end_sent`
4. `live.interrupted`
5. `live.interrupt.requested`
6. `live.metrics.round_trip`
7. `live.metrics.interrupt_latency`

### Live Bridge Runtime Diagnostics

1. `live.bridge.setup_sent`
2. `live.bridge.connected`
3. `live.bridge.closed`
4. `live.bridge.error`
5. `live.bridge.unavailable`
6. `live.bridge.chunk_dropped`
7. `live.bridge.reconnect_attempt`
8. `live.bridge.reconnect_wait`
9. `live.bridge.forward_retry`
10. `live.bridge.failover`
11. `live.bridge.auth_profile_failed`
12. `live.bridge.connect_timeout`
13. `live.bridge.health_degraded`
14. `live.bridge.health_watchdog_reconnect`
15. `live.bridge.health_recovered`
16. `live.bridge.health_probe_started`
17. `live.bridge.health_ping_sent`
18. `live.bridge.health_pong`
19. `live.bridge.health_ping_error`

Failover/watchdog diagnostics (where present):

1. `reasonClass`: `transient | rate_limit | auth | billing`
2. `routeReadyAt`, `routeAvailableNow`, `routeWaitMs`
3. `modelState` and `authProfileState` with cooldown/disable windows and failure counters
4. `silenceMs`, `thresholdMs` for watchdog-degradation path
5. `graceMs`, `probeStartedAt`, `probeElapsedMs`, `probePongAt` for ping-assisted watchdog probing

## Error Taxonomy (WS Path)

`gateway.error` payload uses normalized structure:

1. `code` (stable machine code)
2. `message` (human-readable summary)
3. `traceId` (required)
4. `details` (optional structured context)

Common WS codes:

1. `GATEWAY_INVALID_ENVELOPE`
2. `GATEWAY_SESSION_MISMATCH`
3. `GATEWAY_USER_MISMATCH`
4. `GATEWAY_DRAINING`
5. `GATEWAY_ORCHESTRATOR_FAILURE`
6. `GATEWAY_SERIAL_LANE_FAILURE`
7. `GATEWAY_IDEMPOTENCY_CONFLICT`

Retry guidance:

1. Retryable with backoff: transient `GATEWAY_ORCHESTRATOR_FAILURE`, `GATEWAY_DRAINING` (after warmup/recovery).
2. Non-retryable without client fix: `GATEWAY_INVALID_ENVELOPE`, `GATEWAY_SESSION_MISMATCH`, `GATEWAY_USER_MISMATCH`, `GATEWAY_IDEMPOTENCY_CONFLICT`.

Orchestrator conflict code (in `orchestrator.response.payload.error`):

1. `ORCHESTRATOR_IDEMPOTENCY_CONFLICT`

## Correlation And Replay Rules

1. Keep stable `sessionId` and `userId` for a socket lifetime.
2. Use `runId` per logical request and keep it stable across retries.
3. Log and surface `traceId` from `gateway.error` in frontend/operator diagnostics.
4. Gateway may replay duplicate requests (`gateway.request_replayed`) from TTL cache when request identity matches.
