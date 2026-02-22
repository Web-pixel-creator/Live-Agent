type LatencyStats = {
  min: number | null;
  max: number | null;
  avg: number | null;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  sampleCount: number;
};

type MetricsBucket = {
  count: number;
  errorCount: number;
  durationsMs: number[];
  lastUpdatedAt: string;
};

export type OperationMetricsSnapshot = {
  operation: string;
  count: number;
  errorCount: number;
  errorRatePct: number;
  latencyMs: LatencyStats;
  lastUpdatedAt: string;
};

export type MetricsSnapshot = {
  startedAt: string;
  uptimeSec: number;
  totalCount: number;
  totalErrors: number;
  errorRatePct: number;
  latencyMs: LatencyStats;
  operations: OperationMetricsSnapshot[];
};

export type RollingMetricsRecord = {
  operation: string;
  durationMs: number;
  ok: boolean;
  recordedAt: string;
};

export type RollingMetricsConfig = {
  maxSamplesPerBucket?: number;
  onRecord?: (entry: RollingMetricsRecord) => void;
};

function clampDurationMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function computeQuantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) {
    return null;
  }
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q)));
  return sorted[idx] ?? null;
}

function computeLatencyStats(values: number[]): LatencyStats {
  if (values.length === 0) {
    return {
      min: null,
      max: null,
      avg: null,
      p50: null,
      p95: null,
      p99: null,
      sampleCount: 0,
    };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const min = sorted[0] ?? null;
  const max = sorted[sorted.length - 1] ?? null;
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const avg = sorted.length > 0 ? Math.round((sum / sorted.length) * 100) / 100 : null;

  return {
    min,
    max,
    avg,
    p50: computeQuantile(sorted, 0.5),
    p95: computeQuantile(sorted, 0.95),
    p99: computeQuantile(sorted, 0.99),
    sampleCount: sorted.length,
  };
}

export class RollingMetrics {
  private readonly startedAtMs: number;
  private readonly maxSamplesPerBucket: number;
  private readonly onRecord: ((entry: RollingMetricsRecord) => void) | null;
  private readonly total: MetricsBucket;
  private readonly byOperation = new Map<string, MetricsBucket>();

  constructor(config?: RollingMetricsConfig) {
    this.startedAtMs = Date.now();
    const rawMaxSamples =
      typeof config?.maxSamplesPerBucket === "number" && Number.isFinite(config.maxSamplesPerBucket)
        ? Math.floor(config.maxSamplesPerBucket)
        : 2000;
    this.maxSamplesPerBucket = Math.max(50, rawMaxSamples);
    this.onRecord = typeof config?.onRecord === "function" ? config.onRecord : null;
    const now = new Date().toISOString();
    this.total = {
      count: 0,
      errorCount: 0,
      durationsMs: [],
      lastUpdatedAt: now,
    };
  }

  private ensureOperationBucket(operation: string): MetricsBucket {
    const normalized = operation.trim().length > 0 ? operation.trim() : "unknown";
    const existing = this.byOperation.get(normalized);
    if (existing) {
      return existing;
    }
    const created: MetricsBucket = {
      count: 0,
      errorCount: 0,
      durationsMs: [],
      lastUpdatedAt: new Date().toISOString(),
    };
    this.byOperation.set(normalized, created);
    return created;
  }

  private pushDuration(bucket: MetricsBucket, durationMs: number): void {
    bucket.durationsMs.push(durationMs);
    if (bucket.durationsMs.length > this.maxSamplesPerBucket) {
      bucket.durationsMs.splice(0, bucket.durationsMs.length - this.maxSamplesPerBucket);
    }
  }

  record(operation: string, durationMs: number, ok: boolean): void {
    const normalizedDurationMs = clampDurationMs(durationMs);
    const now = new Date().toISOString();

    this.total.count += 1;
    if (!ok) {
      this.total.errorCount += 1;
    }
    this.total.lastUpdatedAt = now;
    this.pushDuration(this.total, normalizedDurationMs);

    const operationBucket = this.ensureOperationBucket(operation);
    operationBucket.count += 1;
    if (!ok) {
      operationBucket.errorCount += 1;
    }
    operationBucket.lastUpdatedAt = now;
    this.pushDuration(operationBucket, normalizedDurationMs);

    if (this.onRecord) {
      try {
        this.onRecord({
          operation,
          durationMs: normalizedDurationMs,
          ok,
          recordedAt: now,
        });
      } catch {
        // Metrics callback failures must not affect main request path.
      }
    }
  }

  snapshot(params?: { topOperations?: number }): MetricsSnapshot {
    const topOperations = Math.max(1, Math.min(200, params?.topOperations ?? 50));
    const operations = [...this.byOperation.entries()]
      .map(([operation, bucket]) => {
        const errorRatePct = bucket.count > 0 ? Math.round((bucket.errorCount / bucket.count) * 10000) / 100 : 0;
        const entry: OperationMetricsSnapshot = {
          operation,
          count: bucket.count,
          errorCount: bucket.errorCount,
          errorRatePct,
          latencyMs: computeLatencyStats(bucket.durationsMs),
          lastUpdatedAt: bucket.lastUpdatedAt,
        };
        return entry;
      })
      .sort((left, right) => right.count - left.count)
      .slice(0, topOperations);

    const totalErrorRatePct =
      this.total.count > 0 ? Math.round((this.total.errorCount / this.total.count) * 10000) / 100 : 0;

    return {
      startedAt: new Date(this.startedAtMs).toISOString(),
      uptimeSec: Math.floor((Date.now() - this.startedAtMs) / 1000),
      totalCount: this.total.count,
      totalErrors: this.total.errorCount,
      errorRatePct: totalErrorRatePct,
      latencyMs: computeLatencyStats(this.total.durationsMs),
      operations,
    };
  }
}
