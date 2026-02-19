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

## Integration TODOs

1. Validate Gemini Live protocol payloads against target region/model profile and finalize setup/runtime schema.
2. Add richer session/history endpoints in `apps/api-backend` for operational tooling.
3. Add Vertex AI runtime wiring for model calls.
4. Add approval and policy middleware for sensitive actions.
5. Extend observability sink for `live.metrics.round_trip` / `live.metrics.interrupt_latency` events.
