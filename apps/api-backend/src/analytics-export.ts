type AnalyticsTarget = "disabled" | "cloud_monitoring" | "bigquery";

type AnalyticsLabels = Record<string, string | number | boolean>;

export type AnalyticsStatus = {
  enabled: boolean;
  reason: string;
  metricsTarget: AnalyticsTarget;
  eventsTarget: AnalyticsTarget;
  sampleRate: number;
  bigQueryDataset: string | null;
  bigQueryTable: string | null;
};

type MetricRecord = {
  metricType: string;
  value: number;
  unit?: string;
  labels?: AnalyticsLabels;
  ts?: string;
};

type EventRecord = {
  eventType: string;
  labels?: AnalyticsLabels;
  payload?: unknown;
  severity?: "DEBUG" | "INFO" | "WARNING" | "ERROR";
  target?: AnalyticsTarget;
  ts?: string;
};

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return fallback;
}

function parseSampleRate(value: string | undefined): number {
  if (!value) {
    return 1;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(0, Math.min(1, parsed));
}

function parseTarget(value: string | undefined, fallback: AnalyticsTarget): AnalyticsTarget {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "disabled" || normalized === "off" || normalized === "none") {
    return "disabled";
  }
  if (normalized === "cloud_monitoring" || normalized === "monitoring") {
    return "cloud_monitoring";
  }
  if (normalized === "bigquery" || normalized === "bq") {
    return "bigquery";
  }
  return fallback;
}

function normalizeLabels(labels: AnalyticsLabels | undefined): AnalyticsLabels | undefined {
  if (!labels) {
    return undefined;
  }
  const normalized: AnalyticsLabels = {};
  for (const [key, value] of Object.entries(labels)) {
    const cleanKey = key.trim();
    if (cleanKey.length === 0) {
      continue;
    }
    normalized[cleanKey] = value;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function sanitizePayload(payload: unknown): unknown {
  if (payload === undefined) {
    return undefined;
  }
  try {
    const serialized = JSON.stringify(payload);
    if (serialized.length <= 8000) {
      return payload;
    }
    return {
      truncated: true,
      bytes: Buffer.byteLength(serialized, "utf8"),
      preview: serialized.slice(0, 8000),
    };
  } catch {
    return {
      truncated: true,
      reason: "payload_not_serializable",
    };
  }
}

function safeMetricValue(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 1000) / 1000;
}

export class AnalyticsExporter {
  private readonly serviceName: string;
  private readonly status: AnalyticsStatus;

  constructor(params: { serviceName: string }) {
    this.serviceName = params.serviceName;
    const enabled = parseBool(process.env.ANALYTICS_EXPORT_ENABLED, false);
    const metricsTarget = parseTarget(process.env.ANALYTICS_EXPORT_METRICS_TARGET, "cloud_monitoring");
    const eventsTarget = parseTarget(process.env.ANALYTICS_EXPORT_EVENTS_TARGET, "bigquery");
    const sampleRate = parseSampleRate(process.env.ANALYTICS_EXPORT_SAMPLE_RATE);
    const bigQueryDataset =
      typeof process.env.ANALYTICS_BIGQUERY_DATASET === "string" && process.env.ANALYTICS_BIGQUERY_DATASET.trim()
        ? process.env.ANALYTICS_BIGQUERY_DATASET.trim()
        : null;
    const bigQueryTable =
      typeof process.env.ANALYTICS_BIGQUERY_TABLE === "string" && process.env.ANALYTICS_BIGQUERY_TABLE.trim()
        ? process.env.ANALYTICS_BIGQUERY_TABLE.trim()
        : null;

    this.status = {
      enabled,
      reason: enabled ? "enabled" : "ANALYTICS_EXPORT_ENABLED=false",
      metricsTarget,
      eventsTarget,
      sampleRate,
      bigQueryDataset,
      bigQueryTable,
    };
  }

  snapshot(): AnalyticsStatus {
    return this.status;
  }

  private shouldEmit(target: AnalyticsTarget): boolean {
    if (!this.status.enabled) {
      return false;
    }
    if (target === "disabled") {
      return false;
    }
    if (this.status.sampleRate >= 1) {
      return true;
    }
    if (this.status.sampleRate <= 0) {
      return false;
    }
    return Math.random() <= this.status.sampleRate;
  }

  recordMetric(record: MetricRecord): void {
    if (!this.shouldEmit(this.status.metricsTarget)) {
      return;
    }
    const value = safeMetricValue(record.value);
    if (value === null) {
      return;
    }
    const payload = {
      category: "analytics_metric",
      service: this.serviceName,
      target: this.status.metricsTarget,
      metricType: record.metricType,
      value,
      unit: record.unit ?? "1",
      labels: normalizeLabels(record.labels),
      ts: record.ts ?? new Date().toISOString(),
      logName: process.env.ANALYTICS_LOG_NAME ?? "multimodal_analytics",
    };
    console.log("[analytics]", JSON.stringify(payload));
  }

  recordEvent(record: EventRecord): void {
    const target = record.target ?? this.status.eventsTarget;
    if (!this.shouldEmit(target)) {
      return;
    }
    const payload = {
      category: "analytics_event",
      service: this.serviceName,
      target,
      eventType: record.eventType,
      severity: record.severity ?? "INFO",
      labels: normalizeLabels(record.labels),
      payload: sanitizePayload(record.payload),
      ts: record.ts ?? new Date().toISOString(),
      bigQueryDataset: this.status.bigQueryDataset,
      bigQueryTable: this.status.bigQueryTable,
      logName: process.env.ANALYTICS_LOG_NAME ?? "multimodal_analytics",
    };
    console.log("[analytics]", JSON.stringify(payload));
  }
}
