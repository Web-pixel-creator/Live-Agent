# Monitoring Templates

This folder contains template artifacts consumed by `infra/gcp/setup-monitoring-baseline.ps1`.

## Files

1. `dashboard.telemetry-kpis.json`
   - Baseline KPI dashboard widgets for latency, service errors, analytics event errors, and Story media queue health/quota signals.
2. `alert-policy.gateway-latency.json`
   - Alert when gateway p95 duration is above threshold.
3. `alert-policy.service-errors.json`
   - Alert when analytics error rate is elevated across services.
4. `alert-policy.orchestrator-persist-failures.json`
   - Alert when orchestrator persistence rollups report failures.
5. `alert-policy.story-media-queue-health.json`
   - Alert when Story media queue shows dead-letter growth, sustained retry pressure, or excessive queue age.

## Template Placeholders

1. `__NOTIFICATION_CHANNELS__`
   - Replaced with JSON array from `-NotificationChannels`.
2. `__PROJECT_ID__`
   - Reserved placeholder for future project-bound filters.

## Local Validation

Run from repo root:

```powershell
npm run infra:monitoring:validate
```
