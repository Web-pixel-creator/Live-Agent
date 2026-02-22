# GCP Baseline Bootstrap

This folder provides an idempotent baseline for:

1. Required Google APIs.
2. Service accounts for gateway, api-backend, and orchestrator.
3. IAM role bindings for Firestore, Secret Manager, Logging, and Monitoring.
4. Core Secret Manager entries for runtime credentials.

## Files

- `bootstrap.ps1` - baseline bootstrap script (Windows PowerShell).
- `setup-analytics-sinks.ps1` - analytics routing baseline (Cloud Logging -> BigQuery sink + log-based metric for Cloud Monitoring dashboards/alerts).
- `setup-monitoring-baseline.ps1` - Cloud Monitoring baseline (log-based metrics + KPI dashboard + alert policies).
- `setup-observability.ps1` - one-shot wrapper (`bootstrap` + `setup-analytics-sinks` + `setup-monitoring-baseline`).
- `collect-observability-evidence.ps1` - collects judge-ready observability evidence into `artifacts/observability`.

## Usage

```powershell
pwsh ./infra/gcp/bootstrap.ps1 -ProjectId "<your-project-id>" -Region "us-central1"
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

Judge report generation from collected evidence (repo root):

```powershell
npm run infra:observability:report
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

## Security Notes

1. This is a practical baseline, not final least-privilege hardening.
2. For production, scope `secretAccessor` to specific secrets and move role bindings to dedicated IAM modules.
3. Rotate secret values after bootstrap if test placeholders were used.
4. `setup-analytics-sinks.ps1` grants sink writer project-level `roles/bigquery.dataEditor` as a baseline. For production, scope access to dataset-level IAM only.
5. Alert policies can be created without notification channels, but production should always attach channels and on-call routing.
