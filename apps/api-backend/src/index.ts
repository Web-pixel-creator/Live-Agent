import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
  applyRuntimeProfile,
  createApiErrorResponse,
  createEnvelope,
  createNormalizedError,
  normalizeUnknownError,
  RollingMetrics,
  type NormalizedError,
  type OrchestratorRequest,
  type OrchestratorResponse,
} from "@mla/contracts";
import {
  type ApprovalDecision,
  type ApprovalSweepResult,
  createSession,
  type DeviceNodeKind,
  type DeviceNodeStatus,
  type EventListItem,
  getDeviceNodeById,
  getFirestoreState,
  listDeviceNodeIndex,
  listDeviceNodes,
  listEvents,
  listRecentEvents,
  listApprovals,
  listOperatorActions,
  listRuns,
  listSessions,
  listManagedSkillIndex,
  listManagedSkills,
  type ManagedSkillTrustLevel,
  recordOperatorAction,
  recordApprovalDecision,
  sweepApprovalTimeouts,
  touchDeviceNodeHeartbeat,
  upsertDeviceNode,
  upsertPendingApproval,
  upsertManagedSkill,
  updateSessionStatus,
  type SessionMode,
  type SessionStatus,
} from "./firestore.js";
import { AnalyticsExporter } from "./analytics-export.js";
import { buildOperatorTraceSummary } from "./operator-traces.js";
import { buildDeviceNodeHealthSummary } from "./device-node-summary.js";

const port = Number(process.env.API_PORT ?? 8081);
const apiBaseUrl = toBaseUrl(process.env.API_BASE_URL, `http://localhost:${port}`);
const gatewayBaseUrl = toBaseUrl(process.env.API_GATEWAY_BASE_URL, "http://localhost:8080");
const orchestratorBaseUrl = toBaseUrl(
  process.env.API_ORCHESTRATOR_BASE_URL ?? process.env.ORCHESTRATOR_BASE_URL,
  "http://localhost:8082",
);
const uiExecutorBaseUrl = toBaseUrl(
  process.env.API_UI_EXECUTOR_BASE_URL ?? process.env.UI_EXECUTOR_BASE_URL,
  "http://localhost:8090",
);
const orchestratorUrl =
  process.env.API_ORCHESTRATOR_URL ?? process.env.ORCHESTRATOR_URL ?? `${orchestratorBaseUrl}/orchestrate`;
const orchestratorTimeoutMs = parsePositiveInt(process.env.API_ORCHESTRATOR_TIMEOUT_MS ?? null, 15000);
const orchestratorMaxRetries = parsePositiveInt(process.env.API_ORCHESTRATOR_MAX_RETRIES ?? null, 1);
const orchestratorRetryBackoffMs = parsePositiveInt(
  process.env.API_ORCHESTRATOR_RETRY_BACKOFF_MS ?? null,
  300,
);
const serviceName = "api-backend";
const runtimeProfile = applyRuntimeProfile(serviceName);
const serviceVersion = process.env.API_BACKEND_VERSION ?? process.env.SERVICE_VERSION ?? "0.1.0";
const startedAtMs = Date.now();
let draining = false;
let lastWarmupAt: string | null = new Date().toISOString();
let lastDrainAt: string | null = null;
const analytics = new AnalyticsExporter({ serviceName });
const metrics = new RollingMetrics({
  maxSamplesPerBucket: Number(process.env.API_METRICS_MAX_SAMPLES ?? 2000),
  onRecord: (entry) => {
    analytics.recordMetric({
      metricType: "api.operation.duration_ms",
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
const approvalSoftTimeoutMs = parsePositiveInt(process.env.APPROVAL_SOFT_TIMEOUT_MS ?? null, 60_000);
const approvalHardTimeoutMs = parsePositiveInt(process.env.APPROVAL_HARD_TIMEOUT_MS ?? null, 300_000);
const approvalSweepLimit = parsePositiveInt(process.env.APPROVAL_SWEEP_LIMIT ?? null, 250);
const operatorDeviceNodeSummaryLimit = parseBoundedInt(
  process.env.OPERATOR_DEVICE_NODE_SUMMARY_LIMIT ?? null,
  200,
  1,
  500,
);
const operatorDeviceNodeStaleThresholdMs = parsePositiveInt(
  process.env.OPERATOR_DEVICE_NODE_STALE_THRESHOLD_MS ?? null,
  5 * 60 * 1000,
);
const operatorTaskQueueStaleThresholdMs = parsePositiveInt(
  process.env.OPERATOR_TASK_QUEUE_STALE_THRESHOLD_MS ?? null,
  30 * 1000,
);
const operatorTaskQueueElevatedActiveThreshold = parsePositiveInt(
  process.env.OPERATOR_TASK_QUEUE_ELEVATED_ACTIVE_THRESHOLD ?? null,
  6,
);
const operatorTaskQueueCriticalActiveThreshold = parsePositiveInt(
  process.env.OPERATOR_TASK_QUEUE_CRITICAL_ACTIVE_THRESHOLD ?? null,
  12,
);
const operatorTaskQueuePendingApprovalWarnThreshold = parsePositiveInt(
  process.env.OPERATOR_TASK_QUEUE_PENDING_APPROVAL_WARN_THRESHOLD ?? null,
  2,
);

function toBaseUrl(input: string | undefined, fallback: string): string {
  const candidate = typeof input === "string" && input.trim().length > 0 ? input.trim() : fallback;
  return candidate.replace(/\/+$/, "");
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function writeApiError(
  res: ServerResponse,
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

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseBoundedInt(
  value: string | null,
  fallback: number,
  minValue: number,
  maxValue: number,
): number {
  const parsed = parsePositiveInt(value, fallback);
  if (parsed < minValue) {
    return minValue;
  }
  if (parsed > maxValue) {
    return maxValue;
  }
  return parsed;
}

function parseNonNegativeInt(value: unknown): number | null {
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

function sanitizeMode(raw: unknown): SessionMode {
  return raw === "story" || raw === "ui" || raw === "multi" ? raw : "live";
}

function sanitizeStatus(raw: unknown): SessionStatus {
  return raw === "paused" || raw === "closed" ? raw : "active";
}

function parseExpectedVersion(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1) {
    return Math.floor(raw);
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function parseIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.trim();
  if (normalized.length === 0) {
    return null;
  }
  return normalized.slice(0, 128);
}

function headerValue(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name];
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null;
  }
  return typeof value === "string" ? value : null;
}

function sanitizeDecision(raw: unknown): ApprovalDecision {
  return raw === "rejected" ? "rejected" : "approved";
}

function sanitizeManagedTrustLevel(raw: unknown): ManagedSkillTrustLevel {
  if (raw === "trusted" || raw === "reviewed" || raw === "untrusted") {
    return raw;
  }
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "trusted" || normalized === "reviewed" || normalized === "untrusted") {
      return normalized;
    }
  }
  return "reviewed";
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseSkillScope(raw: unknown): string[] {
  const entries = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const item of entries) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.trim().toLowerCase();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

function parseOptionalExpectedVersion(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1) {
    return Math.floor(raw);
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function sanitizeDeviceNodeKind(raw: unknown): DeviceNodeKind {
  if (raw === "mobile" || raw === "desktop") {
    return raw;
  }
  if (typeof raw === "string" && raw.trim().toLowerCase() === "mobile") {
    return "mobile";
  }
  return "desktop";
}

function sanitizeDeviceNodeStatus(raw: unknown): DeviceNodeStatus {
  if (raw === "offline" || raw === "degraded" || raw === "online") {
    return raw;
  }
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "offline" || normalized === "degraded" || normalized === "online") {
      return normalized;
    }
  }
  return "online";
}

function parseCapabilities(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const item of values) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.trim().toLowerCase();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type OperatorRole = "viewer" | "operator" | "admin";

function normalizeOperatorRole(value: unknown): OperatorRole | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "viewer" || normalized === "operator" || normalized === "admin") {
    return normalized;
  }
  return null;
}

function extractOperatorRole(req: IncomingMessage): OperatorRole | null {
  const header = req.headers["x-operator-role"];
  if (Array.isArray(header)) {
    return normalizeOperatorRole(header[0]);
  }
  return normalizeOperatorRole(header);
}

function assertOperatorRole(req: IncomingMessage, allowed: OperatorRole[]): OperatorRole {
  const role = extractOperatorRole(req);
  if (!role) {
    throw new ApiRequestError({
      statusCode: 401,
      code: "API_OPERATOR_ROLE_REQUIRED",
      message: "x-operator-role header is required",
      details: {
        allowedRoles: allowed,
      },
    });
  }
  if (!allowed.includes(role)) {
    throw new ApiRequestError({
      statusCode: 403,
      code: "API_OPERATOR_ROLE_FORBIDDEN",
      message: "operator role is not allowed for this action",
      details: {
        role,
        allowedRoles: allowed,
      },
    });
  }
  return role;
}

class ApiRequestError extends Error {
  readonly statusCode: number;

  readonly code: string;

  readonly details?: unknown;

  constructor(params: { statusCode: number; code: string; message: string; details?: unknown }) {
    super(params.message);
    this.name = "ApiRequestError";
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details;
  }
}

function parseJsonBody(raw: string): Record<string, unknown> {
  if (raw.trim().length === 0) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      throw new ApiRequestError({
        statusCode: 400,
        code: "API_INVALID_JSON_BODY",
        message: "Request body must be a JSON object",
      });
    }
    return parsed;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }
    throw new ApiRequestError({
      statusCode: 400,
      code: "API_INVALID_JSON",
      message: "Invalid JSON body",
    });
  }
}

