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
npm run demo:e2e:visual-pack
```

Artifacts:

1. `artifacts/demo-e2e/summary.json`
2. `artifacts/demo-e2e/policy-check.json`
3. `artifacts/demo-e2e/badge-details.json`
4. `artifacts/judge-visual-evidence/manifest.json`
5. `artifacts/judge-visual-evidence/manifest.md`

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

## 5) Primary Docs (if deeper review is needed)

1. `docs/challenge-demo-runbook.md`
2. `docs/operator-guide.md`
3. `docs/ws-protocol.md`
4. `docs/architecture.md`
