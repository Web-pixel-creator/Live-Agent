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

1. `Live Negotiator` (default): connection/live controls at top, split middle layout (`intent + approval + tasks` left, sticky `KPI + Transcript` rail right); technical fields are tucked into `Advanced Settings` to reduce cognitive load during demos; KPI card includes per-metric delta badges and source attribution (`final/current/mixed`)
2. `Storyteller`: story timeline workspace with progress bar, segment scrubber/selector, selectable segment cards, asset preview controls, and status pills (`timeline mode`, `asset mix`, `segment progress`)
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
4. `Focus Critical` (default) keeps only critical cards visible and mirrors key status pills in the top signal strip (`Bridge`, `Queue`, `Approvals`, `Startup`, `UI Executor`, `Device Nodes`); click again (`Show All Cards`) for full board
5. `Issues Only` hides cards already marked `ok` and keeps neutral/fail evidence visible for incident triage
6. `Reset View` restores default triage layout (`Focus Critical` on, `Issues Only` off, default group visibility)
7. Signal strip cards are clickable jump-links: they auto-expand the target group, scroll to the matching evidence card, and flash it for fast triage
8. Secondary controls are under collapsed `Advanced Actions` (`Retry Task`, `Failover Drain`, `Failover Warmup`)
9. Create/update device node and send heartbeat
10. Approve/reject pending UI-sensitive actions
11. Export session evidence from frontend (`Export Session Markdown` / `Export Session JSON` / `Export Session Audio (WAV)`)
12. Inspect Story Timeline panel to verify Storyteller segment sequencing and asset references during demo
13. For `Intent=Request`, UI grounding fields are visible only when `intent=ui_task` and are grouped under `Advanced UI Task Settings`

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
