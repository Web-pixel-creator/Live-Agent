# GCP Baseline Bootstrap

This folder provides an idempotent baseline for:

1. Required Google APIs.
2. Service accounts for gateway, api-backend, and orchestrator.
3. IAM role bindings for Firestore, Secret Manager, Logging, and Monitoring.
4. Core Secret Manager entries for runtime credentials.

## Files

- `bootstrap.ps1` - baseline bootstrap script (Windows PowerShell).
- `ensure-firestore.ps1` - Firestore Native bootstrap + index/TTL apply + summary artifact.
- `sync-runtime-secrets.ps1` - resolves Gemini / Live API credentials from env or repo-local `.env` and adds fresh Secret Manager versions required by Cloud Run.
- `build-cloud-run-images.ps1` - creates the Artifact Registry repository if needed and builds `orchestrator`, `realtime-gateway`, and `api-backend` images through Cloud Build.
- `deploy-cloud-run.ps1` - deploys `orchestrator`, `realtime-gateway`, and `api-backend` from `infra/cloud-run/services.yaml`.
- `collect-runtime-proof.ps1` - aggregates Cloud Run, Firestore, BigQuery, and observability proof into `artifacts/release-evidence`.
- `prepare-judge-runtime.ps1` - wrapper for bootstrap + Firestore + observability + secret sync + Cloud Build image publish + Cloud Run + runtime proof.
- `refresh-submission-pack.ps1` - post-deploy judged refresh wrapper for `demo/policy/badge/visual pack` with Google-first env overrides, release-style demo retries/restarts, local provenance refresh, `.env` secret resolution, and Google Live key/header auto-derivation from the Gemini key when separate `LIVE_API_*` values are not present.
- `setup-analytics-sinks.ps1` - analytics routing baseline (Cloud Logging -> BigQuery sink + log-based metric for Cloud Monitoring dashboards/alerts).
- `setup-monitoring-baseline.ps1` - Cloud Monitoring baseline (log-based metrics + KPI dashboard + alert policies).
- `setup-observability.ps1` - one-shot wrapper (`bootstrap` + `setup-analytics-sinks` + `setup-monitoring-baseline`).
- `collect-observability-evidence.ps1` - collects judge-ready observability evidence into `artifacts/observability`.

## Usage

```powershell
pwsh ./infra/gcp/bootstrap.ps1 -ProjectId "<your-project-id>" -Region "us-central1"
```

Firestore bootstrap:

```powershell
pwsh ./infra/gcp/ensure-firestore.ps1 -ProjectId "<your-project-id>" -Location "nam5"
```

Cloud Run deploy from `infra/cloud-run/services.yaml`:

```powershell
pwsh ./infra/gcp/deploy-cloud-run.ps1 -ProjectId "<your-project-id>" -Region "us-central1" -ImageTag "<release-tag>"
```

Image build from source into Artifact Registry:

```powershell
pwsh ./infra/gcp/build-cloud-run-images.ps1 -ProjectId "<your-project-id>" -Region "us-central1" -ImageTag "<release-tag>"
```

Secret sync from env / `.env` into Secret Manager:

```powershell
pwsh ./infra/gcp/sync-runtime-secrets.ps1 -ProjectId "<your-project-id>"
```

Analytics sink setup:

```powershell
pwsh ./infra/gcp/setup-analytics-sinks.ps1 -ProjectId "<your-project-id>" -Location "US" -DatasetId "agent_analytics"
```

Monitoring baseline setup:

```powershell
pwsh ./infra/gcp/setup-monitoring-baseline.ps1 -ProjectId "<your-project-id>" `
  -NotificationChannels "projects/<your-project-id>/notificationChannels/<channel-id>"
```

One-shot observability setup:

```powershell
pwsh ./infra/gcp/setup-observability.ps1 -ProjectId "<your-project-id>" `
  -Region "us-central1" `
  -Location "US" `
  -DatasetId "agent_analytics" `
  -NotificationChannels "projects/<your-project-id>/notificationChannels/<channel-id>"
```

Template validation before apply (from repo root):

```powershell
npm run infra:monitoring:validate
```

Evidence collection (after setup and traffic):

```powershell
pwsh ./infra/gcp/collect-observability-evidence.ps1 -ProjectId "<your-project-id>" -DatasetId "agent_analytics" -LookbackHours 24
```

Runtime proof collection (after Firestore + Cloud Run + observability + screenshot capture):

```powershell
pwsh ./infra/gcp/collect-runtime-proof.ps1 -ProjectId "<your-project-id>" -Region "us-central1" -DatasetId "agent_analytics"
```

End-to-end judge runtime bootstrap:

```powershell
pwsh ./infra/gcp/prepare-judge-runtime.ps1 -ProjectId "<your-project-id>" `
  -Region "us-central1" `
  -FirestoreLocation "nam5" `
  -DatasetId "agent_analytics" `
  -ImageTag "<release-tag>"
