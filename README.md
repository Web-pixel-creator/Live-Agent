# Multimodal Live Agent Starter

Starter workspace for the "next-generation agents" spec:

- Live Agent (realtime voice/video, interruption, translation, negotiation)
- Creative Storyteller (Gemini + Imagen + Veo + TTS)
- UI Navigator (Computer Use + action execution)

![PR Quality Gate](https://github.com/Web-pixel-creator/Live-Agent/actions/workflows/pr-quality.yml/badge.svg)
![Demo E2E](https://github.com/Web-pixel-creator/Live-Agent/actions/workflows/demo-e2e.yml/badge.svg)
![Release Strict Final Gate](https://github.com/Web-pixel-creator/Live-Agent/actions/workflows/release-strict-final.yml/badge.svg)
![Demo KPI Badge](https://img.shields.io/endpoint?url=https%3A%2F%2Flive-agent-production.up.railway.app%2Fdemo-e2e%2Fbadge.json)

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
Frontend `Intent Request -> Send Conversation Item` supports multimodal parts: text + optional image + optional audio attachment.
Frontend `Live Controls -> Apply Live Setup` can send runtime `live.setup` overrides (`model`, `voice`, `activityHandling`, `systemInstruction`).
Frontend `Intent Request` also supports optional `ui_task` grounding overrides (`url`, `deviceNodeId`, `screenshotRef`, `domSnapshot`, `accessibilityTree`, `markHints`).

5. Optional runtime integrations:
- Firestore adapter (orchestrator): set `FIRESTORE_ENABLED=true` and `GOOGLE_CLOUD_PROJECT`.
- Live API bridge (gateway): set `LIVE_API_ENABLED=true`, `LIVE_API_WS_URL`, and auth values.
- Live API protocol profile (gateway): set `LIVE_API_PROTOCOL=gemini` (default), `LIVE_API_AUTO_SETUP=true`, and tune `LIVE_AUDIO_MIME_TYPE` if needed.
- Live gateway resilience tuning: configure `LIVE_CONNECT_ATTEMPT_TIMEOUT_MS`, `LIVE_CONNECT_RETRY_MS`, `LIVE_CONNECT_MAX_ATTEMPTS`, `LIVE_MAX_STALE_CHUNK_MS`.
- Live gateway failover/health tuning: `LIVE_MODEL_FALLBACK_IDS`, `LIVE_API_FALLBACK_KEYS`, `LIVE_API_AUTH_PROFILES_JSON`, `LIVE_FAILOVER_COOLDOWN_MS`, `LIVE_FAILOVER_RATE_LIMIT_COOLDOWN_MS`, `LIVE_FAILOVER_AUTH_DISABLE_MS`, `LIVE_FAILOVER_BILLING_DISABLE_MS`, `LIVE_HEALTH_CHECK_INTERVAL_MS`, `LIVE_HEALTH_SILENCE_MS`, `LIVE_HEALTH_PING_ENABLED`, `LIVE_HEALTH_PROBE_GRACE_MS`.
- Live setup tuning: `LIVE_SETUP_VOICE_NAME`, `LIVE_SYSTEM_INSTRUCTION`, `LIVE_REALTIME_ACTIVITY_HANDLING`, `LIVE_ENABLE_INPUT_AUDIO_TRANSCRIPTION`, `LIVE_ENABLE_OUTPUT_AUDIO_TRANSCRIPTION`, `LIVE_SETUP_PATCH_JSON` (JSON object merged into setup for tools/toolConfig overrides).
- Live function auto-dispatch tuning: `LIVE_FUNCTION_AUTO_INVOKE`, `LIVE_FUNCTION_ALLOWLIST`, `LIVE_FUNCTION_ARGUMENT_MAX_BYTES`, `LIVE_FUNCTION_UI_SANDBOX_MODE`, `LIVE_FUNCTION_DEDUPE_TTL_MS`.
- Gateway websocket binding guardrails: each message carries correlation context (`userId/sessionId/runId`), and gateway rejects bound-socket mismatch (`GATEWAY_SESSION_MISMATCH`, `GATEWAY_USER_MISMATCH`).
- WebSocket integration contract and error taxonomy: `docs/ws-protocol.md`.
- WebRTC V2 transport spike plan (no MVP switch): `docs/webrtc-v2-spike.md`.
- WebRTC rollout telemetry controls (status-only, no transport cutover): `GATEWAY_WEBRTC_ROLLOUT_STAGE=disabled|spike|shadow|canary`, `GATEWAY_WEBRTC_CANARY_PERCENT=0..100`, `GATEWAY_WEBRTC_ROLLBACK_READY=true|false`.
- Gateway -> orchestrator request resilience: configure `GATEWAY_ORCHESTRATOR_TIMEOUT_MS`, `GATEWAY_ORCHESTRATOR_MAX_RETRIES`, `GATEWAY_ORCHESTRATOR_RETRY_BACKOFF_MS`.
- Gateway orchestrator replay-dedupe tuning: `GATEWAY_ORCHESTRATOR_DEDUPE_TTL_MS` (idempotent response replay window for duplicate websocket requests).
- API -> orchestrator request resilience: configure `API_ORCHESTRATOR_TIMEOUT_MS`, `API_ORCHESTRATOR_MAX_RETRIES`, `API_ORCHESTRATOR_RETRY_BACKOFF_MS`.
- Orchestrator idempotency cache tuning: `ORCHESTRATOR_IDEMPOTENCY_TTL_MS` (in-flight + completed request dedupe window).
- Orchestrator assistive LLM router (feature-flagged): `ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED`, `ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL`, `ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY`, `ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL`, `ORCHESTRATOR_ASSISTIVE_ROUTER_TIMEOUT_MS`, `ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE`, `ORCHESTRATOR_ASSISTIVE_ROUTER_ALLOW_INTENTS` (details: `docs/assistive-router.md`).
- Live-agent Gemini text features (translation/conversation): set `GEMINI_API_KEY` (or `LIVE_AGENT_GEMINI_API_KEY`) and optionally tune `LIVE_AGENT_TRANSLATION_MODEL` / `LIVE_AGENT_CONVERSATION_MODEL`.
- Live-agent context compaction tuning: `LIVE_AGENT_CONTEXT_COMPACTION_ENABLED`, `LIVE_AGENT_CONTEXT_MAX_TOKENS`, `LIVE_AGENT_CONTEXT_TARGET_TOKENS`, `LIVE_AGENT_CONTEXT_KEEP_RECENT_TURNS`, `LIVE_AGENT_CONTEXT_MAX_SESSIONS`, `LIVE_AGENT_CONTEXT_SUMMARY_MODEL`.
- Storyteller pipeline config: set `STORYTELLER_*` envs for planner models and media mode (`STORYTELLER_MEDIA_MODE=fallback|simulated`).
- UI Navigator planner config: set `UI_NAVIGATOR_*` envs for Computer Use-style planning, max steps, and approval keyword policy.
- UI Navigator executor modes: `UI_NAVIGATOR_EXECUTOR_MODE=simulated|playwright_preview|remote_http`, optional `UI_NAVIGATOR_EXECUTOR_URL`, remote fallback behavior `UI_NAVIGATOR_REMOTE_HTTP_FALLBACK_MODE=simulated|failed`, and timeout/retry controls `UI_NAVIGATOR_EXECUTOR_TIMEOUT_MS`, `UI_NAVIGATOR_EXECUTOR_MAX_RETRIES`, `UI_NAVIGATOR_EXECUTOR_RETRY_BACKOFF_MS`.
- UI Navigator device-node routing: `UI_NAVIGATOR_DEVICE_NODE_INDEX_URL`, `UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_TOKEN`, `UI_NAVIGATOR_DEVICE_NODE_INDEX_TIMEOUT_MS`, `UI_NAVIGATOR_DEVICE_NODES_JSON`.
- UI Navigator loop guard tuning: `UI_NAVIGATOR_LOOP_DETECTION_ENABLED`, `UI_NAVIGATOR_LOOP_WINDOW_SIZE`, `UI_NAVIGATOR_LOOP_REPEAT_THRESHOLD`, `UI_NAVIGATOR_LOOP_SIMILARITY_THRESHOLD`.
- UI Navigator sandbox policy tuning: `UI_NAVIGATOR_SANDBOX_POLICY_MODE=off|non-main|all`, `UI_NAVIGATOR_SANDBOX_MAIN_SESSION_IDS`, `UI_NAVIGATOR_SANDBOX_MAX_STEPS`, `UI_NAVIGATOR_SANDBOX_ALLOWED_ACTIONS`, `UI_NAVIGATOR_SANDBOX_BLOCKED_CATEGORIES`, `UI_NAVIGATOR_SANDBOX_FORCE_EXECUTOR_MODE`.
- UI Navigator damage-control policy: `UI_NAVIGATOR_DAMAGE_CONTROL_ENABLED`, `UI_NAVIGATOR_DAMAGE_CONTROL_RULES_PATH` (default `.kiro/policies/ui-damage-control.rules.json`), optional inline override `UI_NAVIGATOR_DAMAGE_CONTROL_RULES_JSON`.
- Skills runtime tuning: `SKILLS_RUNTIME_ENABLED`, `SKILLS_SOURCE_PRECEDENCE=workspace,bundled,managed`, `SKILLS_ALLOWED_SOURCES`, `SKILLS_WORKSPACE_DIR`, `SKILLS_BUNDLED_DIR`, `SKILLS_MANAGED_INDEX_JSON`, `SKILLS_MANAGED_INDEX_URL`, `SKILLS_MANAGED_INDEX_AUTH_TOKEN`, `SKILLS_MANAGED_INDEX_TIMEOUT_MS`, `SKILLS_ENABLED_IDS`, `SKILLS_DISABLED_IDS`, `SKILLS_SECURITY_MODE=off|warn|enforce`, `SKILLS_MIN_TRUST_LEVEL=untrusted|reviewed|trusted`.
- Plugin marketplace signing for managed skills: `SKILL_PLUGIN_REQUIRE_SIGNATURE=true|false`, `SKILL_PLUGIN_SIGNING_KEYS_JSON` (JSON map `{ "<keyId>": "<hmacSecret>" }`).
- Remote UI executor service: run `npm run dev:ui-executor`; endpoint `/execute` is used when `UI_NAVIGATOR_EXECUTOR_MODE=remote_http`.
- UI Executor device-node registry knobs: `UI_EXECUTOR_DEFAULT_DEVICE_NODE_ID`, `UI_EXECUTOR_DEVICE_NODES_JSON`.
- Approval SLA tuning in API backend: `APPROVAL_SOFT_TIMEOUT_MS`, `APPROVAL_HARD_TIMEOUT_MS`, `APPROVAL_SWEEP_LIMIT`.
- Local-first profile for offline iteration: set `LOCAL_FIRST_PROFILE=true` and `APP_ENV=dev` (guardrail blocks local-first in `staging/prod`). Profile details: `docs/local-first-profile.md`.
- Telemetry storage split profile (`T-221`): `ANALYTICS_EXPORT_ENABLED`, `ANALYTICS_EXPORT_METRICS_TARGET`, `ANALYTICS_EXPORT_EVENTS_TARGET`, `ANALYTICS_EXPORT_SAMPLE_RATE`, `ANALYTICS_BIGQUERY_DATASET`, `ANALYTICS_BIGQUERY_TABLE`; policy docs: `docs/telemetry-storage-split.md`.
- GCP provisioning helper for telemetry split: `pwsh ./infra/gcp/setup-analytics-sinks.ps1 -ProjectId "<project-id>" -Location "US" -DatasetId "agent_analytics"`.
- GCP monitoring baseline helper (dashboard + alerts): `pwsh ./infra/gcp/setup-monitoring-baseline.ps1 -ProjectId "<project-id>" -NotificationChannels "projects/<project-id>/notificationChannels/<channel-id>"`.
- One-shot observability setup wrapper: `pwsh ./infra/gcp/setup-observability.ps1 -ProjectId "<project-id>" -Region "us-central1" -Location "US" -DatasetId "agent_analytics"`.
- Monitoring template validation (local/CI): `npm run infra:monitoring:validate`.
- Observability evidence collector for judges: `pwsh ./infra/gcp/collect-observability-evidence.ps1 -ProjectId "<project-id>" -DatasetId "agent_analytics" -LookbackHours 24`.
- Judge-ready observability report generation: `npm run infra:observability:report`.
- Observability artifact integrity check (required files + summary shape): `npm run infra:observability:check`.
- GitHub Actions workflow for observability evidence: `.github/workflows/observability-evidence.yml` (manual dispatch; set `collect_live=true`, `project_id`, and repository secret `GCP_CREDENTIALS_JSON`).

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
- Tenant scope baseline:
  - Set request tenant via header `x-tenant-id` (or query `tenantId`).
  - Session list/create are tenant-scoped (`tenantId` returned in session payload).
  - Configure defaults with `API_DEFAULT_TENANT_ID` and `API_COMPLIANCE_TEMPLATE`.

8. Managed skills registry APIs:
- `GET /v1/skills/index` -> public managed skills index for agent runtime (`managed` source).
- `GET /v1/skills/registry` with `x-operator-role` -> operator catalog view (`limit`, `scope`, `includeDisabled`).
- `POST /v1/skills/registry` with `x-operator-role: admin` -> versioned upsert (`expectedVersion` for optimistic locking).
  - Supports plugin marketplace manifest:
    - `pluginManifest.permissions[]` (validated against allowlist).
    - `pluginManifest.signing.{algorithm,keyId,signature}` for `hmac-sha256` verification.
  - Signature validation error contracts: `API_SKILL_PLUGIN_PERMISSION_INVALID`, `API_SKILL_PLUGIN_SIGNATURE_REQUIRED`, `API_SKILL_PLUGIN_SIGNATURE_INVALID`, `API_SKILL_PLUGIN_SIGNING_KEY_NOT_FOUND`.

9. Device node registry APIs:
- `GET /v1/device-nodes/index` -> public device-node index for runtime routing (`limit`, `kind`, `includeOffline`).
- `GET /v1/device-nodes` with `x-operator-role` -> operator registry view.
- `POST /v1/device-nodes` with `x-operator-role: admin` -> versioned upsert (`expectedVersion` supported).
- `POST /v1/device-nodes/heartbeat` with `x-operator-role: operator|admin` -> update node liveness/status.

9.5 Multi-channel session binding APIs (`T-301` baseline):
- `GET /v1/channels/adapters` -> enabled channel adapters from env (`API_CHANNEL_ADAPTERS`).
- `GET /v1/channels/sessions/index` -> compact index (`adapterId`, `sessionId`, `userId`, `externalUserId`, `limit` filters).
- `GET /v1/channels/sessions` -> full binding records with same filters.
- `GET /v1/channels/sessions/resolve?adapterId=<id>&externalSessionId=<id>` -> resolve external channel session to internal session/user.
- `POST /v1/channels/sessions/bind` -> create/update adapter binding with optimistic versioning (`expectedVersion`) and idempotency key (`idempotencyKey` or `x-idempotency-key`).
- Optional env:
  - `API_CHANNEL_ADAPTERS=webchat,telegram,slack`
  - `API_CHANNEL_ADAPTERS_ALLOW_CUSTOM=true|false`

10. Operator console APIs (RBAC via `x-operator-role: viewer|operator|admin`):
- `GET /v1/operator/summary` -> active tasks, approvals snapshot, service runtime/health summary, and execution trace rollup (runs/events/tool steps/screenshots/approval links).
- `POST /v1/operator/actions` with:
  - `action=cancel_task` + `taskId`
  - `action=retry_task` + `taskId`
  - `action=failover` + `targetService` + `operation` (`drain|warmup`, admin only)
- Summary response now includes `operatorActions.recent` audit trail for cancel/retry/failover operations (role, outcome, reason, target/task metadata).

10.5 Governance APIs (`T-304.1` + `T-304.2` baseline):
- `GET /v1/governance/tenant` -> resolved tenant context (`tenantId`, source, compliance template).
- `GET /v1/governance/compliance-template` -> active compliance template profile + available templates.
- `GET /v1/governance/retention-policy` -> effective retention policy (template + env overrides).
- `GET /v1/governance/policy` (`x-operator-role: viewer|operator|admin`) -> effective tenant policy; admin can query `tenantId=all` for overrides snapshot.
- `POST /v1/governance/policy` (`x-operator-role: admin`) -> mutate tenant compliance/retention policy with optimistic versioning (`expectedVersion`) + idempotency key (`idempotencyKey` or `x-idempotency-key`); all mutations are audited via `operator_actions`.
- `GET /v1/governance/audit/operator-actions` -> tenant-scoped operator audit stream (`viewer|operator|admin`); non-admin cross-tenant queries are rejected.
- `GET /v1/governance/audit/summary` -> centralized tenant audit dashboard snapshot (operator actions, approvals, sessions, channel bindings). Admin can query `tenantId=all`.

11. Demo frontend includes an Operator Console panel for summary refresh and recovery actions.

12. Real Playwright remote-http run (no simulation fallback):
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

CI split:

- PR quick gate: `.github/workflows/pr-quality.yml` (`verify:deploy:railway:dry` + build + unit + profile smoke + monitoring validate + `demo:e2e:fast` + policy + badge artifact).
- Full gate on `main/master` + manual dispatch: `.github/workflows/demo-e2e.yml` (includes perf-load policy gate and best-effort badge publish to `gh-pages`).

Fast mode (skip workspace build):

```powershell
npm run demo:e2e:fast
```

Fast mode with built-in full-run retry (demo-only, skips policy/badge/perf gates):

```powershell
npm run demo:e2e:fast:retry
```

Policy validation for generated report:

```powershell
npm run demo:e2e:policy
```

Badge artifact generation:

```powershell
npm run demo:e2e:badge
```

Single-command local quality gate (build + unit tests + profile smoke + demo e2e + policy + badge + perf load policy):

```powershell
npm run verify:release
```

Note: `verify:release` reuses the prebuilt workspace and runs `demo:e2e:fast` with `RequestTimeoutSec=45` for stability of long approval-resume paths. The gate also syncs `artifacts/demo-e2e/badge*.json` into `public/demo-e2e/` for runtime badge endpoints.

Strict final pre-submission gate (zero scenario retries allowed):

```powershell
npm run verify:release:strict
```

Strict gate with existing perf artifacts (skip perf rerun):

```powershell
npm run verify:release:strict:skip-perf-run
```

Artifact-only revalidation (no build/test/demo reruns, validates existing artifacts):

```powershell
npm run verify:release:artifact-only
```
This gate requires `artifacts/release-artifact-revalidation/source-run.json` (provenance manifest). The recommended path is `npm run verify:release:artifact:revalidate` or workflow `.github/workflows/release-artifact-revalidation.yml`, both of which generate the manifest automatically.

Local artifact-only smoke (self-contained, no GitHub API, generates temp perf + provenance artifacts and runs the real artifact-only gate):

```powershell
npm run verify:release:artifact-only:smoke
```
Strict final variant (enforces strict release policy inside smoke gate):

```powershell
npm run verify:release:artifact-only:smoke:strict
```
Debug variant (keeps generated temp artifacts for inspection):

```powershell
npm run verify:release:artifact-only:smoke:keep-temp
```

Optional CI equivalent for fast sanity (without artifact download): run workflow `.github/workflows/release-artifact-only-smoke.yml` with `strict_final_run=true|false`.
This workflow uploads debug artifacts as `release-artifact-only-smoke-artifacts` (`artifacts/release-artifact-only-smoke/summary.json`, `artifacts/release-artifact-only-smoke/smoke.log`).

Artifact bundle pull + local revalidation (downloads latest successful `demo-e2e`/`release-strict-final` bundle, restores `artifacts/`, then runs artifact-only gate):

```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
$env:GITHUB_TOKEN="<token-with-actions-read>"
npm run verify:release:artifact:revalidate
```

If `GITHUB_TOKEN`/`GH_TOKEN` is not set, the helper attempts `gh auth token` (GitHub CLI must be authenticated via `gh auth login`).

Optional local helper flags:
- `-- -SourceRunId <id>` - force specific workflow run.
- `-- -ArtifactName <name>` - force specific artifact bundle name.
- `-- -GithubApiMaxAttempts <n>` - max retry attempts for GitHub API + artifact download calls (default `3`).
- `-- -GithubApiRetryBackoffMs <ms>` - linear backoff base for GitHub API/download retries (default `1200`).
- `-- -MaxSourceRunAgeHours <n>` - maximum source-run age guard in hours (default `168`, `0` disables).
- `-- -AllowAnySourceBranch` - allow source runs outside `main/master` (disabled by default).
- `-- -StrictFinalRun` - enforce strict artifact gate (`scenarioRetriesUsedCount = 0`).
- `-- -PerfGateMode auto|with_perf|without_perf` - explicit local perf gate mode.
- `-- -SkipPerfLoadGate` - legacy alias for `-- -PerfGateMode without_perf` (deprecated).
- `-- -SkipArtifactOnlyGate` - restore artifacts without running release gate.
- Perf gate is auto-skipped when downloaded bundle has no `artifacts/perf-load/*` (for example `pr-quality-artifacts`).
- Helper writes source provenance manifest to `artifacts/release-artifact-revalidation/source-run.json`.

Optional faster local pass (skip build):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/release-readiness.ps1 -SkipBuild
```

Single-command local PR-equivalent gate (same checks as `pr-quality.yml`, without perf):

```powershell
npm run verify:pr
```

Note: `verify:pr` uses fast demo mode (`demo:e2e:fast`) with a slightly higher request timeout for CI stability.

Direct mode with explicit thresholds:

```powershell
node ./scripts/demo-e2e-policy-check.mjs --input ./artifacts/demo-e2e/summary.json --output ./artifacts/demo-e2e/policy-check.md --maxGatewayWsRoundTripMs 1800 --minApprovalsRecorded 1 --maxUiApprovalResumeElapsedMs 60000 --minUiApprovalResumeRequestAttempts 1 --maxUiApprovalResumeRequestAttempts 2 --expectedUiAdapterMode remote_http --allowedUiAdapterModes remote_http,simulated --allowedGatewayInterruptEvents live.interrupt.requested,live.bridge.unavailable --allowedTranslationProviders fallback,gemini --allowedVisualComparatorModes fallback_heuristic,gemini_reasoning --allowedStoryMediaModes simulated
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

Runtime public endpoint validation (Railway-first default):

```powershell
npm run badge:public:check
```

By default, `badge:public:check` is strict and requires judge-facing evidence blocks to report `status=pass`.
Use `-- -AllowFailingEvidence` only for schema/debug checks when you intentionally do not want deployment gating.

Optional endpoint overrides:

```powershell
$env:PUBLIC_BADGE_ENDPOINT="https://<host>/demo-e2e/badge.json"
$env:PUBLIC_BADGE_DETAILS_ENDPOINT="https://<host>/demo-e2e/badge-details.json"
# or set base host only:
$env:RAILWAY_PUBLIC_URL="https://<host>"
# optional: expose demo frontend URL in gateway root descriptor (`GET /`)
$env:DEMO_FRONTEND_PUBLIC_URL="https://<demo-frontend-host>"
npm run badge:public:check
```

`badge-details.json` includes judge-facing operator evidence snapshots:
- `evidence.operatorTurnTruncation`
- `evidence.operatorTurnDelete`
- `evidence.damageControl`
- `evidence.operatorDamageControl`
- `evidence.governancePolicy`
- `evidence.skillsRegistry`

## Repository Publish Automation

Publish flow script (git init/commit/push + optional Pages + optional badge polling):

```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
$env:GITHUB_TOKEN="<token-with-repo-pages-permissions>"
npm run repo:publish
```

By default `repo:publish` runs pre-publish release verification (`npm run verify:release`). For strict final publishing, use `-StrictReleaseVerification`.
If `origin` already points to the same GitHub repository with a different URL format (SSH vs HTTPS), `repo:publish` now treats it as equivalent and continues without `-ForceRemoteUpdate`.

Publish + deploy to Railway in one command:

```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
$env:RAILWAY_PROJECT_ID="bbca2889-fd0d-48fe-bded-79802230e5a6"
$env:RAILWAY_SERVICE_ID="b8c1a952-da24-4410-a53a-82b634b70f47"
$env:RAILWAY_ENVIRONMENT="production"
npm run repo:publish -- -DeployRailway -SkipPages -SkipBadgeCheck
```

Publish + deploy to Railway with explicit post-deploy badge check controls:

```powershell
npm run repo:publish -- -DeployRailway -SkipPages -SkipBadgeCheck -RailwayPublicUrl https://live-agent-production.up.railway.app -RailwayPublicBadgeCheckTimeoutSec 30
```

Trigger-only Railway deploy (no wait + no post-deploy badge check):

```powershell
npm run repo:publish -- -DeployRailway -SkipPages -SkipBadgeCheck -RailwayNoWait -RailwaySkipPublicBadgeCheck
```

Publish + deploy gateway and frontend Railway services in one command:

```powershell
npm run repo:publish -- -DeployRailway -DeployRailwayFrontend -SkipPages -SkipBadgeCheck -RailwayPublicUrl https://live-agent-production.up.railway.app -RailwayFrontendService "Live-Agent-Frontend"
```

When `-DeployRailwayFrontend` is enabled and frontend URLs are not passed explicitly, `repo:publish` derives:
- `FRONTEND_API_BASE_URL` from `-RailwayPublicUrl`
- `FRONTEND_WS_URL` as `<ws(s)://host>/realtime`

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
- `-SkipReleaseVerification` - skip pre-publish release verification (`verify:release`).
- `-StrictReleaseVerification` - use strict pre-publish gate (`verify:release:strict`).
- `-DeployRailway` - trigger Railway deploy after publish (calls `scripts/railway-deploy.ps1` with `-SkipReleaseVerification`).
- `-RailwayProjectId` / `-RailwayServiceId` / `-RailwayEnvironment` / `-RailwayWorkspace` - Railway target overrides.
- `-RailwaySkipLink` - skip `railway link` step and use existing linked service.
- `-RailwaySkipRootDescriptorCheck` - skip Railway post-deploy gateway root descriptor check (`GET /`).
- `-RailwaySkipPublicBadgeCheck` - skip Railway post-deploy public badge endpoint validation.
- `-RailwayPublicBadgeEndpoint` / `-RailwayPublicBadgeDetailsEndpoint` - override Railway public badge endpoints passed to deploy helper.
- `-RailwayPublicUrl` - Railway public base URL override passed to deploy helper (`/demo-e2e/badge*.json`).
- `-RailwayDemoFrontendPublicUrl` - expected frontend public URL passed to gateway root descriptor validation (`uiUrl`).
- `-RailwayRootDescriptorCheckMaxAttempts <n>` - max retry attempts for gateway root descriptor check inside `repo:publish -> railway-deploy`.
- `-RailwayRootDescriptorCheckRetryBackoffSec <n>` - retry backoff (seconds) for gateway root descriptor check inside `repo:publish -> railway-deploy`.
- `-RailwayPublicBadgeCheckTimeoutSec` - timeout (seconds) for Railway post-deploy public badge endpoint checks.
- `-RailwayNoWait` - return after deploy trigger without waiting for terminal Railway status.
- `-DeployRailwayFrontend` - trigger Railway frontend deploy after publish (calls `scripts/railway-deploy-frontend.ps1`).
- `-RailwayFrontendProjectId` / `-RailwayFrontendService` / `-RailwayFrontendEnvironment` / `-RailwayFrontendPath` - frontend deploy target/path overrides.
- `-RailwayFrontendWsUrl` / `-RailwayFrontendApiBaseUrl` - explicit frontend runtime endpoints (`FRONTEND_WS_URL` / `FRONTEND_API_BASE_URL`).
- `-RailwayFrontendNoWait` - trigger frontend deploy without waiting for terminal status.
- `-RailwayFrontendSkipHealthCheck` - skip frontend `/healthz` check after successful deploy.
- `-RailwayFrontendHealthCheckTimeoutSec` - frontend `/healthz` timeout override.

## Railway Deploy Automation

Deploy current workspace to a linked Railway service:

```powershell
$env:RAILWAY_PROJECT_ID="bbca2889-fd0d-48fe-bded-79802230e5a6"
$env:RAILWAY_SERVICE_ID="b8c1a952-da24-4410-a53a-82b634b70f47"
$env:RAILWAY_ENVIRONMENT="production"
npm run deploy:railway
```

Deploy gateway + frontend in one command:

```powershell
npm run deploy:railway:all -- -ProjectId "bbca2889-fd0d-48fe-bded-79802230e5a6" -GatewayServiceId "b8c1a952-da24-4410-a53a-82b634b70f47" -FrontendService "Live-Agent-Frontend" -Environment production -SkipReleaseVerification -GatewayPublicUrl https://live-agent-production.up.railway.app
```

Dispatch `railway-deploy-all.yml` workflow from local CLI (with optional wait for completion):

```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
npm run deploy:railway:all:dispatch -- -Environment production -GatewayPublicUrl https://live-agent-production.up.railway.app -SkipReleaseVerification
```

`deploy:railway:all:dispatch` auth uses `-Token`, then `GITHUB_TOKEN`/`GH_TOKEN`, then fallback `gh auth token`.

Behavior:

- Runs release verification before deploy (`verify:release` by default).
- Links local directory to Railway project/service when both `-ProjectId` and `-ServiceId` are provided.
- If `-ProjectId/-ServiceId` are omitted, reuses existing Railway linked context for this workspace.
- Triggers deployment (`railway up`) and waits until terminal status.
- Uses `railway.json` config-as-code to pin Railway runtime start command (`node --import tsx apps/realtime-gateway/src/index.ts`) for workspace TypeScript imports.
- Prints effective runtime metadata after successful deploy (`start command`, `config-as-code source`, `effective public URL`).
- `GET /` on Railway returns gateway service descriptor JSON (health/status/metrics/ws/badge links). Interactive UI (`demo-frontend`) is deployed separately.
- Runs gateway root descriptor check (`GET /`) after successful deploy.
  - Root descriptor check retries automatically (`-RootDescriptorCheckMaxAttempts`, `-RootDescriptorCheckRetryBackoffSec`) to tolerate transient post-rollout warmup failures.
  - When `-DemoFrontendPublicUrl` is provided, deploy helper also updates Railway gateway variable `DEMO_FRONTEND_PUBLIC_URL` (`--skip-deploys`) before rollout so root descriptor returns `uiUrl`.
  - If `-DemoFrontendPublicUrl` is omitted and `FRONTEND_PUBLIC_URL` is set, combined helper auto-uses `FRONTEND_PUBLIC_URL` as gateway `uiUrl` contract target.
- Runs post-deploy public badge endpoint check (`badge:public:check` helper logic) after successful deploy.
- In `-- -NoWait` mode, post-deploy gateway root descriptor and badge endpoint checks are not executed (trigger-only flow).

Fast contract-only dry gate for Railway deploy/repo-publish wiring:

```powershell
npm run verify:deploy:railway:dry
```

Common flags:

- `-- -StrictReleaseVerification` - use strict pre-deploy gate (`verify:release:strict`).
- `-- -SkipReleaseVerification` - skip local verification before deploy.
- `-- -ProjectId <id> -- -ServiceId <id>` - explicit Railway link target override for current run (must be provided as a pair).
- `-- -SkipRootDescriptorCheck` - skip post-deploy gateway root descriptor check.
- `-- -RootDescriptorCheckMaxAttempts <n>` - max retry attempts for root descriptor check (default `3`).
- `-- -RootDescriptorCheckRetryBackoffSec <n>` - retry backoff in seconds for root descriptor check (default `2`).
- `-- -SkipPublicBadgeCheck` - skip post-deploy public badge endpoint check.
- `-- -DemoFrontendPublicUrl <url>` - expected demo frontend URL for root descriptor validation (`uiUrl` contract) and auto-sync to gateway runtime variable `DEMO_FRONTEND_PUBLIC_URL`.
- `FRONTEND_PUBLIC_URL` env/variable can serve as fallback source for `-DemoFrontendPublicUrl` in combined helper/workflow dispatch.
- `-- -SkipFailureLogs` - do not auto-fetch Railway build/deployment logs when deploy fails or times out.
- `-- -SkipLink` - deploy using already linked Railway service.
- `-- -NoWait` - return immediately after deploy trigger.
- `-- -FailureLogLines <n>` - number of lines to fetch for failure diagnostics (`120` by default).
- `-- -PublicBadgeEndpoint <url>` / `-- -PublicBadgeDetailsEndpoint <url>` - override public badge endpoints.
- `-- -RailwayPublicUrl <url>` - set base URL used by badge checker (`/demo-e2e/badge*.json`).
- Combined helper (`deploy:railway:all`) forwards gateway flags (`-SkipReleaseVerification`, `-StrictReleaseVerification`, `-GatewaySkipLink`, `-GatewaySkipRootDescriptorCheck`, `-GatewaySkipPublicBadgeCheck`, `-GatewayNoWait`, `-GatewayDemoFrontendPublicUrl`, `-GatewayRootDescriptorCheckMaxAttempts`, `-GatewayRootDescriptorCheckRetryBackoffSec`) and frontend flags (`-FrontendNoWait`, `-FrontendSkipHealthCheck`), and derives frontend runtime URLs from `-GatewayPublicUrl` when explicit frontend URLs are not set.

## Railway Frontend Service

Public demo frontend URL:

```text
https://live-agent-frontend-production.up.railway.app
```

Deploy `apps/demo-frontend` as a standalone Railway service:

```powershell
railway up apps/demo-frontend --path-as-root -s "Live-Agent-Frontend" -e production -p "bbca2889-fd0d-48fe-bded-79802230e5a6" -d
```

Or deploy via helper script:

```powershell
npm run deploy:railway:frontend -- -Service "Live-Agent-Frontend" -Environment production -ProjectId "bbca2889-fd0d-48fe-bded-79802230e5a6"
```

Recommended frontend runtime variables for this project:

```powershell
railway variable set -s "Live-Agent-Frontend" -e production --skip-deploys "FRONTEND_WS_URL=wss://live-agent-production.up.railway.app/realtime"
railway variable set -s "Live-Agent-Frontend" -e production --skip-deploys "FRONTEND_API_BASE_URL=https://live-agent-production.up.railway.app"
```

Notes:

- Frontend serves `GET /config.json` and applies `FRONTEND_WS_URL` / `FRONTEND_API_BASE_URL` at bootstrap.
- Frontend service health endpoint: `GET /healthz`.
- Frontend service config-as-code is at `apps/demo-frontend/railway.json`.
- Helper flags: `-NoWait`, `-SkipHealthCheck`, `-StatusPollMaxAttempts`, `-StatusPollIntervalSec`.

## CI Workflow

- PR workflow: `.github/workflows/pr-quality.yml`
- Triggered on pull requests.
- Runs `npm run verify:deploy:railway:dry` (deploy/repo-publish contract checks) before `npm run verify:pr` (build + unit + profile smoke + monitoring validate + demo policy/badge gate).
- Uploads demo artifacts for PR review.

- Railway combined deploy workflow: `.github/workflows/railway-deploy-all.yml`
- Triggered manually (`workflow_dispatch`) to deploy `gateway + frontend` via `npm run deploy:railway:all`.
- Required repository secrets:
  - `RAILWAY_API_TOKEN` (recommended: workspace/account token)
  - `RAILWAY_TOKEN` (legacy fallback; still supported)
  - optional `RAILWAY_PROJECT_TOKEN` (if you want explicit project-token auth path)
  - `RAILWAY_PROJECT_ID`
  - `RAILWAY_SERVICE_ID`
  - optional `RAILWAY_FRONTEND_SERVICE_ID` (if omitted, helper default service name is used).
- Auth-resilience: workflow probes `railway whoami` first; if auth fails and `verify_only_fallback_on_auth_failure=true` (default), it runs verify-only checks (`badge:public:check` + frontend `/healthz`) instead of hard-failing deploy stage.
- Optional repository variable: `FRONTEND_PUBLIC_URL` (used by verify-only fallback frontend health check; default fallback URL is `https://live-agent-frontend-production.up.railway.app`).

- Full workflow: `.github/workflows/demo-e2e.yml`
- Triggered on push to `main`/`master` and manual dispatch.
- Runs unit/profile/monitoring/demo policy gates plus perf-load policy gate.
- Publishes public badge endpoint files (`demo-e2e/badge.json`) to `gh-pages` on `main`/`master`.
- Publishes `summary.md` into GitHub Job Summary for quick review.
- Uploads:
  - `artifacts/demo-e2e/summary.json`
  - `artifacts/demo-e2e/summary.md`
  - `artifacts/demo-e2e/policy-check.md`
  - `artifacts/demo-e2e/policy-check.json`
  - `artifacts/demo-e2e/badge.json`
  - `artifacts/demo-e2e/badge-details.json`
  - `artifacts/demo-e2e/logs`
  - `artifacts/perf-load/summary.json`
  - `artifacts/perf-load/summary.md`
  - `artifacts/perf-load/policy-check.json`
  - `artifacts/perf-load/policy-check.md`
  - `artifacts/perf-load/logs`

- Strict final release workflow: `.github/workflows/release-strict-final.yml`
- Triggered on push to `main`/`master` and manual dispatch.
- Runs `npm run verify:release:strict` (`-StrictFinalRun`) and uploads consolidated release artifacts bundle.
- Manual dispatch supports optional deploy to Railway (`deploy_to_railway=true`) after strict gate passes using `npm run deploy:railway:all`.
- For release-triggered deploy, configure repository secrets: `RAILWAY_API_TOKEN` (recommended), `RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_ID` (optional `RAILWAY_FRONTEND_SERVICE_ID`; legacy fallback `RAILWAY_TOKEN`; optional `RAILWAY_PROJECT_TOKEN`).
- Same auth-resilience path is enabled for strict manual deploys: `verify_only_fallback_on_auth_failure=true` triggers verify-only public endpoint checks when Railway auth probe fails.

Local helper to dispatch the same strict workflow (and optionally wait for completion):

```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
npm run release:strict:dispatch -- -DeployToRailway -RailwayEnvironment production -GatewayPublicUrl https://live-agent-production.up.railway.app
```

Helper auth uses `-Token`, then `GITHUB_TOKEN`/`GH_TOKEN`, then fallback `gh auth token`.

Unified local dispatch entrypoint (single command for both workflow families):

```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
npm run workflow:dispatch -- -Workflow railway_deploy_all -RailwayEnvironment production -GatewayPublicUrl https://live-agent-production.up.railway.app -SkipReleaseVerification
```

```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
npm run workflow:dispatch -- -Workflow release_strict -DeployToRailway -RailwayEnvironment production -GatewayPublicUrl https://live-agent-production.up.railway.app
```

Optional cross-workflow override: `-GatewayDemoFrontendPublicUrl https://live-agent-frontend-production.up.railway.app` (propagates to deploy helper root-descriptor `uiUrl` validation).
Optional root-descriptor retry overrides: `-GatewayRootDescriptorCheckMaxAttempts 5 -GatewayRootDescriptorCheckRetryBackoffSec 3` (propagates through dispatch helpers into workflow inputs and `deploy:railway:all` gateway checks).

Use `-DryRun` to validate argument routing without dispatching workflows:

```powershell
npm run workflow:dispatch -- -Workflow railway_deploy_all -DryRun
```

- Artifact-only release revalidation workflow: `.github/workflows/release-artifact-revalidation.yml`
- Triggered on manual dispatch.
- Resolves latest successful `demo-e2e`/`release-strict-final` run (or uses provided `source_run_id`), downloads artifact bundle, and runs artifact-only release gate.
- Supports manual `workflow_dispatch` inputs:
  - `perf_gate_mode=auto|with_perf|without_perf` for explicit operator control of perf validation behavior.
  - `strict_final_run=true|false` to enforce strict artifact gate (`-StrictFinalRun`).
  - `github_api_max_attempts=<int>=3` for bounded retry count on workflow GitHub API/download operations.
  - `github_api_retry_backoff_ms=<int>=1200` for linear retry backoff on workflow GitHub API/download operations.
  - `max_source_run_age_hours=<int>=168` to block stale source runs (`0` disables age guard).
  - `allow_any_source_branch=true|false` to allow non-`main/master` source runs (default `false`).
- Workflow auto-detects presence of `artifacts/perf-load/*`: with perf artifacts it runs `npm run verify:release:artifact-only`; without perf artifacts (for example `pr-quality-artifacts`) it runs `release-readiness.ps1` with `-SkipPerfLoad`.
- Workflow writes source provenance manifest to `artifacts/release-artifact-revalidation/source-run.json` and includes the path in job summary.
- Job summary includes badge evidence statuses for `operatorDamageControl`, `governancePolicy`, and `skillsRegistry` from `badge-details.json`.
- Local equivalent helper: `npm run verify:release:artifact:revalidate` (uses `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_TOKEN` or `GH_TOKEN`, then falls back to `gh auth token`; enforces `main/master` + source-run age guard by default, supports strict mode and auto-skip for missing perf artifacts).

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
