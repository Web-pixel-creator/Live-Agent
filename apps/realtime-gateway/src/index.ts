import { createServer, type IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
const moduleDir = dirname(fileURLToPath(import.meta.url));

function resolveReadablePath(preferredPath: string | undefined, candidates: string[]): string | null {
  if (preferredPath) {
    return preferredPath;
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0] ?? null;
}

const publicBadgeFilePath = resolveReadablePath(process.env.PUBLIC_BADGE_PATH, [
  resolve(process.cwd(), "public", "demo-e2e", "badge.json"),
  resolve(process.cwd(), "..", "..", "public", "demo-e2e", "badge.json"),
  resolve(moduleDir, "..", "..", "..", "public", "demo-e2e", "badge.json"),
]);
const publicBadgeDetailsFilePath = resolveReadablePath(process.env.PUBLIC_BADGE_DETAILS_PATH, [
  resolve(process.cwd(), "public", "demo-e2e", "badge-details.json"),
  resolve(process.cwd(), "..", "..", "public", "demo-e2e", "badge-details.json"),
  resolve(moduleDir, "..", "..", "..", "public", "demo-e2e", "badge-details.json"),
]);
const publicBadgeFallback: Record<string, unknown> = {
  schemaVersion: 1,
  label: "Demo KPI Gate",
  message: "service online",
  color: "blue",
  cacheSeconds: 300,
};
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
    rollout: {
      stage: GatewayConfig["gatewayWebrtcRolloutStage"];
      canaryPercent: number;
      rollbackReady: boolean;
    };
  };
};

type TurnTruncationSnapshot = {
  runId: string | null;
  sessionId: string;
  seenAt: string;
  turnId: string | null;
  reason: string | null;
  contentIndex: number | null;
  audioEndMs: number | null;
  scope: string | null;
};

type TurnDeleteSnapshot = {
  runId: string | null;
  sessionId: string;
  seenAt: string;
  turnId: string | null;
  reason: string | null;
  scope: string | null;
  hadActiveTurn: boolean;
};

