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

1. `Live Negotiator` (default): connection/live controls at top, split middle layout (`intent + approval + tasks` left, sticky `KPI + Transcript` rail right); top toolbars separate `primary` and `secondary` action lanes for clearer control hierarchy; technical fields are tucked into `Advanced Settings` (`Advanced Session Settings`, `Live Setup`, `Advanced Approval Settings`, `Advanced UI Task Settings`) to reduce cognitive load during demos; KPI card includes per-metric delta badges and source attribution (`final/current/mixed`); `Active Tasks` empty state offers one-click quick starts (`Run Negotiation`, `Run Story`, `Run UI Task`) plus `Refresh Active Tasks`; when tasks exist they render as status/progress cards with stage/intent/route chips and run/session metadata
2. `Storyteller`: story timeline workspace with `Timeline State` KPI card, progress bar, segment scrubber/selector, selectable segment cards, asset preview controls, status pills (`timeline mode`, `asset mix`, `segment progress`), top `Story Guidance` rail for first-run CTA (`Open Live Negotiator` / `Use Story Prompt Template`), animated visual empty-state cue cards (`Storyboard` preview + `Timeline` list) with readiness strip (`timeline_idle / assets=none / progress=0%`), expected-output KPI chips (`Segments`, `Asset Mix`, `First Render`), collapsible guidance blocks (`Preview story arc and expected outputs` + `Preview example segment cards`), and empty-state actions `Open Live Negotiator` (primary CTA) / `Use Story Prompt Template` for fast story-intent handoff; when storyteller jobs are queued before first segment arrives, empty states automatically switch to `pending` messaging (`timeline_pending_video`, queueing status pills, rendering badges)
3. `Operator Console`: health/evidence cards grouped into collapsible lanes (`Live Bridge & Turn Safety`, `Governance/Skills/Cost`, `Runtime/UI Executor/Device Nodes`, `Approvals/Queue/Startup`), operator actions, and a collapsed-by-default `Debug Event Stream` section for raw event log tracing
4. `Device Nodes`: device-node create/update/heartbeat controls, compact fleet summary (`total/online/degraded/offline/stale`), `List Filter` (`all/online/degraded/offline/stale`) + `List Sort` (`last heartbeat/status priority/name A-Z/name Z-A`) with live `Showing X of Y` counters, and selectable node cards with status pills; empty/filtered-empty states provide direct recovery actions (`Use Demo Template`, `Show All Nodes`)
5. Frontend remembers last active tab (`mla.demoFrontend.activeTab`) and restores it on reload; Operator Console also remembers last board mode (`mla.demoFrontend.operatorBoardMode`) for consistent demo/operator context

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
2. `Demo View` (default) keeps Operator Console in critical-first mode for judge walkthroughs, prioritizes six cards (`Live Bridge`, `Queue`, `Approvals`, `Startup`, `UI Executor`, `Device Nodes`), and keeps `Live Bridge & Turn Safety` expanded by default while still surfacing new `fail` cards; in `Demo View`, uninitialized neutral noise cards (`unknown` / `pending` / `n/a` / `awaiting_refresh`) are auto-hidden outside the six-card lane, and in `Demo View + Focus Critical` the same neutral noise is also auto-hidden inside the six-card lane; `Full Ops View` opens the full board for deep diagnostics; mode banner (`demo_view` / `full_ops_view`) confirms active triage scope
3. Operator board mode choice (`Demo` vs `Full Ops`) persists across reload (`mla.demoFrontend.operatorBoardMode`) until changed or manually reset
4. `Demo View` adds a top `Demo Summary` strip (Realtime Gateway, Queue, Approvals, Startup, UI Executor, Device Nodes) with large mirrored status pills, per-lane mini-KPI (`F/N/O`), and one-click jump-to-card navigation
5. Before the first manual refresh, a guided pre-refresh banner is shown with one-click `Refresh Summary`, quick-start actions (`Run Negotiation`, `Run Story`, `Run UI Task`), and mode-specific hint text (`Demo` vs `Full Ops`)
6. Operator Console keeps a collapsible `Operator Quick Start` rail (`Run Negotiation`, `Run Story`, `Run UI Task`, `Open Device Nodes`, `Refresh Summary`) so empty lanes can be repopulated at any point without keeping extra controls always expanded
7. Collapsible `Lane Recovery Playbook` cards (Realtime/Story/UI Safety/Device Nodes) provide direct run + refresh controls so `awaiting_refresh` lanes can be recovered without scanning the full board
8. Top operator toolbar keeps only primary triage controls visible (`Demo/Full`, `Refresh`, `Focus Critical`, `Issues Only`); reset/collapse/cancel controls are grouped under a collapsed `Board Actions` block
9. Collapse/expand operator evidence cards (`Collapse All` / `Expand All`); before first manual refresh the UI keeps only `Live Bridge & Turn Safety` expanded by default
10. Placeholder cards (`no_data` / `summary_error`) stay hidden until the first manual `Refresh Summary` to reduce visual noise during judge-facing walkthrough
11. When placeholder statuses are shown, labels are rendered as `awaiting_refresh` / `refresh_failed` (internal placeholder codes remain unchanged for filtering logic)
12. Empty-state hints are action-oriented and point to the next scenario/action to run before `Refresh Summary`
13. Static HTML placeholders are also demo-friendly (`awaiting_refresh` / `pending`) before frontend JS hydration
14. `Focus Critical` keeps only critical cards visible and mirrors key status pills in the top signal strip (`Bridge`, `Queue`, `Approvals`, `Startup`, `UI Executor`, `Device Nodes`); click again (`Show All Cards`) for broader board context without demo-noise placeholders
15. `Issues Only` hides cards already marked `ok` and keeps neutral/fail evidence visible for incident triage
16. `Reset View` restores default triage layout (`Demo View`, `Focus Critical` on, `Issues Only` off, default group visibility)
17. `Triage Summary` shows live counters (`total`, `visible`, `fail`, `neutral`, `ok`, `hidden`) and updates as filters/statuses change
18. Each lane header shows live mini-counters (`visible/fail/neutral/ok/hidden`) for quick group-level prioritization
19. Signal strip cards are clickable jump-links: they auto-expand the target group, scroll to the matching evidence card, and flash it for fast triage
20. Secondary controls are under collapsed `Advanced Actions` (`Retry Task`, `Failover Drain`, `Failover Warmup`)
21. Create/update device node and send heartbeat
22. Approve/reject pending UI-sensitive actions
23. Export session evidence from frontend via single `Export Session` dropdown (`Markdown` / `JSON` / `Audio (WAV)`)
24. Export dropdown keeps `Last export` metadata, format badges (`MD/JS/WAV`), and a `Recent exports` list (last 3 downloads); audio export is enabled only after assistant audio chunks are captured and the menu hint shows live capture metadata (`turns`, `size`, `trimmed` when rolling-window cap applies)
25. Inspect Story Timeline panel to verify Storyteller segment sequencing, `Timeline State` KPI, and asset references during demo
26. For `Intent=Request`, UI grounding fields are visible only when `intent=ui_task` and are grouped under `Advanced UI Task Settings`
27. Live Negotiator status strip (`Status/Assistant/Run ID/User ID/Session State/Mode/PTT/Export`) uses high-contrast text, pill-state color mapping, dedicated value chips for `Run ID`/`User ID`, concise export labels (`exported markdown/json/audio`), and lane-level `ok/neutral/fail` accents in a compact `4-column` matrix (2 rows on desktop) for faster scan and lower visual density; on narrower screens, items wrap to 2-column/1-column naturally without horizontal overflow
28. KPI secondary text (`labels`, `status notes`, and context hints) uses elevated contrast to stay readable over gradient/video backgrounds during fast judge walkthroughs
29. Custom dropdown controls support keyboard navigation (`ArrowUp/ArrowDown/Home/End`, `Enter/Space`, `Escape`) and combobox/listbox ARIA semantics (`aria-controls`, `aria-expanded`, `aria-activedescendant`) so operators/judges can complete flows without pointer-only input
30. Image/audio uploads use themed file pickers (`Choose image` / `Choose audio` + inline filename chips) to keep Live Controls and Intent Request visually consistent with the rest of the dashboard controls
31. Operator Console secondary operator copy (`mode hints`, quick-start helper text, lane playbook notes, triage micro-labels, and health metadata rows) uses elevated neutral contrast to remain legible over layered gradients/video
32. In `Demo View`, remaining neutral/uninitialized demo-essential cards are rendered in compact mode (`title + status + hint`) until evidence arrives, reducing pre-refresh visual noise without hiding critical-failure cards
33. Compact operator empty cards include inline recovery CTAs (`Run Negotiation` / `Run UI Task` / `Open Device Nodes` + `Refresh Summary`) so empty evidence lanes can be populated without leaving the card context

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
