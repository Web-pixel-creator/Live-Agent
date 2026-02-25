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
  "conversation": "default|none (optional)",
  "metadata": {},
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
4. `conversation` MAY be set to `none` for out-of-band requests that should not mutate default dialog context.
5. `metadata` MAY contain client diagnostics and request labels.
6. Gateway MAY enrich `metadata.autoDispatch` for runtime-managed flows (for example realtime function auto-dispatch).
7. `type` drives routing and behavior.

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
4. `live.image`
5. `live.text`
6. `live.turn.end`
7. `live.interrupt`
8. `live.setup` (optional Gemini setup override payload)
9. `live.input.clear` (push-to-talk/manual input control)
10. `live.input.commit` (push-to-talk/manual input control)
11. `conversation.item.truncate` (remove unplayed assistant audio from active turn context)
12. `conversation.item.create` (structured conversation item lane for text/image/audio content parts)
13. `live.function_call_output` (client-provided function/skill execution result for active live turn)

Notes:

1. `live.audio` is expected as PCM16 base64 chunks with `sampleRate=16000` in current frontend/gateway baseline.
2. `orchestrator.request` SHOULD carry stable request identity (`runId` and/or `payload.idempotencyKey`) for replay safety.
3. `orchestrator.request` with `conversation=none` is treated as out-of-band lane: gateway forwards request but does not emit task lifecycle events for that request.
4. `conversation.item.create` accepts OpenAI-style content parts (`input_text`, `input_image`, `input_audio`) and gateway maps them into Gemini `clientContent.turns[*].parts`.
5. `input_audio` parts SHOULD provide base64 audio bytes (`audio` or `audioBase64`) and SHOULD include `mimeType` (for example `audio/wav` or `audio/pcm;rate=16000`) for deterministic decoding.
6. `live.setup` overrides are merged on top of gateway base setup and optional env patch (`LIVE_SETUP_PATCH_JSON`), with `live.setup` taking highest precedence.
7. `live.setup` MAY override runtime setup fields such as `model`, `generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`, `generationConfig.realtimeInputConfig.activityHandling`, and `systemInstruction`.
8. `orchestrator.request` for `intent=ui_task` MAY include grounding signals (`url`, `deviceNodeId`, `screenshotRef`, `domSnapshot`, `accessibilityTree`, `markHints`) to improve computer-use action stability.

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

Out-of-band behavior (`conversation=none`):

1. `orchestrator.response` is returned with `conversation=none`.
2. `orchestrator.response.metadata` includes `oob=true` and `parentEventId` for correlation.
3. Task lifecycle events (`task.*`) are emitted only for default conversation lane.

### Live Bridge Output and Metrics

1. `live.output`
2. `live.output.audio.delta`
3. `live.output.transcript.delta`
4. `live.turn.completed`
5. `live.turn.end_sent`
6. `live.interrupted`
7. `live.interrupt.requested`
8. `live.metrics.round_trip`
9. `live.metrics.interrupt_latency`
10. `live.input.cleared`
11. `live.input.committed`
12. `live.turn.truncated`
13. `live.function_call`
14. `live.function_call_output.sent`
15. `live.function_call.dispatching`
16. `live.function_call.completed`
17. `live.function_call.failed`

Granular output guidance:

1. `live.output.audio.delta` and `live.output.transcript.delta` are the preferred low-latency rendering events for realtime UI.
2. `live.output` remains as compatibility envelope and may include `normalized.granular=true` when granular deltas were already emitted.

Realtime function-call auto-dispatch behavior:

1. When `LIVE_FUNCTION_AUTO_INVOKE=true`, gateway may enrich `live.function_call.metadata.autoDispatch=gateway_auto_invoke`.
2. Gateway may execute mapped function calls via orchestrator as side-lane (`conversation=none`) requests.
3. Auto-dispatch lifecycle is exposed via `live.function_call.dispatching/completed/failed` and the final model callback still uses `live.function_call_output` -> `live.function_call_output.sent`.

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
3. `selectionStrategy`: `ready_lru | earliest_ready | active_fallback`
4. `modelState` and `authProfileState` with cooldown/disable windows and failure counters
5. `silenceMs`, `thresholdMs` for watchdog-degradation path
6. `graceMs`, `probeStartedAt`, `probeElapsedMs`, `probePongAt` for ping-assisted watchdog probing

## Error Taxonomy (WS Path)

`gateway.error` payload uses normalized structure:

1. `code` (stable machine code)
2. `message` (human-readable summary)
3. `traceId` (required)
4. `details` (optional structured context)
5. `details.clientEventId` (optional echo of client envelope `id` when available)

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
4. Frontend SHOULD correlate `gateway.error.details.clientEventId` with locally tracked outbound envelopes to surface `clientEventType` and request latency for faster debugging.
5. Gateway may replay duplicate requests (`gateway.request_replayed`) from TTL cache when request identity matches.
6. Frontend operator console SHOULD persist the latest `gateway.error` or `orchestrator.error` correlation tuple (`code`, `traceId`, `clientEventId`, `clientEventType`, `conversation`, `latencyMs`) as a dedicated diagnostics widget.
