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
  type ChannelSessionBindingRecord,
  createSession,
  type DeviceNodeKind,
  type DeviceNodeStatus,
  type EventListItem,
  getTenantGovernancePolicy,
  getChannelSessionBinding,
  getDeviceNodeById,
  getFirestoreState,
  type GovernanceComplianceTemplate,
  type GovernanceRetentionPolicy,
  listChannelSessionBindingIndex,
  listChannelSessionBindings,
  listDeviceNodeIndex,
  listDeviceNodes,
  listEvents,
  listRecentEvents,
  listApprovals,
  listOperatorActions,
  listRuns,
  listSessions,
  listTenantGovernancePolicies,
  listManagedSkillIndex,
  listManagedSkills,
  type ManagedSkillTrustLevel,
  recordOperatorAction,
  recordApprovalDecision,
  sweepApprovalTimeouts,
  touchDeviceNodeHeartbeat,
  upsertChannelSessionBinding,
  upsertDeviceNode,
  upsertTenantGovernancePolicy,
  upsertPendingApproval,
  upsertManagedSkill,
  updateSessionStatus,
  type SessionMode,
  type SessionStatus,
} from "./firestore.js";
import { AnalyticsExporter } from "./analytics-export.js";
import { buildOperatorTraceSummary } from "./operator-traces.js";
import { buildDeviceNodeHealthSummary } from "./device-node-summary.js";
import {
  normalizeSkillPluginManifest,
  parseSkillPluginSigningKeys,
} from "./skill-plugin-marketplace.js";

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
const configuredChannelAdapters = parseChannelAdapters(
  process.env.API_CHANNEL_ADAPTERS ?? "webchat,telegram,slack",
);
const allowCustomChannelAdapters = process.env.API_CHANNEL_ADAPTERS_ALLOW_CUSTOM === "true";
const defaultTenantId = normalizeTenantId(process.env.API_DEFAULT_TENANT_ID);
const requestedComplianceTemplate = toOptionalString(process.env.API_COMPLIANCE_TEMPLATE) ?? "baseline";
const skillPluginRequireSignature = process.env.SKILL_PLUGIN_REQUIRE_SIGNATURE === "true";
const skillPluginSigningKeysConfig = parseSkillPluginSigningKeys(
  process.env.SKILL_PLUGIN_SIGNING_KEYS_JSON,
);
type ComplianceTemplateId = GovernanceComplianceTemplate;
type RetentionPolicy = GovernanceRetentionPolicy;
type ComplianceTemplateProfile = {
  id: ComplianceTemplateId;
  description: string;
  controls: {
    piiRedactionLevel: "standard" | "high";
    crossTenantAdminOnly: boolean;
    approvalSlaEnforced: boolean;
    auditTrailRequired: boolean;
  };
  retentionPolicy: RetentionPolicy;
  requestedTemplateId: string;
  fallbackApplied: boolean;
};
const complianceTemplateProfiles: Record<
  ComplianceTemplateId,
  Omit<ComplianceTemplateProfile, "requestedTemplateId" | "fallbackApplied">
> = {
  baseline: {
    id: "baseline",
    description: "Balanced defaults for product/demo operation.",
    controls: {
      piiRedactionLevel: "standard",
      crossTenantAdminOnly: true,
      approvalSlaEnforced: true,
      auditTrailRequired: true,
    },
    retentionPolicy: {
      rawMediaDays: 7,
      auditLogsDays: 365,
      approvalsDays: 365,
      eventsDays: 365,
      operatorActionsDays: 365,
      metricsRollupsDays: 400,
      sessionsDays: 90,
    },
  },
  strict: {
    id: "strict",
    description: "Short raw data retention with longer compliance evidence.",
    controls: {
      piiRedactionLevel: "high",
      crossTenantAdminOnly: true,
      approvalSlaEnforced: true,
      auditTrailRequired: true,
    },
    retentionPolicy: {
      rawMediaDays: 3,
      auditLogsDays: 540,
      approvalsDays: 540,
      eventsDays: 540,
      operatorActionsDays: 540,
      metricsRollupsDays: 730,
      sessionsDays: 120,
    },
  },
  regulated: {
    id: "regulated",
    description: "Compliance-first profile for strict audit-heavy environments.",
    controls: {
      piiRedactionLevel: "high",
      crossTenantAdminOnly: true,
      approvalSlaEnforced: true,
      auditTrailRequired: true,
    },
    retentionPolicy: {
      rawMediaDays: 1,
      auditLogsDays: 1095,
      approvalsDays: 1095,
      eventsDays: 1095,
      operatorActionsDays: 1095,
      metricsRollupsDays: 1095,
      sessionsDays: 180,
    },
  },
};
const complianceTemplateProfile = resolveComplianceTemplateProfile(requestedComplianceTemplate);
const complianceTemplate = complianceTemplateProfile.id;

function toBaseUrl(input: string | undefined, fallback: string): string {
  const candidate = typeof input === "string" && input.trim().length > 0 ? input.trim() : fallback;
  return candidate.replace(/\/+$/, "");
}

function parseChannelAdapters(raw: string): string[] {
  const entries = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0)
    .map((item) =>
      item
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .filter((item) => item.length > 0);
  const deduped = Array.from(new Set(entries));
  return deduped.length > 0 ? deduped : ["webchat"];
}

function normalizeTenantId(raw: unknown): string {
  const source = typeof raw === "string" ? raw.trim() : "";
  const normalized = source
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (normalized.length === 0) {
    return "public";
  }
  return normalized.slice(0, 64);
}

function resolveRequestTenantContext(req: IncomingMessage, url: URL): {
  tenantId: string;
  source: "query" | "header" | "default";
} {
  const queryTenant = normalizeTenantId(url.searchParams.get("tenantId"));
  if (queryTenant !== "public" || (url.searchParams.get("tenantId") ?? "").trim().length > 0) {
    return {
      tenantId: queryTenant,
      source: "query",
    };
  }
  const headerTenant = normalizeTenantId(headerValue(req, "x-tenant-id"));
  if (headerTenant !== "public" || (headerValue(req, "x-tenant-id") ?? "").trim().length > 0) {
    return {
      tenantId: headerTenant,
      source: "header",
    };
  }
  return {
    tenantId: defaultTenantId,
    source: "default",
  };
}

