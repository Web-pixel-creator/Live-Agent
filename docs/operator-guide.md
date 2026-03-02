# Operator Guide

## Purpose

The operator flow is used during live demos and production diagnostics to:

1. Inspect health and policy evidence,
2. Manage approvals and failover actions,
3. Validate session/device/skills/governance lifecycle behavior.

## Access Points

1. Frontend: `http://localhost:3000`
2. API summary: `GET /v1/operator/summary`
3. Operator actions: `POST /v1/operator/actions`

## Frontend Tabs

1. `Live Negotiator` (default): connection/live controls at top, split middle layout (`intent + approval + tasks` and `KPI`), transcript at bottom; KPI card includes per-metric delta badges and source attribution (`final/current/mixed`)
2. `Storyteller`: story timeline with progress bar, segment scrubber/selector, asset preview controls, and status pills (`timeline mode`, `asset mix`, `segment progress`)
3. `Operator Console`: health/evidence cards grouped into collapsible lanes (`Live Bridge & Turn Safety`, `Governance/Skills/Cost`, `Runtime/UI Executor/Device Nodes`, `Approvals/Queue/Startup`), operator actions, and raw event log
4. `Device Nodes`: device-node create/update/heartbeat controls and list

## Key Panels (Demo Frontend)

1. Live Bridge Status
2. Approvals Queue
3. Device Nodes Health
4. Device Node Updates Evidence
5. Trace Coverage
6. Task Queue Pressure
7. Startup Failures
8. UI Executor Failover
9. Governance Policy Lifecycle
10. Skills Registry Lifecycle
11. Agent Usage Evidence
12. Cost & Tokens Evidence

## Standard Operator Actions

1. Refresh summary (`Refresh Summary`)
2. Collapse/expand operator evidence cards (`Collapse All` / `Expand All`); before first manual refresh the UI keeps only `Live Bridge & Turn Safety` expanded by default
3. Placeholder cards (`no_data` / `summary_error`) stay hidden until the first manual `Refresh Summary` to reduce visual noise during judge-facing walkthrough
4. Drain/warmup target service (failover controls)
5. Create/update device node and send heartbeat
6. Approve/reject pending UI-sensitive actions
7. Export session evidence from frontend (`Export Session Markdown` / `Export Session JSON` / `Export Session Audio (WAV)`)
8. Inspect Story Timeline panel to verify Storyteller segment sequencing and asset references during demo
9. For `Intent=Request`, UI grounding fields are visible only when `intent=ui_task`

## Safety Controls

1. Sensitive actions require approval gate.
2. UI execution applies sandbox modes and damage-control verdicts.
3. Loop detection can force `failed_loop` to stop repeated action plans.

## Evidence Expectations

Operator walkthrough should end with:

1. Turn truncation/delete evidence visible,
2. Device node lifecycle evidence visible,
3. Governance + skills lifecycle evidence visible,
4. Agent usage evidence visible (`source/models/token totals`),
5. Cost/token estimate evidence visible (`currency/mode/rates/totals`),
6. Health/failover diagnostics visible.

See full judged flow in `docs/judge-runbook.md`.
