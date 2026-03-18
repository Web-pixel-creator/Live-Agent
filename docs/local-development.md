# Local Development

## Quick Start

```bash
npm install
```

Run services:

```bash
npm run dev:orchestrator
npm run dev:api
npm run dev:gateway
npm run dev:ui-executor
npm run dev:frontend
```

Frontend: `http://localhost:3000`

Current baseline note: `dev:orchestrator` already links the repo-owned domain agents in-process (`live-agent`, `storyteller-agent`, `ui-navigator-agent`), so the separate `npm run dev:live-agent`, `npm run dev:storyteller-agent`, and `npm run dev:ui-agent` scripts are optional isolated-debug entrypoints rather than required quick-start services.

## UI Executor Runtime Notes

For long-running or checkpointed UI jobs, `ui-executor` can now keep a warm
Playwright session between resume points instead of relaunching the browser on
every slice.

Key knobs:

1. `UI_EXECUTOR_PERSISTENT_BROWSER_SESSIONS=true|false`
2. `UI_EXECUTOR_BROWSER_SESSION_TTL_MS=<milliseconds>`

When enabled, the session pool is surfaced in `GET /status` and
`GET /runtime/config`, and background browser job metadata now reports explicit
session state (`ephemeral`, `pending`, `ready`, `released`, `closed`, `expired`).

## GCP Judge Runtime

For judged submission runs, use `GCP-first` infrastructure instead of the legacy Railway path.

Prerequisites:

1. Google Cloud SDK (`gcloud`) and BigQuery CLI (`bq`) are installed.
2. The target project already has Artifact Registry images for `orchestrator`, `realtime-gateway`, and `api-backend`.
3. Secret Manager contains `LIVE_API_API_KEY`, `LIVE_API_AUTH_HEADER`, and `GOOGLE_GENAI_API_KEY`.

Bootstrap the full judge runtime:

```powershell
pwsh ./infra/gcp/prepare-judge-runtime.ps1 -ProjectId "<your-project-id>" `
  -Region "us-central1" `
  -FirestoreLocation "nam5" `
  -DatasetId "agent_analytics" `
  -ImageTag "<release-tag>"
```

Regenerate the judged submission pack with GCP-first overrides:

```powershell
pwsh ./infra/gcp/refresh-submission-pack.ps1 -ProjectId "<your-project-id>" `
  -Region "us-central1" `
  -DatasetId "agent_analytics" `
  -ImageTag "<release-tag>"
```

The wrapper resolves `GOOGLE_GENAI_API_KEY`, `LIVE_API_API_KEY`, and `LIVE_API_AUTH_HEADER` from the current shell or Secret Manager when `gcloud` is available, forces `LIVE_AGENT_TEXT_PROVIDER=gemini_api`, blanks Moonshot judged overrides, sets `STORYTELLER_MEDIA_MODE=default`, disables `UI_EXECUTOR_FORCE_SIMULATION`, and rewrites the demo/policy/badge/visual evidence chain. If you are running from a shell without `gcloud`, provide `-GoogleGenAiApiKey`, `-LiveApiApiKey`, and `-LiveApiAuthHeader` explicitly.

Key proof outputs:

1. `artifacts/deploy/gcp-cloud-run-summary.json`
2. `artifacts/deploy/gcp-firestore-summary.json`
3. `artifacts/observability/observability-evidence-summary.json`
4. `artifacts/release-evidence/gcp-runtime-proof.json`
5. `artifacts/release-evidence/gcp-runtime-proof.md`
6. `artifacts/release-evidence/submission-refresh-status.json`
7. `artifacts/release-evidence/submission-refresh-status.md`

Submission-safe judged refresh criteria:

1. `artifacts/demo-e2e/summary.json` reports `liveApiEnabled=true`.
2. Submission scenarios do not report `translationProvider=fallback`.
3. Submission scenarios do not report `storytellerMediaMode=simulated`.
4. Submission scenarios do not report `uiExecutorForceSimulation=true`.

If `verify:release:artifact-only` is blocked by stale `artifacts/release-artifact-revalidation/source-run.json` and GitHub API access is unavailable, rebuild the local provenance manifest from the current artifacts first:

```powershell
npm run verify:release:artifact:refresh-local-source
npm run verify:release:artifact-only
```

## Optional Moonshot / Kimi Text Path

To test live-agent `translation` or `conversation` with Moonshot/Kimi 2.5 instead of the default Gemini text path, set:

1. `LIVE_AGENT_TEXT_PROVIDER=moonshot`
2. `LIVE_AGENT_MOONSHOT_API_KEY` (or `MOONSHOT_API_KEY`)
3. `LIVE_AGENT_MOONSHOT_BASE_URL=https://api.moonshot.ai/v1`
4. Optional model pins: `LIVE_AGENT_MOONSHOT_TRANSLATION_MODEL=kimi-k2.5`, `LIVE_AGENT_MOONSHOT_CONVERSATION_MODEL=kimi-k2.5`
5. Optional live latency budget: `LIVE_AGENT_MOONSHOT_TIMEOUT_MS=60000`