```

Post-deploy judged evidence refresh:

```powershell
pwsh ./infra/gcp/refresh-submission-pack.ps1 -ProjectId "<your-project-id>" `
  -Region "us-central1" `
  -DatasetId "agent_analytics" `
  -ImageTag "<release-tag>"
```

If the current shell does not have `gcloud`, either keep the keys in repo-local `.env` or provide them directly:

```powershell
pwsh ./infra/gcp/refresh-submission-pack.ps1 `
  -SkipPrepareRuntime `
  -GoogleGenAiApiKey "<google-genai-key>" `
  -LiveApiApiKey "<live-api-key>" `
  -LiveApiAuthHeader "x-goog-api-key"
```

When `.env` contains only Gemini-style keys such as `GEMINI_API_KEY` / `LIVE_AGENT_GEMINI_API_KEY` / `STORYTELLER_GEMINI_API_KEY` / `UI_NAVIGATOR_GEMINI_API_KEY`, `refresh-submission-pack.ps1` now reuses that value for `LIVE_API_API_KEY` and defaults `LIVE_API_AUTH_HEADER` to `x-goog-api-key`.

Judge report generation from collected evidence (repo root):

```powershell
npm run infra:observability:report
```

Artifact integrity check (required files + summary schema):

```powershell
npm run infra:observability:check
```

GitHub Actions alternative:

1. Configure repository secret `GCP_CREDENTIALS_JSON`.
2. Run workflow `.github/workflows/observability-evidence.yml` via `workflow_dispatch`.
3. Set `collect_live=true` and provide `project_id`.

Optional flags:

- `-GatewaySaName` default: `mla-gateway-sa`
- `-ApiSaName` default: `mla-api-sa`
- `-OrchestratorSaName` default: `mla-orchestrator-sa`
- `deploy-cloud-run.ps1 -DryRun` prints the exact `gcloud run deploy` commands without mutating Cloud Run.
- `prepare-judge-runtime.ps1` supports `-Skip*` switches for partial reruns (for example, only Cloud Run redeploy or only proof collection).
- `prepare-judge-runtime.ps1` now also supports `-SkipSecretSync` and `-SkipCloudRunBuild` when credentials or images are already in place.
- `refresh-submission-pack.ps1` writes `artifacts/release-evidence/submission-refresh-status.json` and `.md` so the post-deploy judged refresh can be reviewed even when the summary is still pending follow-up.
- `refresh-submission-pack.ps1` runs `demo-e2e.ps1` with the same retry/restart posture as `verify:release`, resolves secrets from env, repo-local `.env`, or Secret Manager, and pushes Storyteller media timeout knobs (`STORYTELLER_GEMINI_TIMEOUT_MS`, `STORYTELLER_VIDEO_POLL_MS`, `STORYTELLER_VIDEO_MAX_WAIT_MS`) into the judged run.

## What It Configures

1. Enables APIs:
   - `run.googleapis.com`
   - `artifactregistry.googleapis.com`
   - `cloudbuild.googleapis.com`
   - `firestore.googleapis.com`
   - `secretmanager.googleapis.com`
   - `logging.googleapis.com`
   - `monitoring.googleapis.com`
   - `bigquery.googleapis.com`
   - `iamcredentials.googleapis.com`
2. Creates service accounts if missing.
3. Binds baseline IAM roles:
   - `roles/datastore.user` (api-backend + orchestrator)
   - `roles/secretmanager.secretAccessor` (all runtime services)
   - `roles/logging.logWriter` (all runtime services)
   - `roles/monitoring.metricWriter` (all runtime services)
   - `roles/run.invoker` (gateway -> orchestrator call path)
4. Creates secrets if missing:
   - `LIVE_API_API_KEY`
   - `LIVE_API_AUTH_HEADER`
   - `GOOGLE_GENAI_API_KEY`
5. Deploy path assumptions:
   - Source build path uses `infra/cloud-run/Dockerfile.*` plus `build-cloud-run-images.ps1` to create the three Cloud Run images when they do not already exist.
   - `infra/cloud-run/services.yaml` remains the single editable manifest for service-level env/secret wiring.
   - Firestore and observability proof are written into repo-owned artifacts before submission packaging.

## Security Notes

1. This is a practical baseline, not final least-privilege hardening.
2. For production, scope `secretAccessor` to specific secrets and move role bindings to dedicated IAM modules.
3. Rotate secret values after bootstrap if test placeholders were used.
4. `setup-analytics-sinks.ps1` grants sink writer project-level `roles/bigquery.dataEditor` as a baseline. For production, scope access to dataset-level IAM only.
5. Alert policies can be created without notification channels, but production should always attach channels and on-call routing.
6. `deploy-cloud-run.ps1` validates only secret names, not secret payload freshness; rotate and pin versions before a judged submission run.
