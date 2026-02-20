import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  createEnvelope,
  RollingMetrics,
  safeParseEnvelope,
  type EventEnvelope,
  type OrchestratorRequest,
  type OrchestratorResponse,
} from "@mla/contracts";
import { WebSocketServer } from "ws";
import { loadGatewayConfig } from "./config.js";
import { LiveApiBridge } from "./live-bridge.js";
import { sendToOrchestrator } from "./orchestrator-client.js";
import { TaskRegistry, type TaskRecord } from "./task-registry.js";

const config = loadGatewayConfig();
const serviceName = "realtime-gateway";
const serviceVersion = process.env.REALTIME_GATEWAY_VERSION ?? process.env.SERVICE_VERSION ?? "0.1.0";
const startedAtMs = Date.now();
let draining = false;
let lastWarmupAt: string | null = new Date().toISOString();
let lastDrainAt: string | null = null;
const taskRegistry = new TaskRegistry({
  completedRetentionMs: parsePositiveInt(process.env.GATEWAY_TASK_COMPLETED_RETENTION_MS, 5 * 60 * 1000),
  maxEntries: parsePositiveInt(process.env.GATEWAY_TASK_MAX_ENTRIES, 1000),
});
const metrics = new RollingMetrics({
  maxSamplesPerBucket: Number(process.env.GATEWAY_METRICS_MAX_SAMPLES ?? 2000),
});

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizeHttpPath(pathname: string): string {
  if (pathname.startsWith("/tasks/")) {
    return "/tasks/:taskId";
  }
  return pathname;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function extractRequestIntent(request: OrchestratorRequest): string | null {
  if (!isObject(request.payload)) {
    return null;
  }
  return toNonEmptyString(request.payload.intent);
}

function extractRequestTaskId(request: OrchestratorRequest): string | null {
  if (!isObject(request.payload)) {
    return null;
  }
  if (!isObject(request.payload.task)) {
    return null;
  }
  return toNonEmptyString(request.payload.task.taskId);
}

function extractResponseRoute(event: EventEnvelope): string | null {
  if (!isObject(event.payload)) {
    return null;
  }
  return toNonEmptyString(event.payload.route);
}

function extractResponseStatus(event: EventEnvelope): string | null {
  if (!isObject(event.payload)) {
    return null;
  }
  return toNonEmptyString(event.payload.status);
}

function extractApprovalRequired(event: EventEnvelope): boolean {
  if (!isObject(event.payload) || !isObject(event.payload.output)) {
    return false;
  }
  return event.payload.output.approvalRequired === true;
}

function attachTaskToRequest(
  request: OrchestratorRequest,
  task: TaskRecord,
): OrchestratorRequest {
  if (!isObject(request.payload)) {
    return request;
  }
  const payload = request.payload;
  return {
    ...request,
    payload: {
      ...payload,
      task: {
        taskId: task.taskId,
        status: task.status,
        progressPct: task.progressPct,
        stage: task.stage,
        route: task.route,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    },
  };
}

function attachTaskToResponse(response: OrchestratorResponse, task: TaskRecord): OrchestratorResponse {
  if (!isObject(response.payload)) {
    return response;
  }
  return {
    ...response,
    payload: {
      ...response.payload,
      task: {
        taskId: task.taskId,
        status: task.status,
        progressPct: task.progressPct,
        stage: task.stage,
        route: task.route,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    },
  };
}

function runtimeState(): Record<string, unknown> {
  const summary = metrics.snapshot({ topOperations: 10 });
  return {
    state: draining ? "draining" : "ready",
    ready: !draining,
    draining,
    activeTaskCount: taskRegistry.listActive({ limit: 1000 }).length,
    startedAt: new Date(startedAtMs).toISOString(),
    uptimeSec: Math.floor((Date.now() - startedAtMs) / 1000),
    lastWarmupAt,
    lastDrainAt,
    version: serviceVersion,
    metrics: {
      totalCount: summary.totalCount,
      totalErrors: summary.totalErrors,
      errorRatePct: summary.errorRatePct,
      p95Ms: summary.latencyMs.p95,
    },
  };
}

const server = createServer((req, res) => {
  const startedAt = Date.now();
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const operation = `${req.method ?? "UNKNOWN"} ${normalizeHttpPath(url.pathname)}`;
  res.once("finish", () => {
    metrics.record(operation, Date.now() - startedAt, res.statusCode < 500);
  });

  if (url.pathname === "/healthz" && req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: serviceName,
        runtime: runtimeState(),
      }),
    );
    return;
  }

  if (url.pathname === "/status" && req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: serviceName,
        runtime: runtimeState(),
      }),
    );
    return;
  }

  if (url.pathname === "/version" && req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: serviceName,
        version: serviceVersion,
      }),
    );
    return;
  }

  if (url.pathname === "/metrics" && req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: serviceName,
        metrics: metrics.snapshot({ topOperations: 50 }),
      }),
    );
    return;
  }

  if (url.pathname === "/warmup" && req.method === "POST") {
    draining = false;
    lastWarmupAt = new Date().toISOString();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: serviceName,
        runtime: runtimeState(),
      }),
    );
    return;
  }

  if (url.pathname === "/drain" && req.method === "POST") {
    draining = true;
    lastDrainAt = new Date().toISOString();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: serviceName,
        runtime: runtimeState(),
      }),
    );
    return;
  }

  if (url.pathname === "/tasks/active" && req.method === "GET") {
    const sessionId = toNonEmptyString(url.searchParams.get("sessionId"));
    const limit = parsePositiveInt(url.searchParams.get("limit") ?? undefined, 100);
    const tasks = taskRegistry.listActive({
      sessionId: sessionId ?? undefined,
      limit,
    });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: serviceName,
        total: tasks.length,
        data: tasks,
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/tasks/") && req.method === "GET") {
    const taskId = decodeURIComponent(url.pathname.replace("/tasks/", ""));
    if (!taskId) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "taskId is required" }));
      return;
    }
    const task = taskRegistry.getTask(taskId);
    if (!task) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "task not found" }));
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: serviceName,
        data: task,
      }),
    );
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

