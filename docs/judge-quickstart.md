# Judge Quickstart

## Purpose

Fast, judge-facing entry point for a 5-10 minute evaluation run.

This project covers all three challenge categories in one platform:

1. Live Agent (realtime speech, interruption, translation, negotiation)
2. Creative Storyteller (text + audio + image + video narrative flow)
3. UI Navigator (computer-use style UI planning/execution with approval guardrails)

## 1) Start Local Demo Stack

```bash
npm install
npm run dev:orchestrator
npm run dev:gateway
npm run dev:api
npm run dev:ui-executor
npm run dev:frontend
```

Open: `http://localhost:3000`

## 2) Run Judge-Evidence Automation

```bash
npm run demo:e2e:fast
npm run demo:e2e:policy
npm run demo:e2e:badge
npm run demo:e2e:visual-capture
npm run demo:e2e:visual-pack
npm run demo:e2e:visual:gallery
npm run demo:e2e:visual:bundle
```

Artifacts:

1. `artifacts/demo-e2e/summary.json`
2. `artifacts/demo-e2e/policy-check.json`
3. `artifacts/demo-e2e/badge-details.json`
4. `artifacts/judge-visual-evidence/manifest.json`
5. `artifacts/judge-visual-evidence/manifest.md`
6. `artifacts/judge-visual-evidence/screenshots/_capture-manifest.json`
7. `artifacts/judge-visual-evidence/gallery.md`
8. `artifacts/judge-visual-evidence/presentation.md`

## 3) Validate Release Readiness

```bash
npm run verify:release
```

## 4) What Judges Should See in UI

1. Connection + assistant lifecycle (`idle/streaming/speaking`).
2. Live interruption, truncate/delete evidence, and gateway error correlation.
3. Operator Console panels:
   - Live Bridge Status
   - Approvals Queue
   - Device Nodes Health / Updates
   - Governance Policy Lifecycle
   - Skills Registry Lifecycle
   - Agent Usage Evidence
   - Cost & Tokens Evidence
4. Session export controls:
   - `Export Session Markdown`
   - `Export Session JSON`
   - `Export Session Audio (WAV)`
5. Story Timeline panel:
   - Segment scrubber/selector reflects `output.story.timeline`
   - Preview card shows segment text + `image/video/audio` refs

## 5) Primary Docs (if deeper review is needed)

1. `docs/challenge-demo-runbook.md`
2. `docs/operator-guide.md`
3. `docs/ws-protocol.md`
4. `docs/architecture.md`

## 6) Demo Script by Minute (5-6 min)

1. `00:00-00:45` Platform intro:
   - Open `http://localhost:3000`.
   - Show connection panel and assistant lifecycle (`idle/streaming/speaking`).
   - Point to judge artifacts target: `artifacts/judge-visual-evidence/presentation.md`.
2. `00:45-02:15` Live Agent category:
   - Start mic, send live request, then trigger interruption.
   - Show truncate/delete/gateway-correlation evidence in Operator Console.
   - Mention roundtrip and interrupt KPI lanes in `artifacts/demo-e2e/badge-details.json`.
3. `02:15-03:30` Creative Storyteller category:
   - Send storyteller prompt.
   - Open `Story Timeline` panel and scrub segments.
   - Show image/video/audio refs and async media behavior.
4. `03:30-04:45` UI Navigator category:
   - Send `ui_task` intent with grounding fields.
   - Show approval flow and damage-control verdict in Operator Console.
   - Confirm safety gates before execution.
5. `04:45-05:30` Evidence close:
   - Run `npm run demo:e2e:visual:judge`.
   - Open `artifacts/judge-visual-evidence/presentation.md`.
   - Confirm all evidence lanes are `pass` in `artifacts/demo-e2e/badge-details.json`.
