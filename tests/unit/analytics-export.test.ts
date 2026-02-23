import test from "node:test";
import assert from "node:assert/strict";
import { AnalyticsExporter as ApiBackendAnalyticsExporter } from "../../apps/api-backend/src/analytics-export.js";
import { AnalyticsExporter as RealtimeGatewayAnalyticsExporter } from "../../apps/realtime-gateway/src/analytics-export.js";
import { AnalyticsExporter as OrchestratorAnalyticsExporter } from "../../agents/orchestrator/src/services/analytics-export.js";

type AnalyticsStatus = {
  enabled: boolean;
  reason: string;
  metricsTarget: string;
  eventsTarget: string;
  sampleRate: number;
  bigQueryDataset: string | null;
  bigQueryTable: string | null;
};

type AnalyticsExporterInstance = {
  snapshot(): AnalyticsStatus;
  recordMetric(record: {
    metricType: string;
    value: number;
    unit?: string;
    labels?: Record<string, string | number | boolean>;
    ts?: string;
  }): void;
  recordEvent(record: {
    eventType: string;
    labels?: Record<string, string | number | boolean>;
    payload?: unknown;
    severity?: "DEBUG" | "INFO" | "WARNING" | "ERROR";
    target?: "disabled" | "cloud_monitoring" | "bigquery";
    ts?: string;
  }): void;
};

type AnalyticsExporterCtor = new (params: { serviceName: string }) => AnalyticsExporterInstance;

const exporters: Array<{ name: string; Ctor: AnalyticsExporterCtor }> = [
  { name: "api-backend", Ctor: ApiBackendAnalyticsExporter },
  { name: "realtime-gateway", Ctor: RealtimeGatewayAnalyticsExporter },
  { name: "orchestrator", Ctor: OrchestratorAnalyticsExporter },
];

async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => T | Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function withMockRandom<T>(value: number, fn: () => T | Promise<T>): Promise<T> {
  const originalRandom = Math.random;
  Math.random = () => value;
  try {
    return await fn();
  } finally {
    Math.random = originalRandom;
  }
}

async function captureAnalyticsLogs(fn: () => void | Promise<void>): Promise<Array<Record<string, unknown>>> {
  const records: Array<Record<string, unknown>> = [];
  const originalLog = console.log;
  console.log = ((...args: unknown[]) => {
    if (args[0] === "[analytics]" && typeof args[1] === "string") {
      try {
        records.push(JSON.parse(args[1]) as Record<string, unknown>);
      } catch {
        // Ignore malformed payloads in test harness.
      }
    }
  }) as typeof console.log;

  try {
    await fn();
  } finally {
    console.log = originalLog;
  }

  return records;
}