Gemini remains the judged-default provider. If Moonshot is selected but no Moonshot key is configured, the live-agent falls back to Gemini when a Gemini key is present, and to repo-owned fallback responses when neither provider is configured. The repo-owned adapter also pins `temperature=1` for `kimi-k2.5`, matching the current Moonshot runtime contract.

For local `Discuss` runs, the conversation lane now also uses Moonshot as the secondary provider when `LIVE_AGENT_USE_GEMINI_CHAT=false` but a Moonshot key is available, instead of degrading straight to the repo echo fallback.

For local `Research` runs, skill directives stay in provider context instead of being prepended to the user query. If the grounded research provider is unavailable but the reasoning adapter is still live, the agent returns a concise answer without citations before it falls back to the deterministic offline message.

## Storyteller Secondary Media Paths

The primary Gemini reasoning path now uses the official Google `@google/genai` SDK, and storyteller can also run the primary image/video/TTS lanes in `STORYTELLER_MEDIA_MODE=default` when Gemini credentials are present. For Gemini image models, `STORYTELLER_IMAGE_MODEL=gemini-3.1-flash-image-preview` selects `Nano Banana 2`, while Imagen-family IDs continue to use the Imagen predict path. `Nano Banana 2` image generations can take longer than the repo's old `12s` baseline, so raise `STORYTELLER_GEMINI_TIMEOUT_MS` when you enable the Gemini image lane locally. Use `STORYTELLER_VIDEO_POLL_MS` and `STORYTELLER_VIDEO_MAX_WAIT_MS` to control how long the runtime waits for the live Veo operation before it degrades to repo-owned fallback assets.

Use `npm run storyteller:smoke:live -- --mediaMode=default --includeImages=false --includeVideo=true --segmentCount=1` to capture a local live-media snapshot into `artifacts/storyteller-live-media-smoke/latest.json`. The smoke runner auto-loads repo-local `.env` when present and exits non-zero when a requested `default` image/video lane does not activate, so it is the fastest way to tune Veo polling before the full judge flow.

For the `Nano Banana` continuity pass, run `npm run storyteller:smoke:live -- --mediaMode=default --includeImages=true --includeVideo=false --imageEditRequested=true --segmentCount=1`. With `FAL_KEY` configured, this verifies that the live `fal-ai/nano-banana-2/edit` lane can edit fallback or live source images without the full judge harness.

To keep storyteller secondary-provider smoke runs live by default, set `STORYTELLER_TTS_PROVIDER_OVERRIDE=deepgram`, keep `STORYTELLER_TTS_SECONDARY_ENABLED=true`, and use a voice-specific Deepgram model such as `STORYTELLER_TTS_SECONDARY_MODEL=aura-2-thalia-en`. For image post-processing, set `STORYTELLER_IMAGE_EDIT_ENABLED=true` with `FAL_KEY` or `FAL_API_KEY`.

The repo fallback pack ships downloadable placeholder scene images so the fal continuity pass can execute live in local runs even when the primary story image lane is still operating in fallback mode. Treat that path as local-debug only, not as judged submission evidence.

## API CORS for Frontend

`api-backend` now serves CORS headers for cross-origin frontend requests.

1. Default behavior allows all origins (`API_CORS_ALLOWED_ORIGINS=*`).
2. To lock it down, set explicit origins as comma-separated values:

```bash
API_CORS_ALLOWED_ORIGINS=http://localhost:3000,https://live-agent-frontend-production.up.railway.app
```

## Local-First Profile

Use local-first profile for offline development and lower cloud dependency risk:

1. `LOCAL_FIRST_PROFILE=true`
2. `APP_ENV=dev`

Detailed matrix and guardrails: `docs/local-first-profile.md`.

## Realtime Mock Mode

Start local live API echo mock:

```bash
npm run dev:live-mock
```

Gateway envs:

1. `LIVE_API_ENABLED=true`
2. `LIVE_API_PROTOCOL=gemini`
3. `LIVE_API_WS_URL=wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent` for Gemini Live, or `ws://localhost:8091/live` when you intentionally run the local mock.

## Validation Commands

1. Unit tests:

```bash
npm run test:unit
```

2. Build:

```bash
npm run build
```

3. Release gate:

```bash
npm run verify:release
```

4. Strict release gate:

```bash
npm run verify:release:strict
```

## Autoresearch Runtime-Perf Loop

The repo includes a repo-owned `autoresearch`-style loop for performance experiments against existing JSON evidence artifacts.

Prerequisites:

1. Start the local stack that `npm run perf:profile` depends on.
2. Keep the candidate change narrow and reversible.

Baseline run:

```bash
npm run autoresearch:runtime-perf -- --description baseline
```

Candidate run:

```bash
npm run autoresearch:runtime-perf -- --description "reduce gateway replay overhead"
```

Artifacts:

- `artifacts/autoresearch/runtime-perf/results.tsv`
- `artifacts/autoresearch/runtime-perf/run.log`
- `artifacts/autoresearch/runtime-perf/last-run.json`

Reference:

- `docs/autoresearch.md`
- `configs/autoresearch/runtime-perf.program.md`