const wss = new WebSocketServer({ server, path: "/realtime" });

wss.on("connection", (ws) => {
  if (draining) {
    metrics.record("ws.connection", 0, false);
    ws.send(
      JSON.stringify(
        createEnvelope({
          sessionId: "system",
          type: "gateway.error",
          source: "gateway",
          payload: {
            code: "GATEWAY_DRAINING",
            message: "gateway is draining and does not accept new websocket sessions",
            runtime: runtimeState(),
          },
        }),
      ),
    );
    ws.close(1013, "gateway draining");
    return;
  }
  metrics.record("ws.connection", 0, true);

  let currentSessionId = "system";
  let liveBridge: LiveApiBridge | null = null;

  const sendEvent = (event: EventEnvelope): void => {
    ws.send(JSON.stringify(event));
  };

  const ensureLiveBridge = (sessionId: string): LiveApiBridge => {
    if (!liveBridge || currentSessionId !== sessionId) {
      liveBridge?.close();
      liveBridge = new LiveApiBridge({
        config,
        sessionId,
        send: sendEvent,
      });
    }
    return liveBridge;
  };

  sendEvent(
    createEnvelope({
      sessionId: currentSessionId,
      type: "gateway.connected",
      source: "gateway",
      payload: {
        ok: true,
        liveApiEnabled: config.liveApiEnabled,
        runtime: runtimeState(),
      },
    }),
  );

  ws.on("message", async (raw) => {
    const messageStartedAt = Date.now();
    const parsedEnvelope = safeParseEnvelope(raw.toString("utf8"));
    if (!parsedEnvelope) {
      metrics.record("ws.message.invalid_envelope", Date.now() - messageStartedAt, false);
      const traceId = randomUUID();
      sendEvent(
        createEnvelope({
          sessionId: "unknown",
          runId: traceId,
          type: "gateway.error",
          source: "gateway",
          payload: {
            code: "GATEWAY_INVALID_ENVELOPE",
            message: "Invalid event envelope",
            traceId,
          },
        }),
      );
      return;
    }

    const parsed: EventEnvelope = parsedEnvelope;

    currentSessionId = parsed.sessionId;

    if (draining) {
      metrics.record("ws.message.draining", Date.now() - messageStartedAt, false);
      sendEvent(
        createEnvelope({
          sessionId: parsed.sessionId,
          runId: parsed.runId,
          type: "gateway.error",
          source: "gateway",
          payload: {
            code: "GATEWAY_DRAINING",
            message: "gateway is draining and does not accept new requests",
            runtime: runtimeState(),
          },
        }),
      );
      return;
    }

    let trackedTaskOnError: TaskRecord | null = null;
    let orchestratorCallStartedAt: number | null = null;

    try {
      if (parsed.type.startsWith("live.")) {
        const bridge = ensureLiveBridge(parsed.sessionId);
        await bridge.forwardFromClient(parsed);
        metrics.record("ws.message.live", Date.now() - messageStartedAt, true);
        return;
      }

      const rawRequest: OrchestratorRequest = parsed.runId
        ? (parsed as OrchestratorRequest)
        : ({ ...parsed, runId: parsed.id } as OrchestratorRequest);
      const shouldTrackTask = parsed.type === "orchestrator.request";
      let trackedTask: TaskRecord | null = null;
      let request = rawRequest;

      if (shouldTrackTask) {
        trackedTask = taskRegistry.startTask({
          taskId: extractRequestTaskId(rawRequest) ?? undefined,
          sessionId: rawRequest.sessionId,
          runId: rawRequest.runId ?? null,
          intent: extractRequestIntent(rawRequest),
          stage: "received",
        });
        trackedTaskOnError = trackedTask;
        request = attachTaskToRequest(rawRequest, trackedTask);

        sendEvent(
          createEnvelope({
            sessionId: trackedTask.sessionId,
            runId: trackedTask.runId ?? undefined,
            type: "task.started",
            source: "gateway",
            payload: trackedTask,
          }),
        );

        const runningTask = taskRegistry.updateTask(trackedTask.taskId, {
          status: "running",
          progressPct: 35,
          stage: "orchestrator.dispatch",
        });
        if (runningTask) {
          trackedTask = runningTask;
          trackedTaskOnError = runningTask;
          sendEvent(
            createEnvelope({
              sessionId: runningTask.sessionId,
              runId: runningTask.runId ?? undefined,
              type: "task.progress",
              source: "gateway",
              payload: runningTask,
            }),
          );
        }
      }

      orchestratorCallStartedAt = Date.now();
      let response = await sendToOrchestrator(config.orchestratorUrl, request, {
        timeoutMs: config.orchestratorTimeoutMs,
        maxRetries: config.orchestratorMaxRetries,
        retryBackoffMs: config.orchestratorRetryBackoffMs,
      });
      metrics.record(
        "ws.orchestrator_request",
        Date.now() - (orchestratorCallStartedAt ?? messageStartedAt),
        true,
      );

      if (trackedTask) {
        const responseStatus = extractResponseStatus(response);
        const responseRoute = extractResponseRoute(response);

        if (responseStatus === "completed") {
          const completedTask = taskRegistry.updateTask(trackedTask.taskId, {
            status: "completed",
            progressPct: 100,
            stage: "done",
            route: responseRoute,
            error: null,
          });
          if (completedTask) {
            trackedTask = completedTask;
            trackedTaskOnError = null;
            sendEvent(
              createEnvelope({
                sessionId: completedTask.sessionId,
                runId: completedTask.runId ?? undefined,
                type: "task.completed",
                source: "gateway",
                payload: completedTask,
              }),
            );
          }
        } else if (responseStatus === "failed") {
          const failedTask = taskRegistry.updateTask(trackedTask.taskId, {
            status: "failed",
            progressPct: 100,
            stage: "done",
            route: responseRoute,
            error: "orchestrator failed",
          });
          if (failedTask) {
            trackedTask = failedTask;
            trackedTaskOnError = null;
            sendEvent(
              createEnvelope({
                sessionId: failedTask.sessionId,
                runId: failedTask.runId ?? undefined,
                type: "task.failed",
                source: "gateway",
                payload: failedTask,
              }),
            );
          }
        } else {
          const pendingStatus = extractApprovalRequired(response) ? "pending_approval" : "running";
          const pendingTask = taskRegistry.updateTask(trackedTask.taskId, {
            status: pendingStatus,
            progressPct: pendingStatus === "pending_approval" ? 70 : 60,
            stage: pendingStatus === "pending_approval" ? "awaiting_approval" : "accepted",
            route: responseRoute,
            error: null,
          });
          if (pendingTask) {
            trackedTask = pendingTask;
            trackedTaskOnError = pendingTask;
            sendEvent(
              createEnvelope({
                sessionId: pendingTask.sessionId,
                runId: pendingTask.runId ?? undefined,
                type: "task.progress",
                source: "gateway",
                payload: pendingTask,
              }),
            );
          }
        }

        if (trackedTask) {
          response = attachTaskToResponse(response, trackedTask);
        }
      }

      sendEvent(response);
      metrics.record("ws.message.orchestrator", Date.now() - messageStartedAt, true);
    } catch (error) {
      if (orchestratorCallStartedAt !== null) {
        metrics.record("ws.orchestrator_request", Date.now() - orchestratorCallStartedAt, false);
      }
      metrics.record("ws.message.orchestrator", Date.now() - messageStartedAt, false);
      if (trackedTaskOnError) {
        const failedTask = taskRegistry.updateTask(trackedTaskOnError.taskId, {
          status: "failed",
          progressPct: 100,
          stage: "done",
          error: error instanceof Error ? error.message : "gateway orchestration failure",
        });
        if (failedTask) {
          sendEvent(
            createEnvelope({
              sessionId: failedTask.sessionId,
              runId: failedTask.runId ?? undefined,
              type: "task.failed",
              source: "gateway",
              payload: failedTask,
            }),
          );
        }
      }

      const traceId = randomUUID();
      sendEvent(
        createEnvelope({
          sessionId: parsed.sessionId,
          runId: parsed.runId,
          type: "gateway.error",
          source: "gateway",
          payload: {
            code: "GATEWAY_ORCHESTRATOR_FAILURE",
            message: error instanceof Error ? error.message : "Unknown gateway failure",
            traceId,
          },
        }),
      );
    }
  });

  ws.on("close", () => {
    metrics.record("ws.connection.closed", 0, true);
    liveBridge?.close();
    liveBridge = null;
  });
});

server.listen(config.port, () => {
  console.log(`[realtime-gateway] listening on :${config.port}`);
  console.log(`[realtime-gateway] websocket endpoint ws://localhost:${config.port}/realtime`);
});
