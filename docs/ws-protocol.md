# WebSocket Protocol (Frontend <-> Realtime Gateway)

## Scope

This document is the canonical contract for `/realtime` WebSocket integration between frontend clients and `apps/realtime-gateway`.

MVP transport is WebSocket only. WebRTC is out of scope for MVP.

## Envelope

All messages MUST use the shared envelope shape:

```json
{
  "id": "uuid",
  "userId": "string-optional",
  "sessionId": "string",
  "runId": "string-optional",
  "type": "string",
  "source": "frontend|gateway|...",
  "ts": "ISO-8601",
  "payload": {}
}
```

## Client -> Gateway Events

Required:

1. `orchestrator.request`
2. `live.audio`
3. `live.video`
4. `live.text`
5. `live.turn.end`
6. `live.interrupt`
7. `live.setup` (optional setup override)

Notes:

1. `sessionId` and `userId` are binding keys for the socket session.
2. Gateway enforces mismatch protection; messages with different bound `sessionId`/`userId` are rejected.

## Gateway -> Client Events

Connection/session:

1. `gateway.connected`
2. `session.state`
3. `gateway.error`

Task lifecycle:

1. `task.started`
2. `task.progress`
3. `task.completed`
4. `task.failed`
5. `gateway.request_replayed` (duplicate orchestrator request replayed from gateway cache)

Live bridge output/metrics:

1. `live.output`
2. `live.turn.completed`
3. `live.interrupted`
4. `live.metrics.round_trip`
5. `live.metrics.interrupt_latency`
6. `live.bridge.setup_sent`
7. `live.bridge.connected`
8. `live.bridge.closed`
9. `live.bridge.reconnect_attempt`
10. `live.bridge.forward_retry`
11. `live.bridge.unavailable`
12. `live.bridge.chunk_dropped`
13. `live.bridge.failover`
14. `live.bridge.auth_profile_failed`
15. `live.bridge.health_degraded`
16. `live.bridge.health_recovered`

## Error Taxonomy (WS Path)

`gateway.error` payload uses normalized error format with `code`, `message`, `traceId`, optional `details`.

Common codes:

1. `GATEWAY_INVALID_ENVELOPE`
2. `GATEWAY_SESSION_MISMATCH`
3. `GATEWAY_USER_MISMATCH`
4. `GATEWAY_DRAINING`
5. `GATEWAY_ORCHESTRATOR_FAILURE`
6. `GATEWAY_SERIAL_LANE_FAILURE`

Retry guidance:

1. Retryable:
`GATEWAY_DRAINING` (after backoff / warmup), transient `GATEWAY_ORCHESTRATOR_FAILURE`.
2. Non-retryable without client fix:
`GATEWAY_INVALID_ENVELOPE`, `GATEWAY_SESSION_MISMATCH`, `GATEWAY_USER_MISMATCH`.

## Correlation Rules

1. Client must keep stable `sessionId` + `userId` per socket.
2. `runId` is operation-level and may change per request.
3. `traceId` from `gateway.error` should be logged by frontend and operator tooling for diagnostics.
4. Client SHOULD send stable request identity (`runId` and/or `payload.idempotencyKey`) so gateway/orchestrator can replay duplicates safely.
