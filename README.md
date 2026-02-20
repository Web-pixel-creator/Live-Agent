# Multimodal Live Agent Starter

Starter workspace for the "next-generation agents" spec:

- Live Agent (realtime voice/video, interruption, translation, negotiation)
- Creative Storyteller (Gemini + Imagen + Veo + TTS)
- UI Navigator (Computer Use + action execution)

## Workspace Layout

- `apps/realtime-gateway` - realtime ingress/egress service
- `apps/api-backend` - management REST API
- `agents/orchestrator` - ADK orchestration boundary and intent routing
- `agents/live-agent` - live communication domain logic (conversation, translation, negotiation)
- `agents/storyteller-agent` - storytelling domain logic stub
- `agents/ui-navigator-agent` - UI automation domain logic stub
- `shared/contracts` - shared event/session contracts
- `configs` - runtime configuration notes
- `infra` - infrastructure templates and deployment notes
- `.kiro/specs/multimodal-agents` - requirements/design/tasks/ADR documents

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Run orchestrator:
```bash
npm run dev:orchestrator
```

3. Run gateway and API in separate terminals:
```bash
npm run dev:gateway
npm run dev:api
npm run dev:ui-executor
```

4. Run demo frontend:
```bash
npm run dev:frontend
```
Open `http://localhost:3000`.

5. Optional runtime integrations:
- Firestore adapter (orchestrator): set `FIRESTORE_ENABLED=true` and `GOOGLE_CLOUD_PROJECT`.
- Live API bridge (gateway): set `LIVE_API_ENABLED=true`, `LIVE_API_WS_URL`, and auth values.
- Live API protocol profile (gateway): set `LIVE_API_PROTOCOL=gemini` (default), `LIVE_API_AUTO_SETUP=true`, and tune `LIVE_AUDIO_MIME_TYPE` if needed.
- Live gateway resilience tuning: configure `LIVE_CONNECT_RETRY_MS`, `LIVE_CONNECT_MAX_ATTEMPTS`, `LIVE_MAX_STALE_CHUNK_MS`.
- Gateway -> orchestrator request resilience: configure `GATEWAY_ORCHESTRATOR_TIMEOUT_MS`, `GATEWAY_ORCHESTRATOR_MAX_RETRIES`, `GATEWAY_ORCHESTRATOR_RETRY_BACKOFF_MS`.
- API -> orchestrator request resilience: configure `API_ORCHESTRATOR_TIMEOUT_MS`, `API_ORCHESTRATOR_MAX_RETRIES`, `API_ORCHESTRATOR_RETRY_BACKOFF_MS`.
- Live-agent Gemini text features (translation/conversation): set `GEMINI_API_KEY` (or `LIVE_AGENT_GEMINI_API_KEY`) and optionally tune `LIVE_AGENT_TRANSLATION_MODEL` / `LIVE_AGENT_CONVERSATION_MODEL`.
- Storyteller pipeline config: set `STORYTELLER_*` envs for planner models and media mode (`STORYTELLER_MEDIA_MODE=fallback|simulated`).
- UI Navigator planner config: set `UI_NAVIGATOR_*` envs for Computer Use-style planning, max steps, and approval keyword policy.
- UI Navigator executor modes: `UI_NAVIGATOR_EXECUTOR_MODE=simulated|playwright_preview|remote_http`, optional `UI_NAVIGATOR_EXECUTOR_URL`, and timeout/retry controls `UI_NAVIGATOR_EXECUTOR_TIMEOUT_MS`, `UI_NAVIGATOR_EXECUTOR_MAX_RETRIES`, `UI_NAVIGATOR_EXECUTOR_RETRY_BACKOFF_MS`.
- Remote UI executor service: run `npm run dev:ui-executor`; endpoint `/execute` is used when `UI_NAVIGATOR_EXECUTOR_MODE=remote_http`.