for (const { name, Ctor } of exporters) {
  test(`${name}: analytics snapshot parses env settings`, { concurrency: false }, async () => {
    await withEnv(
      {
        ANALYTICS_EXPORT_ENABLED: "true",
        ANALYTICS_EXPORT_METRICS_TARGET: "monitoring",
        ANALYTICS_EXPORT_EVENTS_TARGET: "bq",
        ANALYTICS_EXPORT_SAMPLE_RATE: "0.7",
        ANALYTICS_BIGQUERY_DATASET: " agent_analytics ",
        ANALYTICS_BIGQUERY_TABLE: " events ",
      },
      () => {
        const exporter = new Ctor({ serviceName: `${name}-svc` });
        assert.deepEqual(exporter.snapshot(), {
          enabled: true,
          reason: "enabled",
          metricsTarget: "cloud_monitoring",
          eventsTarget: "bigquery",
          sampleRate: 0.7,
          bigQueryDataset: "agent_analytics",
          bigQueryTable: "events",
        });
      },
    );
  });

  test(`${name}: analytics snapshot keeps storage split defaults when env is unset`, { concurrency: false }, async () => {
    await withEnv(
      {
        ANALYTICS_EXPORT_ENABLED: undefined,
        ANALYTICS_EXPORT_METRICS_TARGET: undefined,
        ANALYTICS_EXPORT_EVENTS_TARGET: undefined,
        ANALYTICS_EXPORT_SAMPLE_RATE: undefined,
        ANALYTICS_BIGQUERY_DATASET: undefined,
        ANALYTICS_BIGQUERY_TABLE: undefined,
      },
      () => {
        const exporter = new Ctor({ serviceName: `${name}-svc` });
        assert.deepEqual(exporter.snapshot(), {
          enabled: false,
          reason: "ANALYTICS_EXPORT_ENABLED=false",
          metricsTarget: "cloud_monitoring",
          eventsTarget: "bigquery",
          sampleRate: 1,
          bigQueryDataset: null,
          bigQueryTable: null,
        });
      },
    );
  });

  test(`${name}: recordMetric emits normalized analytics payload`, { concurrency: false }, async () => {
    await withEnv(
      {
        ANALYTICS_EXPORT_ENABLED: "true",
        ANALYTICS_EXPORT_METRICS_TARGET: "cloud_monitoring",
        ANALYTICS_EXPORT_EVENTS_TARGET: "bigquery",
        ANALYTICS_EXPORT_SAMPLE_RATE: "1",
        ANALYTICS_BIGQUERY_DATASET: undefined,
        ANALYTICS_BIGQUERY_TABLE: undefined,
        ANALYTICS_LOG_NAME: "mla_analytics",
      },
      async () => {
        const exporter = new Ctor({ serviceName: `${name}-svc` });
        const records = await captureAnalyticsLogs(() => {
          exporter.recordMetric({
            metricType: "gateway.operation.duration_ms",
            value: 10.9876,
            labels: {
              " operation ": "ws.message",
              ok: true,
              "   ": "ignored",
            },
            ts: "2026-02-22T00:00:00.000Z",
          });
        });

        assert.equal(records.length, 1);
        const payload = records[0];
        assert.equal(payload.category, "analytics_metric");
        assert.equal(payload.service, `${name}-svc`);
        assert.equal(payload.target, "cloud_monitoring");
        assert.equal(payload.metricType, "gateway.operation.duration_ms");
        assert.equal(payload.value, 10.988);
        assert.equal(payload.unit, "1");
        assert.equal(payload.ts, "2026-02-22T00:00:00.000Z");
        assert.equal(payload.logName, "mla_analytics");
        assert.deepEqual(payload.labels, {
          operation: "ws.message",
          ok: true,
        });
      },
    );
  });

  test(`${name}: metric guardrails skip invalid values and disabled targets`, { concurrency: false }, async () => {
    await withEnv(
      {
        ANALYTICS_EXPORT_ENABLED: "true",
        ANALYTICS_EXPORT_METRICS_TARGET: "cloud_monitoring",
        ANALYTICS_EXPORT_EVENTS_TARGET: "bigquery",
        ANALYTICS_EXPORT_SAMPLE_RATE: "1",
      },
      async () => {
        const exporter = new Ctor({ serviceName: `${name}-svc` });
        const invalidValueLogs = await captureAnalyticsLogs(() => {
          exporter.recordMetric({
            metricType: "invalid.metric",
            value: Number.NaN,
          });
        });
        assert.equal(invalidValueLogs.length, 0);
      },
    );

    await withEnv(
      {
        ANALYTICS_EXPORT_ENABLED: "true",
        ANALYTICS_EXPORT_METRICS_TARGET: "disabled",
        ANALYTICS_EXPORT_EVENTS_TARGET: "bigquery",
        ANALYTICS_EXPORT_SAMPLE_RATE: "1",
      },
      async () => {
        const exporter = new Ctor({ serviceName: `${name}-svc` });
        const disabledTargetLogs = await captureAnalyticsLogs(() => {
          exporter.recordMetric({
            metricType: "disabled.metric",
            value: 1,
          });
        });
        assert.equal(disabledTargetLogs.length, 0);
      },
    );
  });

  test(`${name}: recordEvent sanitizes oversized payloads`, { concurrency: false }, async () => {
    await withEnv(
      {
        ANALYTICS_EXPORT_ENABLED: "true",
        ANALYTICS_EXPORT_METRICS_TARGET: "cloud_monitoring",
        ANALYTICS_EXPORT_EVENTS_TARGET: "bigquery",
        ANALYTICS_EXPORT_SAMPLE_RATE: "1",
        ANALYTICS_BIGQUERY_DATASET: "agent_analytics",
        ANALYTICS_BIGQUERY_TABLE: "event_rollups",
      },
      async () => {
        const exporter = new Ctor({ serviceName: `${name}-svc` });
        const records = await captureAnalyticsLogs(() => {
          exporter.recordEvent({
            eventType: "orchestrator.event_rollup",
            payload: {
              blob: "x".repeat(9000),
            },
          });
        });

        assert.equal(records.length, 1);
        const payload = records[0];
        assert.equal(payload.category, "analytics_event");
        assert.equal(payload.service, `${name}-svc`);
        assert.equal(payload.target, "bigquery");
        assert.equal(payload.eventType, "orchestrator.event_rollup");
        assert.equal(payload.severity, "INFO");
        assert.equal(payload.bigQueryDataset, "agent_analytics");
        assert.equal(payload.bigQueryTable, "event_rollups");

        const sanitizedPayload = payload.payload as Record<string, unknown>;
        assert.equal(sanitizedPayload.truncated, true);
        assert.equal(typeof sanitizedPayload.bytes, "number");
        assert.ok(Number(sanitizedPayload.bytes) > 8000);
        assert.equal(typeof sanitizedPayload.preview, "string");
        assert.equal((sanitizedPayload.preview as string).length, 8000);
      },
    );
  });

  test(`${name}: event payload_not_serializable + target override works`, { concurrency: false }, async () => {
    await withEnv(
      {
        ANALYTICS_EXPORT_ENABLED: "true",
        ANALYTICS_EXPORT_METRICS_TARGET: "cloud_monitoring",
        ANALYTICS_EXPORT_EVENTS_TARGET: "bigquery",
        ANALYTICS_EXPORT_SAMPLE_RATE: "1",
      },
      async () => {
        const exporter = new Ctor({ serviceName: `${name}-svc` });
        const circular: Record<string, unknown> = {};
        circular.self = circular;

        const records = await captureAnalyticsLogs(() => {
          exporter.recordEvent({
            eventType: "runtime.bridge.error",
            severity: "WARNING",
            target: "cloud_monitoring",
            payload: circular,
          });
        });

        assert.equal(records.length, 1);
        const payload = records[0];
        assert.equal(payload.target, "cloud_monitoring");
        assert.equal(payload.severity, "WARNING");
        assert.deepEqual(payload.payload, {
          truncated: true,
          reason: "payload_not_serializable",
        });
      },
    );
  });

  test(`${name}: sampling gate respects ANALYTICS_EXPORT_SAMPLE_RATE`, { concurrency: false }, async () => {
    await withEnv(
      {
        ANALYTICS_EXPORT_ENABLED: "true",
        ANALYTICS_EXPORT_METRICS_TARGET: "cloud_monitoring",
        ANALYTICS_EXPORT_EVENTS_TARGET: "bigquery",
        ANALYTICS_EXPORT_SAMPLE_RATE: "0.4",
      },
      async () => {
        const exporter = new Ctor({ serviceName: `${name}-svc` });
        const dropped = await withMockRandom(0.8, async () =>
          captureAnalyticsLogs(() => {
            exporter.recordEvent({
              eventType: "sample.drop",
            });
          }),
        );
        assert.equal(dropped.length, 0);

        const emitted = await withMockRandom(0.1, async () =>
          captureAnalyticsLogs(() => {
            exporter.recordEvent({
              eventType: "sample.emit",
            });
          }),
        );
        assert.equal(emitted.length, 1);
      },
    );
  });
}
