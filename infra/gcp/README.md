# GCP Baseline Bootstrap

This folder provides an idempotent baseline for:

1. Required Google APIs.
2. Service accounts for gateway, api-backend, and orchestrator.
3. IAM role bindings for Firestore, Secret Manager, Logging, and Monitoring.
4. Core Secret Manager entries for runtime credentials.

## Files

- `bootstrap.ps1` - baseline bootstrap script (Windows PowerShell).

## Usage

```powershell
pwsh ./infra/gcp/bootstrap.ps1 -ProjectId "<your-project-id>" -Region "us-central1"
```

Optional flags:

- `-GatewaySaName` default: `mla-gateway-sa`
- `-ApiSaName` default: `mla-api-sa`
- `-OrchestratorSaName` default: `mla-orchestrator-sa`

## What It Configures

1. Enables APIs:
   - `run.googleapis.com`
   - `artifactregistry.googleapis.com`
   - `cloudbuild.googleapis.com`
   - `firestore.googleapis.com`
   - `secretmanager.googleapis.com`
   - `logging.googleapis.com`
   - `monitoring.googleapis.com`
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

## Security Notes

1. This is a practical baseline, not final least-privilege hardening.
2. For production, scope `secretAccessor` to specific secrets and move role bindings to dedicated IAM modules.
3. Rotate secret values after bootstrap if test placeholders were used.