function resolveComplianceTemplateProfile(rawTemplate: string): ComplianceTemplateProfile {
  const requested = rawTemplate.trim().toLowerCase();
  const resolvedId: ComplianceTemplateId =
    requested === "strict" || requested === "regulated" || requested === "baseline"
      ? requested
      : "baseline";
  const base = complianceTemplateProfiles[resolvedId];
  const retentionPolicy: RetentionPolicy = {
    rawMediaDays: parseBoundedInt(
      process.env.API_RETENTION_RAW_MEDIA_DAYS ?? null,
      base.retentionPolicy.rawMediaDays,
      1,
      3650,
    ),
    auditLogsDays: parseBoundedInt(
      process.env.API_RETENTION_AUDIT_LOGS_DAYS ?? null,
      base.retentionPolicy.auditLogsDays,
      1,
      3650,
    ),
    approvalsDays: parseBoundedInt(
      process.env.API_RETENTION_APPROVALS_DAYS ?? null,
      base.retentionPolicy.approvalsDays,
      1,
      3650,
    ),
    eventsDays: parseBoundedInt(
      process.env.API_RETENTION_EVENTS_DAYS ?? null,
      base.retentionPolicy.eventsDays,
      1,
      3650,
    ),
    operatorActionsDays: parseBoundedInt(
      process.env.API_RETENTION_OPERATOR_ACTIONS_DAYS ?? null,
      base.retentionPolicy.operatorActionsDays,
      1,
      3650,
    ),
    metricsRollupsDays: parseBoundedInt(
      process.env.API_RETENTION_METRICS_ROLLUPS_DAYS ?? null,
      base.retentionPolicy.metricsRollupsDays,
      1,
      3650,
    ),
    sessionsDays: parseBoundedInt(
      process.env.API_RETENTION_SESSIONS_DAYS ?? null,
      base.retentionPolicy.sessionsDays,
      1,
      3650,
    ),
  };
  return {
    ...base,
    retentionPolicy,
    requestedTemplateId: requested.length > 0 ? requested : "baseline",
    fallbackApplied: requested.length > 0 && requested !== resolvedId,
  };
}

function resolveGovernanceTenantScope(params: {
  requestedTenantRaw: string | null;
  requestTenant: {
    tenantId: string;
    source: "query" | "header" | "default";
  };
  role: OperatorRole;
}): {
  scope: "tenant" | "all";
  effectiveTenantId: string | null;
  requestedTenantId: string | null;
} {
  const requestedTenantRaw = params.requestedTenantRaw?.trim() ?? "";
  if (requestedTenantRaw.length === 0) {
    return {
      scope: "tenant",
      effectiveTenantId: params.requestTenant.tenantId,
      requestedTenantId: null,
    };
  }

  if (requestedTenantRaw.toLowerCase() === "all") {
    if (params.role !== "admin") {
      throw new ApiRequestError({
        statusCode: 403,
        code: "API_TENANT_SCOPE_FORBIDDEN",
        message: "cross-tenant audit access requires admin role",
        details: {
          requestTenantId: params.requestTenant.tenantId,
          requestedTenantId: "all",
          role: params.role,
        },
      });
    }
    return {
      scope: "all",
      effectiveTenantId: null,
      requestedTenantId: "all",
    };
  }

  const requestedTenantId = normalizeTenantId(requestedTenantRaw);
  if (params.role !== "admin" && requestedTenantId !== params.requestTenant.tenantId) {
    throw new ApiRequestError({
      statusCode: 403,
      code: "API_TENANT_SCOPE_FORBIDDEN",
      message: "cross-tenant audit access requires admin role",
      details: {
        requestTenantId: params.requestTenant.tenantId,
        requestedTenantId,
        role: params.role,
      },
    });
  }
  return {
    scope: "tenant",
    effectiveTenantId: requestedTenantId,
    requestedTenantId,
  };
}

type EffectiveGovernancePolicy = {
  tenantId: string;
  source: "template_default" | "tenant_override";
  profile: ComplianceTemplateProfile;
  overrideVersion: number | null;
  overrideUpdatedAt: string | null;
};

function isComplianceTemplateId(value: unknown): value is ComplianceTemplateId {
  return value === "baseline" || value === "strict" || value === "regulated";
}

function parseRetentionPolicyPatch(raw: unknown): {
  patch: Partial<RetentionPolicy>;
  invalidFields: string[];
} {
  if (!isRecord(raw)) {
    return {
      patch: {},
      invalidFields: [],
    };
  }
  const patch: Partial<RetentionPolicy> = {};
  const invalidFields: string[] = [];
  const assignField = (key: keyof RetentionPolicy) => {
    const value = raw[key];
    if (value === undefined) {
      return;
    }
    const parsed = parseNonNegativeInt(value);
    if (parsed === null || parsed < 1) {
      invalidFields.push(String(key));
      return;
    }
    patch[key] = Math.min(3650, parsed);
  };
  assignField("rawMediaDays");
  assignField("auditLogsDays");
  assignField("approvalsDays");
  assignField("eventsDays");
  assignField("operatorActionsDays");
  assignField("metricsRollupsDays");
  assignField("sessionsDays");
  return {
    patch,
    invalidFields,
  };
}

function applyRetentionPolicyPatch(
  base: RetentionPolicy,
  patch: Partial<RetentionPolicy>,
): RetentionPolicy {
  return {
    rawMediaDays: patch.rawMediaDays ?? base.rawMediaDays,
    auditLogsDays: patch.auditLogsDays ?? base.auditLogsDays,
    approvalsDays: patch.approvalsDays ?? base.approvalsDays,
    eventsDays: patch.eventsDays ?? base.eventsDays,
    operatorActionsDays: patch.operatorActionsDays ?? base.operatorActionsDays,
    metricsRollupsDays: patch.metricsRollupsDays ?? base.metricsRollupsDays,
    sessionsDays: patch.sessionsDays ?? base.sessionsDays,
  };
}

