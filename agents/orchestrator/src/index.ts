import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
  applyRuntimeProfile,
  createApiErrorResponse,
  createNormalizedError,
  normalizeUnknownError,
  RollingMetrics,
} from "@mla/contracts";
import {
  getMediaJobQueueSnapshot,
  getStoryCacheSnapshot,
  purgeStoryCache,
} from "@mla/storyteller-agent";
import { orchestrate } from "./orchestrate.js";
import { AnalyticsExporter } from "./services/analytics-export.js";
import { getFirestoreState } from "./services/firestore.js";
import { buildStoryCacheMetricRecords } from "./story-cache-telemetry.js";
import { buildStoryQueueMetricRecords } from "./story-queue-telemetry.js";

const port = Number(process.env.ORCHESTRATOR_PORT ?? 8082);
const serviceName = "orchestrator";
const runtimeProfile = applyRuntimeProfile(serviceName);
const serviceVersion = process.env.ORCHESTRATOR_VERSION ?? process.env.SERVICE_VERSION ?? "0.1.0";
const startedAtMs = Date.now();
let draining = false;
let lastWarmupAt: string | null = new Date().toISOString();
let lastDrainAt: string | null = null;
const analytics = new AnalyticsExporter({ serviceName });
const metrics = new RollingMetrics({
  maxSamplesPerBucket: Number(process.env.ORCHESTRATOR_METRICS_MAX_SAMPLES ?? 2000),
  onRecord: (entry) => {
    analytics.recordMetric({
      metricType: "orchestrator.operation.duration_ms",
      value: entry.durationMs,
      unit: "ms",
      ts: entry.recordedAt,
      labels: {
        operation: entry.operation,
        ok: entry.ok,
      },
    });
  },
});
const storyQueueTelemetryEnabled = parseBoolean(process.env.ORCHESTRATOR_STORY_QUEUE_TELEMETRY_ENABLED, true);
const storyQueueTelemetryPollMs = parsePositiveInt(process.env.ORCHESTRATOR_STORY_QUEUE_TELEMETRY_POLL_MS, 30000);
let lastStoryQueueTelemetryAt: string | null = null;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
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

