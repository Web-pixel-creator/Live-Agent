# Challenge Demo Runbook

This runbook defines the judged-demo flow for all three categories with explicit interruption checkpoints and fallback actions.

## Preconditions

1. Run local release verification:
```powershell
npm run verify:release
```
This gate validates build, unit tests, runtime profile smoke, demo e2e policy, badge artifact, and perf-load policy.
For artifact-only revalidation (without rerunning perf profile), keep perf artifacts and run:
```powershell
npm run verify:release:artifact-only
```
This alias maps to `verify:release -- -SkipBuild -SkipUnitTests -SkipMonitoringTemplates -SkipProfileSmoke -SkipDemoE2E -SkipPolicy -SkipBadge -SkipPerfRun`.
Artifact-only gate expects provenance manifest `artifacts/release-artifact-revalidation/source-run.json`; use helper/workflow paths below to generate it automatically.
For local self-contained sanity check (without GitHub API calls), run:
```powershell
npm run verify:release:artifact-only:smoke
```
Strict local smoke (same path with strict final gate):
```powershell
npm run verify:release:artifact-only:smoke:strict
```
Debug local smoke (keeps generated temp artifacts for inspection):
```powershell
npm run verify:release:artifact-only:smoke:keep-temp
```
Optional CI equivalent: run `.github/workflows/release-artifact-only-smoke.yml` (manual dispatch) with `strict_final_run=true|false`.
Workflow uploads smoke diagnostics as `release-artifact-only-smoke-artifacts` (`artifacts/release-artifact-only-smoke/summary.json`, `artifacts/release-artifact-only-smoke/smoke.log`).
Optional CI equivalent: run GitHub workflow `.github/workflows/release-artifact-revalidation.yml` to revalidate downloaded artifacts from the latest successful `demo-e2e`/`release-strict-final` run (or a specific `source_run_id`).
Workflow behavior: when downloaded bundle includes `artifacts/perf-load/*`, full artifact-only gate runs; when perf artifacts are missing (for example `pr-quality-artifacts`), workflow automatically switches to `-SkipPerfLoad` mode.
Manual overrides: use workflow inputs `perf_gate_mode=auto|with_perf|without_perf`, `strict_final_run=true|false`, `github_api_max_attempts=<int>=3`, `github_api_retry_backoff_ms=<int>=1200`, `max_source_run_age_hours=<int>=168` (`0` disables), and `allow_any_source_branch=true|false` when dispatching `release-artifact-revalidation`.
Optional local equivalent: use helper to pull artifact bundle and run the same gate:
```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
$env:GITHUB_TOKEN="<token-with-actions-read>"
npm run verify:release:artifact:revalidate
```
If `GITHUB_TOKEN`/`GH_TOKEN` is not set, helper tries `gh auth token` (requires prior `gh auth login`).
Optional flags: `-- -SourceRunId <id>`, `-- -ArtifactName <name>`, `-- -GithubApiMaxAttempts <n>`, `-- -GithubApiRetryBackoffMs <ms>`, `-- -MaxSourceRunAgeHours <n>`, `-- -AllowAnySourceBranch`, `-- -StrictFinalRun`, `-- -PerfGateMode auto|with_perf|without_perf`, `-- -SkipPerfLoadGate` (deprecated alias), `-- -SkipArtifactOnlyGate`.
Helper behavior: if downloaded bundle does not contain `artifacts/perf-load/*`, perf checks are skipped automatically while demo/policy/badge artifact checks stay enforced.
Provenance output: helper/workflow emit source-run manifest at `artifacts/release-artifact-revalidation/source-run.json`.
For flaky local runners you can increase demo retry tolerance:
```powershell
npm run verify:release -- -DemoRunMaxAttempts 3 -DemoRunRetryBackoffMs 3000 -DemoScenarioRetryMaxAttempts 3 -DemoScenarioRetryBackoffMs 1200
```
For final pre-submission validation, enforce strict no-retry discipline:
```powershell
npm run verify:release:strict
```
This alias maps to `verify:release -- -StrictFinalRun`.
If perf artifacts are already present and you only want to skip rerunning perf profile, use:
```powershell
npm run verify:release:strict:skip-perf-run
```
Optional CI equivalent: run GitHub workflow `.github/workflows/release-strict-final.yml` (manual `workflow_dispatch`) for the same strict gate + artifact bundle.
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

Non-retryable startup failures (fail-fast):
- `scripts/demo-e2e.ps1` now aborts early (without consuming full retry budget) when stderr indicates deterministic startup breakage, for example:
  - `cannot find module` / `ERR_MODULE_NOT_FOUND`
  - `SyntaxError` / `ReferenceError` / `TypeError`
  - `EADDRINUSE` / `address already in use`
  - `EACCES` / `permission denied`
- Operator recovery sequence:
  1. Open `artifacts/demo-e2e/logs/<service>.attempt<k>.stderr.log` and capture the tail included in the thrown error.
  2. For module/syntax failures, rebuild and restart (`npm run build`, then rerun `npm run verify:release`).
  3. For port conflicts (`EADDRINUSE`), free the conflicting process or change local port mapping before rerun.
  4. For permission failures (`EACCES`), fix filesystem/env permissions and rerun.