async function resolveEffectiveGovernancePolicyForTenant(tenantId: string): Promise<EffectiveGovernancePolicy> {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const override = await getTenantGovernancePolicy({
    tenantId: normalizedTenantId,
  });
  if (!override) {
    return {
      tenantId: normalizedTenantId,
      source: "template_default",
      profile: complianceTemplateProfile,
      overrideVersion: null,
      overrideUpdatedAt: null,
    };
  }
  const template = complianceTemplateProfiles[override.complianceTemplate];
  return {
    tenantId: normalizedTenantId,
    source: "tenant_override",
    profile: {
      ...template,
      retentionPolicy: override.retentionPolicy,
      requestedTemplateId: override.complianceTemplate,
      fallbackApplied: false,
    },
    overrideVersion: override.version,
    overrideUpdatedAt: override.updatedAt,
  };
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

function sanitizeChannelAdapterId(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (normalized.length === 0) {
    return null;
  }
  return normalized.slice(0, 64);
}

function isConfiguredChannelAdapter(adapterId: string): boolean {
  return configuredChannelAdapters.includes(adapterId);
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
  if (pathname.startsWith("/v1/device-nodes/")) {
    return "/v1/device-nodes/:id";
  }
  if (pathname.startsWith("/v1/channels/sessions/resolve")) {
    return "/v1/channels/sessions/resolve";
  }
  if (pathname.startsWith("/v1/governance/policy")) {
    return "/v1/governance/policy";
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
    governance: {
      defaultTenantId,
      complianceTemplate,
      complianceTemplateRequested: complianceTemplateProfile.requestedTemplateId,
      complianceTemplateFallbackApplied: complianceTemplateProfile.fallbackApplied,
      retentionPolicy: complianceTemplateProfile.retentionPolicy,
      allowTenantHeaderOverride: true,
    },
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
      damageControl: runtime ? runtime.damageControl ?? null : null,
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

function buildDamageControlSummary(
  events: EventListItem[],
  services: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const uniqueRuns = new Set<string>();
  const uniqueSessions = new Set<string>();
  const normalized: Array<Record<string, unknown>> = [];
  let enabledTrueCount = 0;
  let matchedRuleCountTotal = 0;
  const verdictCounts = {
    allow: 0,
    ask: 0,
    block: 0,
  };
  const sourceCounts = {
    default: 0,
    file: 0,
    env_json: 0,
    unknown: 0,
  };

  for (const event of events) {
    const enabled = typeof event.damageControlEnabled === "boolean" ? event.damageControlEnabled : null;
    const verdict = toOptionalString(event.damageControlVerdict);
    const source = toOptionalString(event.damageControlSource);
    const matchedRuleCount = parseNonNegativeInt(event.damageControlMatchedRuleCount) ?? 0;
    const matchRuleIds = Array.isArray(event.damageControlMatchRuleIds)
      ? event.damageControlMatchRuleIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    const hasDamageControlEvidence = enabled !== null || verdict !== null || source !== null || matchedRuleCount > 0 || matchRuleIds.length > 0;
    if (!hasDamageControlEvidence) {
      continue;
    }
    if (typeof event.runId === "string" && event.runId.trim().length > 0) {
      uniqueRuns.add(event.runId);
    }
    if (typeof event.sessionId === "string" && event.sessionId.trim().length > 0) {
      uniqueSessions.add(event.sessionId);
    }
    if (enabled === true) {
      enabledTrueCount += 1;
    }
    matchedRuleCountTotal += matchedRuleCount;
    if (verdict === "allow" || verdict === "ask" || verdict === "block") {
      verdictCounts[verdict] += 1;
    }
    if (source === "default" || source === "file" || source === "env_json") {
      sourceCounts[source] += 1;
    } else {
      sourceCounts.unknown += 1;
    }
    normalized.push({
      eventId: event.eventId,
      runId: event.runId ?? null,
      sessionId: event.sessionId,
      createdAt: event.createdAt,
      source: event.source,
      eventType: event.type,
      enabled,
      verdict,
      policySource: source,
      path: toOptionalString(event.damageControlPath),
      matchedRuleCount,
      matchRuleIds,
    });
  }

  if (normalized.length <= 0) {
    const gatewayService = services.find((service) => service.name === "realtime-gateway");
    const runtimeEvidence =
      gatewayService && isRecord(gatewayService.damageControl) ? gatewayService.damageControl : null;
    if (!runtimeEvidence) {
      return {
        status: "missing",
        total: 0,
        uniqueRuns: 0,
        uniqueSessions: 0,
        enabledTrueCount: 0,
        matchedRuleCountTotal: 0,
        verdictCounts,
        sourceCounts,
        latest: null,
        recent: [],
        source: "operator_summary",
        validated: false,
      };
    }

    const runtimeRecentRaw = Array.isArray(runtimeEvidence.recent)
      ? runtimeEvidence.recent.filter((item): item is Record<string, unknown> => isRecord(item))
      : [];
    const runtimeRecent = runtimeRecentRaw.map((item) => ({
      eventId: null,
      runId: toOptionalString(item.runId),
      sessionId: toOptionalString(item.sessionId) ?? "unknown",
      createdAt: toOptionalString(item.seenAt) ?? new Date().toISOString(),
      source: "gateway",
      eventType: "orchestrator.response",
      enabled: typeof item.enabled === "boolean" ? item.enabled : null,
      verdict: toOptionalString(item.verdict),
      policySource: toOptionalString(item.source),
      path: toOptionalString(item.path),
      matchedRuleCount: parseNonNegativeInt(item.matchedRuleCount) ?? 0,
      matchRuleIds: Array.isArray(item.matchRuleIds)
        ? item.matchRuleIds.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [],
    }));
    const runtimeLatestRaw = isRecord(runtimeEvidence.latest) ? runtimeEvidence.latest : null;
    const runtimeLatest = runtimeLatestRaw
      ? {
          eventId: null,
          runId: toOptionalString(runtimeLatestRaw.runId),
          sessionId: toOptionalString(runtimeLatestRaw.sessionId) ?? "unknown",
          createdAt: toOptionalString(runtimeLatestRaw.seenAt) ?? new Date().toISOString(),
          source: "gateway",
          eventType: "orchestrator.response",
          enabled: typeof runtimeLatestRaw.enabled === "boolean" ? runtimeLatestRaw.enabled : null,
          verdict: toOptionalString(runtimeLatestRaw.verdict),
          policySource: toOptionalString(runtimeLatestRaw.source),
          path: toOptionalString(runtimeLatestRaw.path),
          matchedRuleCount: parseNonNegativeInt(runtimeLatestRaw.matchedRuleCount) ?? 0,
          matchRuleIds: Array.isArray(runtimeLatestRaw.matchRuleIds)
            ? runtimeLatestRaw.matchRuleIds.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
            : [],
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
    const runtimeMatchedRuleCountTotal =
      parseNonNegativeInt(runtimeEvidence.matchedRuleCountTotal) ??
      runtimeRecent.reduce((acc, item) => acc + (parseNonNegativeInt(item.matchedRuleCount) ?? 0), 0);
    const runtimeVerdictCounts = isRecord(runtimeEvidence.verdictCounts) ? runtimeEvidence.verdictCounts : null;
    const runtimeSourceCounts = isRecord(runtimeEvidence.sourceCounts) ? runtimeEvidence.sourceCounts : null;

    return {
      status: runtimeTotal > 0 ? "observed" : "missing",
      total: runtimeTotal,
      uniqueRuns: runtimeUniqueRuns,
      uniqueSessions: runtimeUniqueSessions,
      enabledTrueCount: runtimeRecent.filter((item) => item.enabled === true).length,
      matchedRuleCountTotal: runtimeMatchedRuleCountTotal,
      verdictCounts: {
        allow: parseNonNegativeInt(runtimeVerdictCounts?.allow) ?? 0,
        ask: parseNonNegativeInt(runtimeVerdictCounts?.ask) ?? 0,
        block: parseNonNegativeInt(runtimeVerdictCounts?.block) ?? 0,
      },
      sourceCounts: {
        default: parseNonNegativeInt(runtimeSourceCounts?.default) ?? 0,
        file: parseNonNegativeInt(runtimeSourceCounts?.file) ?? 0,
        env_json: parseNonNegativeInt(runtimeSourceCounts?.env_json) ?? 0,
        unknown: parseNonNegativeInt(runtimeSourceCounts?.unknown) ?? 0,
      },
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
    enabledTrueCount,
    matchedRuleCountTotal,
    verdictCounts,
    sourceCounts,
    latest: normalized[0],
    recent: normalized.slice(0, 20),
    source: "operator_summary",
    validated: true,
  };
}

async function syncPendingApprovalsFromTasks(
  tasks: unknown[],
  options?: {
    tenantId?: string;
  },
): Promise<number> {
  const scopedTenantId = options?.tenantId ? normalizeTenantId(options.tenantId) : null;
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
    const taskTenantId = normalizeTenantId(toTaskString(item.tenantId) ?? scopedTenantId ?? "public");
    if (scopedTenantId && taskTenantId !== scopedTenantId) {
      continue;
    }
    const runId = toTaskString(item.runId) ?? approvalId.replace(/^approval-/, "run-unknown");
    const stage = toTaskString(item.stage) ?? "awaiting_approval";
    const updatedAt = toTaskString(item.updatedAt) ?? new Date().toISOString();
    await upsertPendingApproval({
      approvalId,
      tenantId: taskTenantId,
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
  tenantId?: string;
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
      tenantId: normalizeTenantId(params.tenantId),
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
    const requestTenant = resolveRequestTenantContext(req, url);
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

    if (url.pathname === "/v1/governance/tenant" && req.method === "GET") {
      const effectiveGovernance = await resolveEffectiveGovernancePolicyForTenant(requestTenant.tenantId);
      writeJson(res, 200, {
        data: {
          tenantId: requestTenant.tenantId,
          source: requestTenant.source,
          complianceTemplate: effectiveGovernance.profile.id,
          complianceTemplateRequested: effectiveGovernance.profile.requestedTemplateId,
          complianceTemplateFallbackApplied: effectiveGovernance.profile.fallbackApplied,
          complianceSource: effectiveGovernance.source,
          retentionPolicy: effectiveGovernance.profile.retentionPolicy,
          defaultTenantId,
          headers: {
            tenantHeader: "x-tenant-id",
          },
        },
      });
      return;
    }

    if (url.pathname === "/v1/governance/compliance-template" && req.method === "GET") {
      const effectiveGovernance = await resolveEffectiveGovernancePolicyForTenant(requestTenant.tenantId);
      writeJson(res, 200, {
        data: {
          active: effectiveGovernance.profile,
          source: effectiveGovernance.source,
          tenant: requestTenant,
          availableTemplates: Object.values(complianceTemplateProfiles).map((item) => ({
            id: item.id,
            description: item.description,
          })),
        },
      });
      return;
    }

    if (url.pathname === "/v1/governance/retention-policy" && req.method === "GET") {
      const effectiveGovernance = await resolveEffectiveGovernancePolicyForTenant(requestTenant.tenantId);
      writeJson(res, 200, {
        data: {
          tenant: requestTenant,
          templateId: effectiveGovernance.profile.id,
          requestedTemplateId: effectiveGovernance.profile.requestedTemplateId,
          source: effectiveGovernance.source,
          policy: effectiveGovernance.profile.retentionPolicy,
        },
      });
      return;
    }

    if (url.pathname === "/v1/governance/policy" && req.method === "GET") {
      const role = assertOperatorRole(req, ["viewer", "operator", "admin"]);
      const tenantScope = resolveGovernanceTenantScope({
        requestedTenantRaw: url.searchParams.get("tenantId"),
        requestTenant,
        role,
      });
      if (tenantScope.scope === "all") {
        const limit = parseBoundedInt(url.searchParams.get("limit"), 100, 1, 500);
        const overrides = await listTenantGovernancePolicies({
          limit,
        });
        writeJson(res, 200, {
          data: {
            role,
            tenant: {
              tenantId: "all",
              requestTenantId: requestTenant.tenantId,
              source: requestTenant.source,
              scope: "all",
            },
            defaults: complianceTemplateProfile,
            overrides: {
              total: overrides.length,
              recent: overrides.slice(0, 50),
            },
          },
        });
        return;
      }

      const tenantId = tenantScope.effectiveTenantId ?? requestTenant.tenantId;
      const effective = await resolveEffectiveGovernancePolicyForTenant(tenantId);
      writeJson(res, 200, {
        data: {
          role,
          tenant: {
            tenantId,
            requestTenantId: requestTenant.tenantId,
            source: requestTenant.source,
            scope: "tenant",
          },
          source: effective.source,
          policy: {
            complianceTemplate: effective.profile.id,
            retentionPolicy: effective.profile.retentionPolicy,
          },
          profile: effective.profile,
          override: effective.overrideVersion === null
            ? null
            : {
                version: effective.overrideVersion,
                updatedAt: effective.overrideUpdatedAt,
              },
        },
      });
      return;
    }

    if (url.pathname === "/v1/governance/policy" && req.method === "POST") {
      const role = assertOperatorRole(req, ["admin"]);
      const raw = await readBody(req);
      const parsed = parseJsonBody(raw) as {
        tenantId?: unknown;
        complianceTemplate?: unknown;
        retentionPolicy?: unknown;
        expectedVersion?: unknown;
        idempotencyKey?: unknown;
        metadata?: unknown;
      };
      const tenantId = normalizeTenantId(parsed.tenantId ?? requestTenant.tenantId);
      const current = await resolveEffectiveGovernancePolicyForTenant(tenantId);
      const requestedTemplateRaw = toOptionalString(parsed.complianceTemplate);
      if (requestedTemplateRaw && !isComplianceTemplateId(requestedTemplateRaw)) {
        await auditOperatorAction({
          tenantId,
          role,
          action: "update_governance_policy",
          outcome: "denied",
          reason: "invalid complianceTemplate value",
          errorCode: "API_INVALID_COMPLIANCE_TEMPLATE",
          details: {
            tenantId,
            complianceTemplate: requestedTemplateRaw,
          },
        });
        writeApiError(res, 400, {
          code: "API_INVALID_COMPLIANCE_TEMPLATE",
          message: "complianceTemplate must be one of baseline|strict|regulated",
          details: {
            receivedComplianceTemplate: requestedTemplateRaw,
          },
        });
        return;
      }
      const nextTemplate: ComplianceTemplateId = requestedTemplateRaw && isComplianceTemplateId(requestedTemplateRaw)
        ? requestedTemplateRaw
        : current.profile.id;
      const retentionPatchResult = parseRetentionPolicyPatch(parsed.retentionPolicy);
      if (retentionPatchResult.invalidFields.length > 0) {
        await auditOperatorAction({
          tenantId,
          role,
          action: "update_governance_policy",
          outcome: "denied",
          reason: "invalid retention policy patch",
          errorCode: "API_INVALID_RETENTION_POLICY",
          details: {
            tenantId,
            invalidFields: retentionPatchResult.invalidFields,
          },
        });
        writeApiError(res, 400, {
          code: "API_INVALID_RETENTION_POLICY",
          message: "retentionPolicy contains invalid day values",
          details: {
            invalidFields: retentionPatchResult.invalidFields,
          },
        });
        return;
      }
      const nextRetentionPolicy = applyRetentionPolicyPatch(
        current.profile.retentionPolicy,
        retentionPatchResult.patch,
      );
      const idempotencyKey =
        parseIdempotencyKey(parsed.idempotencyKey) ??
        parseIdempotencyKey(headerValue(req, "x-idempotency-key"));
      const expectedVersion = parseOptionalExpectedVersion(parsed.expectedVersion);
      const updatedBy = toOptionalString(headerValue(req, "x-operator-id")) ?? `role:${role}`;
      const update = await upsertTenantGovernancePolicy({
        tenantId,
        complianceTemplate: nextTemplate,
        retentionPolicy: nextRetentionPolicy,
        updatedBy,
        expectedVersion,
        idempotencyKey,
        metadata: parsed.metadata,
      });

      if (update.outcome === "version_conflict") {
        await auditOperatorAction({
          tenantId,
          role,
          action: "update_governance_policy",
          outcome: "denied",
          reason: "governance policy version conflict",
          errorCode: "API_GOVERNANCE_POLICY_VERSION_CONFLICT",
          details: {
            expectedVersion: update.expectedVersion,
            actualVersion: update.actualVersion,
          },
        });
        writeApiError(res, 409, {
          code: "API_GOVERNANCE_POLICY_VERSION_CONFLICT",
          message: "governance policy version conflict",
          details: {
            tenantId,
            expectedVersion: update.expectedVersion,
            actualVersion: update.actualVersion,
          },
        });
        return;
      }

      if (update.outcome === "idempotency_conflict") {
        await auditOperatorAction({
          tenantId,
          role,
          action: "update_governance_policy",
          outcome: "denied",
          reason: "governance policy idempotency conflict",
          errorCode: "API_GOVERNANCE_POLICY_IDEMPOTENCY_CONFLICT",
          details: {
            idempotencyKey: update.idempotencyKey,
            actualVersion: update.policy.version,
          },
        });
        writeApiError(res, 409, {
          code: "API_GOVERNANCE_POLICY_IDEMPOTENCY_CONFLICT",
          message: "governance policy idempotency conflict",
          details: {
            tenantId,
            idempotencyKey: update.idempotencyKey,
            actualVersion: update.policy.version,
          },
        });
        return;
      }

      await auditOperatorAction({
        tenantId,
        role,
        action: "update_governance_policy",
        outcome: "succeeded",
        reason: `governance policy ${update.outcome}`,
        operation: "set_governance_policy",
        details: {
          tenantId,
          outcome: update.outcome,
          version: update.policy.version,
          complianceTemplate: update.policy.complianceTemplate,
        },
      });

      const effective = await resolveEffectiveGovernancePolicyForTenant(tenantId);
      writeJson(res, update.outcome === "created" ? 201 : 200, {
        data: {
          tenant: {
            tenantId,
            requestTenantId: requestTenant.tenantId,
            source: requestTenant.source,
          },
          outcome: update.outcome,
          idempotencyKey,
          expectedVersion,
          policy: update.policy,
          effective,
        },
      });
      return;
    }

    if (url.pathname === "/v1/governance/audit/operator-actions" && req.method === "GET") {
      const role = assertOperatorRole(req, ["viewer", "operator", "admin"]);
      const limit = parseBoundedInt(url.searchParams.get("limit"), 50, 1, 500);
      const tenantScope = resolveGovernanceTenantScope({
        requestedTenantRaw: url.searchParams.get("tenantId"),
        requestTenant,
        role,
      });

      const actions = await listOperatorActions(
        limit,
        tenantScope.effectiveTenantId ? { tenantId: tenantScope.effectiveTenantId } : undefined,
      );
      writeJson(res, 200, {
        data: actions,
        total: actions.length,
        tenant: {
          tenantId: tenantScope.effectiveTenantId ?? "all",
          requestTenantId: requestTenant.tenantId,
          source: requestTenant.source,
          scope: tenantScope.scope,
        },
        role,
      });
      return;
    }

    if (url.pathname === "/v1/governance/audit/summary" && req.method === "GET") {
      const role = assertOperatorRole(req, ["viewer", "operator", "admin"]);
      const tenantScope = resolveGovernanceTenantScope({
        requestedTenantRaw: url.searchParams.get("tenantId"),
        requestTenant,
        role,
      });
      const operatorActionsLimit = parseBoundedInt(url.searchParams.get("operatorActionsLimit"), 200, 1, 1000);
      const approvalsLimit = parseBoundedInt(url.searchParams.get("approvalsLimit"), 200, 1, 1000);
      const sessionsLimit = parseBoundedInt(url.searchParams.get("sessionsLimit"), 200, 1, 1000);
      const bindingsLimit = parseBoundedInt(url.searchParams.get("bindingsLimit"), 200, 1, 1000);
      const governancePolicy =
        tenantScope.scope === "tenant"
          ? await resolveEffectiveGovernancePolicyForTenant(tenantScope.effectiveTenantId ?? requestTenant.tenantId)
          : null;
      const governanceOverridesPromise =
        tenantScope.scope === "all"
          ? listTenantGovernancePolicies({
              limit: parseBoundedInt(url.searchParams.get("governanceOverridesLimit"), 100, 1, 500),
            })
          : Promise.resolve([]);
      const [operatorActions, approvals, sessions, channelBindings, governanceOverrides] = await Promise.all([
        listOperatorActions(
          operatorActionsLimit,
          tenantScope.effectiveTenantId ? { tenantId: tenantScope.effectiveTenantId } : undefined,
        ),
        listApprovals({
          limit: approvalsLimit,
          tenantId: tenantScope.effectiveTenantId ?? undefined,
        }),
        listSessions(
          sessionsLimit,
          tenantScope.effectiveTenantId ? { tenantId: tenantScope.effectiveTenantId } : undefined,
        ),
        listChannelSessionBindings({
          limit: bindingsLimit,
          tenantId: tenantScope.effectiveTenantId ?? undefined,
        }),
        governanceOverridesPromise,
      ]);

      const operatorActionOutcomeCounts = operatorActions.reduce(
        (acc, item) => {
          acc[item.outcome] = (acc[item.outcome] ?? 0) + 1;
          return acc;
        },
        {
          succeeded: 0,
          failed: 0,
          denied: 0,
        } satisfies Record<"succeeded" | "failed" | "denied", number>,
      );
      const approvalStatusCounts = approvals.reduce(
        (acc, item) => {
          acc[item.status] = (acc[item.status] ?? 0) + 1;
          return acc;
        },
        {
          pending: 0,
          approved: 0,
          rejected: 0,
          timeout: 0,
        } satisfies Record<"pending" | "approved" | "rejected" | "timeout", number>,
      );
      const sessionModeCounts = sessions.reduce(
        (acc, item) => {
          acc[item.mode] = (acc[item.mode] ?? 0) + 1;
          return acc;
        },
        {
          live: 0,
          story: 0,
          ui: 0,
          multi: 0,
        } satisfies Record<"live" | "story" | "ui" | "multi", number>,
      );
      const sessionStatusCounts = sessions.reduce(
        (acc, item) => {
          acc[item.status] = (acc[item.status] ?? 0) + 1;
          return acc;
        },
        {
          active: 0,
          paused: 0,
          closed: 0,
        } satisfies Record<"active" | "paused" | "closed", number>,
      );
      const channelAdapterCounts = channelBindings.reduce(
        (acc, item) => {
          acc[item.adapterId] = (acc[item.adapterId] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      writeJson(res, 200, {
        data: {
          generatedAt: new Date().toISOString(),
          role,
          tenant: {
            tenantId: tenantScope.effectiveTenantId ?? "all",
            requestTenantId: requestTenant.tenantId,
            source: requestTenant.source,
            scope: tenantScope.scope,
          },
          compliance: {
            templateId: governancePolicy?.profile.id ?? complianceTemplateProfile.id,
            requestedTemplateId: governancePolicy?.profile.requestedTemplateId ?? complianceTemplateProfile.requestedTemplateId,
            fallbackApplied: governancePolicy?.profile.fallbackApplied ?? complianceTemplateProfile.fallbackApplied,
            controls: governancePolicy?.profile.controls ?? complianceTemplateProfile.controls,
            source: governancePolicy?.source ?? "template_default",
            overrideVersion: governancePolicy?.overrideVersion ?? null,
          },
          retentionPolicy: governancePolicy?.profile.retentionPolicy ?? complianceTemplateProfile.retentionPolicy,
          governanceOverrides: tenantScope.scope === "all"
            ? {
                total: governanceOverrides.length,
                recent: governanceOverrides.slice(0, 25),
              }
            : undefined,
          audit: {
            operatorActions: {
              total: operatorActions.length,
              outcomeCounts: operatorActionOutcomeCounts,
              latest: operatorActions[0] ?? null,
            },
            approvals: {
              total: approvals.length,
              statusCounts: approvalStatusCounts,
              latest: approvals[0] ?? null,
            },
            sessions: {
              total: sessions.length,
              modeCounts: sessionModeCounts,
              statusCounts: sessionStatusCounts,
              latest: sessions[0] ?? null,
            },
            channelBindings: {
              total: channelBindings.length,
              adapterCounts: channelAdapterCounts,
              latest: channelBindings[0] ?? null,
            },
          },
        },
      });
      return;
    }

    if (url.pathname === "/v1/sessions" && req.method === "GET") {
      const limit = parsePositiveInt(url.searchParams.get("limit"), 50);
      const sessions = await listSessions(limit, { tenantId: requestTenant.tenantId });
      writeJson(res, 200, {
        data: sessions,
        total: sessions.length,
        tenant: requestTenant,
      });
      return;
    }

    if (url.pathname === "/v1/sessions" && req.method === "POST") {
      const raw = await readBody(req);
      const parsed = parseJsonBody(raw) as { userId?: unknown; mode?: unknown };
      const userId =
        typeof parsed.userId === "string" && parsed.userId.length > 0 ? parsed.userId : "anonymous";
      const mode = sanitizeMode(parsed.mode);
      const session = await createSession({
        userId,
        mode,
        tenantId: requestTenant.tenantId,
      });
      writeJson(res, 201, {
        data: session,
        tenant: requestTenant,
      });
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
        pluginManifest?: unknown;
        metadata?: unknown;
      };

      const skillId = toOptionalString(parsed.skillId);
      const name = toOptionalString(parsed.name);
      const prompt = toOptionalString(parsed.prompt);
      if (!skillId || !name || !prompt) {
        await auditOperatorAction({
          tenantId: requestTenant.tenantId,
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

      const scope = parseSkillScope(parsed.scope);
      const trustLevel = sanitizeManagedTrustLevel(parsed.trustLevel);
      const publisher = toOptionalString(parsed.publisher);
      const checksum = toOptionalString(parsed.checksum);
      const pluginManifestResult = normalizeSkillPluginManifest({
        raw: parsed.pluginManifest,
        requireSignature: skillPluginRequireSignature,
        signingKeys: skillPluginSigningKeysConfig.keys,
        signingKeysConfigError: skillPluginSigningKeysConfig.configError,
        nowIso: new Date().toISOString(),
        skill: {
          skillId,
          name,
          prompt,
          scope,
          trustLevel,
          publisher,
          checksum,
        },
      });
      if (!pluginManifestResult.ok) {
        await auditOperatorAction({
          tenantId: requestTenant.tenantId,
          role,
          action: "skills_registry_upsert",
          outcome: "denied",
          reason: pluginManifestResult.message,
          errorCode: pluginManifestResult.code,
          details: pluginManifestResult.details,
        });
        writeApiError(res, 400, {
          code: pluginManifestResult.code,
          message: pluginManifestResult.message,
          details: pluginManifestResult.details,
        });
        return;
      }

      const upsertResult = await upsertManagedSkill({
        skillId,
        name,
        description: toOptionalString(parsed.description) ?? undefined,
        prompt,
        scope,
        enabled: parsed.enabled === undefined ? true : Boolean(parsed.enabled),
        trustLevel,
        pluginManifest: pluginManifestResult.manifest,
        expectedVersion: parseOptionalExpectedVersion(parsed.expectedVersion),
        updatedBy: toOptionalString(parsed.updatedBy) ?? role,
        publisher,
        checksum,
        metadata: parsed.metadata,
      });

      if (upsertResult.outcome === "version_conflict") {
        await auditOperatorAction({
          tenantId: requestTenant.tenantId,
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
        tenantId: requestTenant.tenantId,
        role,
        action: "skills_registry_upsert",
        outcome: "succeeded",
        reason: `managed skill ${upsertResult.outcome}`,
        details: {
          skillId: upsertResult.skill.skillId,
          version: upsertResult.skill.version,
          trustLevel: upsertResult.skill.trustLevel,
          pluginManifestStatus: upsertResult.skill.pluginManifest?.signing.status ?? "none",
          pluginPermissionCount: upsertResult.skill.pluginManifest?.permissions.length ?? 0,
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
          tenantId: requestTenant.tenantId,
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
          tenantId: requestTenant.tenantId,
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
        tenantId: requestTenant.tenantId,
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
          tenantId: requestTenant.tenantId,
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
          tenantId: requestTenant.tenantId,
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
        tenantId: requestTenant.tenantId,
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

    if (url.pathname === "/v1/channels/adapters" && req.method === "GET") {
      writeJson(res, 200, {
        data: configuredChannelAdapters.map((adapterId) => ({
          adapterId,
          enabled: true,
          source: "env",
        })),
        total: configuredChannelAdapters.length,
        allowCustomAdapters: allowCustomChannelAdapters,
      });
      return;
    }

    if (url.pathname === "/v1/channels/sessions/index" && req.method === "GET") {
      const limit = parseBoundedInt(url.searchParams.get("limit"), 200, 1, 500);
      const rawAdapterId = url.searchParams.get("adapterId") ?? url.searchParams.get("adapter");
      const adapterId =
        rawAdapterId === null
          ? undefined
          : sanitizeChannelAdapterId(rawAdapterId) ?? undefined;
      if (rawAdapterId !== null && !adapterId) {
        writeApiError(res, 400, {
          code: "API_CHANNEL_ADAPTER_REQUIRED",
          message: "adapterId must be a non-empty string",
        });
        return;
      }
      if (adapterId && !allowCustomChannelAdapters && !isConfiguredChannelAdapter(adapterId)) {
        writeApiError(res, 400, {
          code: "API_CHANNEL_ADAPTER_NOT_ENABLED",
          message: "Channel adapter is not enabled",
          details: {
            adapterId,
            enabledAdapters: configuredChannelAdapters,
            allowCustomAdapters: allowCustomChannelAdapters,
          },
        });
        return;
      }

      const index = await listChannelSessionBindingIndex({
        limit,
        tenantId: requestTenant.tenantId,
        adapterId,
        sessionId: url.searchParams.get("sessionId") ?? undefined,
        userId: url.searchParams.get("userId") ?? undefined,
        externalUserId: url.searchParams.get("externalUserId") ?? undefined,
      });
      writeJson(res, 200, {
        data: index,
        total: index.length,
        tenant: requestTenant,
        source: "channel_session_bindings",
        generatedAt: new Date().toISOString(),
      });
      return;
    }

    if (url.pathname === "/v1/channels/sessions" && req.method === "GET") {
      const limit = parseBoundedInt(url.searchParams.get("limit"), 200, 1, 500);
      const rawAdapterId = url.searchParams.get("adapterId") ?? url.searchParams.get("adapter");
      const adapterId =
        rawAdapterId === null
          ? undefined
          : sanitizeChannelAdapterId(rawAdapterId) ?? undefined;
      if (rawAdapterId !== null && !adapterId) {
        writeApiError(res, 400, {
          code: "API_CHANNEL_ADAPTER_REQUIRED",
          message: "adapterId must be a non-empty string",
        });
        return;
      }
      if (adapterId && !allowCustomChannelAdapters && !isConfiguredChannelAdapter(adapterId)) {
        writeApiError(res, 400, {
          code: "API_CHANNEL_ADAPTER_NOT_ENABLED",
          message: "Channel adapter is not enabled",
          details: {
            adapterId,
            enabledAdapters: configuredChannelAdapters,
            allowCustomAdapters: allowCustomChannelAdapters,
          },
        });
        return;
      }
      const bindings = await listChannelSessionBindings({
        limit,
        tenantId: requestTenant.tenantId,
        adapterId,
        sessionId: url.searchParams.get("sessionId") ?? undefined,
        userId: url.searchParams.get("userId") ?? undefined,
        externalUserId: url.searchParams.get("externalUserId") ?? undefined,
      });
      writeJson(res, 200, {
        data: bindings,
        total: bindings.length,
        tenant: requestTenant,
      });
      return;
    }

    if (url.pathname === "/v1/channels/sessions/resolve" && req.method === "GET") {
      const rawAdapterId = url.searchParams.get("adapterId") ?? url.searchParams.get("adapter");
      const rawExternalSessionId = url.searchParams.get("externalSessionId");
      const adapterId = sanitizeChannelAdapterId(rawAdapterId);
      const externalSessionId = toOptionalString(rawExternalSessionId);
      if (!adapterId || !externalSessionId) {
        writeApiError(res, 400, {
          code: "API_CHANNEL_RESOLVE_INVALID_INPUT",
          message: "adapterId and externalSessionId query params are required",
          details: {
            required: ["adapterId", "externalSessionId"],
          },
        });
        return;
      }
      if (!allowCustomChannelAdapters && !isConfiguredChannelAdapter(adapterId)) {
        writeApiError(res, 400, {
          code: "API_CHANNEL_ADAPTER_NOT_ENABLED",
          message: "Channel adapter is not enabled",
          details: {
            adapterId,
            enabledAdapters: configuredChannelAdapters,
            allowCustomAdapters: allowCustomChannelAdapters,
          },
        });
        return;
      }
      const binding = await getChannelSessionBinding({
        tenantId: requestTenant.tenantId,
        adapterId,
        externalSessionId,
      });
      if (!binding) {
        writeApiError(res, 404, {
          code: "API_CHANNEL_SESSION_NOT_FOUND",
          message: "Channel session binding not found",
          details: {
            adapterId,
            externalSessionId,
          },
        });
        return;
      }
      writeJson(res, 200, {
        data: binding,
        tenant: requestTenant,
      });
      return;
    }

    if (url.pathname === "/v1/channels/sessions/bind" && req.method === "POST") {
      const raw = await readBody(req);
      const parsed = parseJsonBody(raw) as {
        adapterId?: unknown;
        adapter?: unknown;
        externalSessionId?: unknown;
        externalUserId?: unknown;
        sessionId?: unknown;
        userId?: unknown;
        expectedVersion?: unknown;
        idempotencyKey?: unknown;
        metadata?: unknown;
      };

      const adapterId = sanitizeChannelAdapterId(parsed.adapterId ?? parsed.adapter);
      const externalSessionId = toOptionalString(parsed.externalSessionId);
      const externalUserId = toOptionalString(parsed.externalUserId);
      const requestedUserId = toOptionalString(parsed.userId) ?? externalUserId ?? "anonymous";
      const requestedSessionId = toOptionalString(parsed.sessionId);
      const idempotencyKey =
        parseIdempotencyKey(parsed.idempotencyKey) ??
        parseIdempotencyKey(headerValue(req, "x-idempotency-key"));

      if (!adapterId || !externalSessionId) {
        writeApiError(res, 400, {
          code: "API_CHANNEL_BIND_INVALID_INPUT",
          message: "adapterId and externalSessionId are required",
          details: {
            required: ["adapterId", "externalSessionId"],
          },
        });
        return;
      }
      if (!allowCustomChannelAdapters && !isConfiguredChannelAdapter(adapterId)) {
        writeApiError(res, 400, {
          code: "API_CHANNEL_ADAPTER_NOT_ENABLED",
          message: "Channel adapter is not enabled",
          details: {
            adapterId,
            enabledAdapters: configuredChannelAdapters,
            allowCustomAdapters: allowCustomChannelAdapters,
          },
        });
        return;
      }

      let resolvedSessionId = requestedSessionId;
      let autoCreatedSession: ChannelSessionBindingRecord["sessionId"] | null = null;
      if (!resolvedSessionId) {
        const created = await createSession({
          userId: requestedUserId,
          mode: "multi",
          tenantId: requestTenant.tenantId,
        });
        resolvedSessionId = created.sessionId;
        autoCreatedSession = created.sessionId;
      }

      const bindingResult = await upsertChannelSessionBinding({
        tenantId: requestTenant.tenantId,
        adapterId,
        externalSessionId,
        externalUserId,
        sessionId: resolvedSessionId,
        userId: requestedUserId,
        expectedVersion: parseOptionalExpectedVersion(parsed.expectedVersion),
        idempotencyKey,
        metadata: parsed.metadata,
      });

      if (bindingResult.outcome === "version_conflict") {
        writeApiError(res, 409, {
          code: "API_CHANNEL_SESSION_VERSION_CONFLICT",
          message: "Channel session binding version conflict",
          details: {
            adapterId,
            externalSessionId,
            expectedVersion: bindingResult.expectedVersion,
            actualVersion: bindingResult.actualVersion,
          },
        });
        return;
      }

      if (bindingResult.outcome === "idempotency_conflict") {
        writeApiError(res, 409, {
          code: "API_CHANNEL_SESSION_IDEMPOTENCY_CONFLICT",
          message: "Channel session binding idempotency conflict",
          details: {
            adapterId,
            externalSessionId,
            idempotencyKey: bindingResult.idempotencyKey,
            actualVersion: bindingResult.binding.version,
          },
        });
        return;
      }

      writeJson(res, bindingResult.outcome === "created" ? 201 : 200, {
        data: bindingResult.binding,
        meta: {
          outcome: bindingResult.outcome,
          idempotencyKey,
          autoCreatedSessionId: autoCreatedSession,
        },
        tenant: requestTenant,
      });
      return;
    }

    if (url.pathname === "/v1/approvals" && req.method === "GET") {
      const limit = parsePositiveInt(url.searchParams.get("limit"), 50);
      const sessionId = url.searchParams.get("sessionId") ?? undefined;
      const sweep = await runApprovalSlaSweep();
      const activeTasks = await getGatewayActiveTasks(200);
      const syncedFromTasks = await syncPendingApprovalsFromTasks(activeTasks, {
        tenantId: requestTenant.tenantId,
      });
      const approvals = await listApprovals({
        limit,
        sessionId,
        tenantId: requestTenant.tenantId,
      });
      writeJson(res, 200, {
        data: approvals,
        total: approvals.length,
        tenant: requestTenant,
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
        tenantId: requestTenant.tenantId,
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
      const syncedFromTasks = await syncPendingApprovalsFromTasks(activeTasks, {
        tenantId: requestTenant.tenantId,
      });
      const [approvals, operatorActions] = await Promise.all([
        listApprovals({ limit: 100, tenantId: requestTenant.tenantId }),
        listOperatorActions(50, { tenantId: requestTenant.tenantId }),
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
      const damageControl = buildDamageControlSummary(recentEvents, services);

      writeJson(res, 200, {
        data: {
          generatedAt: new Date().toISOString(),
          role,
          tenant: requestTenant,
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
            tenantId: requestTenant.tenantId,
          },
          startupFailures,
          turnTruncation,
          turnDelete,
          damageControl,
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
            tenantId: requestTenant.tenantId,
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
            tenantId: requestTenant.tenantId,
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
          tenantId: requestTenant.tenantId,
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
            tenantId: requestTenant.tenantId,
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
            tenantId: requestTenant.tenantId,
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
          tenantId: requestTenant.tenantId,
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
            tenantId: requestTenant.tenantId,
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
            tenantId: requestTenant.tenantId,
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
            tenantId: requestTenant.tenantId,
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
            tenantId: requestTenant.tenantId,
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
          tenantId: requestTenant.tenantId,
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
        tenantId: requestTenant.tenantId,
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

