# Telemetry Storage Split (T-221)

This document defines how runtime telemetry is split between operational state storage and analytics sinks.

## Goal

1. Keep operational state in Firestore for low-latency workflows and recovery.
2. Export metric streams and heavy analytics events to analytics sinks (Cloud Monitoring and BigQuery) via structured logs.
3. Control retention and cost explicitly.

## Storage Mapping

| Data type | Primary store | Why |
| --- | --- | --- |
| Session state, approvals, run lifecycle, task replay context | Firestore | Transactional state and fast lookup for runtime APIs |
| Request/operation latency metrics | Cloud Monitoring (through analytics log routing) | Time-series queries, SLO alerting |
| Heavy event rollups (event metadata, payload size, route/intent dimensions) | BigQuery (through analytics log routing) | Cost-effective analytics and long-range reporting |

## Runtime Behavior

Services (`realtime-gateway`, `api-backend`, `orchestrator`) now emit:

1. `analytics_metric` records for every `RollingMetrics.record(...)` sample.
2. `analytics_event` rollups from orchestrator persistence flow (`orchestrator.event_rollup`), including:
   - `eventId`, `sessionId`, `runId`, `runStatus`
   - `intent`, `route`, `mode`, `source`, `eventType`
   - `payloadBytes`, and storage/write status (`firestore|fallback`, `writeFailed`)
3. Story queue operational gauges from orchestrator runtime sampling (`storyteller.media.queue.*`, `storyteller.media.quota.*`), including:
   - backlog / retry_waiting / dead_letter / oldest_age_ms
   - worker utilization and per-model quota utilization
4. Story cache operational gauges from orchestrator runtime sampling (`storyteller.cache.*`), including:
   - entries / hit_rate_pct / hits_total / misses_total / evictions_total / invalidations_total
   - scope-level distribution (`storyteller.cache.scope_entries`, labels: `scope=plan|branch|asset`)

The export transport is structured stdout logs (`[analytics] { ...json... }`), designed for Cloud Logging ingestion and downstream sinks.

## Configuration

Environment variables:

1. `ANALYTICS_EXPORT_ENABLED=true|false`
2. `ANALYTICS_EXPORT_METRICS_TARGET=cloud_monitoring|disabled`
3. `ANALYTICS_EXPORT_EVENTS_TARGET=bigquery|disabled`
4. `ANALYTICS_EXPORT_SAMPLE_RATE=0..1`
5. `ANALYTICS_BIGQUERY_DATASET=<dataset>`
6. `ANALYTICS_BIGQUERY_TABLE=<table>`
7. `ANALYTICS_LOG_NAME=<log_name>`

Default local behavior is disabled.

## GCP Routing Pattern

1. Cloud Run services write structured logs.
2. Cloud Logging sink routes:
   - `category=analytics_metric` -> Cloud Monitoring custom metrics.
   - `category=analytics_event` -> BigQuery table.
3. Alerts and dashboards read from Cloud Monitoring.
4. Long-term product analytics and cost analysis run on BigQuery.

Provisioning helper:

1. Run baseline bootstrap:
   - `pwsh ./infra/gcp/bootstrap.ps1 -ProjectId "<project-id>" -Region "us-central1"`
2. Configure analytics sinks and log-based metric:
   - `pwsh ./infra/gcp/setup-analytics-sinks.ps1 -ProjectId "<project-id>" -Location "US" -DatasetId "agent_analytics"`
3. Apply monitoring baseline (dashboard + alert policies):
   - `pwsh ./infra/gcp/setup-monitoring-baseline.ps1 -ProjectId "<project-id>" -NotificationChannels "projects/<project-id>/notificationChannels/<channel-id>"`
   - includes Story media queue health alert template (`alert-policy.story-media-queue-health.json`)
   - includes Story cache health alert template (`alert-policy.story-cache-health.json`)
4. Set runtime envs:
   - `ANALYTICS_EXPORT_ENABLED=true`
   - `ANALYTICS_EXPORT_METRICS_TARGET=cloud_monitoring`
   - `ANALYTICS_EXPORT_EVENTS_TARGET=bigquery`
   - `ANALYTICS_BIGQUERY_DATASET=agent_analytics`

One-command path:

1. `pwsh ./infra/gcp/setup-observability.ps1 -ProjectId "<project-id>" -Region "us-central1" -Location "US" -DatasetId "agent_analytics"`
2. `pwsh ./infra/gcp/collect-observability-evidence.ps1 -ProjectId "<project-id>" -DatasetId "agent_analytics" -LookbackHours 24`
3. `npm run infra:observability:report`

## Retention and Cost Policy

Recommended baseline:

1. Firestore operational collections: 14-365 days TTL depending on collection purpose.
2. Cloud Monitoring custom metrics: 6 weeks to 24 months depending on metric class and budget.
3. BigQuery analytics tables: partition by event date, 90-180 days hot retention, archive/expire older partitions.

Cost controls:

1. Keep payload rollups compact (no full raw payload blobs in analytics events).
2. Use `ANALYTICS_EXPORT_SAMPLE_RATE` for high-volume environments.
3. Partition and cluster BigQuery by `eventDate`, `service`, `intent`, `route`.
