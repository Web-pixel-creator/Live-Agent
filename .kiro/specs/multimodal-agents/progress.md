# Progress Snapshot

## As Of

- Date: 2026-02-23
- Branch: `main`
- Status: `release-ready baseline (green gates)`

## Verified Quality Gates

1. `npm run verify:release` passes end-to-end.
2. Demo e2e policy gate is green with `129` checks.
3. Perf-load policy gate is green.
4. Unit tests are green (`113` tests passed).

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

## Current Focus Queue

1. Keep demo/release reliability deterministic under transient runtime failures.
2. Continue operational polish for judge-facing evidence and runbook clarity.
3. Proceed to next roadmap slice only after preserving green release gates.
