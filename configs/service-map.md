# Service Map

## Ports (local default)

- `demo-frontend`: `3000`
- `realtime-gateway`: `8080`
- `api-backend`: `8081`
- `orchestrator`: `8082`
- `ui-executor`: `8090`

## Request Flow

1. Client opens demo UI in `demo-frontend`.
2. Demo frontend opens realtime session with `realtime-gateway`.
3. Gateway forwards normalized events to `orchestrator`.
4. Orchestrator routes intent to domain agent:
   - `live-agent`
   - `storyteller-agent`
   - `ui-navigator-agent`
5. Results are returned to gateway/API and persisted to Firestore collections (`events`, `sessions`, `agent_runs`).
6. For UI Navigator with `remote_http` mode, orchestrator -> ui-navigator-agent -> `ui-executor` (`/execute`) is used for action execution.

## Integration Status

1. Gemini Live setup/runtime schema: implemented in gateway live-bridge (`setup`, model profile routing, interruption handling, health watchdog/failover diagnostics).
2. Session/history and operational endpoints: implemented in `apps/api-backend` (`/v1/sessions`, approvals, operator summary/actions, lifecycle/status surfaces).
3. Approval + policy middleware for sensitive UI actions: implemented in `ui-navigator-agent` and validated by demo e2e policy scenarios.
4. Observability sinks: structured analytics metrics/events exported for Cloud Monitoring/BigQuery routing (`docs/telemetry-storage-split.md`).

## Open Items (Post-MVP)

1. Vertex AI managed runtime wiring for cloud deployment profile (current baseline supports local/cloud-ready adapters).
2. WebRTC transport migration (V2): keep WebSocket as MVP baseline, follow `docs/webrtc-v2-spike.md`.
3. Multi-channel adapters and ecosystem expansion (V3 roadmap items in `.kiro/specs/multimodal-agents/tasks.md`).
