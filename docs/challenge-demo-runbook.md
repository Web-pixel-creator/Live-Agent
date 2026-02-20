# Challenge Demo Runbook

This runbook defines the judged-demo flow for all three categories with explicit interruption checkpoints and fallback actions.

## Preconditions

1. Run local release verification:
```powershell
npm run verify:release
```
2. Start services for live walkthrough:
```powershell
npm run dev:ui-executor
npm run dev:orchestrator
npm run dev:api
npm run dev:gateway
npm run dev:frontend
```
3. Open `http://localhost:3000` and confirm:
- `Connection status` changes to `connected`.
- KPI panel is visible (`target/current/final`).
- `Approval Control` panel is visible.

## Master Timeline (5-6 minutes)

### 00:00-02:20 Live Agent (primary category)

1. Connect WebSocket and start mic stream.
2. Send negotiation request with constraints:
   - `price <= 100`
   - `delivery <= 14`
   - `SLA >= 98`
3. Show KPI panel updates in real time.

Checkpoint A (soft interruption) at ~00:55:
1. Click `Interrupt Assistant` once while assistant is speaking.
2. Expected behavior:
   - playback stops immediately,
   - transcript continues after recovery,
   - KPI state remains intact.

Checkpoint B (hard interruption) at ~01:40:
1. Click `Interrupt Assistant` again during active response.
2. Expected behavior:
   - interruption lifecycle event appears,
   - assistant resumes from same session context,
   - no KPI reset.

### 02:20-03:40 Creative Storyteller

1. Switch intent to `story`.
2. Send prompt for short branching story.
3. Show generated timeline and fallback marker (`fallback_asset=true`) when pre-generated assets are used.
4. For async video mode (`mediaMode=simulated`), show linked `mediaJobs.video` entries (`jobId`, `assetId`, `status=queued/running/completed`).

### 03:40-05:20 UI Navigator

1. Switch intent to `ui_task` with sensitive action phrase.
2. Show `Approval Control` with pending `approvalId`.
3. Execute both decisions:
   - `Reject` (must not resume run),
   - `Approve & Resume` (must resume and complete).
4. Run one safe `ui_task` in visual testing mode (`visualTesting.enabled=true`) and show:
   - structured visual report with `checks` and severity labels,
   - `status=passed|failed`,
   - artifact refs (`baseline`, `actual`, `diff`).

## Stage Fallback Procedure (text mode)

Manual shortcut:
1. Click `Switch To Text Fallback`.
2. Continue in same session without reconnect.
3. Confirm:
   - `Mode` becomes `text-fallback`,
   - transcript still updates,
   - KPI panel keeps previous values.

## Evidence and Artifacts

1. Local artifacts:
- `artifacts/demo-e2e/summary.json`
- `artifacts/demo-e2e/summary.md`
- `artifacts/demo-e2e/policy-check.json`
- `artifacts/demo-e2e/policy-check.md`
- `artifacts/demo-e2e/badge.json`
2. Public status:
- `https://Web-pixel-creator.github.io/Live-Agent/demo-e2e/badge.json`
- `https://img.shields.io/endpoint?url=https%3A%2F%2FWeb-pixel-creator.github.io%2FLive-Agent%2Fdemo-e2e%2Fbadge.json`
