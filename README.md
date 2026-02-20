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
- `agents/storyteller-agent` - storytelling pipeline (planner + branch + image/video/tts asset timeline)
- `agents/ui-navigator-agent` - UI planning/execution with approval gates and adapter-aware traces
- `shared/capabilities` - internal capability adapter contracts/profile helpers
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
- Live gateway failover/health tuning: `LIVE_MODEL_FALLBACK_IDS`, `LIVE_API_FALLBACK_KEYS`, `LIVE_API_AUTH_PROFILES_JSON`, `LIVE_FAILOVER_COOLDOWN_MS`, `LIVE_HEALTH_CHECK_INTERVAL_MS`, `LIVE_HEALTH_SILENCE_MS`.
- Live setup tuning: `LIVE_SETUP_VOICE_NAME`, `LIVE_SYSTEM_INSTRUCTION`, `LIVE_REALTIME_ACTIVITY_HANDLING`, `LIVE_ENABLE_INPUT_AUDIO_TRANSCRIPTION`, `LIVE_ENABLE_OUTPUT_AUDIO_TRANSCRIPTION`.
- Gateway websocket binding guardrails: each message carries correlation context (`userId/sessionId/runId`), and gateway rejects bound-socket mismatch (`GATEWAY_SESSION_MISMATCH`, `GATEWAY_USER_MISMATCH`).
- WebSocket integration contract and error taxonomy: `docs/ws-protocol.md`.
- Gateway -> orchestrator request resilience: configure `GATEWAY_ORCHESTRATOR_TIMEOUT_MS`, `GATEWAY_ORCHESTRATOR_MAX_RETRIES`, `GATEWAY_ORCHESTRATOR_RETRY_BACKOFF_MS`.
- Gateway orchestrator replay-dedupe tuning: `GATEWAY_ORCHESTRATOR_DEDUPE_TTL_MS` (idempotent response replay window for duplicate websocket requests).
- API -> orchestrator request resilience: configure `API_ORCHESTRATOR_TIMEOUT_MS`, `API_ORCHESTRATOR_MAX_RETRIES`, `API_ORCHESTRATOR_RETRY_BACKOFF_MS`.
- Orchestrator idempotency cache tuning: `ORCHESTRATOR_IDEMPOTENCY_TTL_MS` (in-flight + completed request dedupe window).
- Live-agent Gemini text features (translation/conversation): set `GEMINI_API_KEY` (or `LIVE_AGENT_GEMINI_API_KEY`) and optionally tune `LIVE_AGENT_TRANSLATION_MODEL` / `LIVE_AGENT_CONVERSATION_MODEL`.
- Live-agent context compaction tuning: `LIVE_AGENT_CONTEXT_COMPACTION_ENABLED`, `LIVE_AGENT_CONTEXT_MAX_TOKENS`, `LIVE_AGENT_CONTEXT_TARGET_TOKENS`, `LIVE_AGENT_CONTEXT_KEEP_RECENT_TURNS`, `LIVE_AGENT_CONTEXT_MAX_SESSIONS`, `LIVE_AGENT_CONTEXT_SUMMARY_MODEL`.
- Storyteller pipeline config: set `STORYTELLER_*` envs for planner models and media mode (`STORYTELLER_MEDIA_MODE=fallback|simulated`).
- UI Navigator planner config: set `UI_NAVIGATOR_*` envs for Computer Use-style planning, max steps, and approval keyword policy.
- UI Navigator executor modes: `UI_NAVIGATOR_EXECUTOR_MODE=simulated|playwright_preview|remote_http`, optional `UI_NAVIGATOR_EXECUTOR_URL`, and timeout/retry controls `UI_NAVIGATOR_EXECUTOR_TIMEOUT_MS`, `UI_NAVIGATOR_EXECUTOR_MAX_RETRIES`, `UI_NAVIGATOR_EXECUTOR_RETRY_BACKOFF_MS`.
- UI Navigator loop guard tuning: `UI_NAVIGATOR_LOOP_DETECTION_ENABLED`, `UI_NAVIGATOR_LOOP_WINDOW_SIZE`, `UI_NAVIGATOR_LOOP_REPEAT_THRESHOLD`, `UI_NAVIGATOR_LOOP_SIMILARITY_THRESHOLD`.
- Remote UI executor service: run `npm run dev:ui-executor`; endpoint `/execute` is used when `UI_NAVIGATOR_EXECUTOR_MODE=remote_http`.
- Approval SLA tuning in API backend: `APPROVAL_SOFT_TIMEOUT_MS`, `APPROVAL_HARD_TIMEOUT_MS`, `APPROVAL_SWEEP_LIMIT`.
- Local-first profile for offline iteration: set `LOCAL_FIRST_PROFILE=true` and `APP_ENV=dev` (guardrail blocks local-first in `staging/prod`). Profile details: `docs/local-first-profile.md`.