function emitStoryQueueTelemetrySample(trigger: "interval" | "metrics_endpoint" | "startup"): void {
  if (!storyQueueTelemetryEnabled) {
    return;
  }
  const snapshot = getMediaJobQueueSnapshot();
  const queueRecords = buildStoryQueueMetricRecords(snapshot);
  const cacheRecords = buildStoryCacheMetricRecords(getStoryCacheSnapshot());
  for (const record of [...queueRecords, ...cacheRecords]) {
    analytics.recordMetric({
      metricType: record.metricType,
      value: record.value,
      unit: record.unit,
      labels: {
        trigger,
        ...record.labels,
      },
    });
  }
  lastStoryQueueTelemetryAt = new Date().toISOString();
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function writeHttpError(
  res: ServerResponse,
  statusCode: number,
  params: {
    code: string;
    message: string;
    traceId?: string;
    details?: unknown;
    runtime?: unknown;
  },
): void {
  const error = createNormalizedError({
    code: params.code,
    message: params.message,
    traceId: params.traceId,
    details: params.details,
  });
  writeJson(
    res,
    statusCode,
    createApiErrorResponse({
      error,
      service: serviceName,
      runtime: params.runtime,
    }),
  );
}

function runtimeState(): Record<string, unknown> {
  const summary = metrics.snapshot({ topOperations: 10 });
  return {
    state: draining ? "draining" : "ready",
    ready: !draining,
    draining,
    startedAt: new Date(startedAtMs).toISOString(),
    uptimeSec: Math.floor((Date.now() - startedAtMs) / 1000),
    lastWarmupAt,
    lastDrainAt,
    version: serviceVersion,
    profile: runtimeProfile,
    analytics: analytics.snapshot(),
    storyQueueTelemetry: {
      enabled: storyQueueTelemetryEnabled,
      pollMs: storyQueueTelemetryPollMs,
      lastSampleAt: lastStoryQueueTelemetryAt,
    },
    metrics: {
      totalCount: summary.totalCount,
      totalErrors: summary.totalErrors,
      errorRatePct: summary.errorRatePct,
      p95Ms: summary.latencyMs.p95,
    },
  };
}

export const server = createServer(async (req, res) => {
  const startedAt = Date.now();
  let operation = `${req.method ?? "UNKNOWN"} /unknown`;
  res.once("finish", () => {
    metrics.record(operation, Date.now() - startedAt, res.statusCode < 500);
  });

  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    operation = `${req.method ?? "UNKNOWN"} ${url.pathname}`;

    if (url.pathname === "/healthz" && req.method === "GET") {
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        runtime: runtimeState(),
        storage: {
          firestore: getFirestoreState(),
        },
      });
      return;
    }

    if (url.pathname === "/status" && req.method === "GET") {
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        runtime: runtimeState(),
      });
      return;
    }

    if (url.pathname === "/version" && req.method === "GET") {
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        version: serviceVersion,
      });
      return;
    }

    if (url.pathname === "/metrics" && req.method === "GET") {
      emitStoryQueueTelemetrySample("metrics_endpoint");
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        metrics: metrics.snapshot({ topOperations: 50 }),
        storytellerMediaJobs: getMediaJobQueueSnapshot(),
        storytellerCache: getStoryCacheSnapshot(),
      });
      return;
    }

    if (url.pathname === "/story/media-jobs/queue" && req.method === "GET") {
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        storytellerMediaJobs: getMediaJobQueueSnapshot(),
      });
      return;
    }

    if (url.pathname === "/story/cache" && req.method === "GET") {
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        storytellerCache: getStoryCacheSnapshot(),
      });
      return;
    }

    if (url.pathname === "/story/cache/purge" && req.method === "POST") {
      const reason = url.searchParams.get("reason") ?? "orchestrator.manual_cache_purge";
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        storytellerCache: purgeStoryCache(reason),
      });
      return;
    }

    if (url.pathname === "/warmup" && req.method === "POST") {
      draining = false;
      lastWarmupAt = new Date().toISOString();
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        runtime: runtimeState(),
      });
      return;
    }

    if (url.pathname === "/drain" && req.method === "POST") {
      draining = true;
      lastDrainAt = new Date().toISOString();
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        runtime: runtimeState(),
      });
      return;
    }

    if (url.pathname === "/orchestrate" && req.method === "POST") {
      const traceId = randomUUID();

      if (draining) {
        writeHttpError(res, 503, {
          code: "ORCHESTRATOR_DRAINING",
          message: "orchestrator is draining and does not accept new runs",
          traceId,
          runtime: runtimeState(),
        });
        return;
      }

      const raw = await readBody(req);
      if (raw.trim().length === 0) {
        writeHttpError(res, 400, {
          code: "ORCHESTRATOR_INVALID_REQUEST",
          message: "request body is required",
          traceId,
        });
        return;
      }

      let parsed: Parameters<typeof orchestrate>[0];
      try {
        parsed = JSON.parse(raw) as Parameters<typeof orchestrate>[0];
      } catch {
        writeHttpError(res, 400, {
          code: "ORCHESTRATOR_INVALID_JSON",
          message: "invalid JSON body",
          traceId,
        });
        return;
      }

      const result = await orchestrate(parsed);
      writeJson(res, 200, result);
      return;
    }

    writeHttpError(res, 404, {
      code: "ORCHESTRATOR_HTTP_NOT_FOUND",
      message: "Not found",
      details: {
        method: req.method ?? "UNKNOWN",
        path: url.pathname,
      },
    });
  } catch (error) {
    const normalized = normalizeUnknownError(error, {
      defaultCode: "ORCHESTRATOR_HTTP_INTERNAL_ERROR",
      defaultMessage: "orchestrator request failed",
    });
    writeJson(
      res,
      500,
      createApiErrorResponse({
        error: normalized,
        service: serviceName,
      }),
    );
  }
});

server.listen(port, () => {
  console.log(`[orchestrator] listening on :${port}`);
  if (storyQueueTelemetryEnabled) {
    emitStoryQueueTelemetrySample("startup");
    const timer = setInterval(() => {
      emitStoryQueueTelemetrySample("interval");
    }, storyQueueTelemetryPollMs);
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  }
});
