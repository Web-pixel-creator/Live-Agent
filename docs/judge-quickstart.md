# Judge Quickstart

## Purpose

Fast, judge-facing entry point for a 5-10 minute evaluation run.

This project covers all three challenge categories in one platform:

1. Live Agent (realtime speech, interruption, translation, negotiation, grounded research)
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

One-command pipeline:

```bash
npm run demo:epic
```

Or run explicit steps:

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
9. `artifacts/demo-e2e/epic-summary.json`

If deploy/publish artifacts are present, `manifest.md` and `presentation.md` also surface compact deploy/publish provenance from `artifacts/deploy/railway-deploy-summary.json` and `artifacts/deploy/repo-publish-summary.json`. Ordinary local judge flows omit that section, and raw deploy/publish JSON is not embedded into the judge-facing markdown.

## 3) Validate Release Readiness

```bash
npm run verify:release
```

## 4) What Judges Should See in UI

1. Connection + assistant lifecycle (`idle/streaming/speaking`).
2. Live interruption, truncate/delete evidence, gateway error correlation, and optional `research` citations/source URLs.
3. Operator Console panels:
   - Live Bridge Status
   - Approvals Queue
   - Workflow Runtime / Runtime Guardrails
   - Device Nodes Health / Updates
   - Bootstrap Doctor / Browser Workers
   - Governance Policy Lifecycle
   - Skills Registry Lifecycle
   - Plugin Marketplace Lifecycle
   - Agent Usage Evidence
   - Cost & Tokens Evidence
4. Operator support panels:
   - `Runtime Drill Runner` for repo-owned dry-run/live recovery drills and `followUpContext` handoff.
   - `Workflow Control Panel` for redacted assistive-router/runtime override posture.
   - `Operator Session Ops` for saved `operatorPurpose`, session replay, and cross-agent discovery.
   - `Bootstrap Doctor & Auth Profiles` for provider/auth-profile/device/fallback posture.
   - `Browser Worker Control` for queue/checkpoint posture on long-running UI jobs.
5. Session export controls:
   - `Export Session -> Export Markdown`
   - `Export Session -> Export JSON`
   - `Export Session -> Export Audio (WAV)`
   - Confirm exported Markdown/JSON include `runtimeGuardrailsSignalPaths`, `operatorPurpose`, `operatorSessionReplay`, and `operatorDiscovery`.
6. Story Timeline panel:
   - Confirm `Timeline State` KPI transitions (`0%` idle -> ready/pending) as story output arrives.
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
   - If judges ask for grounded-research proof, switch to `intent=research` once and show citation-bearing `answer`, `citations`, and `sourceUrls`.
3. `02:15-03:30` Creative Storyteller category:
   - Send storyteller prompt.
   - Open `Story Timeline` panel and scrub segments.
   - Show image/video/audio refs and async media behavior.
4. `03:30-04:45` UI Navigator category:
   - Send `ui_task` intent with grounding fields.
   - Show approval flow and damage-control verdict in Operator Console.
   - Save a short purpose in `Operator Session Ops`, then open `Bootstrap Doctor & Auth Profiles` and `Browser Worker Control` once to show runtime posture before execution.
   - Confirm safety gates before execution.
5. `04:45-05:30` Evidence close:
   - Run `npm run demo:epic` (or fallback `npm run demo:e2e:visual:judge` if e2e/policy/badge were already executed).
   - Open `artifacts/judge-visual-evidence/presentation.md`.
   - Confirm all evidence lanes are `pass` in `artifacts/demo-e2e/badge-details.json`.
   - Export session `JSON` or `Markdown` and confirm `runtimeGuardrailsSignalPaths`, `operatorPurpose`, `operatorSessionReplay`, and `operatorDiscovery`.