6. Optional delegation demo commands (in demo frontend message box with `intent=conversation`):
- `delegate story: <prompt>` -> Live Agent delegates to Storyteller.
- `delegate ui: <goal>` -> Live Agent delegates to UI Navigator.

7. Approval/resume API flow for sensitive UI actions:
- `GET /v1/approvals?sessionId=<id>&limit=50` -> list approval decisions.
- `POST /v1/approvals/resume` with `intent=ui_task` + `decision=approved|rejected` -> persist decision and optionally resume execution through orchestrator.

Session mutation concurrency controls:
- `PATCH /v1/sessions/{sessionId}` accepts optional `expectedVersion` in body for optimistic concurrency.
- `PATCH /v1/sessions/{sessionId}` accepts optional idempotency key via body `idempotencyKey` or header `x-idempotency-key`.
- On stale version, API returns `409 API_SESSION_VERSION_CONFLICT`.

8. Operator console APIs (RBAC via `x-operator-role: viewer|operator|admin`):
- `GET /v1/operator/summary` -> active tasks, approvals snapshot, service runtime/health summary.
- `POST /v1/operator/actions` with:
  - `action=cancel_task` + `taskId`
  - `action=retry_task` + `taskId`
  - `action=failover` + `targetService` + `operation` (`drain|warmup`, admin only)

9. Demo frontend includes an Operator Console panel for summary refresh and recovery actions.

10. Real Playwright remote-http run (no simulation fallback):
- Install runtime once: `npm i -D playwright && npx playwright install chromium`
- Set env:
  - `UI_NAVIGATOR_EXECUTOR_MODE=remote_http`
  - `UI_NAVIGATOR_EXECUTOR_URL=http://localhost:8090`
  - `UI_EXECUTOR_STRICT_PLAYWRIGHT=true`
  - `UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE=false`
- Start services: `npm run dev:ui-executor`, `npm run dev:orchestrator`, `npm run dev:api`, `npm run dev:gateway`, `npm run dev:frontend`.

## Automated Demo E2E

Run a full judge-oriented smoke scenario (translation + negotiation + storyteller with async video jobs + UI approval/reject/approve + UI visual testing report + delegation + WebSocket gateway roundtrip + session/run/user binding checks + WebSocket task-progress contract check + WebSocket interruption signal contract check + WebSocket invalid-envelope error contract check + approvals resume invalid-intent REST contract check with normalized error `API_INVALID_INTENT` + `traceId` + lifecycle status/version/warmup/drain checks + runtime metrics endpoint checks):

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
node ./scripts/demo-e2e-policy-check.mjs --input ./artifacts/demo-e2e/summary.json --output ./artifacts/demo-e2e/policy-check.md --maxGatewayWsRoundTripMs 1800 --minApprovalsRecorded 1 --expectedUiAdapterMode remote_http --allowedUiAdapterModes remote_http,simulated --allowedGatewayInterruptEvents live.interrupt.requested,live.bridge.unavailable --allowedTranslationProviders fallback,gemini --allowedVisualComparatorModes fallback_heuristic,gemini_reasoning --allowedStoryMediaModes simulated
```

The script writes a structured report to:

- `artifacts/demo-e2e/summary.json`
- `artifacts/demo-e2e/summary.md`
- `artifacts/demo-e2e/policy-check.md`
- `artifacts/demo-e2e/policy-check.json`
- `artifacts/demo-e2e/badge.json`
- `artifacts/demo-e2e/badge-details.json`

## Performance Load Suite

Run load profile for live-agent translation path, UI navigation execution, and gateway WebSocket replay/dedupe contract:

```powershell
npm run perf:load
```

Fast mode (skip build):

```powershell
npm run perf:load:fast
```

If services are already running, execute raw profile only:

```powershell
npm run perf:profile
```

Validate performance/error-budget policy on generated report:

```powershell
npm run perf:load:policy
```

Default artifacts:

- `artifacts/perf-load/summary.json`
- `artifacts/perf-load/summary.md`
- `artifacts/perf-load/policy-check.json`
- `artifacts/perf-load/policy-check.md`

Example with custom thresholds:

```powershell
node ./scripts/perf-load.mjs --liveIterations 30 --liveConcurrency 6 --uiIterations 30 --uiConcurrency 6 --gatewayReplayIterations 12 --gatewayReplayConcurrency 3 --maxLiveP95Ms 1800 --maxUiP95Ms 25000 --maxGatewayReplayP95Ms 9000 --maxGatewayReplayErrorRatePct 20 --maxAggregateErrorRatePct 10
node ./scripts/perf-load-policy-check.mjs --input ./artifacts/perf-load/summary.json --maxLiveP95Ms 1800 --maxUiP95Ms 25000 --maxGatewayReplayP95Ms 9000 --maxGatewayReplayErrorRatePct 20 --maxAggregateErrorRatePct 10 --requiredUiAdapterMode remote_http
```

## Story Media Worker Runtime

Long-running storyteller media jobs (Veo/Imagen profile) run through dedicated async worker slots with queue visibility, retry budget, and quota-aware scheduling.

- Queue snapshot in story responses: `payload.output.mediaJobs.queue`
- Queue operator endpoint: `GET http://localhost:8082/story/media-jobs/queue`
- Queue metrics are embedded into orchestrator metrics response: `GET http://localhost:8082/metrics` -> `storytellerMediaJobs`
- Story cache snapshot in story responses: `payload.output.generation.cache`
- Story cache endpoints: `GET http://localhost:8082/story/cache` and `POST http://localhost:8082/story/cache/purge?reason=<reason>`
- Story cache metrics are embedded into orchestrator metrics response: `GET http://localhost:8082/metrics` -> `storytellerCache`

