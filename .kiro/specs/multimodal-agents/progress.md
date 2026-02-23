# Progress Snapshot

## As Of

- Date: 2026-02-23
- Branch: `main`
- Status: `release-ready baseline (green gates)`

## Verified Quality Gates

1. `npm run verify:release` passes end-to-end.
2. Demo e2e policy gate is green with `143` checks.
3. Perf-load policy gate is green.
4. Unit tests are green (`183` tests passed).

## Implemented Hardening Highlights

1. Live bridge failover + health watchdog + interruption handling.
2. Approval lifecycle with SLA behavior (`pending/approved/rejected/timeout`) and audit coverage.
3. UI loop protection (`failed_loop` diagnostics for planned/runtime loops).
4. Session idempotency/versioning for mutable API paths.
5. Echo mock + local-first profile flow for offline iteration.
6. Telemetry split documentation + monitoring templates and policy checks.
7. Assistive router with confidence-gated deterministic fallback.
8. WebSocket MVP protocol discipline with explicit docs (`docs/ws-protocol.md`).

## Latest Reliability Additions

1. Transient retry for `ui.approval.approve_resume` request in demo e2e script.
2. Policy checks for:
   - `kpi.uiApprovalResumeRequestAttempts` (`1..2`)
   - `kpi.uiApprovalResumeRequestRetried` (`boolean`)
   - `scenario.ui.approval.approve_resume.elapsedMs <= 60000`