function normalizeOperationPath(pathname: string): string {
  if (pathname.startsWith("/v1/sessions/")) {
    return "/v1/sessions/:id";
  }
  return pathname;
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
    metrics: {
      totalCount: summary.totalCount,
      totalErrors: summary.totalErrors,
      errorRatePct: summary.errorRatePct,
      p95Ms: summary.latencyMs.p95,
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readErrorDetails(response: Response): Promise<string> {
  try {
    const details = await response.text();
    return details.slice(0, 300);
  } catch {
    return "";
  }
}

function shouldRetryStatus(statusCode: number): boolean {
  return statusCode >= 500 || statusCode === 429;
}

class NonRetriableRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetriableRequestError";
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

type ServiceProbeFailureType =
  | "http_error"
  | "timeout"
  | "connection_refused"
  | "network_error"
  | "invalid_json";

type ServiceProbeResult = {
  endpoint: string;
  checkedAt: string;
  latencyMs: number;
  ok: boolean;
  payload: unknown;
  statusCode: number | null;
  type: ServiceProbeFailureType | null;
  message: string | null;
};

function classifyServiceProbeError(error: unknown): {
  type: Exclude<ServiceProbeFailureType, "http_error" | "invalid_json">;
  message: string;
} {
  const fallbackMessage = "network request failed";
  if (!isRecord(error)) {
    return {
      type: "network_error",
      message: fallbackMessage,
    };
  }

  const name = typeof error.name === "string" ? error.name : "";
  const message = typeof error.message === "string" && error.message.trim().length > 0 ? error.message.trim() : fallbackMessage;
  if (name === "AbortError") {
    return {
      type: "timeout",
      message,
    };
  }

  const cause = isRecord(error.cause) ? error.cause : null;
  const causeCode = cause && typeof cause.code === "string" ? cause.code.toUpperCase() : "";
  if (causeCode === "ECONNREFUSED") {
    return {
      type: "connection_refused",
      message: cause && typeof cause.message === "string" && cause.message.trim().length > 0 ? cause.message : message,
    };
  }
  if (
    causeCode === "ECONNRESET" ||
    causeCode === "EHOSTUNREACH" ||
    causeCode === "ENETUNREACH" ||
    causeCode === "ENOTFOUND" ||
    causeCode === "EAI_AGAIN"
  ) {
    return {
      type: "network_error",
      message: cause && typeof cause.message === "string" && cause.message.trim().length > 0 ? cause.message : message,
    };
  }

  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes("abort")) {
    return {
      type: "timeout",
      message,
    };
  }
  if (normalizedMessage.includes("refused")) {
    return {
      type: "connection_refused",
      message,
    };
  }

  return {
    type: "network_error",
    message,
  };
}

async function probeJsonWithTimeout(url: string, timeoutMs: number): Promise<ServiceProbeResult> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    const latencyMs = Math.max(0, Date.now() - startedAt);
    if (!response.ok) {
      const details = await readErrorDetails(response);
      return {
        endpoint: url,
        checkedAt,
        latencyMs,
        ok: false,
        payload: null,
        statusCode: response.status,
        type: "http_error",
        message: details.length > 0 ? `HTTP ${response.status}: ${details}` : `HTTP ${response.status}`,
      };
    }

    try {
      const payload = (await response.json()) as unknown;
      return {
        endpoint: url,
        checkedAt,
        latencyMs,
        ok: true,
        payload,
        statusCode: response.status,
        type: null,
        message: null,
      };
    } catch {
      return {
        endpoint: url,
        checkedAt,
        latencyMs,
        ok: false,
        payload: null,
        statusCode: response.status,
        type: "invalid_json",
        message: "response body is not valid JSON",
      };
    }
  } catch (error) {
    const classified = classifyServiceProbeError(error);
    return {
      endpoint: url,
      checkedAt,
      latencyMs: Math.max(0, Date.now() - startedAt),
      ok: false,
      payload: null,
      statusCode: null,
      type: classified.type,
      message: classified.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function postJsonWithTimeout(url: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      throw new ApiRequestError({
        statusCode: 502,
        code: "API_OPERATOR_UPSTREAM_FAILURE",
        message: `upstream action failed (${response.status})`,
        details: {
          url,
          statusCode: response.status,
          payload,
        },
      });
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }
    throw new ApiRequestError({
      statusCode: 502,
      code: "API_OPERATOR_UPSTREAM_UNAVAILABLE",
      message: "failed to reach upstream service for operator action",
      details: {
        url,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeServiceName(
  input: unknown,
): "realtime-gateway" | "api-backend" | "orchestrator" | "ui-executor" | null {
  if (typeof input !== "string") {
    return null;
  }
  const normalized = input.trim().toLowerCase();
  if (
    normalized === "realtime-gateway" ||
    normalized === "api-backend" ||
    normalized === "orchestrator" ||
    normalized === "ui-executor"
  ) {
    return normalized;
  }
  return null;
}

function resolveServiceBaseUrl(
  name: "realtime-gateway" | "api-backend" | "orchestrator" | "ui-executor",
): string {
  switch (name) {
    case "realtime-gateway":
      return gatewayBaseUrl;
    case "api-backend":
      return apiBaseUrl;
    case "orchestrator":
      return orchestratorBaseUrl;
    case "ui-executor":
      return uiExecutorBaseUrl;
    default:
      return orchestratorBaseUrl;
  }
}

async function getOperatorServiceSummary(): Promise<Array<Record<string, unknown>>> {
  const services: Array<{
    name: "realtime-gateway" | "api-backend" | "orchestrator" | "ui-executor";
    baseUrl: string;
  }> = [
    { name: "ui-executor", baseUrl: uiExecutorBaseUrl },
    { name: "realtime-gateway", baseUrl: gatewayBaseUrl },
    { name: "api-backend", baseUrl: apiBaseUrl },
    { name: "orchestrator", baseUrl: orchestratorBaseUrl },
  ];
  const timeoutMs = 4500;
  const summaries: Array<Record<string, unknown>> = [];

  for (const service of services) {
    const [healthProbe, statusProbe, metricsProbe] = await Promise.all([
      probeJsonWithTimeout(`${service.baseUrl}/healthz`, timeoutMs),
      probeJsonWithTimeout(`${service.baseUrl}/status`, timeoutMs),
      probeJsonWithTimeout(`${service.baseUrl}/metrics`, timeoutMs),
    ]);
    const health = healthProbe.ok ? healthProbe.payload : null;
    const status = statusProbe.ok ? statusProbe.payload : null;
    const metricsResponse = metricsProbe.ok ? metricsProbe.payload : null;
    const probeFailures = [
      {
        probe: healthProbe,
        endpoint: "healthz",
      },
      {
        probe: statusProbe,
        endpoint: "status",
      },
      {
        probe: metricsProbe,
        endpoint: "metrics",
      },
    ]
      .filter((entry) => entry.probe.ok !== true)
      .map((entry) => ({
        endpoint: entry.endpoint,
        checkedAt: entry.probe.checkedAt,
        latencyMs: entry.probe.latencyMs,
        type: entry.probe.type ?? "network_error",
        statusCode: entry.probe.statusCode,
        message: entry.probe.message ?? "probe failed",
      }));

    const runtime = isRecord(status) && isRecord(status.runtime) ? status.runtime : null;
    const profile = runtime && isRecord(runtime.profile) ? runtime.profile : null;
    const metricsSummary =
      isRecord(metricsResponse) && isRecord(metricsResponse.metrics) ? metricsResponse.metrics : null;
    const startupFailureCount = probeFailures.length;
    const startupBlockingFailure = startupFailureCount >= 2;
    const startupStatus = startupFailureCount <= 0 ? "healthy" : startupBlockingFailure ? "critical" : "degraded";

    summaries.push({
      name: service.name,
      baseUrl: service.baseUrl,
      healthy: isRecord(health) ? health.ok === true : false,
      state: runtime ? runtime.state ?? null : null,
      ready: runtime ? runtime.ready ?? null : null,
      draining: runtime ? runtime.draining ?? null : null,
      startedAt: runtime ? runtime.startedAt ?? null : null,
      uptimeSec: runtime ? runtime.uptimeSec ?? null : null,
      lastWarmupAt: runtime ? runtime.lastWarmupAt ?? null : null,
      lastDrainAt: runtime ? runtime.lastDrainAt ?? null : null,
      version: runtime ? runtime.version ?? null : null,
      turnTruncation: runtime ? runtime.turnTruncation ?? null : null,
      turnDelete: runtime ? runtime.turnDelete ?? null : null,
      profile,
      metrics: metricsSummary
        ? {
            totalCount: metricsSummary.totalCount ?? null,
            errorRatePct: metricsSummary.errorRatePct ?? null,
            p95Ms: isRecord(metricsSummary.latencyMs) ? metricsSummary.latencyMs.p95 ?? null : null,
          }
        : null,
      startupStatus,
      startupFailureCount,
      startupBlockingFailure,
      startupFailures: probeFailures,
    });
  }

  return summaries;
}

async function getGatewayActiveTasks(limit = 100): Promise<unknown[]> {
  const response = await fetchJsonWithTimeout(
    `${gatewayBaseUrl}/tasks/active?limit=${encodeURIComponent(String(limit))}`,
    5000,
  );
  if (!isRecord(response) || !Array.isArray(response.data)) {
    return [];
  }
  return response.data;
}

function toTaskString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildApprovalIdFromTask(task: Record<string, unknown>): string | null {
  const runId = toTaskString(task.runId);
  if (runId) {
    return `approval-${runId}`;
  }
  const taskId = toTaskString(task.taskId);
  if (taskId) {
    return `approval-task-${taskId}`;
  }
  return null;
}

function parseIsoTimestampMs(value: unknown): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function normalizeTaskQueueStatus(value: unknown): "queued" | "running" | "pending_approval" | "other" {
  if (typeof value !== "string") {
    return "other";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "queued" || normalized === "running" || normalized === "pending_approval") {
    return normalized;
  }
  return "other";
}

function buildTaskQueueSummary(tasks: unknown[]): Record<string, unknown> {
  const nowMs = Date.now();
  let queued = 0;
  let running = 0;
  let pendingApproval = 0;
  let other = 0;
  let staleCount = 0;
  let maxAgeMs = 0;
  let oldestUpdatedAt: string | null = null;
  let oldestTaskId: string | null = null;
  let oldestTaskStatus: string | null = null;

  for (const item of tasks) {
    if (!isRecord(item)) {
      continue;
    }
    const status = normalizeTaskQueueStatus(item.status);
    if (status === "queued") {
      queued += 1;
    } else if (status === "running") {
      running += 1;
    } else if (status === "pending_approval") {
      pendingApproval += 1;
    } else {
      other += 1;
    }

    const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt : null;
    const updatedAtMs = parseIsoTimestampMs(updatedAt);
    if (updatedAtMs === null) {
      continue;
    }
    const ageMs = Math.max(0, nowMs - updatedAtMs);
    if (ageMs > maxAgeMs) {
      maxAgeMs = ageMs;
      oldestUpdatedAt = updatedAt;
      oldestTaskId = toTaskString(item.taskId);
      oldestTaskStatus = typeof item.status === "string" ? item.status : null;
    }
    if (ageMs >= operatorTaskQueueStaleThresholdMs) {
      staleCount += 1;
    }
  }

  const total = queued + running + pendingApproval + other;
  let pressureLevel: "idle" | "healthy" | "elevated" | "critical" = "healthy";
  if (total <= 0) {
    pressureLevel = "idle";
  } else if (staleCount > 0 || total >= operatorTaskQueueCriticalActiveThreshold) {
    pressureLevel = "critical";
  } else if (
    total >= operatorTaskQueueElevatedActiveThreshold ||
    pendingApproval >= operatorTaskQueuePendingApprovalWarnThreshold
  ) {
    pressureLevel = "elevated";
  }

  return {
    total,
    statusCounts: {
      queued,
      running,
      pendingApproval,
      other,
    },
    staleCount,
    staleThresholdMs: operatorTaskQueueStaleThresholdMs,
    maxAgeMs,
    oldestUpdatedAt,
    oldestTaskId,
    oldestTaskStatus,
    pressureLevel,
    thresholds: {
      elevatedActive: operatorTaskQueueElevatedActiveThreshold,
      criticalActive: operatorTaskQueueCriticalActiveThreshold,
      pendingApprovalWarn: operatorTaskQueuePendingApprovalWarnThreshold,
    },
  };
}

function normalizeStartupFailureType(value: unknown): ServiceProbeFailureType {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    normalized === "http_error" ||
    normalized === "timeout" ||
    normalized === "connection_refused" ||
    normalized === "network_error" ||
    normalized === "invalid_json"
  ) {
    return normalized;
  }
  return "network_error";
}

function buildStartupFailureSummary(services: Array<Record<string, unknown>>): Record<string, unknown> {
  const byType = {
    http_error: 0,
    timeout: 0,
    connection_refused: 0,
    network_error: 0,
    invalid_json: 0,
  };
  const byService: Record<string, number> = {};
  const recent: Array<Record<string, unknown>> = [];
  let blockingServices = 0;

  for (const service of services) {
    const serviceName = typeof service.name === "string" ? service.name : "service";
    const startupFailures = Array.isArray(service.startupFailures)
      ? service.startupFailures.filter((item): item is Record<string, unknown> => isRecord(item))
      : [];
    if (startupFailures.length <= 0) {
      continue;
    }
    if (service.startupBlockingFailure === true) {
      blockingServices += 1;
    }
    byService[serviceName] = startupFailures.length;

    for (const item of startupFailures) {
      const type = normalizeStartupFailureType(item.type);
      byType[type] += 1;
      recent.push({
        service: serviceName,
        endpoint: typeof item.endpoint === "string" ? item.endpoint : "unknown",
        type,
        statusCode: typeof item.statusCode === "number" ? item.statusCode : null,
        message: typeof item.message === "string" ? item.message : "probe failed",
        checkedAt: typeof item.checkedAt === "string" ? item.checkedAt : null,
        latencyMs: typeof item.latencyMs === "number" ? item.latencyMs : null,
      });
    }
  }

  recent.sort((left, right) => {
    const leftTs = typeof left.checkedAt === "string" ? Date.parse(left.checkedAt) : Number.NaN;
    const rightTs = typeof right.checkedAt === "string" ? Date.parse(right.checkedAt) : Number.NaN;
    const leftValue = Number.isFinite(leftTs) ? leftTs : 0;
    const rightValue = Number.isFinite(rightTs) ? rightTs : 0;
    return rightValue - leftValue;
  });

  const total = recent.length;
  const status = total <= 0 ? "healthy" : blockingServices > 0 ? "critical" : "degraded";
  const latest = recent.length > 0 ? recent[0] : null;

  return {
    status,
    total,
    blockingServices,
    hasBlockingFailures: blockingServices > 0,
    byType,
    byService,
    recent: recent.slice(0, 20),
    latest,
    validated: true,
  };
}

function buildTurnTruncationSummary(
  events: EventListItem[],
  services: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const uniqueRuns = new Set<string>();
  const uniqueSessions = new Set<string>();
  const normalized: Array<Record<string, unknown>> = [];

  for (const event of events) {
    if (event.type !== "live.turn.truncated") {
      continue;
    }
    if (typeof event.runId === "string" && event.runId.trim().length > 0) {
      uniqueRuns.add(event.runId);
    }
    if (typeof event.sessionId === "string" && event.sessionId.trim().length > 0) {
      uniqueSessions.add(event.sessionId);
    }
    normalized.push({
      eventId: event.eventId,
      runId: event.runId ?? null,
      sessionId: event.sessionId,
      createdAt: event.createdAt,
      turnId: event.turnId ?? null,
      reason: event.truncateReason ?? null,
      contentIndex: event.truncateContentIndex ?? null,
      audioEndMs: event.truncateAudioEndMs ?? null,
      scope: event.truncateScope ?? null,
    });
  }

  if (normalized.length <= 0) {
    const gatewayService = services.find((service) => service.name === "realtime-gateway");
    const runtimeEvidence =
      gatewayService && isRecord(gatewayService.turnTruncation) ? gatewayService.turnTruncation : null;
    if (!runtimeEvidence) {
      return {
        status: "missing",
        total: 0,
        uniqueRuns: 0,
        uniqueSessions: 0,
        latest: null,
        recent: [],
        source: "operator_summary",
        validated: false,
      };
    }

    const runtimeRecentRaw = Array.isArray(runtimeEvidence.recent)
      ? runtimeEvidence.recent.filter((item): item is Record<string, unknown> => isRecord(item))
      : [];
    const runtimeRecent = runtimeRecentRaw.map((item) => {
      const runId = toOptionalString(item.runId);
      const sessionId = toOptionalString(item.sessionId) ?? "unknown";
      const seenAt = toOptionalString(item.seenAt) ?? new Date().toISOString();
      return {
        eventId: null,
        runId,
        sessionId,
        createdAt: seenAt,
        turnId: toOptionalString(item.turnId),
        reason: toOptionalString(item.reason),
        contentIndex: parseNonNegativeInt(item.contentIndex),
        audioEndMs: parseNonNegativeInt(item.audioEndMs),
        scope: toOptionalString(item.scope),
      };
    });
    const runtimeLatestRaw = isRecord(runtimeEvidence.latest) ? runtimeEvidence.latest : null;
    const runtimeLatest = runtimeLatestRaw
      ? {
          eventId: null,
          runId: toOptionalString(runtimeLatestRaw.runId),
          sessionId: toOptionalString(runtimeLatestRaw.sessionId) ?? "unknown",
          createdAt: toOptionalString(runtimeLatestRaw.seenAt) ?? new Date().toISOString(),
          turnId: toOptionalString(runtimeLatestRaw.turnId),
          reason: toOptionalString(runtimeLatestRaw.reason),
          contentIndex: parseNonNegativeInt(runtimeLatestRaw.contentIndex),
          audioEndMs: parseNonNegativeInt(runtimeLatestRaw.audioEndMs),
          scope: toOptionalString(runtimeLatestRaw.scope),
        }
      : runtimeRecent.length > 0
        ? runtimeRecent[0]
        : null;

    const runtimeTotal = parseNonNegativeInt(runtimeEvidence.total) ?? runtimeRecent.length;
    const runtimeUniqueRuns =
      parseNonNegativeInt(runtimeEvidence.uniqueRuns) ??
      new Set(runtimeRecent.map((item) => (typeof item.runId === "string" ? item.runId : null)).filter(Boolean)).size;
    const runtimeUniqueSessions =
      parseNonNegativeInt(runtimeEvidence.uniqueSessions) ??
      new Set(runtimeRecent.map((item) => item.sessionId)).size;

    return {
      status: runtimeTotal > 0 ? "observed" : "missing",
      total: runtimeTotal,
      uniqueRuns: runtimeUniqueRuns,
      uniqueSessions: runtimeUniqueSessions,
      latest: runtimeLatest,
      recent: runtimeRecent.slice(0, 20),
      source: "gateway_runtime",
      validated: runtimeTotal > 0,
    };
  }

  return {
    status: "observed",
    total: normalized.length,
    uniqueRuns: uniqueRuns.size,
    uniqueSessions: uniqueSessions.size,
    latest: normalized.length > 0 ? normalized[0] : null,
    recent: normalized.slice(0, 20),
    source: "operator_summary",
    validated: normalized.length > 0,
  };
}

function buildTurnDeleteSummary(
  events: EventListItem[],
  services: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const uniqueRuns = new Set<string>();
  const uniqueSessions = new Set<string>();
  const normalized: Array<Record<string, unknown>> = [];

  for (const event of events) {
    if (event.type !== "live.turn.deleted") {
      continue;
    }
    if (typeof event.runId === "string" && event.runId.trim().length > 0) {
      uniqueRuns.add(event.runId);
    }
    if (typeof event.sessionId === "string" && event.sessionId.trim().length > 0) {
      uniqueSessions.add(event.sessionId);
    }
    normalized.push({
      eventId: event.eventId,
      runId: event.runId ?? null,
      sessionId: event.sessionId,
      createdAt: event.createdAt,
      turnId: event.turnId ?? null,
      reason: event.truncateReason ?? null,
      scope: event.truncateScope ?? null,
    });
  }

  if (normalized.length <= 0) {
    const gatewayService = services.find((service) => service.name === "realtime-gateway");
    const runtimeEvidence =
      gatewayService && isRecord(gatewayService.turnDelete) ? gatewayService.turnDelete : null;
    if (!runtimeEvidence) {
      return {
        status: "missing",
        total: 0,
        uniqueRuns: 0,
        uniqueSessions: 0,
        latest: null,
        recent: [],
        source: "operator_summary",
        validated: false,
      };
    }

    const runtimeRecentRaw = Array.isArray(runtimeEvidence.recent)
      ? runtimeEvidence.recent.filter((item): item is Record<string, unknown> => isRecord(item))
      : [];
    const runtimeRecent = runtimeRecentRaw.map((item) => {
      const runId = toOptionalString(item.runId);
      const sessionId = toOptionalString(item.sessionId) ?? "unknown";
      const seenAt = toOptionalString(item.seenAt) ?? new Date().toISOString();
      return {
        eventId: null,
        runId,
        sessionId,
        createdAt: seenAt,
        turnId: toOptionalString(item.turnId),
        reason: toOptionalString(item.reason),
        scope: toOptionalString(item.scope),
        hadActiveTurn: item.hadActiveTurn === true,
      };
    });
    const runtimeLatestRaw = isRecord(runtimeEvidence.latest) ? runtimeEvidence.latest : null;
    const runtimeLatest = runtimeLatestRaw
      ? {
          eventId: null,
          runId: toOptionalString(runtimeLatestRaw.runId),
          sessionId: toOptionalString(runtimeLatestRaw.sessionId) ?? "unknown",
          createdAt: toOptionalString(runtimeLatestRaw.seenAt) ?? new Date().toISOString(),
          turnId: toOptionalString(runtimeLatestRaw.turnId),
          reason: toOptionalString(runtimeLatestRaw.reason),
          scope: toOptionalString(runtimeLatestRaw.scope),
          hadActiveTurn: runtimeLatestRaw.hadActiveTurn === true,
        }
      : runtimeRecent.length > 0
        ? runtimeRecent[0]
        : null;

    const runtimeTotal = parseNonNegativeInt(runtimeEvidence.total) ?? runtimeRecent.length;
    const runtimeUniqueRuns =
      parseNonNegativeInt(runtimeEvidence.uniqueRuns) ??
      new Set(runtimeRecent.map((item) => (typeof item.runId === "string" ? item.runId : null)).filter(Boolean)).size;
    const runtimeUniqueSessions =
      parseNonNegativeInt(runtimeEvidence.uniqueSessions) ??
      new Set(runtimeRecent.map((item) => item.sessionId)).size;

    return {
      status: runtimeTotal > 0 ? "observed" : "missing",
      total: runtimeTotal,
      uniqueRuns: runtimeUniqueRuns,
      uniqueSessions: runtimeUniqueSessions,
      latest: runtimeLatest,
      recent: runtimeRecent.slice(0, 20),
      source: "gateway_runtime",
      validated: runtimeTotal > 0,
    };
  }

  return {
    status: "observed",
    total: normalized.length,
    uniqueRuns: uniqueRuns.size,
    uniqueSessions: uniqueSessions.size,
    latest: normalized.length > 0 ? normalized[0] : null,
    recent: normalized.slice(0, 20),
    source: "operator_summary",
    validated: normalized.length > 0,
  };
}

async function syncPendingApprovalsFromTasks(tasks: unknown[]): Promise<number> {
  let createdOrRefreshed = 0;
  for (const item of tasks) {
    if (!isRecord(item)) {
      continue;
    }
    if (item.status !== "pending_approval") {
      continue;
    }
    const approvalId = buildApprovalIdFromTask(item);
    const sessionId = toTaskString(item.sessionId);
    if (!approvalId || !sessionId) {
      continue;
    }
    const runId = toTaskString(item.runId) ?? approvalId.replace(/^approval-/, "run-unknown");
    const stage = toTaskString(item.stage) ?? "awaiting_approval";
    const updatedAt = toTaskString(item.updatedAt) ?? new Date().toISOString();
    await upsertPendingApproval({
      approvalId,
      sessionId,
      runId,
      actionType: "ui_task",
      actor: "gateway-task-sync",
      metadata: {
        taskId: toTaskString(item.taskId),
        stage,
        route: toTaskString(item.route),
        intent: toTaskString(item.intent),
      },
      softTimeoutMs: approvalSoftTimeoutMs,
      hardTimeoutMs: approvalHardTimeoutMs,
      requestedAtIso: updatedAt,
    });
    createdOrRefreshed += 1;
  }
  return createdOrRefreshed;
}

async function runApprovalSlaSweep(): Promise<ApprovalSweepResult> {
  return sweepApprovalTimeouts({
    nowIso: new Date().toISOString(),
    limit: approvalSweepLimit,
  });
}

async function auditOperatorAction(params: {
  role: OperatorRole;
  action: string;
  outcome: "succeeded" | "failed" | "denied";
  reason: string;
  taskId?: string;
  targetService?: string;
  operation?: string;
  errorCode?: string;
  details?: unknown;
}): Promise<void> {
  try {
    await recordOperatorAction({
      actorRole: params.role,
      action: params.action,
      outcome: params.outcome,
      reason: params.reason,
      taskId: params.taskId,
      targetService: params.targetService,
      operation: params.operation,
      errorCode: params.errorCode,
      details: params.details,
    });
  } catch (error) {
    console.error("[api-backend] failed to write operator action audit", {
      action: params.action,
      role: params.role,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function sendToOrchestrator(request: OrchestratorRequest): Promise<OrchestratorResponse> {
  const startedAt = Date.now();
  let lastError: Error | null = null;
  const totalAttempts = orchestratorMaxRetries + 1;

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), orchestratorTimeoutMs);

    try {
      const response = await fetch(orchestratorUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (response.ok) {
        const parsed = (await response.json()) as OrchestratorResponse;
        metrics.record("internal.orchestrator_call", Date.now() - startedAt, true);
        return parsed;
      }

      const details = await readErrorDetails(response);
      const retriable = shouldRetryStatus(response.status) && attempt < orchestratorMaxRetries;
      if (!retriable) {
        metrics.record("internal.orchestrator_call", Date.now() - startedAt, false);
        throw new NonRetriableRequestError(
          details.length > 0
            ? `orchestrator request failed: ${response.status} ${details}`
            : `orchestrator request failed: ${response.status}`,
        );
      }
      lastError = new Error(
        details.length > 0
          ? `orchestrator request failed: ${response.status} ${details}`
          : `orchestrator request failed: ${response.status}`,
      );
    } catch (error) {
      if (error instanceof NonRetriableRequestError) {
        throw error;
      }
      const isAbortError = error instanceof Error && error.name === "AbortError";
      const retriable = attempt < orchestratorMaxRetries;
      if (!retriable) {
        if (isAbortError) {
          metrics.record("internal.orchestrator_call", Date.now() - startedAt, false);
          throw new Error(`orchestrator request timed out after ${orchestratorTimeoutMs}ms`);
        }
        metrics.record("internal.orchestrator_call", Date.now() - startedAt, false);
        throw error instanceof Error ? error : new Error("orchestrator request failed");
      }
      lastError = isAbortError
        ? new Error(`orchestrator request timed out after ${orchestratorTimeoutMs}ms`)
        : error instanceof Error
          ? error
          : new Error("orchestrator request failed");
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < orchestratorMaxRetries) {
      await sleep(orchestratorRetryBackoffMs * (attempt + 1));
    }
  }

  metrics.record("internal.orchestrator_call", Date.now() - startedAt, false);
  throw lastError ?? new Error("orchestrator request failed");
}

export const server = createServer(async (req, res) => {
  const startedAt = Date.now();
  let operation = `${req.method ?? "UNKNOWN"} /unknown`;
  res.once("finish", () => {
    metrics.record(operation, Date.now() - startedAt, res.statusCode < 500);
  });

  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    operation = `${req.method ?? "UNKNOWN"} ${normalizeOperationPath(url.pathname)}`;

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

    if (draining) {
      writeApiError(res, 503, {
        code: "API_DRAINING",
        message: "api-backend is draining and does not accept new requests",
        runtime: runtimeState(),
      });
      return;
    }

    if (url.pathname === "/v1/sessions" && req.method === "GET") {
      const limit = parsePositiveInt(url.searchParams.get("limit"), 50);
      const sessions = await listSessions(limit);
      writeJson(res, 200, { data: sessions, total: sessions.length });
      return;
    }

    if (url.pathname === "/v1/sessions" && req.method === "POST") {
      const raw = await readBody(req);
      const parsed = parseJsonBody(raw) as { userId?: unknown; mode?: unknown };
      const userId =
        typeof parsed.userId === "string" && parsed.userId.length > 0 ? parsed.userId : "anonymous";
      const mode = sanitizeMode(parsed.mode);
      const session = await createSession({ userId, mode });
      writeJson(res, 201, { data: session });
      return;
    }

    if (url.pathname.startsWith("/v1/sessions/") && req.method === "PATCH") {
      const sessionId = decodeURIComponent(url.pathname.replace("/v1/sessions/", ""));
      if (!sessionId) {
        writeApiError(res, 400, {
          code: "API_SESSION_ID_REQUIRED",
          message: "sessionId is required",
        });
        return;
      }
      const raw = await readBody(req);
      const parsed = parseJsonBody(raw) as {
        status?: unknown;
        expectedVersion?: unknown;
        idempotencyKey?: unknown;
      };
      const status = sanitizeStatus(parsed.status);
      const expectedVersion = parseExpectedVersion(parsed.expectedVersion);
      const idempotencyKey =
        parseIdempotencyKey(parsed.idempotencyKey) ?? parseIdempotencyKey(headerValue(req, "x-idempotency-key"));
      const sessionUpdate = await updateSessionStatus(sessionId, status, {
        expectedVersion,
        idempotencyKey,
      });
      if (sessionUpdate.outcome === "not_found") {
        writeApiError(res, 404, {
          code: "API_SESSION_NOT_FOUND",
          message: "Session not found",
          details: { sessionId },
        });
        return;
      }
      if (sessionUpdate.outcome === "version_conflict") {
        writeApiError(res, 409, {
          code: "API_SESSION_VERSION_CONFLICT",
          message: "Session version conflict",
          details: {
            sessionId,
            expectedVersion: sessionUpdate.expectedVersion,
            actualVersion: sessionUpdate.actualVersion,
          },
        });
        return;
      }
      if (sessionUpdate.outcome === "idempotency_conflict") {
        writeApiError(res, 409, {
          code: "API_SESSION_IDEMPOTENCY_CONFLICT",
          message: "Session idempotency key conflict",
          details: {
            sessionId,
            idempotencyKey: sessionUpdate.idempotencyKey,
            currentStatus: sessionUpdate.session.status,
            requestedStatus: sessionUpdate.requestedStatus,
            actualVersion: sessionUpdate.session.version,
          },
        });
        return;
      }
      writeJson(res, 200, {
        data: sessionUpdate.session,
        meta: {
          outcome: sessionUpdate.outcome,
          expectedVersion,
          idempotencyKey,
        },
      });
      return;
    }

    if (url.pathname === "/v1/runs" && req.method === "GET") {
      const limit = parsePositiveInt(url.searchParams.get("limit"), 50);
      const runs = await listRuns(limit);
      writeJson(res, 200, { data: runs, total: runs.length });
      return;
    }

    if (url.pathname === "/v1/events" && req.method === "GET") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) {
        writeApiError(res, 400, {
          code: "API_SESSION_ID_QUERY_REQUIRED",
          message: "sessionId query param is required",
        });
        return;
      }
      const limit = parsePositiveInt(url.searchParams.get("limit"), 100);
      const events = await listEvents({ sessionId, limit });
      writeJson(res, 200, { data: events, total: events.length });
      return;
    }

    if (url.pathname === "/v1/skills/index" && req.method === "GET") {
      const limit = parseBoundedInt(url.searchParams.get("limit"), 200, 1, 500);
      const scope = url.searchParams.get("scope") ?? undefined;
      const includeDisabled = url.searchParams.get("includeDisabled") === "true";
      const indexItems = await listManagedSkillIndex({
        limit,
        includeDisabled,
        scope,
      });
      writeJson(res, 200, {
        data: indexItems,
        total: indexItems.length,
        source: "managed_registry",
        generatedAt: new Date().toISOString(),
      });
      return;
    }

    if (url.pathname === "/v1/skills/registry" && req.method === "GET") {
      const role = assertOperatorRole(req, ["viewer", "operator", "admin"]);
      const limit = parseBoundedInt(url.searchParams.get("limit"), 200, 1, 500);
      const scope = url.searchParams.get("scope") ?? undefined;
      const includeDisabled = url.searchParams.get("includeDisabled") === "true";
      const skills = await listManagedSkills({
        limit,
        includeDisabled,
        scope,
      });
      writeJson(res, 200, {
        data: skills,
        total: skills.length,
        role,
      });
      return;
    }

    if (url.pathname === "/v1/skills/registry" && req.method === "POST") {
      const role = assertOperatorRole(req, ["admin"]);
      const raw = await readBody(req);
      const parsed = parseJsonBody(raw) as {
        skillId?: unknown;
        name?: unknown;
        description?: unknown;
        prompt?: unknown;
        scope?: unknown;
        enabled?: unknown;
        trustLevel?: unknown;
        expectedVersion?: unknown;
        updatedBy?: unknown;
        publisher?: unknown;
        checksum?: unknown;
        metadata?: unknown;
      };

      const skillId = toOptionalString(parsed.skillId);
      const name = toOptionalString(parsed.name);
      const prompt = toOptionalString(parsed.prompt);
      if (!skillId || !name || !prompt) {
        await auditOperatorAction({
          role,
          action: "skills_registry_upsert",
          outcome: "denied",
          reason: "skillId, name and prompt are required",
          errorCode: "API_SKILL_REGISTRY_INVALID_INPUT",
        });
        writeApiError(res, 400, {
          code: "API_SKILL_REGISTRY_INVALID_INPUT",
          message: "skillId, name and prompt are required",
          details: {
            required: ["skillId", "name", "prompt"],
          },
        });
        return;
      }

      const upsertResult = await upsertManagedSkill({
        skillId,
        name,
        description: toOptionalString(parsed.description) ?? undefined,
        prompt,
        scope: parseSkillScope(parsed.scope),
        enabled: parsed.enabled === undefined ? true : Boolean(parsed.enabled),
        trustLevel: sanitizeManagedTrustLevel(parsed.trustLevel),
        expectedVersion: parseOptionalExpectedVersion(parsed.expectedVersion),
        updatedBy: toOptionalString(parsed.updatedBy) ?? role,
        publisher: toOptionalString(parsed.publisher),
        checksum: toOptionalString(parsed.checksum),
        metadata: parsed.metadata,
      });

      if (upsertResult.outcome === "version_conflict") {
        await auditOperatorAction({
          role,
          action: "skills_registry_upsert",
          outcome: "failed",
          reason: "managed skill version conflict",
          errorCode: "API_SKILL_REGISTRY_VERSION_CONFLICT",
          details: {
            skillId: upsertResult.skill.skillId,
            expectedVersion: upsertResult.expectedVersion,
            actualVersion: upsertResult.actualVersion,
          },
        });
        writeApiError(res, 409, {
          code: "API_SKILL_REGISTRY_VERSION_CONFLICT",
          message: "Managed skill version conflict",
          details: {
            skillId: upsertResult.skill.skillId,
            expectedVersion: upsertResult.expectedVersion,
            actualVersion: upsertResult.actualVersion,
          },
        });
        return;
      }

      await auditOperatorAction({
        role,
        action: "skills_registry_upsert",
        outcome: "succeeded",
        reason: `managed skill ${upsertResult.outcome}`,
        details: {
          skillId: upsertResult.skill.skillId,
          version: upsertResult.skill.version,
          trustLevel: upsertResult.skill.trustLevel,
        },
      });

      writeJson(res, upsertResult.outcome === "created" ? 201 : 200, {
        data: upsertResult.skill,
        meta: {
          outcome: upsertResult.outcome,
        },
      });
      return;
    }

    if (url.pathname === "/v1/device-nodes/index" && req.method === "GET") {
      const limit = parseBoundedInt(url.searchParams.get("limit"), 200, 1, 500);
      const includeOffline = url.searchParams.get("includeOffline") === "true";
      const kindRaw = url.searchParams.get("kind");
      const kind =
        kindRaw && (kindRaw === "desktop" || kindRaw === "mobile")
          ? sanitizeDeviceNodeKind(kindRaw)
          : undefined;
      const indexItems = await listDeviceNodeIndex({
        limit,
        includeOffline,
        kind,
      });
      writeJson(res, 200, {
        data: indexItems,
        total: indexItems.length,
        source: "device_node_registry",
        generatedAt: new Date().toISOString(),
      });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/v1/device-nodes/")) {
      const rawNodeId = url.pathname.slice("/v1/device-nodes/".length);
      if (
        rawNodeId.length > 0 &&
        rawNodeId !== "index" &&
        rawNodeId !== "heartbeat"
      ) {
        const role = assertOperatorRole(req, ["viewer", "operator", "admin"]);
        const decodedNodeId = decodeURIComponent(rawNodeId);
        const node = await getDeviceNodeById(decodedNodeId);
        if (!node) {
          writeApiError(res, 404, {
            code: "API_DEVICE_NODE_NOT_FOUND",
            message: "Device node not found",
            details: {
              nodeId: decodedNodeId,
            },
          });
          return;
        }
        writeJson(res, 200, {
          data: node,
          role,
          source: "device_node_registry",
        });
        return;
      }
    }

    if (url.pathname === "/v1/device-nodes" && req.method === "GET") {
      const role = assertOperatorRole(req, ["viewer", "operator", "admin"]);
      const limit = parseBoundedInt(url.searchParams.get("limit"), 200, 1, 500);
      const includeOffline = url.searchParams.get("includeOffline") === "true";
      const kindRaw = url.searchParams.get("kind");
      const kind =
        kindRaw && (kindRaw === "desktop" || kindRaw === "mobile")
          ? sanitizeDeviceNodeKind(kindRaw)
          : undefined;
      const nodes = await listDeviceNodes({
        limit,
        includeOffline,
        kind,
      });
      writeJson(res, 200, {
        data: nodes,
        total: nodes.length,
        role,
      });
      return;
    }

    if (url.pathname === "/v1/device-nodes" && req.method === "POST") {
      const role = assertOperatorRole(req, ["admin"]);
      const raw = await readBody(req);
      const parsed = parseJsonBody(raw) as {
        nodeId?: unknown;
        displayName?: unknown;
        kind?: unknown;
        platform?: unknown;
        executorUrl?: unknown;
        status?: unknown;
        capabilities?: unknown;
        trustLevel?: unknown;
        expectedVersion?: unknown;
        metadata?: unknown;
        updatedBy?: unknown;
      };

      const nodeId = toOptionalString(parsed.nodeId);
      const displayName = toOptionalString(parsed.displayName);
      if (!nodeId || !displayName) {
        await auditOperatorAction({
          role,
          action: "device_node_upsert",
          outcome: "denied",
          reason: "nodeId and displayName are required",
          errorCode: "API_DEVICE_NODE_INVALID_INPUT",
        });
        writeApiError(res, 400, {
          code: "API_DEVICE_NODE_INVALID_INPUT",
          message: "nodeId and displayName are required",
          details: {
            required: ["nodeId", "displayName"],
          },
        });
        return;
      }

      const result = await upsertDeviceNode({
        nodeId,
        displayName,
        kind: sanitizeDeviceNodeKind(parsed.kind),
        platform: toOptionalString(parsed.platform) ?? undefined,
        executorUrl: toOptionalString(parsed.executorUrl),
        status: sanitizeDeviceNodeStatus(parsed.status),
        capabilities: parseCapabilities(parsed.capabilities),
        trustLevel: sanitizeManagedTrustLevel(parsed.trustLevel),
        expectedVersion: parseOptionalExpectedVersion(parsed.expectedVersion),
        metadata: parsed.metadata,
        updatedBy: toOptionalString(parsed.updatedBy) ?? role,
      });

      if (result.outcome === "version_conflict") {
        await auditOperatorAction({
          role,
          action: "device_node_upsert",
          outcome: "failed",
          reason: "device node version conflict",
          errorCode: "API_DEVICE_NODE_VERSION_CONFLICT",
          details: {
            nodeId: result.node.nodeId,
            expectedVersion: result.expectedVersion,
            actualVersion: result.actualVersion,
          },
        });
        writeApiError(res, 409, {
          code: "API_DEVICE_NODE_VERSION_CONFLICT",
          message: "Device node version conflict",
          details: {
            nodeId: result.node.nodeId,
            expectedVersion: result.expectedVersion,
            actualVersion: result.actualVersion,
          },
        });
        return;
      }

      await auditOperatorAction({
        role,
        action: "device_node_upsert",
        outcome: "succeeded",
        reason: `device node ${result.outcome}`,
        details: {
          nodeId: result.node.nodeId,
          status: result.node.status,
          version: result.node.version,
        },
      });

      writeJson(res, result.outcome === "created" ? 201 : 200, {
        data: result.node,
        meta: {
          outcome: result.outcome,
        },
      });
      return;
    }

    if (url.pathname === "/v1/device-nodes/heartbeat" && req.method === "POST") {
      const role = assertOperatorRole(req, ["operator", "admin"]);
      const raw = await readBody(req);
      const parsed = parseJsonBody(raw) as {
        nodeId?: unknown;
        status?: unknown;
        metadata?: unknown;
      };
      const nodeId = toOptionalString(parsed.nodeId);
      if (!nodeId) {
        await auditOperatorAction({
          role,
          action: "device_node_heartbeat",
          outcome: "denied",
          reason: "nodeId is required",
          errorCode: "API_DEVICE_NODE_ID_REQUIRED",
        });
        writeApiError(res, 400, {
          code: "API_DEVICE_NODE_ID_REQUIRED",
          message: "nodeId is required",
        });
        return;
      }

      const node = await touchDeviceNodeHeartbeat({
        nodeId,
        status: parsed.status === undefined ? undefined : sanitizeDeviceNodeStatus(parsed.status),
        metadata: parsed.metadata,
      });

      if (!node) {
        await auditOperatorAction({
          role,
          action: "device_node_heartbeat",
          outcome: "failed",
          reason: "device node not found",
          errorCode: "API_DEVICE_NODE_NOT_FOUND",
          details: {
            nodeId,
          },
        });
        writeApiError(res, 404, {
          code: "API_DEVICE_NODE_NOT_FOUND",
          message: "Device node not found",
          details: {
            nodeId,
          },
        });
        return;
      }

      await auditOperatorAction({
        role,
        action: "device_node_heartbeat",
        outcome: "succeeded",
        reason: "device node heartbeat recorded",
        details: {
          nodeId: node.nodeId,
          status: node.status,
        },
      });
      writeJson(res, 200, {
        data: node,
      });
      return;
    }

    if (url.pathname === "/v1/approvals" && req.method === "GET") {
      const limit = parsePositiveInt(url.searchParams.get("limit"), 50);
      const sessionId = url.searchParams.get("sessionId") ?? undefined;
      const sweep = await runApprovalSlaSweep();
      const activeTasks = await getGatewayActiveTasks(200);
      const syncedFromTasks = await syncPendingApprovalsFromTasks(activeTasks);
      const approvals = await listApprovals({ limit, sessionId });
      writeJson(res, 200, {
        data: approvals,
        total: approvals.length,
        lifecycle: {
          syncedFromTasks,
          slaSweep: sweep,
        },
      });
      return;
    }

    if (url.pathname === "/v1/approvals/resume" && req.method === "POST") {
      const sweep = await runApprovalSlaSweep();
      const raw = await readBody(req);
      const parsed = parseJsonBody(raw) as {
        approvalId?: unknown;
        sessionId?: unknown;
        runId?: unknown;
        userId?: unknown;
        decision?: unknown;
        reason?: unknown;
        intent?: unknown;
        input?: unknown;
      };

      const sessionId =
        typeof parsed.sessionId === "string" && parsed.sessionId.trim().length > 0
          ? parsed.sessionId.trim()
          : null;
      if (!sessionId) {
        writeApiError(res, 400, {
          code: "API_SESSION_ID_REQUIRED",
          message: "sessionId is required",
        });
        return;
      }

      const decision = sanitizeDecision(parsed.decision);
      const runId =
        typeof parsed.runId === "string" && parsed.runId.trim().length > 0
          ? parsed.runId.trim()
          : `resume-${randomUUID()}`;
      const approvalId =
        typeof parsed.approvalId === "string" && parsed.approvalId.trim().length > 0
          ? parsed.approvalId.trim()
          : `approval-${runId}`;
      const reason =
        typeof parsed.reason === "string" && parsed.reason.trim().length > 0
          ? parsed.reason.trim()
          : decision === "approved"
            ? "Approved by operator"
            : "Rejected by operator";
      const intent = parsed.intent === "ui_task" ? "ui_task" : null;
      const userId =
        typeof parsed.userId === "string" && parsed.userId.trim().length > 0
          ? parsed.userId.trim()
          : "operator";

      if (!intent) {
        writeApiError(res, 400, {
          code: "API_INVALID_INTENT",
          message: "intent must be ui_task for approvals resume flow",
          details: {
            allowedIntent: "ui_task",
            receivedIntent: parsed.intent,
          },
        });
        return;
      }

      const approval = await recordApprovalDecision({
        approvalId,
        sessionId,
        runId,
        decision,
        reason,
        metadata: isRecord(parsed.input) ? parsed.input : undefined,
        actor: userId,
      });

      if (approval.status === "timeout") {
        writeJson(res, 409, {
          data: {
            approval,
            resumed: false,
            reason: "Approval already timed out by SLA policy",
            lifecycle: {
              slaSweep: sweep,
            },
          },
        });
        return;
      }

      if (approval.status === "rejected") {
        writeJson(res, 200, {
          data: {
            approval,
            resumed: false,
            reason: "Approval decision is rejected",
            lifecycle: {
              slaSweep: sweep,
            },
          },
        });
        return;
      }

      if (approval.status !== "approved") {
        writeJson(res, 409, {
          data: {
            approval,
            resumed: false,
            reason: `Approval is in non-resumable state: ${approval.status}`,
            lifecycle: {
              slaSweep: sweep,
            },
          },
        });
        return;
      }

      const baseInput = isRecord(parsed.input) ? parsed.input : {};
      const orchestratorRequest = createEnvelope({
        userId,
        sessionId,
        runId,
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent,
          input: {
            ...baseInput,
            approvalConfirmed: true,
            approvalDecision: decision,
            approvalReason: reason,
            approvalId,
          },
        },
      }) as OrchestratorRequest;

      const response = await sendToOrchestrator(orchestratorRequest);
      writeJson(res, 200, {
        data: {
          approval,
          resumed: true,
          orchestrator: response,
          lifecycle: {
            slaSweep: sweep,
          },
        },
      });
      return;
    }

    if (url.pathname === "/v1/operator/summary" && req.method === "GET") {
      const role = assertOperatorRole(req, ["viewer", "operator", "admin"]);
      const traceRunsLimit = parseBoundedInt(url.searchParams.get("traceRunsLimit"), 40, 10, 200);
      const traceEventsLimit = parseBoundedInt(url.searchParams.get("traceEventsLimit"), 120, 20, 500);
      const sweep = await runApprovalSlaSweep();
      const [activeTasks, services, runs, recentEvents, deviceNodes] = await Promise.all([
        getGatewayActiveTasks(100),
        getOperatorServiceSummary(),
        listRuns(Math.max(traceRunsLimit, 100)),
        listRecentEvents(traceEventsLimit),
        listDeviceNodes({
          limit: operatorDeviceNodeSummaryLimit,
          includeOffline: true,
        }),
      ]);
      const syncedFromTasks = await syncPendingApprovalsFromTasks(activeTasks);
      const [approvals, operatorActions] = await Promise.all([
        listApprovals({ limit: 100 }),
        listOperatorActions(50),
      ]);
      const approvalStatusCounts = approvals.reduce(
        (acc, approval) => {
          if (approval.status === "pending") {
            acc.pending += 1;
          } else if (approval.status === "approved") {
            acc.approved += 1;
          } else if (approval.status === "rejected") {
            acc.rejected += 1;
          } else if (approval.status === "timeout") {
            acc.timeout += 1;
          }
          return acc;
        },
        {
          pending: 0,
          approved: 0,
          rejected: 0,
          timeout: 0,
        },
      );
      const latestApproval = approvals.length > 0
        ? {
            approvalId: approvals[0].approvalId,
            status: approvals[0].status,
            decision: approvals[0].decision,
            updatedAt: approvals[0].updatedAt,
            requestedAt: approvals[0].requestedAt,
            hardDueAt: approvals[0].hardDueAt,
            resolvedAt: approvals[0].resolvedAt,
            runId: approvals[0].runId,
            sessionId: approvals[0].sessionId,
          }
        : null;
      const pendingApprovalsFromTasks = activeTasks.filter(
        (task) => isRecord(task) && task.status === "pending_approval",
      ).length;
      const taskQueue = buildTaskQueueSummary(activeTasks);
      const traces = buildOperatorTraceSummary({
        runs,
        events: recentEvents,
        approvals,
        activeTasks,
        runLimit: traceRunsLimit,
        eventLimit: traceEventsLimit,
      });
      const deviceNodeHealth = buildDeviceNodeHealthSummary(deviceNodes, {
        staleThresholdMs: operatorDeviceNodeStaleThresholdMs,
      });
      const startupFailures = buildStartupFailureSummary(services);
      const turnTruncation = buildTurnTruncationSummary(recentEvents, services);
      const turnDelete = buildTurnDeleteSummary(recentEvents, services);

      writeJson(res, 200, {
        data: {
          generatedAt: new Date().toISOString(),
          role,
          activeTasks: {
            total: activeTasks.length,
            data: activeTasks,
          },
          taskQueue,
          approvals: {
            total: approvals.length,
            recent: approvals.slice(0, 25),
            statusCounts: approvalStatusCounts,
            pendingFromTasks: pendingApprovalsFromTasks,
            syncedFromTasks,
            slaSweep: sweep,
            latest: latestApproval,
          },
          operatorActions: {
            total: operatorActions.length,
            recent: operatorActions.slice(0, 25),
          },
          startupFailures,
          turnTruncation,
          turnDelete,
          deviceNodes: deviceNodeHealth,
          services,
          traces,
        },
      });
      return;
    }

    if (url.pathname === "/v1/operator/actions" && req.method === "POST") {
      const role = assertOperatorRole(req, ["operator", "admin"]);
      const raw = await readBody(req);
      const parsed = parseJsonBody(raw) as {
        action?: unknown;
        taskId?: unknown;
        reason?: unknown;
        targetService?: unknown;
        operation?: unknown;
      };

      const action = typeof parsed.action === "string" ? parsed.action.trim().toLowerCase() : "";
      const reason =
        typeof parsed.reason === "string" && parsed.reason.trim().length > 0
          ? parsed.reason.trim()
          : "operator action";

      if (action === "cancel_task") {
        const taskId = typeof parsed.taskId === "string" ? parsed.taskId.trim() : "";
        if (taskId.length === 0) {
          await auditOperatorAction({
            role,
            action: "cancel_task",
            outcome: "denied",
            reason,
            errorCode: "API_OPERATOR_TASK_ID_REQUIRED",
          });
          writeApiError(res, 400, {
            code: "API_OPERATOR_TASK_ID_REQUIRED",
            message: "taskId is required for cancel_task",
          });
          return;
        }
        const targetUrl = `${gatewayBaseUrl}/tasks/${encodeURIComponent(taskId)}/cancel?reason=${encodeURIComponent(
          reason,
        )}`;
        let result: unknown;
        try {
          result = await postJsonWithTimeout(targetUrl, {}, 8000);
        } catch (error) {
          const normalized = normalizeUnknownError(error, {
            defaultCode: "API_OPERATOR_ACTION_FAILED",
            defaultMessage: "operator cancel_task failed",
          });
          await auditOperatorAction({
            role,
            action: "cancel_task",
            outcome: "failed",
            reason,
            taskId,
            errorCode: normalized.code,
            details: normalized,
          });
          throw error;
        }
        await auditOperatorAction({
          role,
          action: "cancel_task",
          outcome: "succeeded",
          reason,
          taskId,
        });
        writeJson(res, 200, {
          data: {
            action: "cancel_task",
            taskId,
            result,
          },
        });
        return;
      }

      if (action === "retry_task") {
        const taskId = typeof parsed.taskId === "string" ? parsed.taskId.trim() : "";
        if (taskId.length === 0) {
          await auditOperatorAction({
            role,
            action: "retry_task",
            outcome: "denied",
            reason,
            errorCode: "API_OPERATOR_TASK_ID_REQUIRED",
          });
          writeApiError(res, 400, {
            code: "API_OPERATOR_TASK_ID_REQUIRED",
            message: "taskId is required for retry_task",
          });
          return;
        }
        const targetUrl = `${gatewayBaseUrl}/tasks/${encodeURIComponent(taskId)}/retry?reason=${encodeURIComponent(
          reason,
        )}`;
        let result: unknown;
        try {
          result = await postJsonWithTimeout(targetUrl, {}, 8000);
        } catch (error) {
          const normalized = normalizeUnknownError(error, {
            defaultCode: "API_OPERATOR_ACTION_FAILED",
            defaultMessage: "operator retry_task failed",
          });
          await auditOperatorAction({
            role,
            action: "retry_task",
            outcome: "failed",
            reason,
            taskId,
            errorCode: normalized.code,
            details: normalized,
          });
          throw error;
        }
        await auditOperatorAction({
          role,
          action: "retry_task",
          outcome: "succeeded",
          reason,
          taskId,
        });
        writeJson(res, 200, {
          data: {
            action: "retry_task",
            taskId,
            result,
          },
        });
        return;
      }

      if (action === "failover") {
        if (role !== "admin") {
          await auditOperatorAction({
            role,
            action: "failover",
            outcome: "denied",
            reason,
            errorCode: "API_OPERATOR_ADMIN_REQUIRED",
          });
          writeApiError(res, 403, {
            code: "API_OPERATOR_ADMIN_REQUIRED",
            message: "failover action requires admin role",
          });
          return;
        }

        const targetService = normalizeServiceName(parsed.targetService);
        const operationRaw =
          typeof parsed.operation === "string" ? parsed.operation.trim().toLowerCase() : "";
        const operation = operationRaw === "drain" || operationRaw === "warmup" ? operationRaw : null;

        if (!targetService || !operation) {
          await auditOperatorAction({
            role,
            action: "failover",
            outcome: "denied",
            reason,
            targetService: typeof parsed.targetService === "string" ? parsed.targetService : undefined,
            operation: typeof parsed.operation === "string" ? parsed.operation : undefined,
            errorCode: "API_OPERATOR_FAILOVER_INVALID_INPUT",
          });
          writeApiError(res, 400, {
            code: "API_OPERATOR_FAILOVER_INVALID_INPUT",
            message: "targetService and operation (drain|warmup) are required for failover action",
            details: {
              allowedServices: ["realtime-gateway", "api-backend", "orchestrator", "ui-executor"],
              allowedOperations: ["drain", "warmup"],
            },
          });
          return;
        }

        if (targetService === "api-backend") {
          if (operation === "drain") {
            draining = true;
            lastDrainAt = new Date().toISOString();
          } else {
            draining = false;
            lastWarmupAt = new Date().toISOString();
          }
          await auditOperatorAction({
            role,
            action: "failover",
            outcome: "succeeded",
            reason,
            targetService,
            operation,
          });
          writeJson(res, 200, {
            data: {
              action: "failover",
              targetService,
              operation,
              runtime: runtimeState(),
            },
          });
          return;
        }

        const baseUrl = resolveServiceBaseUrl(targetService);
        let result: unknown;
        try {
          result = await postJsonWithTimeout(`${baseUrl}/${operation}`, {}, 8000);
        } catch (error) {
          const normalized = normalizeUnknownError(error, {
            defaultCode: "API_OPERATOR_ACTION_FAILED",
            defaultMessage: "operator failover action failed",
          });
          await auditOperatorAction({
            role,
            action: "failover",
            outcome: "failed",
            reason,
            targetService,
            operation,
            errorCode: normalized.code,
            details: normalized,
          });
          throw error;
        }
        await auditOperatorAction({
          role,
          action: "failover",
          outcome: "succeeded",
          reason,
          targetService,
          operation,
        });
        writeJson(res, 200, {
          data: {
            action: "failover",
            targetService,
            operation,
            result,
          },
        });
        return;
      }

      await auditOperatorAction({
        role,
        action: action.length > 0 ? action : "unknown",
        outcome: "denied",
        reason,
        errorCode: "API_OPERATOR_ACTION_INVALID",
        details: {
          action: parsed.action,
          allowedActions: ["cancel_task", "retry_task", "failover"],
        },
      });
      writeApiError(res, 400, {
        code: "API_OPERATOR_ACTION_INVALID",
        message: "unsupported operator action",
        details: {
          action: parsed.action,
          allowedActions: ["cancel_task", "retry_task", "failover"],
        },
      });
      return;
    }

    writeApiError(res, 404, {
      code: "API_NOT_FOUND",
      message: "Not found",
      details: {
        method: req.method ?? "UNKNOWN",
        path: url.pathname,
      },
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      writeApiError(res, error.statusCode, {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return;
    }

    const normalized = normalizeUnknownError(error, {
      defaultCode: "API_INTERNAL_ERROR",
      defaultMessage: "unknown api-backend error",
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
  console.log(`[api-backend] listening on :${port}`);
});
