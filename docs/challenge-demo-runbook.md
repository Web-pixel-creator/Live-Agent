# Challenge Demo Runbook

This runbook defines the judged-demo flow for all three categories with explicit interruption checkpoints and fallback actions.

## Preconditions

1. Run local release verification:
```powershell
npm run verify:release
```
This gate validates build, unit tests, runtime profile smoke, demo e2e policy, badge artifact, and perf-load policy.
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

Recommended UI executor safety setting for judged demo:
- `UI_NAVIGATOR_REMOTE_HTTP_FALLBACK_MODE=failed` (fail-fast instead of silent simulated fallback when remote executor is unavailable).

Optional startup reliability knobs for local/CI runs:
- `DEMO_E2E_SERVICE_START_MAX_ATTEMPTS=2` (or higher for unstable runners).
- `DEMO_E2E_SERVICE_START_RETRY_BACKOFF_MS=1200`.

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
   - policy evidence keeps interrupt latency guard green: `kpi.gatewayInterruptLatencyMs <= 300` when measured (or explicit `live.bridge.unavailable` fallback path).

### 02:20-03:40 Creative Storyteller

1. Switch intent to `story`.
2. Send prompt for short branching story.
3. Show generated timeline and fallback marker (`fallback_asset=true`) when pre-generated assets are used.
4. For async video mode (`mediaMode=simulated`), show linked `mediaJobs.video` entries (`jobId`, `assetId`, `status=queued/running/completed`).

### 03:40-05:20 UI Navigator

1. In `Operator Console`, switch role to `admin` and create one node in `Device Nodes`:
   - `nodeId=desktop-main`, `kind=desktop`, `status=online`, capabilities include `screen,click,type`.
   - For mutating actions (`Create/Update`, `Heartbeat`, `Failover`), accept the confirmation dialog before request submission.
2. Still as `admin`, run one update with `expectedVersion` from the created node and confirm version increments.
3. Switch role to `operator` and send one heartbeat for the same node (optionally with `status=degraded` then back to `online`).
4. Click `Check Status` for the same `nodeId` and confirm point-lookup returns current `status`, `version`, and `lastSeenAt`.
5. Optional resilience proof: click `Probe Stale Conflict` (or send stale `expectedVersion`) and show guarded `409 API_DEVICE_NODE_VERSION_CONFLICT`.
6. Confirm `Device Nodes` list updates with latest `status`, `version`, and `lastSeenAt`.
7. Click `Refresh Summary` in `Operator Console` and show `Live Bridge Status` widget:
   - status badge (`state=<healthy|degraded|unknown>`, probe success when available),
   - counters (`degraded/recovered/watchdog_reconnect/errors/unavailable/connect_timeouts`),
   - probe telemetry (`probes/ping_sent/pongs/ping_errors`),
   - last health event marker (`lastEventType`, `lastEventAt`).
   - `UI Executor Failover` widget (`state/healthy/profile/version + last_action/last_outcome`).
   - `device_nodes_health` summary line (`total/online/degraded/offline/stale/missing_heartbeat`) and `device.<nodeId>` recent entry.
   - policy evidence includes explicit scenario `operator.device_nodes.lifecycle=passed` in `summary.json`.
8. Show admin failover proof for `ui-executor`:
   - set `Target Service=ui-executor`,
   - click `Failover Drain` and confirm widget state switches to `draining`,
   - click `Failover Warmup` and confirm widget state returns to `ready`.
   - policy evidence in `summary.json`: `operatorFailoverUiExecutorDrainState=draining`, `operatorFailoverUiExecutorWarmupState=ready`, `operatorFailoverUiExecutorValidated=true`.
9. Switch intent to `ui_task` with sensitive action phrase.
10. Show `Approval Control` with pending `approvalId`.
11. Execute both decisions:
   - `Reject` (must not resume run),
   - `Approve & Resume` (must resume and complete).
   - Check KPI evidence in `summary.json`: `uiApprovalResumeRequestAttempts` is `1..2` and scenario `ui.approval.approve_resume.elapsedMs <= 60000`.
12. Run one safe `ui_task` in visual testing mode (`visualTesting.enabled=true`) and show:
   - structured visual report with `checks` and severity labels,
   - `status=passed|failed`,
   - artifact refs (`baseline`, `actual`, `diff`),
   - execution grounding summary (`domSnapshotProvided`, `accessibilityTreeProvided`, `markHintsCount`).

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
13. API reliability evidence: `api.sessions.versioning=passed` with `kpi.sessionVersioningValidated=true`, `API_SESSION_VERSION_CONFLICT`, `API_SESSION_IDEMPOTENCY_CONFLICT`.
14. WebSocket contract evidence: `gateway.websocket.binding_mismatch=passed` with `kpi.gatewayWsSessionMismatchCode=GATEWAY_SESSION_MISMATCH`, `kpi.gatewayWsUserMismatchCode=GATEWAY_USER_MISMATCH`.
15. WebSocket drain behavior evidence: `gateway.websocket.draining_rejection=passed` with `kpi.gatewayWsDrainingCode=GATEWAY_DRAINING` and successful post-warmup recovery (`kpi.gatewayWsDrainingRecoveryStatus=completed`).

## Quick Observability Setup (for demo environment)

1. Validate templates locally:
```powershell
npm run infra:monitoring:validate
```
2. Apply GCP observability baseline:
```powershell
pwsh ./infra/gcp/setup-observability.ps1 -ProjectId "<your-project-id>" -Region "us-central1" -Location "US" -DatasetId "agent_analytics"
```
3. Collect evidence package:
```powershell
pwsh ./infra/gcp/collect-observability-evidence.ps1 -ProjectId "<your-project-id>" -DatasetId "agent_analytics" -LookbackHours 24
```
4. Generate judge-ready report:
```powershell
npm run infra:observability:report
```
5. Optional CI collection path:
- Run GitHub workflow `.github/workflows/observability-evidence.yml` with `collect_live=true`.
- Provide `project_id` and ensure repository secret `GCP_CREDENTIALS_JSON` is configured.
