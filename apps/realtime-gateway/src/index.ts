import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  applyRuntimeProfile,
  createApiErrorResponse,
  createEnvelope,
  createNormalizedError,
  normalizeUnknownError,
  RollingMetrics,
  safeParseEnvelope,
  type EventEnvelope,
  type NormalizedError,
  type OrchestratorIntent,
  type OrchestratorRequest,
  type OrchestratorResponse,
} from "@mla/contracts";
import { WebSocketServer } from "ws";
import { AnalyticsExporter } from "./analytics-export.js";
import { loadGatewayConfig, type GatewayConfig } from "./config.js";
import { LiveApiBridge } from "./live-bridge.js";
import { sendToOrchestrator } from "./orchestrator-client.js";
import { buildReplayFingerprint, buildReplayKey } from "./request-replay.js";
import { TaskRegistry, type TaskRecord } from "./task-registry.js";

const serviceName = "realtime-gateway";
const runtimeProfile = applyRuntimeProfile(serviceName);
const config = loadGatewayConfig();
const serviceVersion = process.env.REALTIME_GATEWAY_VERSION ?? process.env.SERVICE_VERSION ?? "0.1.0";
const startedAtMs = Date.now();
let draining = false;
let lastWarmupAt: string | null = new Date().toISOString();
let lastDrainAt: string | null = null;
const analytics = new AnalyticsExporter({ serviceName });
const taskRegistry = new TaskRegistry({
  completedRetentionMs: parsePositiveInt(process.env.GATEWAY_TASK_COMPLETED_RETENTION_MS, 5 * 60 * 1000),
  maxEntries: parsePositiveInt(process.env.GATEWAY_TASK_MAX_ENTRIES, 1000),
});
const metrics = new RollingMetrics({
  maxSamplesPerBucket: Number(process.env.GATEWAY_METRICS_MAX_SAMPLES ?? 2000),
  onRecord: (entry) => {
    analytics.recordMetric({
      metricType: "gateway.operation.duration_ms",
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
const gatewayOrchestratorReplayTtlMs = parsePositiveInt(process.env.GATEWAY_ORCHESTRATOR_DEDUPE_TTL_MS, 120_000);
const liveFunctionAutoInvokeEnabled = process.env.LIVE_FUNCTION_AUTO_INVOKE === "true";
const liveFunctionArgumentMaxBytes = parsePositiveInt(process.env.LIVE_FUNCTION_ARGUMENT_MAX_BYTES, 16 * 1024);
const liveFunctionDispatchDedupeTtlMs = parsePositiveInt(process.env.LIVE_FUNCTION_DEDUPE_TTL_MS, 120_000);
const liveFunctionAllowlist = parseCsvSet(process.env.LIVE_FUNCTION_ALLOWLIST);
const liveFunctionUiSandboxMode = parseUiSandboxMode(process.env.LIVE_FUNCTION_UI_SANDBOX_MODE);

const functionIntentAliasMap: Record<string, OrchestratorIntent> = {
  ui_task: "ui_task",
  delegate_ui_task: "ui_task",
  run_ui_task: "ui_task",
  computer_use: "ui_task",
  story: "story",
  create_story: "story",
  delegate_story: "story",
  translation: "translation",
  translate: "translation",
  live_translation: "translation",
  negotiation: "negotiation",
  negotiate: "negotiation",
  conversation: "conversation",
  chat: "conversation",
};

type GatewayTransportRuntimeState = {
  requestedMode: GatewayConfig["gatewayTransportMode"];
  activeMode: "websocket";
  fallbackActive: boolean;
  webrtc: {
    enabled: boolean;
    ready: boolean;
    reason: string | null;
  };
};

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

function parseCsvSet(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set();
  }
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0),
  );
}

function parseUiSandboxMode(raw: string | undefined): "off" | "non-main" | "all" {
  if (!raw) {
    return "all";
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "off") {
    return "off";
  }
  if (normalized === "non-main" || normalized === "non_main") {
    return "non-main";
  }
  return "all";
}

function normalizeHttpPath(pathname: string): string {
  if (pathname.startsWith("/tasks/")) {
    return "/tasks/:taskId";
  }
  return pathname;
}

function parseTaskActionPath(pathname: string): { taskId: string; action: "cancel" | "retry" } | null {
  const match = pathname.match(/^\/tasks\/([^/]+)\/(cancel|retry)$/);
  if (!match) {
    return null;
  }
  const taskIdRaw = match[1];
  const actionRaw = match[2];
  const taskId = decodeURIComponent(taskIdRaw ?? "").trim();
  if (taskId.length === 0) {
    return null;
  }
  if (actionRaw !== "cancel" && actionRaw !== "retry") {
    return null;
  }
  return {
    taskId,
    action: actionRaw,
  };
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

function normalizeFunctionName(value: string): string {
  return value.trim().toLowerCase();
}

function resolveFunctionCallIntent(functionName: string): OrchestratorIntent | null {
  const normalized = normalizeFunctionName(functionName);
  const fromAlias = functionIntentAliasMap[normalized];
  if (fromAlias) {
    return fromAlias;
  }
  if (normalized.startsWith("ui.") || normalized.startsWith("ui_") || normalized.includes("browser")) {
    return "ui_task";
  }
  if (normalized.includes("story")) {
    return "story";
  }
  if (normalized.includes("translate")) {
    return "translation";
  }
  if (normalized.includes("negotiat")) {
    return "negotiation";
  }
  if (normalized.includes("chat") || normalized.includes("conversation")) {
    return "conversation";
  }
  return null;
}

function parseFunctionArguments(argsJson: string): { value: unknown; sizeBytes: number; parseError: string | null } {
  const normalized = argsJson.trim();
  const sizeBytes = Buffer.byteLength(argsJson, "utf8");
  if (normalized.length === 0) {
    return {
      value: {},
      sizeBytes,
      parseError: null,
    };
  }
  try {
    return {
      value: JSON.parse(argsJson) as unknown,
      sizeBytes,
      parseError: null,
    };
  } catch {
    return {
      value: {},
      sizeBytes,
      parseError: "invalid_json",
    };
  }
}

function toObjectInput(value: unknown): Record<string, unknown> {
  if (isObject(value)) {
    return { ...value };
  }
  return {
    value,
  };
}

function extractApprovalRequiredFromOutput(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }
  return value.approvalRequired === true;
}

function extractEnvelopeUserId(event: EventEnvelope): string | null {
  const direct = toNonEmptyString((event as { userId?: unknown }).userId);
  if (direct) {
    return direct;
  }
  if (!isObject(event.payload)) {
    return null;
  }
  const payloadUserId = toNonEmptyString(event.payload.userId);
  if (payloadUserId) {
    return payloadUserId;
  }
  if (isObject(event.payload.meta)) {
    return toNonEmptyString(event.payload.meta.userId);
  }
  return null;
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

function isLiveBridgeEventType(type: string): boolean {
  if (type.startsWith("live.")) {
    return true;
  }
  return type === "conversation.item.truncate" || type === "conversation.item.create";
}

function cloneOrchestratorResponse(response: OrchestratorResponse): OrchestratorResponse {
  return JSON.parse(JSON.stringify(response)) as OrchestratorResponse;
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

function isOutOfBandConversation(scope: unknown): scope is "none" {
  return scope === "none";
}

function toMetadataRecord(value: unknown): Record<string, unknown> {
  if (!isObject(value)) {
    return {};
  }
  return value;
}

function extractApprovalRequired(event: EventEnvelope): boolean {
  if (!isObject(event.payload) || !isObject(event.payload.output)) {
    return false;
  }
  return event.payload.output.approvalRequired === true;
}

type SessionPhase =
  | "socket_connected"
  | "session_bound"
  | "live_forwarded"
  | "orchestrator_dispatching"
  | "orchestrator_pending_approval"
  | "orchestrator_completed"
  | "orchestrator_failed"
  | "text_fallback";

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

function resolveGatewayTransportRuntimeState(currentConfig: GatewayConfig): GatewayTransportRuntimeState {
  if (currentConfig.gatewayTransportMode === "webrtc") {
    return {
      requestedMode: "webrtc",
      activeMode: "websocket",
      fallbackActive: true,
      webrtc: {
        enabled: true,
        ready: false,
        reason: "webrtc_experimental_path_not_implemented",
      },
    };
  }

  return {
    requestedMode: "websocket",
    activeMode: "websocket",
    fallbackActive: false,
    webrtc: {
      enabled: false,
      ready: false,
      reason: null,
    },
  };
}

const transportRuntimeState = resolveGatewayTransportRuntimeState(config);

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
    profile: runtimeProfile,
    transport: transportRuntimeState,
    analytics: analytics.snapshot(),
    metrics: {
      totalCount: summary.totalCount,
      totalErrors: summary.totalErrors,
      errorRatePct: summary.errorRatePct,
      p95Ms: summary.latencyMs.p95,
    },
  };
}

function writeJson(
  res: import("node:http").ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function writeHttpError(
  res: import("node:http").ServerResponse,
  statusCode: number,
  params: {
    code: string;
    message: string;
    traceId?: string;
    details?: unknown;
    runtime?: unknown;
  },
): NormalizedError {
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
  return error;
}

const server = createServer((req, res) => {
  const startedAt = Date.now();
  let operation = `${req.method ?? "UNKNOWN"} /unknown`;
  res.once("finish", () => {
    metrics.record(operation, Date.now() - startedAt, res.statusCode < 500);
  });

  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    operation = `${req.method ?? "UNKNOWN"} ${normalizeHttpPath(url.pathname)}`;

    if (url.pathname === "/healthz" && req.method === "GET") {
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        runtime: runtimeState(),
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
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        metrics: metrics.snapshot({ topOperations: 50 }),
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

    if (url.pathname === "/tasks/active" && req.method === "GET") {
      const sessionId = toNonEmptyString(url.searchParams.get("sessionId"));
      const limit = parsePositiveInt(url.searchParams.get("limit") ?? undefined, 100);
      const tasks = taskRegistry.listActive({
        sessionId: sessionId ?? undefined,
        limit,
      });
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        total: tasks.length,
        data: tasks,
      });
      return;
    }

    const taskAction = parseTaskActionPath(url.pathname);
    if (taskAction && req.method === "POST") {
      const operatorReason = toNonEmptyString(url.searchParams.get("reason"));
      const task =
        taskAction.action === "cancel"
          ? taskRegistry.cancelTask(taskAction.taskId, operatorReason ?? undefined)
          : taskRegistry.retryTask(taskAction.taskId);

      if (!task) {
        writeHttpError(res, 404, {
          code: "GATEWAY_TASK_NOT_FOUND",
          message: "task not found",
          details: { taskId: taskAction.taskId },
        });
        return;
      }

      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        action: taskAction.action,
        data: task,
      });
      return;
    }

    if (url.pathname.startsWith("/tasks/") && req.method === "GET") {
      const taskId = decodeURIComponent(url.pathname.replace("/tasks/", ""));
      if (!taskId) {
        writeHttpError(res, 400, {
          code: "GATEWAY_TASK_ID_REQUIRED",
          message: "taskId is required",
        });
        return;
      }
      const task = taskRegistry.getTask(taskId);
      if (!task) {
        writeHttpError(res, 404, {
          code: "GATEWAY_TASK_NOT_FOUND",
          message: "task not found",
          details: { taskId },
        });
        return;
      }
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        data: task,
      });
      return;
    }

    writeHttpError(res, 404, {
      code: "GATEWAY_HTTP_NOT_FOUND",
      message: "Not found",
      details: {
        method: req.method ?? "UNKNOWN",
        path: url.pathname,
      },
    });
  } catch (error) {
    const normalized = normalizeUnknownError(error, {
      defaultCode: "GATEWAY_HTTP_INTERNAL_ERROR",
      defaultMessage: "gateway http request failed",
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

const wss = new WebSocketServer({ server, path: "/realtime" });

wss.on("connection", (ws) => {
  if (draining) {
    metrics.record("ws.connection", 0, false);
    const normalized = createNormalizedError({
      code: "GATEWAY_DRAINING",
      message: "gateway is draining and does not accept new websocket sessions",
      details: {
        runtime: runtimeState(),
      },
    });
    ws.send(
      JSON.stringify(
        createEnvelope({
          userId: "system",
          sessionId: "system",
          runId: normalized.traceId,
          type: "gateway.error",
          source: "gateway",
          payload: normalized,
        }),
      ),
    );
    ws.close(1013, "gateway draining");
    return;
  }
  metrics.record("ws.connection", 0, true);

  const connectionId = randomUUID();
  let currentSessionId = "system";
  let currentUserId = "anonymous";
  let currentRunId = `conn-${connectionId}`;
  let sessionPhase: SessionPhase = "socket_connected";
  let liveBridge: LiveApiBridge | null = null;
  let sessionBinding:
    | {
        sessionId: string;
        userId: string;
        establishedAt: string;
      }
    | null = null;
  let messageLane: Promise<void> = Promise.resolve();
  const dispatchedLiveFunctionCalls = new Map<string, number>();

  const cleanupDispatchedLiveFunctionCalls = (nowMs = Date.now()): void => {
    for (const [callId, dispatchedAtMs] of dispatchedLiveFunctionCalls.entries()) {
      if (nowMs - dispatchedAtMs >= liveFunctionDispatchDedupeTtlMs) {
        dispatchedLiveFunctionCalls.delete(callId);
      }
    }
  };

  const markLiveFunctionCallDispatched = (callId: string): boolean => {
    cleanupDispatchedLiveFunctionCalls();
    if (dispatchedLiveFunctionCalls.has(callId)) {
      return false;
    }
    dispatchedLiveFunctionCalls.set(callId, Date.now());
    return true;
  };

  const decorateOutboundEvent = (event: EventEnvelope): EventEnvelope => {
    if (!liveFunctionAutoInvokeEnabled || event.type !== "live.function_call") {
      return event;
    }
    const metadata = toMetadataRecord((event as { metadata?: unknown }).metadata);
    return {
      ...event,
      metadata: {
        ...metadata,
        autoDispatch: "gateway_auto_invoke",
      },
    };
  };

  async function handleLiveFunctionCallAutoInvoke(event: EventEnvelope): Promise<void> {
    const startedAtMs = Date.now();
    if (!liveFunctionAutoInvokeEnabled || event.type !== "live.function_call") {
      return;
    }

    const payload = isObject(event.payload) ? event.payload : null;
    const name = payload ? toNonEmptyString(payload.name) : null;
    const callId = payload ? toNonEmptyString(payload.callId) ?? randomUUID() : randomUUID();
    const turnId = payload ? toNonEmptyString(payload.turnId) : null;
    const functionRunId = `fc-${callId}`;

    const emitFunctionCallFailure = async (params: {
      code: string;
      message: string;
      details?: unknown;
      intent?: OrchestratorIntent | null;
      argumentBytes?: number;
    }): Promise<void> => {
      const normalized = createNormalizedError({
        code: params.code,
        message: params.message,
        details: params.details,
      });
      emitGatewayEvent({
        type: "live.function_call.failed",
        runId: functionRunId,
        payload: {
          callId,
          name: name ?? "unknown_function",
          intent: params.intent ?? null,
          argumentBytes: params.argumentBytes ?? null,
          traceId: normalized.traceId,
          errorCode: normalized.code,
          message: normalized.message,
        },
      });

      const bridge = ensureLiveBridge(currentSessionId, currentUserId, functionRunId);
      await bridge.forwardFromClient(
        createEnvelope({
          userId: currentUserId,
          sessionId: currentSessionId,
          runId: functionRunId,
          conversation: "none",
          metadata: {
            oob: true,
            autoDispatch: "gateway_auto_invoke",
            parentEventId: event.id,
            functionCallName: name ?? "unknown_function",
            failed: true,
          },
          type: "live.function_call_output",
          source: "gateway",
          payload: {
            callId,
            name: name ?? "unknown_function",
            output: {
              status: "failed",
              route: null,
              approvalRequired: false,
              output: null,
              traceId: normalized.traceId,
              error: normalized,
            },
          },
        }),
      );
      metrics.record("ws.message.live.function_call.auto", Date.now() - startedAtMs, false);
    };

    if (!name || !payload) {
      await emitFunctionCallFailure({
        code: "GATEWAY_FUNCTION_CALL_INVALID_PAYLOAD",
        message: "invalid live.function_call payload",
      });
      return;
    }

    if (!markLiveFunctionCallDispatched(callId)) {
      metrics.record("ws.message.live.function_call.auto", Date.now() - startedAtMs, true);
      return;
    }

    const normalizedFunctionName = normalizeFunctionName(name);
    if (liveFunctionAllowlist.size > 0 && !liveFunctionAllowlist.has(normalizedFunctionName)) {
      await emitFunctionCallFailure({
        code: "GATEWAY_FUNCTION_CALL_NOT_ALLOWED",
        message: "function call is not in configured allowlist",
        details: {
          functionName: normalizedFunctionName,
        },
      });
      return;
    }

    const intent = resolveFunctionCallIntent(normalizedFunctionName);
    if (!intent) {
      await emitFunctionCallFailure({
        code: "GATEWAY_FUNCTION_CALL_UNMAPPED",
        message: "function call name cannot be mapped to orchestrator intent",
        details: {
          functionName: normalizedFunctionName,
        },
      });
      return;
    }

    const argumentsJson =
      typeof payload.argumentsJson === "string"
        ? payload.argumentsJson
        : typeof payload.arguments === "string"
          ? payload.arguments
          : JSON.stringify(payload.arguments ?? payload.args ?? {});
    const parsedArguments = parseFunctionArguments(argumentsJson);
    if (parsedArguments.sizeBytes > liveFunctionArgumentMaxBytes) {
      await emitFunctionCallFailure({
        code: "GATEWAY_FUNCTION_CALL_ARGUMENTS_TOO_LARGE",
        message: "function call arguments exceed configured byte limit",
        details: {
          maxBytes: liveFunctionArgumentMaxBytes,
          sizeBytes: parsedArguments.sizeBytes,
        },
        intent,
        argumentBytes: parsedArguments.sizeBytes,
      });
      return;
    }
    if (parsedArguments.parseError) {
      await emitFunctionCallFailure({
        code: "GATEWAY_FUNCTION_CALL_ARGUMENTS_INVALID",
        message: "function call arguments are not valid JSON",
        details: {
          parseError: parsedArguments.parseError,
        },
        intent,
        argumentBytes: parsedArguments.sizeBytes,
      });
      return;
    }

    const input = toObjectInput(parsedArguments.value);
    if (!toNonEmptyString(input.idempotencyKey)) {
      input.idempotencyKey = `live-function:${callId}`;
    }
    input.functionCall = {
      name,
      callId,
      turnId,
      sourceEventId: event.id,
      autoDispatch: true,
    };
    if (intent === "ui_task") {
      if (!toNonEmptyString(input.sandboxPolicyMode)) {
        input.sandboxPolicyMode = liveFunctionUiSandboxMode;
      }
      if (!toNonEmptyString(input.sessionRole)) {
        input.sessionRole = "secondary";
      }
      if (input.approvalConfirmed !== true) {
        input.approvalConfirmed = false;
      }
    }

    emitGatewayEvent({
      type: "live.function_call.dispatching",
      runId: functionRunId,
      payload: {
        callId,
        name,
        turnId,
        intent,
        argumentBytes: parsedArguments.sizeBytes,
        autoDispatch: true,
        sandboxPolicyMode: intent === "ui_task" ? input.sandboxPolicyMode : null,
      },
    });

    try {
      const request = createEnvelope({
        userId: currentUserId,
        sessionId: currentSessionId,
        runId: functionRunId,
        conversation: "none",
        metadata: {
          oob: true,
          topic: "realtime_function_call",
          parentEventId: event.id,
          functionCallName: name,
          autoDispatch: "gateway_auto_invoke",
        },
        type: "orchestrator.request",
        source: "gateway",
        payload: {
          intent,
          input,
        },
      }) as OrchestratorRequest;

      let response = await sendToOrchestrator(config.orchestratorUrl, request, {
        timeoutMs: config.orchestratorTimeoutMs,
        maxRetries: config.orchestratorMaxRetries,
        retryBackoffMs: config.orchestratorRetryBackoffMs,
      });

      if (!toNonEmptyString((response as { userId?: unknown }).userId)) {
        response = {
          ...response,
          userId: currentUserId,
        };
      }
      if (!toNonEmptyString(response.runId)) {
        response = {
          ...response,
          runId: functionRunId,
        };
      }

      const approvalRequired = extractApprovalRequiredFromOutput(response.payload.output);
      const responseRunId = response.runId ?? functionRunId;
      emitGatewayEvent({
        type: "live.function_call.completed",
        runId: responseRunId,
        payload: {
          callId,
          name,
          turnId,
          intent,
          status: response.payload.status,
          route: response.payload.route,
          approvalRequired,
        },
      });

      const bridge = ensureLiveBridge(currentSessionId, currentUserId, responseRunId);
      await bridge.forwardFromClient(
        createEnvelope({
          userId: currentUserId,
          sessionId: currentSessionId,
          runId: responseRunId,
          conversation: "none",
          metadata: {
            oob: true,
            autoDispatch: "gateway_auto_invoke",
            parentEventId: event.id,
            functionCallName: name,
            intent,
            approvalRequired,
          },
          type: "live.function_call_output",
          source: "gateway",
          payload: {
            callId,
            name,
            output: {
              status: response.payload.status,
              route: response.payload.route,
              output: response.payload.output ?? null,
              traceId: response.payload.traceId ?? null,
              error: response.payload.error ?? null,
              approvalRequired,
            },
          },
        }),
      );
      metrics.record("ws.message.live.function_call.auto", Date.now() - startedAtMs, true);
    } catch (error) {
      await emitFunctionCallFailure({
        code: "GATEWAY_FUNCTION_CALL_ORCHESTRATOR_FAILURE",
        message: error instanceof Error ? error.message : "function call dispatch failed",
        details: {
          intent,
          functionName: normalizedFunctionName,
        },
        intent,
        argumentBytes: parsedArguments.sizeBytes,
      });
    }
  }

  const sendEvent = (event: EventEnvelope): void => {
    const outboundEvent = decorateOutboundEvent(event);
    ws.send(JSON.stringify(outboundEvent));
    if (liveFunctionAutoInvokeEnabled && outboundEvent.type === "live.function_call") {
      messageLane = messageLane
        .then(async () => {
          await handleLiveFunctionCallAutoInvoke(outboundEvent);
        })
        .catch((error) => {
          emitGatewayError({
            sessionId: currentSessionId,
            runId: currentRunId,
            code: "GATEWAY_SERIAL_LANE_FAILURE",
            message: error instanceof Error ? error.message : "Unhandled gateway message lane failure",
          });
        });
    }
  };

  const emitGatewayEvent = (params: {
    type: string;
    payload: unknown;
    sessionId?: string;
    runId?: string;
    userId?: string;
  }): void => {
    sendEvent(
      createEnvelope({
        userId: params.userId ?? currentUserId,
        sessionId: params.sessionId ?? currentSessionId,
        runId: params.runId ?? currentRunId,
        type: params.type,
        source: "gateway",
        payload: params.payload,
      }),
    );
  };

  const emitGatewayError = (params: {
    code: string;
    message: string;
    details?: unknown;
    sessionId?: string;
    runId?: string;
    userId?: string;
    traceId?: string;
    clientEventId?: string;
  }): NormalizedError => {
    let details = params.details;
    const clientEventId = toNonEmptyString(params.clientEventId);
    if (clientEventId) {
      if (isObject(details)) {
        details = {
          ...details,
          clientEventId,
        };
      } else if (details === undefined) {
        details = {
          clientEventId,
        };
      } else {
        details = {
          clientEventId,
          context: details,
        };
      }
    }

    const normalized = createNormalizedError({
      code: params.code,
      message: params.message,
      traceId: params.traceId,
      details,
    });
    emitGatewayEvent({
      type: "gateway.error",
      sessionId: params.sessionId,
      runId: params.runId ?? normalized.traceId,
      userId: params.userId,
      payload: normalized,
    });
    return normalized;
  };

  const emitSessionState = (
    nextState: SessionPhase,
    details: Record<string, unknown> = {},
    runId: string | undefined = currentRunId,
  ): void => {
    const previousState = sessionPhase;
    sessionPhase = nextState;
    emitGatewayEvent({
      type: "session.state",
      runId,
      payload: {
        previousState,
        state: nextState,
        connectionId,
        ...details,
      },
    });
  };

  const establishBinding = (parsed: EventEnvelope): { runId: string; userId: string } | null => {
    const messageRunId = toNonEmptyString(parsed.runId) ?? parsed.id;
    const messageUserId = extractEnvelopeUserId(parsed) ?? currentUserId;

    if (!sessionBinding) {
      const establishedAt = new Date().toISOString();
      sessionBinding = {
        sessionId: parsed.sessionId,
        userId: messageUserId,
        establishedAt,
      };
      currentSessionId = parsed.sessionId;
      currentUserId = messageUserId;
      currentRunId = messageRunId;
      emitSessionState(
        "session_bound",
        {
          sessionId: currentSessionId,
          userId: currentUserId,
          establishedAt,
        },
        currentRunId,
      );
      return {
        runId: currentRunId,
        userId: currentUserId,
      };
    }

    if (parsed.sessionId !== sessionBinding.sessionId) {
      emitGatewayError({
        sessionId: sessionBinding.sessionId,
        runId: messageRunId,
        code: "GATEWAY_SESSION_MISMATCH",
        message: "sessionId mismatch for bound websocket connection",
        clientEventId: parsed.id,
        details: {
          expectedSessionId: sessionBinding.sessionId,
          receivedSessionId: parsed.sessionId,
        },
      });
      return null;
    }

    const providedUserId = extractEnvelopeUserId(parsed);
    if (providedUserId && providedUserId !== sessionBinding.userId) {
      emitGatewayError({
        sessionId: sessionBinding.sessionId,
        runId: messageRunId,
        code: "GATEWAY_USER_MISMATCH",
        message: "userId mismatch for bound websocket connection",
        clientEventId: parsed.id,
        details: {
          expectedUserId: sessionBinding.userId,
          receivedUserId: providedUserId,
        },
      });
      return null;
    }

    currentSessionId = sessionBinding.sessionId;
    currentUserId = sessionBinding.userId;
    currentRunId = messageRunId;
    return {
      runId: currentRunId,
      userId: currentUserId,
    };
  };

  const ensureLiveBridge = (sessionId: string, userId: string, runId: string): LiveApiBridge => {
    if (!liveBridge || currentSessionId !== sessionId) {
      liveBridge?.close();
      liveBridge = new LiveApiBridge({
        config,
        sessionId,
        userId,
        runId,
        send: sendEvent,
      });
    } else {
      liveBridge.updateContext({ userId, runId });
    }
    return liveBridge;
  };

  emitGatewayEvent({
    type: "gateway.connected",
    payload: {
      ok: true,
      liveApiEnabled: config.liveApiEnabled,
      runtime: runtimeState(),
      connectionId,
    },
  });
  emitSessionState(
    "socket_connected",
    {
      connectedAt: new Date().toISOString(),
    },
    currentRunId,
  );
  type ReplayCacheEntry = {
    response: OrchestratorResponse;
    fingerprint: string;
    cachedAtMs: number;
    expiresAtMs: number;
  };
  const requestReplayCache = new Map<string, ReplayCacheEntry>();

  const cleanupReplayCache = (nowMs = Date.now()): void => {
    for (const [key, entry] of requestReplayCache.entries()) {
      if (entry.expiresAtMs <= nowMs) {
        requestReplayCache.delete(key);
      }
    }
  };

  const processMessage = async (rawText: string): Promise<void> => {
    const messageStartedAt = Date.now();
    const parsedEnvelope = safeParseEnvelope(rawText);
    if (!parsedEnvelope) {
      metrics.record("ws.message.invalid_envelope", Date.now() - messageStartedAt, false);
      emitGatewayError({
        sessionId: "unknown",
        code: "GATEWAY_INVALID_ENVELOPE",
        message: "Invalid event envelope",
      });
      return;
    }

    const parsed: EventEnvelope = parsedEnvelope;
    const isOutOfBandRequest = isOutOfBandConversation(parsed.conversation);
    const binding = establishBinding(parsed);
    if (!binding) {
      metrics.record("ws.message.binding_error", Date.now() - messageStartedAt, false);
      return;
    }

    if (draining) {
      metrics.record("ws.message.draining", Date.now() - messageStartedAt, false);
      emitGatewayError({
        sessionId: parsed.sessionId,
        runId: binding.runId,
        code: "GATEWAY_DRAINING",
        message: "gateway is draining and does not accept new requests",
        clientEventId: parsed.id,
        details: {
          runtime: runtimeState(),
        },
      });
      return;
    }

    let trackedTaskOnError: TaskRecord | null = null;
    let orchestratorCallStartedAt: number | null = null;

    try {
      if (isLiveBridgeEventType(parsed.type)) {
        const liveEvent = {
          ...parsed,
          userId: binding.userId,
          runId: binding.runId,
        } as EventEnvelope;
        const bridge = ensureLiveBridge(parsed.sessionId, binding.userId, binding.runId);
        if (!bridge.isConfigured()) {
          emitSessionState(
            "text_fallback",
            {
              reason: "live.bridge.unavailable",
            },
            binding.runId,
          );
        }
        await bridge.forwardFromClient(liveEvent);
        emitSessionState(
          "live_forwarded",
          {
            eventType: parsed.type,
          },
          binding.runId,
        );
        metrics.record("ws.message.live", Date.now() - messageStartedAt, true);
        return;
      }

      const normalizedRunId = toNonEmptyString(parsed.runId) ?? parsed.id;
      const rawRequest: OrchestratorRequest = {
        ...(parsed as OrchestratorRequest),
        runId: normalizedRunId,
        userId: binding.userId,
      };
      const shouldTrackTask = parsed.type === "orchestrator.request" && !isOutOfBandRequest;
      const replayKey = shouldTrackTask ? buildReplayKey(rawRequest) : null;
      const replayFingerprint = replayKey ? buildReplayFingerprint(rawRequest) : null;
      let trackedTask: TaskRecord | null = null;
      let request = rawRequest;

      if (replayKey && replayFingerprint) {
        cleanupReplayCache();
        const cached = requestReplayCache.get(replayKey);
        if (cached && cached.expiresAtMs > Date.now()) {
          if (cached.fingerprint !== replayFingerprint) {
            emitSessionState(
              "orchestrator_failed",
              {
                reason: "idempotency_conflict",
                replayKey,
              },
              rawRequest.runId,
            );
            emitGatewayError({
              sessionId: rawRequest.sessionId,
              runId: rawRequest.runId ?? undefined,
              code: "GATEWAY_IDEMPOTENCY_CONFLICT",
              message: "request identity conflict for replay key",
              clientEventId: rawRequest.id,
              details: {
                replayKey,
                cachedFingerprint: cached.fingerprint,
                receivedFingerprint: replayFingerprint,
              },
            });
            metrics.record("ws.message.orchestrator.idempotency_conflict", Date.now() - messageStartedAt, false);
            metrics.record("ws.message.orchestrator", Date.now() - messageStartedAt, false);
            return;
          }

          const replayedResponse = cloneOrchestratorResponse(cached.response);
          emitGatewayEvent({
            sessionId: rawRequest.sessionId,
            runId: rawRequest.runId ?? undefined,
            type: "gateway.request_replayed",
            payload: {
              replayKey,
              cachedAt: new Date(cached.cachedAtMs).toISOString(),
              ageMs: Date.now() - cached.cachedAtMs,
            },
          });

          const replayStatus = extractResponseStatus(replayedResponse);
          const replayRoute = extractResponseRoute(replayedResponse);
          if (replayStatus === "completed") {
            emitSessionState(
              "orchestrator_completed",
              {
                route: replayRoute,
                replayed: true,
              },
              replayedResponse.runId,
            );
          } else if (replayStatus === "failed") {
            emitSessionState(
              "orchestrator_failed",
              {
                route: replayRoute,
                replayed: true,
              },
              replayedResponse.runId,
            );
          } else {
            emitSessionState(
              "orchestrator_pending_approval",
              {
                route: replayRoute,
                responseStatus: replayStatus,
                replayed: true,
              },
              replayedResponse.runId,
            );
          }
          sendEvent(replayedResponse);
          metrics.record("ws.message.orchestrator.replayed", Date.now() - messageStartedAt, true);
          metrics.record("ws.message.orchestrator", Date.now() - messageStartedAt, true);
          return;
        }
      }

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

        emitGatewayEvent({
          sessionId: trackedTask.sessionId,
          runId: trackedTask.runId ?? undefined,
          type: "task.started",
          payload: trackedTask,
        });

        const runningTask = taskRegistry.updateTask(trackedTask.taskId, {
          status: "running",
          progressPct: 35,
          stage: "orchestrator.dispatch",
        });
        if (runningTask) {
          trackedTask = runningTask;
          trackedTaskOnError = runningTask;
          emitGatewayEvent({
            sessionId: runningTask.sessionId,
            runId: runningTask.runId ?? undefined,
            type: "task.progress",
            payload: runningTask,
          });
        }
      }

      if (!isOutOfBandRequest) {
        emitSessionState(
          "orchestrator_dispatching",
          {
            intent: extractRequestIntent(rawRequest),
          },
          rawRequest.runId,
        );
      }
      orchestratorCallStartedAt = Date.now();
      let response = await sendToOrchestrator(config.orchestratorUrl, request, {
        timeoutMs: config.orchestratorTimeoutMs,
        maxRetries: config.orchestratorMaxRetries,
        retryBackoffMs: config.orchestratorRetryBackoffMs,
      });
      if (!toNonEmptyString((response as { userId?: unknown }).userId)) {
        response = {
          ...response,
          userId: binding.userId,
        };
      }
      if (!toNonEmptyString(response.runId)) {
        response = {
          ...response,
          runId: rawRequest.runId,
        };
      }
      if (isOutOfBandRequest) {
        const responseMetadata = toMetadataRecord((response as { metadata?: unknown }).metadata);
        const requestMetadata = toMetadataRecord(parsed.metadata);
        const taggedMetadata: Record<string, unknown> = {
          ...responseMetadata,
          oob: true,
          parentEventId: parsed.id,
          parentRunId: rawRequest.runId ?? null,
        };
        if (Object.keys(requestMetadata).length > 0) {
          taggedMetadata.requestMetadata = requestMetadata;
        }
        response = {
          ...response,
          conversation: "none",
          metadata: taggedMetadata,
        };
      }
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
            emitGatewayEvent({
              sessionId: completedTask.sessionId,
              runId: completedTask.runId ?? undefined,
              type: "task.completed",
              payload: completedTask,
            });
          }
          emitSessionState(
            "orchestrator_completed",
            {
              route: responseRoute,
            },
            response.runId,
          );
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
            emitGatewayEvent({
              sessionId: failedTask.sessionId,
              runId: failedTask.runId ?? undefined,
              type: "task.failed",
              payload: failedTask,
            });
          }
          emitSessionState(
            "orchestrator_failed",
            {
              route: responseRoute,
            },
            response.runId,
          );
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
            emitGatewayEvent({
              sessionId: pendingTask.sessionId,
              runId: pendingTask.runId ?? undefined,
              type: "task.progress",
              payload: pendingTask,
            });
          }
          emitSessionState(
            "orchestrator_pending_approval",
            {
              route: responseRoute,
              responseStatus,
            },
            response.runId,
          );
        }

        if (trackedTask) {
          response = attachTaskToResponse(response, trackedTask);
        }
      }

      if (replayKey) {
        const nowMs = Date.now();
        requestReplayCache.set(replayKey, {
          response: cloneOrchestratorResponse(response),
          fingerprint: replayFingerprint ?? "unknown",
          cachedAtMs: nowMs,
          expiresAtMs: nowMs + gatewayOrchestratorReplayTtlMs,
        });
        cleanupReplayCache(nowMs);
      }

      sendEvent(response);
      if (isOutOfBandRequest) {
        metrics.record("ws.message.orchestrator.oob", Date.now() - messageStartedAt, true);
      }
      metrics.record("ws.message.orchestrator", Date.now() - messageStartedAt, true);
    } catch (error) {
      if (orchestratorCallStartedAt !== null) {
        metrics.record("ws.orchestrator_request", Date.now() - orchestratorCallStartedAt, false);
      }
      if (isOutOfBandRequest) {
        metrics.record("ws.message.orchestrator.oob", Date.now() - messageStartedAt, false);
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
          emitGatewayEvent({
            sessionId: failedTask.sessionId,
            runId: failedTask.runId ?? undefined,
            type: "task.failed",
            payload: failedTask,
          });
        }
      }

      if (!isOutOfBandRequest) {
        emitSessionState(
          "orchestrator_failed",
          {
            error: error instanceof Error ? error.message : "Unknown gateway failure",
          },
          currentRunId,
        );
      }
      emitGatewayError({
        sessionId: parsed.sessionId,
        runId: currentRunId,
        code: "GATEWAY_ORCHESTRATOR_FAILURE",
        message: error instanceof Error ? error.message : "Unknown gateway failure",
        clientEventId: parsed.id,
        details: {
          route: "orchestrator",
        },
      });
    }
  };

  ws.on("message", (raw) => {
    const rawText = raw.toString("utf8");
    messageLane = messageLane
      .then(async () => {
        await processMessage(rawText);
      })
      .catch((error) => {
        metrics.record("ws.message.serial_lane", 0, false);
        emitGatewayError({
          sessionId: currentSessionId,
          runId: currentRunId,
          code: "GATEWAY_SERIAL_LANE_FAILURE",
          message: error instanceof Error ? error.message : "Unhandled gateway message lane failure",
        });
      });
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
  if (transportRuntimeState.fallbackActive) {
    console.warn(
      `[realtime-gateway] transport fallback active: requested=${transportRuntimeState.requestedMode}, active=${transportRuntimeState.activeMode}, reason=${transportRuntimeState.webrtc.reason}`,
    );
  } else {
    console.log(
      `[realtime-gateway] transport mode: requested=${transportRuntimeState.requestedMode}, active=${transportRuntimeState.activeMode}`,
    );
  }
});