type DamageControlSnapshot = {
  runId: string | null;
  sessionId: string;
  seenAt: string;
  verdict: "allow" | "ask" | "block" | null;
  source: string | null;
  path: string | null;
  matchedRuleCount: number;
  matchRuleIds: string[];
  enabled: boolean | null;
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

function loadPublicJsonFile(filePath: string | null): Record<string, unknown> | null {
  if (!filePath) {
    return null;
  }
  try {
    const raw = readFileSync(filePath, "utf8");
    const normalized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(normalized) as unknown;
    if (!isObject(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getPublicBadgePayload(): Record<string, unknown> {
  return loadPublicJsonFile(publicBadgeFilePath) ?? { ...publicBadgeFallback };
}

function getPublicBadgeDetailsPayload(): Record<string, unknown> {
  const fromFile = loadPublicJsonFile(publicBadgeDetailsFilePath);
  if (fromFile) {
    return fromFile;
  }
  return {
    generatedAt: new Date().toISOString(),
    ok: true,
    source: "gateway_fallback",
    badge: getPublicBadgePayload(),
  };
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

function resolveGatewayPublicUrl(req: IncomingMessage): string | null {
  const configuredPublicUrl = toNonEmptyString(process.env.RAILWAY_PUBLIC_URL);
  if (configuredPublicUrl) {
    return configuredPublicUrl.replace(/\/+$/, "");
  }
  const host = toNonEmptyString(req.headers.host);
  if (!host) {
    return null;
  }
  const forwardedProtoHeader = req.headers["x-forwarded-proto"];
  const forwardedProtoRaw = Array.isArray(forwardedProtoHeader) ? forwardedProtoHeader[0] : forwardedProtoHeader;
  const forwardedProto = toNonEmptyString(forwardedProtoRaw);
  const protoToken = forwardedProto ? forwardedProto.split(",")[0]?.trim().toLowerCase() : "";
  const protocol =
    protoToken === "http" || protoToken === "https"
      ? protoToken
      : host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]")
        ? "http"
        : "https";
  return `${protocol}://${host}`.replace(/\/+$/, "");
}

function resolveDemoFrontendPublicUrl(): string | null {
  const configuredFrontendUrl = toNonEmptyString(process.env.DEMO_FRONTEND_PUBLIC_URL);
  if (configuredFrontendUrl) {
    return configuredFrontendUrl.replace(/\/+$/, "");
  }
  const frontendPublicUrl = toNonEmptyString(process.env.FRONTEND_PUBLIC_URL);
  return frontendPublicUrl ? frontendPublicUrl.replace(/\/+$/, "") : null;
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

function toNonNegativeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }
  return null;
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
  return type === "conversation.item.truncate" || type === "conversation.item.create" || type === "conversation.item.delete";
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
  const requestedWebrtc = currentConfig.gatewayTransportMode === "webrtc";
  const rolloutStage = requestedWebrtc ? currentConfig.gatewayWebrtcRolloutStage : "disabled";
  const canaryPercent = requestedWebrtc ? currentConfig.gatewayWebrtcCanaryPercent : 0;
  const rolloutState = {
    stage: rolloutStage,
    canaryPercent,
    rollbackReady: currentConfig.gatewayWebrtcRollbackReady,
  };

  if (currentConfig.gatewayTransportMode === "webrtc") {
    return {
      requestedMode: "webrtc",
      activeMode: "websocket",
      fallbackActive: true,
      webrtc: {
        enabled: true,
        ready: false,
        reason:
          rolloutStage === "disabled"
            ? "webrtc_rollout_stage_disabled"
            : "webrtc_experimental_path_not_implemented",
        rollout: rolloutState,
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
      rollout: rolloutState,
    },
  };
}

const transportRuntimeState = resolveGatewayTransportRuntimeState(config);
const turnTruncationRecentLimit = parsePositiveInt(process.env.GATEWAY_TURN_TRUNCATION_RECENT_LIMIT, 20);
const turnDeleteRecentLimit = parsePositiveInt(process.env.GATEWAY_TURN_DELETE_RECENT_LIMIT, 20);
const damageControlRecentLimit = parsePositiveInt(process.env.GATEWAY_DAMAGE_CONTROL_RECENT_LIMIT, 20);
const turnTruncationRuntime = {
  total: 0,
  uniqueRuns: new Set<string>(),
  uniqueSessions: new Set<string>(),
  latest: null as TurnTruncationSnapshot | null,
  recent: [] as TurnTruncationSnapshot[],
};
const turnDeleteRuntime = {
  total: 0,
  uniqueRuns: new Set<string>(),
  uniqueSessions: new Set<string>(),
  latest: null as TurnDeleteSnapshot | null,
  recent: [] as TurnDeleteSnapshot[],
};
const damageControlRuntime = {
  total: 0,
  uniqueRuns: new Set<string>(),
  uniqueSessions: new Set<string>(),
  latest: null as DamageControlSnapshot | null,
  recent: [] as DamageControlSnapshot[],
  matchedRuleCountTotal: 0,
  verdictCounts: {
    allow: 0,
    ask: 0,
    block: 0,
  },
  sourceCounts: new Map<string, number>(),
};

function observeTurnTruncationEvidence(event: EventEnvelope): void {
  if (event.type !== "live.turn.truncated") {
    return;
  }
  const payload = isObject(event.payload) ? event.payload : {};
  const seenAt = new Date().toISOString();
  const snapshot: TurnTruncationSnapshot = {
    runId: toNonEmptyString(event.runId),
    sessionId: event.sessionId,
    seenAt,
    turnId: toNonEmptyString(payload.turnId),
    reason: toNonEmptyString(payload.reason),
    contentIndex: toNonNegativeInt(payload.contentIndex),
    audioEndMs: toNonNegativeInt(payload.audioEndMs),
    scope: toNonEmptyString(payload.scope),
  };
  turnTruncationRuntime.total += 1;
  if (snapshot.runId) {
    turnTruncationRuntime.uniqueRuns.add(snapshot.runId);
  }
  turnTruncationRuntime.uniqueSessions.add(snapshot.sessionId);
  turnTruncationRuntime.latest = snapshot;
  turnTruncationRuntime.recent.unshift(snapshot);
  if (turnTruncationRuntime.recent.length > turnTruncationRecentLimit) {
    turnTruncationRuntime.recent.length = turnTruncationRecentLimit;
  }
}

function observeTurnDeleteEvidence(event: EventEnvelope): void {
  if (event.type !== "live.turn.deleted") {
    return;
  }
  const payload = isObject(event.payload) ? event.payload : {};
  const seenAt = new Date().toISOString();
  const snapshot: TurnDeleteSnapshot = {
    runId: toNonEmptyString(event.runId),
    sessionId: event.sessionId,
    seenAt,
    turnId: toNonEmptyString(payload.turnId),
    reason: toNonEmptyString(payload.reason),
    scope: toNonEmptyString(payload.scope),
    hadActiveTurn: payload.hadActiveTurn === true,
  };
  turnDeleteRuntime.total += 1;
  if (snapshot.runId) {
    turnDeleteRuntime.uniqueRuns.add(snapshot.runId);
  }
  turnDeleteRuntime.uniqueSessions.add(snapshot.sessionId);
  turnDeleteRuntime.latest = snapshot;
  turnDeleteRuntime.recent.unshift(snapshot);
  if (turnDeleteRuntime.recent.length > turnDeleteRecentLimit) {
    turnDeleteRuntime.recent.length = turnDeleteRecentLimit;
  }
}

function observeDamageControlEvidence(event: EventEnvelope): void {
  if (event.type !== "orchestrator.response") {
    return;
  }
  const payload = isObject(event.payload) ? event.payload : {};
  const output = isObject(payload.output) ? payload.output : null;
  const damageControl = output && isObject(output.damageControl) ? output.damageControl : null;
  if (!damageControl) {
    return;
  }
  const enabled = typeof damageControl.enabled === "boolean" ? damageControl.enabled : null;
  const verdictRaw = toNonEmptyString(damageControl.verdict);
  const verdict =
    verdictRaw === "allow" || verdictRaw === "ask" || verdictRaw === "block"
      ? verdictRaw
      : null;
  const source = toNonEmptyString(damageControl.source);
  const path = toNonEmptyString(damageControl.path);
  const matchedRuleCount = toNonNegativeInt(damageControl.matchedRuleCount) ?? 0;
  const matchRuleIds = Array.isArray(damageControl.matches)
    ? damageControl.matches
      .filter((item): item is Record<string, unknown> => isObject(item))
      .map((item) => toNonEmptyString(item.ruleId))
      .filter((item): item is string => item !== null)
    : [];
  const hasEvidence = enabled !== null || verdict !== null || source !== null || matchedRuleCount > 0 || matchRuleIds.length > 0;
  if (!hasEvidence) {
    return;
  }

  const seenAt = new Date().toISOString();
  const snapshot: DamageControlSnapshot = {
    runId: toNonEmptyString(event.runId),
    sessionId: event.sessionId,
    seenAt,
    verdict,
    source,
    path,
    matchedRuleCount,
    matchRuleIds: Array.from(new Set(matchRuleIds)),
    enabled,
  };
  damageControlRuntime.total += 1;
  if (snapshot.runId) {
    damageControlRuntime.uniqueRuns.add(snapshot.runId);
  }
  damageControlRuntime.uniqueSessions.add(snapshot.sessionId);
  damageControlRuntime.latest = snapshot;
  damageControlRuntime.recent.unshift(snapshot);
  if (damageControlRuntime.recent.length > damageControlRecentLimit) {
    damageControlRuntime.recent.length = damageControlRecentLimit;
  }
  damageControlRuntime.matchedRuleCountTotal += matchedRuleCount;
  if (verdict) {
    damageControlRuntime.verdictCounts[verdict] += 1;
  }
  const sourceKey = source ?? "unknown";
  const currentSourceCount = damageControlRuntime.sourceCounts.get(sourceKey) ?? 0;
  damageControlRuntime.sourceCounts.set(sourceKey, currentSourceCount + 1);
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
    profile: runtimeProfile,
    transport: transportRuntimeState,
    analytics: analytics.snapshot(),
    turnTruncation: {
      total: turnTruncationRuntime.total,
      uniqueRuns: turnTruncationRuntime.uniqueRuns.size,
      uniqueSessions: turnTruncationRuntime.uniqueSessions.size,
      latest: turnTruncationRuntime.latest,
      recent: turnTruncationRuntime.recent.slice(0, turnTruncationRecentLimit),
      validated: turnTruncationRuntime.total > 0,
    },
    turnDelete: {
      total: turnDeleteRuntime.total,
      uniqueRuns: turnDeleteRuntime.uniqueRuns.size,
      uniqueSessions: turnDeleteRuntime.uniqueSessions.size,
      latest: turnDeleteRuntime.latest,
      recent: turnDeleteRuntime.recent.slice(0, turnDeleteRecentLimit),
      validated: turnDeleteRuntime.total > 0,
    },
    damageControl: {
      total: damageControlRuntime.total,
      uniqueRuns: damageControlRuntime.uniqueRuns.size,
      uniqueSessions: damageControlRuntime.uniqueSessions.size,
      latest: damageControlRuntime.latest,
      recent: damageControlRuntime.recent.slice(0, damageControlRecentLimit),
      matchedRuleCountTotal: damageControlRuntime.matchedRuleCountTotal,
      verdictCounts: {
        allow: damageControlRuntime.verdictCounts.allow,
        ask: damageControlRuntime.verdictCounts.ask,
        block: damageControlRuntime.verdictCounts.block,
      },
      sourceCounts: {
        default: damageControlRuntime.sourceCounts.get("default") ?? 0,
        file: damageControlRuntime.sourceCounts.get("file") ?? 0,
        env_json: damageControlRuntime.sourceCounts.get("env_json") ?? 0,
        unknown: Array.from(damageControlRuntime.sourceCounts.entries())
          .filter(([key]) => key !== "default" && key !== "file" && key !== "env_json")
          .reduce((acc, [, count]) => acc + count, 0),
      },
      validated: damageControlRuntime.total > 0,
    },
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

    if (url.pathname === "/" && req.method === "GET") {
      const publicUrl = resolveGatewayPublicUrl(req);
      const demoFrontendPublicUrl = resolveDemoFrontendPublicUrl();
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        message: "realtime-gateway is online",
        runtime: runtimeState(),
        routes: {
          websocket: "/realtime",
          health: "/healthz",
          status: "/status",
          version: "/version",
          metrics: "/metrics",
          badge: "/demo-e2e/badge.json",
          badgeDetails: "/demo-e2e/badge-details.json",
          tasksActive: "/tasks/active",
          taskById: "/tasks/{taskId}",
        },
        ui: "demo-frontend is deployed separately",
        uiUrl: demoFrontendPublicUrl,
        publicUrl,
      });
      return;
    }

    if (url.pathname === "/favicon.ico" && req.method === "GET") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (url.pathname === "/demo-e2e/badge.json" && req.method === "GET") {
      res.setHeader("Cache-Control", "public, max-age=300");
      writeJson(res, 200, getPublicBadgePayload());
      return;
    }

    if (url.pathname === "/demo-e2e/badge-details.json" && req.method === "GET") {
      res.setHeader("Cache-Control", "public, max-age=60");
      writeJson(res, 200, getPublicBadgeDetailsPayload());
      return;
    }

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
    observeTurnTruncationEvidence(outboundEvent);
    observeTurnDeleteEvidence(outboundEvent);
    observeDamageControlEvidence(outboundEvent);
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
      `[realtime-gateway] transport fallback active: requested=${transportRuntimeState.requestedMode}, active=${transportRuntimeState.activeMode}, reason=${transportRuntimeState.webrtc.reason}, stage=${transportRuntimeState.webrtc.rollout.stage}, canary=${transportRuntimeState.webrtc.rollout.canaryPercent}%`,
    );
  } else {
    console.log(
      `[realtime-gateway] transport mode: requested=${transportRuntimeState.requestedMode}, active=${transportRuntimeState.activeMode}, stage=${transportRuntimeState.webrtc.rollout.stage}, canary=${transportRuntimeState.webrtc.rollout.canaryPercent}%`,
    );
  }
});
