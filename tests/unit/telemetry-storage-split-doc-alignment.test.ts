import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("telemetry storage split doc stays aligned with analytics exporters and observability helpers", () => {
  const doc = readFileSync(resolve(process.cwd(), "docs", "telemetry-storage-split.md"), "utf8");
  const apiExporter = readFileSync(resolve(process.cwd(), "apps", "api-backend", "src", "analytics-export.ts"), "utf8");
  const gatewayExporter = readFileSync(
    resolve(process.cwd(), "apps", "realtime-gateway", "src", "analytics-export.ts"),
    "utf8",
  );
  const orchestratorExporter = readFileSync(
    resolve(process.cwd(), "agents", "orchestrator", "src", "services", "analytics-export.ts"),
    "utf8",
  );
  const uiExecutor = readFileSync(resolve(process.cwd(), "apps", "ui-executor", "src", "index.ts"), "utf8");
  const queueTelemetry = readFileSync(
    resolve(process.cwd(), "agents", "orchestrator", "src", "story-queue-telemetry.ts"),
    "utf8",
  );
  const cacheTelemetry = readFileSync(
    resolve(process.cwd(), "agents", "orchestrator", "src", "story-cache-telemetry.ts"),
    "utf8",
  );
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };

  const requiredDocTokens = [
    "analytics_metric",
    "analytics_event",
    "storyteller.media.queue.*",
    "storyteller.media.quota.*",
    "storyteller.cache.*",
    "storyteller.cache.scope_entries",
    "metricsTarget=cloud_monitoring",
    "eventsTarget=bigquery",
    "analyticsRequestedEnabledServices >= 4",
    "analyticsEnabledServices >= 4",
    "ui-executor` does not emit the same analytics stdout stream today",
    "pwsh ./infra/gcp/bootstrap.ps1",
    "pwsh ./infra/gcp/setup-analytics-sinks.ps1",
    "pwsh ./infra/gcp/setup-monitoring-baseline.ps1",
    "pwsh ./infra/gcp/setup-observability.ps1",
    "pwsh ./infra/gcp/collect-observability-evidence.ps1",
    "npm run infra:observability:report",
  ];

  for (const token of requiredDocTokens) {
    assert.ok(doc.includes(token), `telemetry storage split doc missing token: ${token}`);
  }

  for (const exporter of [apiExporter, gatewayExporter, orchestratorExporter]) {
    assert.ok(exporter.includes('category: "analytics_metric"'));
    assert.ok(exporter.includes('category: "analytics_event"'));
    assert.ok(exporter.includes('parseTarget(process.env.ANALYTICS_EXPORT_METRICS_TARGET, "cloud_monitoring")'));
    assert.ok(exporter.includes('parseTarget(process.env.ANALYTICS_EXPORT_EVENTS_TARGET, "bigquery")'));
  }

  assert.ok(uiExecutor.includes("createRuntimeAnalyticsSnapshot"));
  assert.ok(uiExecutor.includes('const serviceName = "ui-executor"'));
  assert.ok(uiExecutor.includes("analytics: runtimeAnalytics"));

  for (const token of [
    'metricType: "storyteller.media.queue.backlog"',
    'metricType: "storyteller.media.quota.utilization_pct"',
  ]) {
    assert.ok(queueTelemetry.includes(token), `story queue telemetry missing token: ${token}`);
  }

  assert.ok(cacheTelemetry.includes('metricType: "storyteller.cache.scope_entries"'));

  assert.equal(
    packageJson.scripts?.["infra:observability:report"],
    "node ./scripts/observability-evidence-report.mjs --input ./artifacts/observability/observability-evidence-summary.json --output ./artifacts/observability/judge-observability.md --jsonOutput ./artifacts/observability/judge-observability.json",
  );
});