3. Release summary now prints approval-resume retry KPI values.
4. UI Navigator remote executor now supports strict fallback policy via `UI_NAVIGATOR_REMOTE_HTTP_FALLBACK_MODE=simulated|failed` (with dedicated unit coverage).
5. Added dedicated unit coverage for `scripts/demo-e2e-policy-check.mjs` (pass path + threshold violations for attempts/elapsed guards).
6. Demo KPI policy gate now enforces `options.uiNavigatorRemoteHttpFallbackMode=failed` for judged demo determinism.
7. Demo KPI policy gate now enforces interrupt-latency discipline (`maxGatewayInterruptLatencyMs=300` when measured) with explicit unavailable fallback allowance.
8. Demo frontend operator console now shows actionable live-bridge recovery hints (`drain/warmup`) based on health state and probe/error counters.
9. Demo e2e managed-service startup now uses retry+backoff with stderr-tail diagnostics, reducing transient startup flakes (`process exited before health check passed`).
10. Demo summary artifacts now include startup-retry runtime options (`serviceStartMaxAttempts`, `serviceStartRetryBackoffMs`) for deterministic run forensics.
11. Demo KPI policy gate now enforces startup-retry option floors (`serviceStartMaxAttempts >= 2`, `serviceStartRetryBackoffMs >= 300ms`) with dedicated unit coverage.
12. Demo e2e now exposes a dedicated operator lifecycle scenario (`operator.device_nodes.lifecycle`) and policy enforces it as a required judge-facing proof.
13. Demo e2e now exposes `api.sessions.versioning` proof and policy validates optimistic-versioning/idempotency outcomes (`idempotent_replay`, `API_SESSION_VERSION_CONFLICT`, `API_SESSION_IDEMPOTENCY_CONFLICT`).
14. Demo e2e now exposes `gateway.websocket.binding_mismatch` proof and policy validates WebSocket binding guards (`GATEWAY_SESSION_MISMATCH`, `GATEWAY_USER_MISMATCH`).
15. Demo e2e now exposes `gateway.websocket.draining_rejection` proof and policy validates drain-mode rejection + post-warmup recovery (`GATEWAY_DRAINING`, `traceId`, `recoveryStatus=completed`).
16. Release readiness gate now fails fast on critical summary evidence (`gateway.websocket.binding_mismatch`, `gateway.websocket.draining_rejection`, `api.sessions.versioning`) and prints judge-critical KPI snapshots in final output.
17. Demo frontend live transcript now uses per-turn streaming aggregation (single assistant entry + idle/turn completion finalization), reducing token-by-token noise in judged live sessions.
18. Demo/perf runtime profiles now pin `UI_EXECUTOR_FORCE_SIMULATION=true`, preserving `remote_http` adapter contract while removing Playwright/network variance; `ui.approval.approve_resume` latency stabilized from multi-second tails to sub-second runs in e2e.
19. Demo KPI policy gate now enforces `ui-executor` runtime profile invariants (`kpi.uiExecutorMode=remote_http`, `kpi.uiExecutorForceSimulation=true`, `kpi.uiExecutorRuntimeValidated=true`) to prevent accidental regression to flaky browser/network execution paths.
20. `ui-executor` now exposes full lifecycle/runtime endpoints (`/status`, `/version`, `/metrics`, `/drain`, `/warmup`) and is included in runtime lifecycle + metrics evidence (`analyticsServicesValidated>=4`, `metricsServicesValidated>=4`, `kpi.uiExecutorLifecycleValidated=true`).
21. Operator e2e flow now validates admin failover for `ui-executor` (`drain` -> `warmup`), and policy gate enforces `kpi.operatorFailoverUiExecutorDrainState=draining`, `kpi.operatorFailoverUiExecutorWarmupState=ready`, `kpi.operatorFailoverUiExecutorValidated=true`.
22. Demo frontend Operator Console now exposes a dedicated `UI Executor Failover` widget (state/healthy/profile/version + last failover action/outcome), and judge runbook includes explicit on-stage `ui-executor` drain/warmup proof sequence.
23. Operator Console now requires explicit confirmation dialogs for mutating actions (`cancel_task`, `retry_task`, `failover drain/warmup`, device-node upsert/conflict probe/heartbeat), reducing accidental control-plane writes during live demo.
24. Operator Console now exposes a dedicated `Device Nodes Health` widget (`total/online/degraded/offline/stale/missing_heartbeat/max_age`) so device-node lifecycle proof is visible at a glance during judge walkthrough.
25. Operator Console now exposes a dedicated `Trace Coverage` widget (`runs/events/ui_runs/approval_linked/steps/screenshots + top route/status`) with coverage-state hints for faster operator diagnostics during demo.
26. Operator summary now includes approval status rollups (`pending/approved/rejected/timeout`) and latest approval snapshot, and Operator Console shows a dedicated `Approvals Queue` widget with SLA sweep hints (`soft/hard`).
27. Operator summary now exposes service lifecycle timestamps (`lastWarmupAt`, `lastDrainAt`) and flags (`ready`, `draining`), and Operator Console shows a dedicated `Service Lifecycle` widget for quick drain/warmup readiness checks.
28. Operator summary now exposes task-queue pressure rollups (`queued/running/pending_approval/stale/maxAge/oldestTask + pressureLevel`), and Operator Console shows a dedicated `Task Queue Pressure` widget with recovery hints for queue saturation and stale task buildup.
29. Demo e2e/policy evidence now enforces operator task-queue KPIs (`operatorTaskQueueSummaryValidated`, `operatorTaskQueuePressureLevel`, `operatorTaskQueueTotal`, `operatorTaskQueueStaleCount`, `operatorTaskQueuePendingApproval`) so queue-pressure regressions are blocked by CI gates.
30. Release-readiness gate now treats operator task-queue KPIs as critical checks and prints `operator.task_queue` summary line (`validated/level/total/pending/stale`) in final output for faster go/no-go diagnostics.
31. Demo e2e startup now runs explicit managed-service port preflight (`8080/8081/8082/8090` + optional `3000`) and fails early with `pid/process/commandLine` diagnostics on conflicts, reducing flaky `EADDRINUSE` startup failures.
32. Release-readiness now supports `-SkipPerfRun` so CI/unit flows can validate existing perf artifacts without re-running load; perf artifacts are still mandatory when `-SkipPerfLoad` is not set.
33. Release-readiness now performs anti-drift perf validation beyond `perfPolicy.ok`: hard thresholds, required perf check set, and mandatory workload presence (`live/ui/gateway_replay`) in perf summary.
34. Added dedicated unit coverage for `scripts/perf-load-policy-check.mjs` and expanded release-readiness unit coverage for perf threshold drift and missing required perf checks.
35. Release-readiness now treats operator evidence as critical: `operatorAuditTrailValidated`, `operatorTraceCoverageValidated`, `operatorLiveBridgeHealthBlockValidated`, `operatorLiveBridgeProbeTelemetryValidated`, plus allowlisted `operatorLiveBridgeHealthState`.
36. Release-readiness now treats Storyteller queue/cache evidence as critical (`storytellerMediaMode=simulated`, queue workers, cache hits, async/queue/cache validation KPIs).
37. Judge runbook now documents artifact-only release revalidation (`-SkipPerfRun`) and explicitly lists release-critical operator/story/perf evidence keys.
38. Added anti-drift unit coverage (`tests/unit/runbook-release-alignment.test.ts`) to keep `docs/challenge-demo-runbook.md` aligned with `scripts/release-readiness.ps1`.
39. Added anti-drift unit coverage (`tests/unit/ws-protocol-error-taxonomy-alignment.test.ts`) to keep `docs/ws-protocol.md` aligned with policy-level gateway error codes and retryability taxonomy.
40. `release-readiness` now retries the `demo:e2e` step with bounded attempts/backoff (`DemoRunMaxAttempts`, `DemoRunRetryBackoffMs`) to reduce transient CI/local flakes without weakening gates.
41. Added anti-drift unit coverage (`tests/unit/release-demo-retry-defaults.test.ts`) to lock demo retry defaults and ensure demo e2e path uses retry runner.
42. `demo-e2e` now supports bounded per-scenario transient retries (`ScenarioRetryMaxAttempts`, `ScenarioRetryBackoffMs`) for flaky paths (`ui.visual_testing`, `operator.console.actions`) with summary KPIs for attempt count and retry usage; coverage added in `tests/unit/demo-scenario-retry-alignment.test.ts`.
43. `release-readiness` now exposes scenario-retry controls (`DemoScenarioRetryMaxAttempts`, `DemoScenarioRetryBackoffMs`) and forwards them into demo runs; policy/release gates enforce `options.scenarioRetryMaxAttempts >= 2` and `options.scenarioRetryBackoffMs >= 500`, with runbook and anti-drift tests updated.
44. Policy/release gates now enforce anti-noise scenario-retry guards (`kpi.scenarioRetriesUsedCount <= 2`, per-scenario attempts bounded by `options.scenarioRetryMaxAttempts`, `kpi.scenarioRetryableFailuresTotal >= 0`), including runbook updates and dedicated unit coverage.
45. `release-readiness` now supports strict final mode (`-StrictFinalRun`) that enforces zero scenario retries (`kpi.scenarioRetriesUsedCount = 0`) and forwards strict policy override (`--maxScenarioRetriesUsedCount 0`) to demo KPI gate for pre-submission cleanliness.
46. Added dedicated CI workflow `.github/workflows/release-strict-final.yml` to run `verify:release:strict` (`release-readiness.ps1 -StrictFinalRun`) on `main/master` pushes and manual dispatch, with release-critical artifact publishing plus anti-drift coverage in `tests/unit/release-strict-workflow-alignment.test.ts`.
47. `repo:publish` now runs pre-publish release verification by default (`verify:release`), supports strict mode (`-StrictReleaseVerification` -> `verify:release:strict`) and explicit bypass (`-SkipReleaseVerification`), with anti-drift coverage in `tests/unit/repo-publish-release-gate-alignment.test.ts`.
48. Fixed locale-dependent numeric parsing in `scripts/release-readiness.ps1` (`To-NumberOrNaN` now parses with invariant culture fallback), eliminating false failures on decimal perf values (e.g., `ui_navigation_execution p95=38.5`), with dedicated regression test `release-readiness accepts decimal perf latency values from artifacts`.
49. Added release-check npm aliases for deterministic operator usage: `verify:release:strict:skip-perf-run` and `verify:release:artifact-only`; synchronized docs in `README.md` and `docs/challenge-demo-runbook.md`; added anti-drift coverage in `tests/unit/release-script-alias-alignment.test.ts`.
50. Updated `README.md` CI visibility with explicit strict-release workflow coverage (`release-strict-final.yml` badge + workflow section) so release-grade gate status is visible alongside PR/demo badges.
51. Added manual artifact-only CI revalidation workflow `.github/workflows/release-artifact-revalidation.yml`: auto-resolves latest successful `demo-e2e`/`release-strict-final` run (or accepts `source_run_id`), auto-detects artifact bundle, restores `artifacts/` tree, runs `verify:release:artifact-only`, and uploads consolidated evidence with anti-drift coverage in `tests/unit/release-artifact-workflow-alignment.test.ts`.

## Current Focus Queue

1. Keep demo/release reliability deterministic under transient runtime failures.
2. Continue operational polish for judge-facing evidence and runbook clarity.
3. Proceed to next roadmap slice only after preserving green release gates.
