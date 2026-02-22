# Challenge Demo Runbook

This runbook defines the judged-demo flow for all three categories with explicit interruption checkpoints and fallback actions.

## Preconditions

1. Run local release verification:
```powershell
npm run verify:release
```
2. Start services for live walkthrough:
```powershell
npm run dev:ui-executor
npm run dev:orchestrator
npm run dev:api
npm run dev:gateway
npm run dev:frontend
```
Optional local realtime mode without cloud keys:
```powershell
npm run dev:live-mock
```
and configure gateway env:
- `LIVE_API_ENABLED=true`
- `LIVE_API_PROTOCOL=gemini`
- `LIVE_API_WS_URL=ws://localhost:8091/live`

3. Open `http://localhost:3000` and confirm:
- `Connection status` changes to `connected`.
- KPI panel is visible (`target/current/final`).
- `Approval Control` panel is visible.
- `Device Nodes` panel is visible (create/update/heartbeat controls).

## Master Timeline (5-6 minutes)

### 00:00-02:20 Live Agent (primary category)

1. Connect WebSocket and start mic stream.
2. Send negotiation request with constraints:
   - `price <= 100`
   - `delivery <= 14`
   - `SLA >= 98`
3. Show KPI panel updates in real time.

Checkpoint A (soft interruption) at ~00:55:
1. Click `Interrupt Assistant` once while assistant is speaking.
2. Expected behavior:
   - playback stops immediately,
   - transcript continues after recovery,
   - KPI state remains intact.

Checkpoint B (hard interruption) at ~01:40:
1. Click `Interrupt Assistant` again during active response.
2. Expected behavior:
   - interruption lifecycle event appears,
   - assistant resumes from same session context,
   - no KPI reset.

### 02:20-03:40 Creative Storyteller

1. Switch intent to `story`.
2. Send prompt for short branching story.
3. Show generated timeline and fallback marker (`fallback_asset=true`) when pre-generated assets are used.
4. For async video mode (`mediaMode=simulated`), show linked `mediaJobs.video` entries (`jobId`, `assetId`, `status=queued/running/completed`).

### 03:40-05:20 UI Navigator

1. In `Operator Console`, switch role to `admin` and create or update one node in `Device Nodes`:
   - `nodeId=desktop-main`, `kind=desktop`, `status=online`, capabilities include `screen,click,type`.
2. Switch role to `operator` and send one heartbeat for the same node (optionally with `status=degraded` then back to `online`).
3. Confirm `Device Nodes` list updates with latest `status`, `version`, and `lastSeenAt`.
4. Click `Refresh Summary` in `Operator Console` and show `live_bridge_health` line:
   - `state` in `healthy|degraded|unknown`,
   - counters (`degraded/recovered/watchdog_reconnect/errors/unavailable`),
   - last health event marker.
5. Switch intent to `ui_task` with sensitive action phrase.
6. Show `Approval Control` with pending `approvalId`.
7. Execute both decisions:
   - `Reject` (must not resume run),
   - `Approve & Resume` (must resume and complete).
8. Run one safe `ui_task` in visual testing mode (`visualTesting.enabled=true`) and show:
   - structured visual report with `checks` and severity labels,
   - `status=passed|failed`,
   - artifact refs (`baseline`, `actual`, `diff`).

## Stage Fallback Procedure (text mode)

Manual shortcut:
1. Click `Switch To Text Fallback`.
2. Continue in same session without reconnect.
3. Confirm:
   - `Mode` becomes `text-fallback`,
   - transcript still updates,
   - KPI panel keeps previous values.

## Evidence and Artifacts

1. Local artifact `artifacts/demo-e2e/summary.json`.
2. Local artifact `artifacts/demo-e2e/summary.md`.
3. Local artifact `artifacts/demo-e2e/policy-check.json`.
4. Local artifact `artifacts/demo-e2e/policy-check.md`.
5. Local artifact `artifacts/demo-e2e/badge.json`.
6. Observability screenshot: dashboard `MLA Telemetry KPI Overview` with latency and error widgets.
7. Observability screenshot: alert policy `MLA Gateway P95 Latency High` enabled.
8. Observability screenshot: alert policy `MLA Service Error Rate High` enabled.
9. Observability screenshot: alert policy `MLA Orchestrator Persistence Failures` enabled.
10. BigQuery evidence: dataset `agent_analytics` has recent `analytics_event` rows.
11. Public status URL: `https://Web-pixel-creator.github.io/Live-Agent/demo-e2e/badge.json`.
12. Public shield URL: `https://img.shields.io/endpoint?url=https%3A%2F%2FWeb-pixel-creator.github.io%2FLive-Agent%2Fdemo-e2e%2Fbadge.json`.

## Quick Observability Setup (for demo environment)

1. Validate templates locally:
```powershell
npm run infra:monitoring:validate
```
2. Apply GCP observability baseline:
```powershell
pwsh ./infra/gcp/setup-observability.ps1 -ProjectId "<your-project-id>" -Region "us-central1" -Location "US" -DatasetId "agent_analytics"
```
