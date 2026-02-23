# Progress Snapshot

## As Of

- Date: 2026-02-23
- Branch: `main`
- Status: `release-ready baseline (green gates)`

## Verified Quality Gates

1. `npm run verify:release` passes end-to-end.
2. Demo e2e policy gate is green with `108` checks.
3. Perf-load policy gate is green.
4. Unit tests are green (`107` tests passed).

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

## Current Focus Queue

1. Keep demo/release reliability deterministic under transient runtime failures.
2. Continue operational polish for judge-facing evidence and runbook clarity.
3. Proceed to next roadmap slice only after preserving green release gates.