Worker runtime knobs:

- `STORYTELLER_MEDIA_WORKER_ENABLED` (default: `true`)
- `STORYTELLER_MEDIA_WORKER_CONCURRENCY` (default: `2`)
- `STORYTELLER_MEDIA_WORKER_POLL_MS` (default: `120`)
- `STORYTELLER_MEDIA_JOB_MAX_ATTEMPTS` (default: `3`)
- `STORYTELLER_MEDIA_JOB_RETRY_BASE_MS` (default: `800`)
- `STORYTELLER_MEDIA_JOB_RETRY_MAX_MS` (default: `20000`)
- `STORYTELLER_MEDIA_QUOTA_RULES` (default: `veo-3.1=1/1000,imagen-4=2/1000,*=2/1000`)
- `STORYTELLER_CACHE_ENABLED` (default: `true`)
- `STORYTELLER_CACHE_MAX_ENTRIES` (default: `600`)
- `STORYTELLER_CACHE_TTL_MS` (default: `1800000`)
- `STORYTELLER_CACHE_VERSION` (default: `story-cache-v1`)
- `STORYTELLER_CACHE_PURGE_TOKEN` (default: unset; changing token invalidates cache policy)

## Runtime Profiles

Runtime guardrails use `APP_ENV` + profile flags:

- `APP_ENV=dev|staging|prod` (default resolves to `dev`)
- `RUNTIME_PROFILE=standard|local-first` or `LOCAL_FIRST_PROFILE=true`
- `local-first` is blocked outside `APP_ENV=dev`

Profile smoke checks:

```powershell
npm run profile:smoke
```

Full profile matrix and disabled features: `docs/local-first-profile.md`.

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

## Capability Adapter Boundary

- Capability contracts are centralized in `@mla/capabilities` (`shared/capabilities`):
  - `live`
  - `reasoning`
  - `tts`
  - `image`
  - `video`
  - `computer_use`
- Default Gemini/Google adapters are wired in:
  - `agents/live-agent` (`live` + `reasoning`)
  - `agents/storyteller-agent` (`reasoning` + `image` + `video` + `tts`)
  - `agents/ui-navigator-agent` (`reasoning` + `computer_use`)
- Each orchestrator response now carries adapter `capabilityProfile` for audit/debug, and demo policy checks enforce `kpi.capabilityAdaptersValidated=true`.

## Task Registry Endpoints

- Realtime gateway exposes active task state:
  - `GET /tasks/active?sessionId=<id>&limit=50`
  - `GET /tasks/<taskId>`
- Task lifecycle events are streamed in websocket channel:
  - `task.started`
  - `task.progress`
  - `task.completed`
  - `task.failed`

## Session State Transitions

- Realtime gateway streams explicit `session.state` events for frontend state visibility:
  - `socket_connected`
  - `session_bound`
  - `orchestrator_dispatching`
  - `orchestrator_pending_approval`
  - `orchestrator_completed`
  - `orchestrator_failed`
  - `text_fallback`
- Transition payload includes previous state and connection metadata, and envelopes include correlation context (`userId`, `sessionId`, `runId`).

## Error Contract

- REST errors are normalized as:
  - `{ "ok": false, "error": { "code": "...", "message": "...", "traceId": "...", "details": { ... } } }`
- WebSocket gateway errors use the same normalized payload in `gateway.error` envelopes.

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