### Release-Critical KPI Snapshot

The release gate (`scripts/release-readiness.ps1`) hard-fails when these evidence items regress:

- Operator reliability:
  - `operatorAuditTrailValidated=true`
  - `operatorTraceCoverageValidated=true`
  - `operatorLiveBridgeHealthBlockValidated=true`
  - `operatorLiveBridgeProbeTelemetryValidated=true`
  - `operatorStartupDiagnosticsValidated=true`
  - `operatorLiveBridgeHealthState in {healthy,degraded,unknown}`
- Storyteller reliability:
  - `storytellerVideoAsyncValidated=true`
  - `storytellerMediaQueueVisible=true`
  - `storytellerMediaQueueQuotaValidated=true`
  - `storytellerCacheEnabled=true`
  - `storytellerCacheHitValidated=true`
  - `storytellerCacheInvalidationValidated=true`
  - `storytellerMediaMode=simulated`
  - `storytellerMediaQueueWorkers >= 1`
  - `storytellerCacheHits >= 1`
- Demo e2e scenario retry discipline:
  - `options.scenarioRetryMaxAttempts >= 2`
  - `options.scenarioRetryBackoffMs >= 500`
  - `kpi.scenarioRetriesUsedCount <= 2`
  - strict final run (`npm run verify:release:strict`) enforces `kpi.scenarioRetriesUsedCount = 0`
  - `kpi.uiVisualTestingScenarioAttempts <= options.scenarioRetryMaxAttempts`
  - `kpi.operatorConsoleActionsScenarioAttempts <= options.scenarioRetryMaxAttempts`
  - `kpi.scenarioRetryableFailuresTotal >= 0`
- Perf-load anti-drift (from `artifacts/perf-load/policy-check.json`):
  - required check items include:
    - `workload.live.p95`
    - `workload.ui.p95`
    - `workload.gateway_replay.p95`
    - `workload.gateway_replay.errorRatePct`
    - `aggregate.errorRatePct`
    - `workload.gateway_replay.contract.responseIdReusedAll`
    - `workload.gateway_replay.contract.taskStartedExactlyOneAll`
    - `workload.ui.adapterMode.remote_http`

3. Open `http://localhost:3000` and confirm:
- `Connection status` changes to `connected`.
- KPI panel is visible (`target/current/final`).
- `Approval Control` panel is visible.
- `Device Nodes` panel is visible (create/update/heartbeat controls).

## Master Timeline (5-6 minutes)

### 00:00-02:20 Live Agent (primary category)

1. Connect WebSocket and start mic stream.
2. Validate `Assistant` status pill lifecycle in the header before negotiation:
   - `waiting_connection` while websocket is opening,
   - `idle` after websocket is connected and no active output,
   - `streaming`/`speaking` while assistant output is in progress.
3. Send negotiation request with constraints:
   - `price <= 100`
   - `delivery <= 14`
   - `SLA >= 98`
4. Show KPI panel updates in real time.

Checkpoint A (soft interruption) at ~00:55:
1. Click `Interrupt Assistant` once while assistant is speaking.
2. Expected behavior:
   - playback stops immediately,
   - transcript continues after recovery,
   - `Assistant` status returns from `speaking`/`streaming` to `idle`,
   - KPI state remains intact.

Checkpoint B (hard interruption) at ~01:40:
1. Click `Interrupt Assistant` again during active response.
2. Expected behavior:
   - interruption lifecycle event appears,
   - assistant resumes from same session context,
   - no KPI reset.
   - policy evidence confirms assistant status lifecycle contract: `assistantActivityLifecycleValidated=true`.
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
   - `Device Nodes Health` widget (`total/online/degraded/offline/stale/missing_heartbeat/max_age`).
   - `Trace Coverage` widget (`runs/events/ui_runs/approval_linked/steps/screenshots + top_route/top_status`).
   - `Approvals Queue` widget (`total/pending/approved/rejected/timeout + pending_from_tasks + SLA soft/hard sweep`).
   - `Service Lifecycle` widget (`ready/draining/unknown + last lifecycle change + draining services list`).
   - `Task Queue Pressure` widget (`total/queued/running/pending_approval/stale + max_age + oldest_task`).
   - `Startup Failures` widget (`status/total/blocking + last type/service/checked_at`).
   - `device_nodes_health` summary line (`total/online/degraded/offline/stale/missing_heartbeat`) and `device.<nodeId>` recent entry.
   - policy evidence includes explicit scenario `operator.device_nodes.lifecycle=passed` and queue KPIs (`operatorTaskQueueSummaryValidated=true`, `operatorTaskQueuePressureLevel`) in `summary.json`.
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
16. Artifact provenance evidence: `artifacts/release-artifact-revalidation/source-run.json` (source run id/branch/age/guardrails/retry settings).

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
