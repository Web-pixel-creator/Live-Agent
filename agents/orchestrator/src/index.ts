/* Load root .env before anything else — works regardless of cwd */
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __orch_dir = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  resolve(__orch_dir, "..", "..", "..", ".env"),   // from dist/src/ or src/
  resolve(__orch_dir, "..", "..", ".env"),          // from agents/orchestrator/src/
  resolve(process.cwd(), ".env"),                  // fallback: cwd
];
for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
    console.log(`[orchestrator] loaded env from ${envPath}`);
    break;
  }
}

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
  clearStorytellerRuntimeControlPlaneOverride,
  getMediaJobQueueSnapshot,
  getStoryCacheSnapshot,
  getStorytellerRuntimeConfig,
  purgeStoryCache,
  setStorytellerRuntimeControlPlaneOverride,
} from "@mla/storyteller-agent";
import { orchestrate } from "./orchestrate.js";
import { OrchestratorExecutionError } from "./retry-classification.js";
import { AnalyticsExporter } from "./services/analytics-export.js";
import { getFirestoreState } from "./services/firestore.js";
import { buildStoryCacheMetricRecords } from "./story-cache-telemetry.js";
import { buildStoryQueueMetricRecords } from "./story-queue-telemetry.js";
import {
  clearOrchestratorWorkflowControlPlaneOverride,
  getOrchestratorWorkflowConfig,
  getOrchestratorWorkflowStoreStatus,
  setOrchestratorWorkflowControlPlaneOverride,
} from "./workflow-store.js";

const port = Number(process.env.PORT ?? process.env.ORCHESTRATOR_PORT ?? 8082);
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

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJsonObjectBody(raw: string): Record<string, unknown> {
  if (raw.trim().length === 0) {
    return {};
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("request body must be a JSON object");
  }
  return parsed;
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
    workflow: getOrchestratorWorkflowStoreStatus(),
    storyteller: getStorytellerRuntimeConfig(),
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

    if (url.pathname === "/story/runtime/config" && req.method === "GET") {
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        storyteller: getStorytellerRuntimeConfig(),
        storytellerMediaJobs: getMediaJobQueueSnapshot(),
        storytellerCache: getStoryCacheSnapshot(),
      });
      return;
    }

    if (url.pathname === "/workflow/config" && req.method === "GET") {
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        workflow: getOrchestratorWorkflowConfig(),
        store: getOrchestratorWorkflowStoreStatus(),
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

    if (url.pathname === "/story/runtime/control-plane-override" && req.method === "POST") {
      let parsed: Record<string, unknown>;
      try {
        parsed = parseJsonObjectBody(await readBody(req));
      } catch {
        writeHttpError(res, 400, {
          code: "ORCHESTRATOR_STORYTELLER_RUNTIME_OVERRIDE_INVALID_JSON",
          message: "storyteller runtime override body must be valid JSON object",
        });
        return;
      }
      const reason = toOptionalString(parsed.reason);
      const clear = parsed.clear === true;

      if (clear) {
        clearStorytellerRuntimeControlPlaneOverride();
        writeJson(res, 200, {
          ok: true,
          service: serviceName,
          action: "clear",
          storyteller: getStorytellerRuntimeConfig(),
        });
        return;
      }

      const rawJson =
        typeof parsed.rawJson === "string" && parsed.rawJson.trim().length > 0
          ? parsed.rawJson
          : isRecord(parsed.runtime)
            ? JSON.stringify(parsed.runtime)
            : null;

      if (!rawJson) {
        writeHttpError(res, 400, {
          code: "ORCHESTRATOR_STORYTELLER_RUNTIME_OVERRIDE_INVALID",
          message: "storyteller runtime override requires rawJson string, runtime object, or clear=true",
          details: {
            allowedInputs: ["rawJson", "runtime", "clear"],
          },
        });
        return;
      }

      try {
        setStorytellerRuntimeControlPlaneOverride({
          rawJson,
          reason,
        });
      } catch (error) {
        writeHttpError(res, 400, {
          code: "ORCHESTRATOR_STORYTELLER_RUNTIME_OVERRIDE_INVALID",
          message: error instanceof Error ? error.message : "invalid storyteller runtime override",
        });
        return;
      }

      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        action: "set",
        storyteller: getStorytellerRuntimeConfig(),
      });
      return;
    }

    if (url.pathname === "/workflow/control-plane-override" && req.method === "POST") {
      let parsed: Record<string, unknown>;
      try {
        parsed = parseJsonObjectBody(await readBody(req));
      } catch {
        writeHttpError(res, 400, {
          code: "ORCHESTRATOR_WORKFLOW_OVERRIDE_INVALID_JSON",
          message: "workflow override body must be valid JSON object",
        });
        return;
      }
      const reason = toOptionalString(parsed.reason);
      const clear = parsed.clear === true;

      if (clear) {
        clearOrchestratorWorkflowControlPlaneOverride();
        writeJson(res, 200, {
          ok: true,
          service: serviceName,
          action: "clear",
          workflow: getOrchestratorWorkflowConfig(),
          store: getOrchestratorWorkflowStoreStatus(),
        });
        return;
      }

      const rawJson =
        typeof parsed.rawJson === "string" && parsed.rawJson.trim().length > 0
          ? parsed.rawJson
          : isRecord(parsed.workflow)
            ? JSON.stringify(parsed.workflow)
            : null;

      if (!rawJson) {
        writeHttpError(res, 400, {
          code: "ORCHESTRATOR_WORKFLOW_OVERRIDE_INVALID",
          message: "workflow override requires rawJson string, workflow object, or clear=true",
          details: {
            allowedInputs: ["rawJson", "workflow", "clear"],
          },
        });
        return;
      }

      setOrchestratorWorkflowControlPlaneOverride({
        rawJson,
        reason,
      });
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        action: "set",
        workflow: getOrchestratorWorkflowConfig(),
        store: getOrchestratorWorkflowStoreStatus(),
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
    const statusCode = error instanceof OrchestratorExecutionError ? error.statusCode : 500;
    const normalized =
      error instanceof OrchestratorExecutionError
        ? error.normalizedError
        : normalizeUnknownError(error, {
            defaultCode: "ORCHESTRATOR_HTTP_INTERNAL_ERROR",
            defaultMessage: "orchestrator request failed",
          });
    writeJson(
      res,
      statusCode,
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