6. Optional delegation demo commands (in demo frontend message box with `intent=conversation`):
- `delegate story: <prompt>` -> Live Agent delegates to Storyteller.
- `delegate ui: <goal>` -> Live Agent delegates to UI Navigator.

7. Approval/resume API flow for sensitive UI actions:
- `GET /v1/approvals?sessionId=<id>&limit=50` -> list approval decisions.
- `POST /v1/approvals/resume` with `intent=ui_task` + `decision=approved|rejected` -> persist decision and optionally resume execution through orchestrator.

8. Real Playwright remote-http run (no simulation fallback):
- Install runtime once: `npm i -D playwright && npx playwright install chromium`
- Set env:
  - `UI_NAVIGATOR_EXECUTOR_MODE=remote_http`
  - `UI_NAVIGATOR_EXECUTOR_URL=http://localhost:8090`
  - `UI_EXECUTOR_STRICT_PLAYWRIGHT=true`
  - `UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE=false`
- Start services: `npm run dev:ui-executor`, `npm run dev:orchestrator`, `npm run dev:api`, `npm run dev:gateway`, `npm run dev:frontend`.

## Automated Demo E2E

Run a full judge-oriented smoke scenario (translation + negotiation + storyteller + UI approval/reject/approve + delegation + WebSocket gateway roundtrip + WebSocket task-progress contract check + WebSocket interruption signal contract check + WebSocket invalid-envelope error contract check + approvals resume invalid-intent REST contract check + lifecycle status/version/warmup/drain checks + runtime metrics endpoint checks):

```powershell
npm run demo:e2e
```

Fast mode (skip workspace build):

```powershell
npm run demo:e2e:fast
```

Policy validation for generated report:

```powershell
npm run demo:e2e:policy
```

Badge artifact generation:

```powershell
npm run demo:e2e:badge
```

Single-command local quality gate (build + demo e2e + policy + badge):

```powershell
npm run verify:release
```

Direct mode with explicit thresholds:

```powershell
node ./scripts/demo-e2e-policy-check.mjs --input ./artifacts/demo-e2e/summary.json --output ./artifacts/demo-e2e/policy-check.md --maxGatewayWsRoundTripMs 1800 --minApprovalsRecorded 1 --expectedUiAdapterMode remote_http --allowedUiAdapterModes remote_http,simulated --allowedGatewayInterruptEvents live.interrupt.requested,live.bridge.unavailable --allowedTranslationProviders fallback,gemini
```

The script writes a structured report to:

- `artifacts/demo-e2e/summary.json`
- `artifacts/demo-e2e/summary.md`
- `artifacts/demo-e2e/policy-check.md`
- `artifacts/demo-e2e/policy-check.json`
- `artifacts/demo-e2e/badge.json`
- `artifacts/demo-e2e/badge-details.json`

### Status Badge Template (Shields Endpoint)

When `badge.json` is published at a static URL (for example GitHub Pages or gist raw), use:

```text
https://img.shields.io/endpoint?url=<URL_TO_BADGE_JSON>
```

This repository workflow auto-publishes badge files to `gh-pages` on pushes to `main`/`master`:

```text
https://<OWNER>.github.io/<REPO>/demo-e2e/badge.json
```

Shields endpoint template for that path:

```text
https://img.shields.io/endpoint?url=https%3A%2F%2F<OWNER>.github.io%2F<REPO>%2Fdemo-e2e%2Fbadge.json
```

GitHub Pages setup (one-time):

1. Open repository `Settings -> Pages`.
2. Set `Build and deployment` to `Deploy from a branch`.
3. Select branch `gh-pages` and folder `/ (root)`.

Or via GitHub API (scripted):

```powershell
$env:GITHUB_OWNER="<owner>"
$env:GITHUB_REPO="<repo>"
$env:GITHUB_TOKEN="<token-with-repo-pages-permissions>"
npm run badge:pages:enable
```

Endpoint validation:

```powershell
$env:GITHUB_OWNER="<owner>"
$env:GITHUB_REPO="<repo>"
npm run badge:pages:check
```

## Repository Publish Automation

Publish flow script (git init/commit/push + optional Pages + optional badge polling):

```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
$env:GITHUB_TOKEN="<token-with-repo-pages-permissions>"
npm run repo:publish
```

Safe dry-run style (no push/pages/badge):

```powershell
npm run repo:publish -- -Owner Web-pixel-creator -Repo Live-Agent -SkipPush -SkipPages -SkipBadgeCheck
```

Preflight validation without creating `.git`:

```powershell
npm run repo:publish -- -Owner Web-pixel-creator -Repo Live-Agent -SkipGitInit -SkipPush -SkipPages -SkipBadgeCheck
```

Workflow badge (GitHub Actions):

```text
https://github.com/<OWNER>/<REPO>/actions/workflows/demo-e2e.yml/badge.svg
```

Useful flags:

- `-SkipServiceStart` - do not start local services (use already running endpoints).
- `-IncludeFrontend` - also start `demo-frontend` and health-check it.
- `-KeepServices` - keep script-started services running after completion.
- `-OutputPath <path>` - custom report output path.

## CI Workflow

- GitHub Actions workflow: `.github/workflows/demo-e2e.yml`
- Triggered on push/PR and manual dispatch.
- Runs `npm run demo:e2e` on `windows-latest`.
- Runs KPI policy gate via `npm run demo:e2e:policy`.
- On push to `main`/`master`, publishes public badge endpoint files (`demo-e2e/badge.json`) to `gh-pages`.
- Publishes `summary.md` into GitHub Job Summary for quick review.
- Uploads:
  - `artifacts/demo-e2e/summary.json`
  - `artifacts/demo-e2e/summary.md`
  - `artifacts/demo-e2e/policy-check.md`
  - `artifacts/demo-e2e/policy-check.json`
  - `artifacts/demo-e2e/badge.json`
  - `artifacts/demo-e2e/badge-details.json`
  - `artifacts/demo-e2e/logs`

## PR Gate

- PR template: `.github/pull_request_template.md`
- Includes a demo-readiness checklist aligned with e2e KPIs and artifacts.

## Challenge Runbook

- Walkthrough + interruption checkpoints + stage fallback steps:
  - `docs/challenge-demo-runbook.md`

## Lifecycle Endpoints

- Implemented on `realtime-gateway`, `api-backend`, and `orchestrator`:
  - `GET /healthz`
  - `GET /status`
  - `GET /version`
  - `POST /drain`
  - `POST /warmup`
- `POST /drain` switches service to draining mode (rejects new business requests).
- `POST /warmup` returns service back to ready mode.

## Metrics Endpoints

- Implemented on `realtime-gateway`, `api-backend`, and `orchestrator`:
  - `GET /metrics`
- Metrics include:
  - request counts and error rate
  - latency summary (`min/max/avg/p50/p95/p99`)
  - per-operation breakdown (top operations)

## Task Registry Endpoints

- Realtime gateway exposes active task state:
  - `GET /tasks/active?sessionId=<id>&limit=50`
  - `GET /tasks/<taskId>`
- Task lifecycle events are streamed in websocket channel:
  - `task.started`
  - `task.progress`
  - `task.completed`
  - `task.failed`

## Day-1 Infra Bootstrap

1. Baseline GCP setup (APIs, IAM, service accounts, secrets):
```powershell
pwsh ./infra/gcp/bootstrap.ps1 -ProjectId "<your-project-id>"
```

2. Firestore indexes + TTL policies:
```powershell
pwsh ./infra/firestore/apply.ps1 -ProjectId "<your-project-id>"
```

## Notes

This scaffold is intentionally minimal and is designed to be expanded by implementing:

1. Live API integrations
2. Firestore persistence adapters
3. Vertex AI agent runtime wiring
4. Tool execution and approval workflows
