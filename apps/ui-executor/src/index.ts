import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { applyRuntimeProfile, RollingMetrics } from "./contracts/index.js";
import {
  clearUiExecutorRuntimeControlPlaneOverride,
  getUiExecutorRuntimeConfig,
  getUiExecutorRuntimeConfigStoreStatus,
  setUiExecutorRuntimeControlPlaneOverride,
  type DeviceNodeDescriptor,
  type ExecutorConfig,
} from "./runtime-config-store.js";
import {
  evaluateUiExecutorSandboxRequest,
  sandboxPolicyRuntimeSnapshot,
  type UiExecutorSandboxEvaluation,
  type UiExecutorSandboxPolicy,
} from "./sandbox-policy.js";
import {
  cancelBrowserJob,
  getBrowserJob,
  getBrowserJobListSnapshot,
  getBrowserJobRuntimeSnapshot,
  resumeBrowserJob,
  setBrowserJobRunner,
  setBrowserJobSessionReleaser,
  submitBrowserJob,
  type BrowserJobExecutionResult,
  type BrowserJobSessionRecord,
} from "./browser-jobs.js";
import {
  buildGroundingRefRecoveryPlan,
  listGroundingRefIds,
  normalizeGroundingRefMap,
  resolveGroundingObservation,
  resolveGroundingTarget,
  type UiGroundingRefMap,
} from "./grounding.js";

type ActionType = "navigate" | "click" | "type" | "scroll" | "hotkey" | "wait" | "verify";

type UiAction = {
  id: string;
  type: ActionType;
  target: string;
  text?: string | null;
  coordinates?: { x: number; y: number } | null;
};

type ExecuteRequest = {
  actions: UiAction[];
  context?: {
    goal?: string;
    url?: string;
    summary?: string;
    screenshotRef?: string;
    domSnapshot?: string;
    accessibilityTree?: string;
    markHints?: string[];
    refMap?: UiGroundingRefMap;
    deviceNodeId?: string;
    cursor?: { x: number; y: number };
  };
  session?: {
    key?: string | null;
    mode?: "ephemeral" | "resumable";
    persistAfterRun?: boolean;
    reuseCount?: number;
  };
};

type BrowserJobSubmitRequest = ExecuteRequest & {
  sessionId?: string;
  runId?: string;
  taskId?: string;
  options?: {
    label?: string | null;
    reason?: string | null;
    checkpointEverySteps?: number | null;
    pauseAfterStep?: number | null;
  };
};

type TraceStep = {
  index: number;
  actionId: string;
  actionType: ActionType;
  target: string;
  status: "ok" | "retry" | "failed";
  screenshotRef: string;
  notes: string;
  observation?: string | null;
};

type ExecuteResponse = {
  trace: TraceStep[];
  finalStatus: "completed" | "failed";
  retries: number;
  executor: string;
  adapterMode: "remote_http";
  adapterNotes: string[];
  deviceNode: DeviceNodeDescriptor | null;
  sandbox: {
    mode: UiExecutorSandboxPolicy["mode"];
    decision: UiExecutorSandboxEvaluation["decision"];
    violations: string[];
    warnings: string[];
    setupMarkerStatus: UiExecutorSandboxEvaluation["setupMarkerStatus"];
  };
  grounding: {
    refMapCount: number;
    actionableRefIds: string[];
    staleRefTargets: string[];
    healedRefTargets: string[];
    recoveryHint: string | null;
  };
  verification: {
    state: "verified" | "partially_verified" | "unverified";
    requested: boolean;
    requestedSteps: number;
    completedVerifySteps: number;
    summary: string;
  };
  session?: Partial<BrowserJobSessionRecord> | null;
};

type PlaywrightPageHandle = {
  goto: (url: string, options?: { waitUntil?: string; timeout?: number }) => Promise<void>;
  click: (selector: string, options?: { timeout?: number }) => Promise<void>;
  fill: (selector: string, value: string, options?: { timeout?: number }) => Promise<void>;
  press: (selector: string, key: string, options?: { timeout?: number }) => Promise<void>;
  waitForSelector: (
    selector: string,
    options?: { timeout?: number; state?: "attached" | "detached" | "visible" | "hidden" },
  ) => Promise<void>;
  evaluate: {
    <TReturn>(callback: () => TReturn): Promise<TReturn>;
    <TReturn, TArg>(callback: (arg: TArg) => TReturn, arg: TArg): Promise<TReturn>;
  };
  waitForTimeout: (ms: number) => Promise<void>;
  url: () => string;
};

type PlaywrightBrowserHandle = {
  newPage: () => Promise<PlaywrightPageHandle>;
  close: () => Promise<void>;
};

type PersistentPlaywrightSession = {
  key: string;
  browser: PlaywrightBrowserHandle;
  page: PlaywrightPageHandle;
  createdAt: string;
  updatedAt: string;
  reuseCount: number;
  lastPageUrl: string | null;
};

type DeviceNodeResolutionResult = {
  selectedNode: DeviceNodeDescriptor | null;
  errorResponse: Record<string, unknown> | null;
  errorStatusCode: number | null;
};


type AnalyticsTarget = "disabled" | "cloud_monitoring" | "bigquery";

type RuntimeAnalyticsSnapshot = {
  enabled: boolean;
  requestedEnabled: boolean;
  reason: string;
  metricsTarget: AnalyticsTarget;
  eventsTarget: AnalyticsTarget;
  splitValid: boolean;
  bigQueryConfigValid: boolean;
  sampleRate: number;
  bigQueryDataset: string | null;
  bigQueryTable: string | null;
};

const persistentPlaywrightSessions = new Map<string, PersistentPlaywrightSession>();

function nowIso(): string {
  return new Date().toISOString();
}

async function releasePersistentPlaywrightSession(sessionKey: string, reason = "released"): Promise<boolean> {
  const entry = persistentPlaywrightSessions.get(sessionKey);
  if (!entry) {
    return false;
  }
  persistentPlaywrightSessions.delete(sessionKey);
  try {
    await entry.browser.close();
  } catch {
    // Best-effort cleanup only.
  }
  return true;
}

async function sweepPersistentPlaywrightSessions(ttlMs: number): Promise<void> {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || persistentPlaywrightSessions.size === 0) {
    return;
  }
  const nowMs = Date.now();
  for (const [sessionKey, entry] of persistentPlaywrightSessions.entries()) {
    const updatedAtMs = Date.parse(entry.updatedAt);
    if (!Number.isFinite(updatedAtMs)) {
      await releasePersistentPlaywrightSession(sessionKey, "stale");
      continue;
    }
    if (nowMs - updatedAtMs > ttlMs) {
      await releasePersistentPlaywrightSession(sessionKey, "expired");
    }
  }
}

function persistentPlaywrightSessionSnapshot(): Record<string, unknown> {
  return {
    enabled: currentConfig().persistentBrowserSessions,
    active: persistentPlaywrightSessions.size,
    sessionKeys: Array.from(persistentPlaywrightSessions.keys()),
  };
}


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

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
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

function parseAnalyticsTarget(value: string | undefined, fallback: AnalyticsTarget): AnalyticsTarget {
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

function createRuntimeAnalyticsSnapshot(): RuntimeAnalyticsSnapshot {
  const requestedEnabled = parseBooleanEnv(process.env.ANALYTICS_EXPORT_ENABLED, false);
  const metricsTarget = parseAnalyticsTarget(process.env.ANALYTICS_EXPORT_METRICS_TARGET, "cloud_monitoring");
  const eventsTarget = parseAnalyticsTarget(process.env.ANALYTICS_EXPORT_EVENTS_TARGET, "bigquery");
  const sampleRate = parseSampleRate(process.env.ANALYTICS_EXPORT_SAMPLE_RATE);
  const bigQueryDataset =
    typeof process.env.ANALYTICS_BIGQUERY_DATASET === "string" && process.env.ANALYTICS_BIGQUERY_DATASET.trim()
      ? process.env.ANALYTICS_BIGQUERY_DATASET.trim()
      : null;
  const bigQueryTable =
    typeof process.env.ANALYTICS_BIGQUERY_TABLE === "string" && process.env.ANALYTICS_BIGQUERY_TABLE.trim()
      ? process.env.ANALYTICS_BIGQUERY_TABLE.trim()
      : null;
  const splitValid = metricsTarget === "cloud_monitoring" && eventsTarget === "bigquery";
  const bigQueryConfigValid = eventsTarget !== "bigquery" || (bigQueryDataset !== null && bigQueryTable !== null);
  const enabled = requestedEnabled && splitValid && bigQueryConfigValid;

  let reason = "ANALYTICS_EXPORT_ENABLED=false";
  if (requestedEnabled) {
    if (!splitValid) {
      reason = "ANALYTICS_SPLIT_INVALID";
    } else if (!bigQueryConfigValid) {
      reason = "ANALYTICS_BIGQUERY_CONFIG_INVALID";
    } else {
      reason = "enabled";
    }
  }

  return {
    enabled,
    requestedEnabled,
    reason,
    metricsTarget,
    eventsTarget,
    splitValid,
    bigQueryConfigValid,
    sampleRate,
    bigQueryDataset,
    bigQueryTable,
  };
}

const serviceName = "ui-executor";
const runtimeProfile = applyRuntimeProfile(serviceName);
const serviceVersion = process.env.UI_EXECUTOR_VERSION ?? process.env.SERVICE_VERSION ?? "0.1.0";
const startedAtMs = Date.now();
let draining = false;
let lastWarmupAt: string | null = new Date().toISOString();
let lastDrainAt: string | null = null;
const runtimeAnalytics = createRuntimeAnalyticsSnapshot();
const metrics = new RollingMetrics({
  maxSamplesPerBucket: parsePositiveInt(process.env.UI_EXECUTOR_METRICS_MAX_SAMPLES, 2000),
});

function currentConfig(): ExecutorConfig {
  return getUiExecutorRuntimeConfig({
    env: process.env,
    cwd: process.cwd(),
  });
}

function runtimeConfigPayload(): Record<string, unknown> {
  const config = currentConfig();
  return {
    sourceKind: config.sourceKind,
    defaultNavigationUrl: config.defaultNavigationUrl,
    strictPlaywright: config.strictPlaywright,
    simulateIfUnavailable: config.simulateIfUnavailable,
    forceSimulation: config.forceSimulation,
    actionTimeoutMs: config.actionTimeoutMs,
    persistentBrowserSessions: config.persistentBrowserSessions,
    browserSessionTtlMs: config.browserSessionTtlMs,
    defaultDeviceNodeId: config.defaultDeviceNodeId,
    registeredDeviceNodes: config.deviceNodes.size,
    sandbox: sandboxPolicyRuntimeSnapshot(config.sandboxPolicy),
  };
}

function runtimeState(): Record<string, unknown> {
  const config = currentConfig();
  const store = getUiExecutorRuntimeConfigStoreStatus({
    env: process.env,
    cwd: process.cwd(),
  });
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
    configSourceKind: config.sourceKind,
    controlPlaneOverride: store.controlPlaneOverride,
    analytics: runtimeAnalytics,
    sandbox: sandboxPolicyRuntimeSnapshot(config.sandboxPolicy),
    browserWorkers: getBrowserJobRuntimeSnapshot(),
    browserSessions: persistentPlaywrightSessionSnapshot(),
    metrics: {
      totalCount: summary.totalCount,
      totalErrors: summary.totalErrors,
      errorRatePct: summary.errorRatePct,
      p95Ms: summary.latencyMs.p95,
    },
  };
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeOperationPath(pathname: string): string {
  if (pathname === "/execute") {
    return "/execute";
  }
  if (pathname === "/browser-jobs") {
    return "/browser-jobs";
  }
  if (parseBrowserJobDetailPath(pathname)) {
    return "/browser-jobs/:jobId";
  }
  if (parseBrowserJobActionPath(pathname)) {
    return "/browser-jobs/:jobId/action";
  }
  return pathname;
}

function toNonEmptyString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function parseJsonObjectBody(raw: string): Record<string, unknown> {
  if (raw.trim().length === 0) {
    return {};
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("ui-executor control-plane override body must be a JSON object");
  }
  return parsed;
}

function normalizeAction(raw: unknown): UiAction | null {
  if (!isRecord(raw)) {
    return null;
  }
  const actionType = toNonEmptyString(raw.type, "") as ActionType;
  if (!["navigate", "click", "type", "scroll", "hotkey", "wait", "verify"].includes(actionType)) {
    return null;
  }
  const coordinates =
    isRecord(raw.coordinates) &&
    typeof raw.coordinates.x === "number" &&
    typeof raw.coordinates.y === "number"
      ? { x: raw.coordinates.x, y: raw.coordinates.y }
      : null;

  return {
    id: toNonEmptyString(raw.id, randomUUID()),
    type: actionType,
    target: toNonEmptyString(raw.target, "unknown-target"),
    text: typeof raw.text === "string" ? raw.text : null,
    coordinates,
  };
}

function normalizeRequest(input: unknown): ExecuteRequest {
  const parsed = isRecord(input) ? input : {};
  const actionsRaw = Array.isArray(parsed.actions) ? parsed.actions : [];
  const actions: UiAction[] = [];
  for (const item of actionsRaw) {
    const normalized = normalizeAction(item);
    if (normalized) {
      actions.push(normalized);
    }
  }

  const contextRaw = isRecord(parsed.context) ? parsed.context : {};
  const context = {
    goal: toNonEmptyString(contextRaw.goal, ""),
    url: toNonEmptyString(contextRaw.url, ""),
    summary: toOptionalString(contextRaw.summary ?? contextRaw.caseSummary ?? contextRaw.crmSummary) ?? undefined,
    screenshotRef: toNonEmptyString(contextRaw.screenshotRef, ""),
    domSnapshot: toNonEmptyString(contextRaw.domSnapshot, ""),
    accessibilityTree: toNonEmptyString(contextRaw.accessibilityTree, ""),
    markHints: Array.isArray(contextRaw.markHints)
      ? contextRaw.markHints.map((item) => toNonEmptyString(item, "")).filter((item) => item.length > 0)
      : [],
    refMap: normalizeGroundingRefMap(contextRaw.refMap ?? contextRaw.groundingRefs),
    deviceNodeId: toNonEmptyString(contextRaw.deviceNodeId, "").toLowerCase(),
    cursor:
      isRecord(contextRaw.cursor) && typeof contextRaw.cursor.x === "number" && typeof contextRaw.cursor.y === "number"
        ? { x: contextRaw.cursor.x, y: contextRaw.cursor.y }
        : undefined,
  };

  return {
    actions,
    context,
  };
}

function normalizeBrowserJobSubmitRequest(input: unknown): BrowserJobSubmitRequest {
  const request = normalizeRequest(input);
  const parsed = isRecord(input) ? input : {};
  const optionsRaw = isRecord(parsed.options) ? parsed.options : {};
  return {
    ...request,
    sessionId: toOptionalString(parsed.sessionId) ?? undefined,
    runId: toOptionalString(parsed.runId) ?? undefined,
    taskId: toOptionalString(parsed.taskId) ?? undefined,
    options: {
      label: toOptionalString(optionsRaw.label),
      reason: toOptionalString(optionsRaw.reason),
      checkpointEverySteps: toOptionalPositiveInt(optionsRaw.checkpointEverySteps),
      pauseAfterStep: toOptionalPositiveInt(optionsRaw.pauseAfterStep),
    },
  };
}

function sandboxResponse(evaluation: UiExecutorSandboxEvaluation): ExecuteResponse["sandbox"] {
  return {
    mode: evaluation.mode,
    decision: evaluation.decision,
    violations: [...evaluation.violations],
    warnings: [...evaluation.warnings],
    setupMarkerStatus: evaluation.setupMarkerStatus,
  };
}

function parseBrowserJobActionPath(pathname: string): { jobId: string; action: "resume" | "cancel" } | null {
  const match = pathname.match(/^\/browser-jobs\/([^/]+)\/(resume|cancel)$/);
  if (!match) {
    return null;
  }
  const jobId = decodeURIComponent(match[1] ?? "").trim();
  const action = match[2];
  if (!jobId || (action !== "resume" && action !== "cancel")) {
    return null;
  }
  return {
    jobId,
    action,
  };
}

function parseBrowserJobDetailPath(pathname: string): string | null {
  const match = pathname.match(/^\/browser-jobs\/([^/]+)$/);
  if (!match) {
    return null;
  }
  const jobId = decodeURIComponent(match[1] ?? "").trim();
  return jobId.length > 0 ? jobId : null;
}

function resolveSelectedDeviceNode(
  config: ExecutorConfig,
  request: ExecuteRequest,
  headerNodeId: string,
): DeviceNodeResolutionResult {
  const requestedNodeId = headerNodeId || toNonEmptyString(request.context?.deviceNodeId, "").toLowerCase();
  const hasNodeRegistry = config.deviceNodes.size > 0;

  let selectedNode: DeviceNodeDescriptor | null = null;
  if (hasNodeRegistry) {
    if (requestedNodeId.length > 0) {
      selectedNode = config.deviceNodes.get(requestedNodeId) ?? null;
      if (!selectedNode) {
        return {
          selectedNode: null,
          errorStatusCode: 404,
          errorResponse: {
            error: "requested device node is not registered",
            nodeId: requestedNodeId,
          },
        };
      }
    } else if (config.defaultDeviceNodeId) {
      selectedNode = config.deviceNodes.get(config.defaultDeviceNodeId) ?? null;
    } else {
      selectedNode = Array.from(config.deviceNodes.values()).find((node) => node.status !== "offline") ?? null;
    }
  }

  if (selectedNode && selectedNode.status === "offline") {
    return {
      selectedNode: null,
      errorStatusCode: 409,
      errorResponse: {
        error: "requested device node is offline",
        nodeId: selectedNode.nodeId,
        status: selectedNode.status,
      },
    };
  }

  return {
    selectedNode,
    errorStatusCode: null,
    errorResponse: null,
  };
}

function simulateExecution(
  request: ExecuteRequest,
  note: string,
  deviceNode: DeviceNodeDescriptor | null,
  sandbox: UiExecutorSandboxEvaluation,
  sessionLocals: {
    requestedSessionKey: string | null;
    persistenceRequested: boolean;
    persistenceEnabled: boolean;
    persistAfterRun: boolean;
  },
): ExecuteResponse {
  const screenshotSeed = request.context?.screenshotRef || `ui://executor/${Date.now()}`;
  const trace: TraceStep[] = request.actions.map((action, idx) => ({
    index: idx + 1,
    actionId: action.id,
    actionType: action.type,
    target: action.target,
    status: "ok",
    screenshotRef: `${screenshotSeed}/sim-step-${idx + 1}.png`,
    notes: "Simulated execution step.",
  }));
  const finalStatus = "completed" as ExecuteResponse["finalStatus"];
  const { requestedSessionKey, persistenceRequested, persistenceEnabled, persistAfterRun } = sessionLocals;
  // Mirror the real-Playwright session shape (lines ~1373-1389) so the
  // browser-job session record reaches a deterministic terminal state in
  // simulation. The simulation lane never holds a real persistent session;
  // the explicit `notes` marker plus the simulation-mode adapterNotes let
  // downstream consumers (inferExecutionMode, judge artifacts) detect that
  // distinction without schema drift.
  const sessionStatus: BrowserJobSessionRecord["status"] = !persistenceEnabled
    ? "ephemeral"
    : !persistAfterRun || finalStatus === "failed"
      ? finalStatus === "failed"
        ? "closed"
        : "released"
      : "ready";
  return {
    trace,
    finalStatus,
    retries: 0,
    executor: "ui-executor-service",
    adapterMode: "remote_http",
    adapterNotes: [
      note,
      sandbox.decision === "audit"
        ? `Sandbox audit noted ${sandbox.violations.length} findings`
        : `Sandbox policy ${sandbox.mode}`,
    ],
    deviceNode,
    sandbox: sandboxResponse(sandbox),
    grounding: groundingResponse(request),
    verification: buildExecutionVerificationSummary(request.actions, trace, finalStatus),
    session: {
      mode: persistenceRequested ? "resumable" : "ephemeral",
      key: persistenceEnabled ? requestedSessionKey : null,
      persistenceRequested,
      persistenceEnabled,
      status: sessionStatus,
      reuseCount: 0,
      lastPageUrl: null,
      notes: ["Simulated browser session: no real persistent session was held."],
    },
  };
}

function buildExecutionVerificationSummary(
  actions: UiAction[],
  trace: TraceStep[],
  finalStatus: ExecuteResponse["finalStatus"],
): ExecuteResponse["verification"] {
  const requestedSteps = actions.filter((action) => action.type === "verify").length;
  const completedVerifySteps = trace.filter((step) => step.actionType === "verify" && step.status === "ok").length;
  const completedSteps = trace.filter((step) => step.status === "ok").length;
  const requested = requestedSteps > 0;
  const state: ExecuteResponse["verification"]["state"] =
    finalStatus === "completed" && requested && completedVerifySteps >= requestedSteps
      ? "verified"
      : completedVerifySteps > 0 || completedSteps > 0
        ? "partially_verified"
        : "unverified";

  let summary: string;
  if (state === "verified") {
    summary = `Executor observed ${completedVerifySteps} successful verification step${
      completedVerifySteps === 1 ? "" : "s"
    }.`;
  } else if (requested) {
    summary =
      finalStatus === "completed"
        ? `Action steps completed, but only ${completedVerifySteps} of ${requestedSteps} verification step${
            requestedSteps === 1 ? "" : "s"
          } succeeded.`
        : `Execution ended before all ${requestedSteps} verification step${requestedSteps === 1 ? "" : "s"} could succeed.`;
  } else if (completedSteps > 0) {
    summary = "Action steps completed without an explicit post-action verification step.";
  } else {
    summary = "Execution did not reach a verifiable UI outcome.";
  }

  return {
    state,
    requested,
    requestedSteps,
    completedVerifySteps,
    summary,
  };
}

function missingGroundingRefError(target: string): Error {
  return new Error(`Need stronger grounding. The planner referenced ${target}, but no matching refMap entry was provided.`);
}

function staleGroundingRefError(refId: string): Error {
  return new Error(`Refresh snapshot and rerun. Grounding ref ${refId} is stale on the current page.`);
}

function isVirtualVerifyTarget(target: string): boolean {
  const normalized = target.trim().toLowerCase();
  return normalized === "initial-screen" || normalized === "post-action-screen";
}

async function assertResolvedActionTarget(
  page: PlaywrightPageHandle,
  selector: string,
  refId: string | null,
): Promise<void> {
  if (!refId) {
    return;
  }
  const visible = await page.evaluate((selectorValue) => {
    const element = document.querySelector(selectorValue);
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }, selector);
  if (!visible) {
    throw staleGroundingRefError(refId);
  }
}

function buildGroundingHealingObservation(refId: string, selector: string): string {
  return `grounding-healed ref:${refId} selector:${selector}`;
}

function appendGroundingHealingObservation(observation: string | null, refId: string, selector: string): string {
  const healingObservation = buildGroundingHealingObservation(refId, selector);
  return observation && observation.trim().length > 0 ? `${healingObservation}; ${observation}` : healingObservation;
}

async function recoverGroundingRefSelector(
  page: PlaywrightPageHandle,
  target: string,
  context: ExecuteRequest["context"],
): Promise<{ refId: string; selector: string } | null> {
  const recoveryPlan = buildGroundingRefRecoveryPlan(target, context);
  if (!recoveryPlan) {
    return null;
  }

  for (const selector of recoveryPlan.selectors) {
    if (typeof selector !== "string" || selector.trim().length === 0) {
      continue;
    }

    try {
      await page.waitForSelector(selector, {
        timeout: 250,
        state: "visible",
      });
      return {
        refId: recoveryPlan.refId,
        selector,
      };
    } catch {
      // Try the next candidate selector.
    }
  }

  return await page.evaluate((plan) => {
    const toLower = (value: string | null | undefined): string => (typeof value === "string" ? value.trim().toLowerCase() : "");
    const collapse = (value: string | null | undefined): string =>
      typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
    const visible = (element: Element | null): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const kindMatches = (element: HTMLElement, kind: string): boolean => {
      const tagName = element.tagName.toLowerCase();
      const role = toLower(element.getAttribute("role"));
      if (kind === "field") {
        return tagName === "input" || tagName === "textarea" || tagName === "select";
      }
      if (kind === "submit") {
        return (
          (tagName === "button" && toLower((element as HTMLButtonElement).type || element.getAttribute("type")) === "submit") ||
          (tagName === "input" && toLower((element as HTMLInputElement).type || element.getAttribute("type")) === "submit")
        );
      }
      if (kind === "button") {
        return tagName === "button" || role === "button" || (tagName === "input" && toLower(element.getAttribute("type")) === "button");
      }
      if (kind === "table") {
        return tagName === "table" || role === "table" || role === "grid";
      }
      if (kind === "dialog") {
        return tagName === "dialog" || role === "dialog";
      }
      if (kind === "heading") {
        return /^h[1-6]$/.test(tagName) || role === "heading";
      }
      return true;
    };
    const collectTexts = (element: HTMLElement): string[] => {
      const texts = new Set<string>();
      const add = (value: string | null | undefined) => {
        const normalized = collapse(value);
        if (normalized.length > 0) {
          texts.add(normalized);
        }
      };
      add(element.textContent);
      add(element.getAttribute("aria-label"));
      add(element.getAttribute("placeholder"));
      const labelList = "labels" in element ? (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).labels : null;
      if (labelList) {
        for (const label of Array.from(labelList)) {
          add(label?.textContent);
        }
      }
      return Array.from(texts);
    };
    const cssEscape = (value: string): string => {
      const escapeFn = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape : null;
      if (escapeFn) {
        return escapeFn(value);
      }
      return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    };
    const attributeEscape = (value: string): string => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const buildSelector = (element: HTMLElement): string | null => {
      const id = collapse(element.id);
      if (id.length > 0) {
        return `#${cssEscape(id)}`;
      }
      const tagName = element.tagName.toLowerCase();
      const name = collapse(element.getAttribute("name"));
      if (name.length > 0) {
        return `${tagName}[name="${attributeEscape(name)}"]`;
      }
      const ariaLabel = collapse(element.getAttribute("aria-label"));
      if (ariaLabel.length > 0) {
        return `${tagName}[aria-label="${attributeEscape(ariaLabel)}"]`;
      }
      const placeholder = collapse(element.getAttribute("placeholder"));
      if (placeholder.length > 0 && (tagName === "input" || tagName === "textarea")) {
        return `${tagName}[placeholder="${attributeEscape(placeholder)}"]`;
      }
      if (tagName === "button" && toLower((element as HTMLButtonElement).type || element.getAttribute("type")) === "submit") {
        return `button[type="submit"]`;
      }
      if (tagName === "input" && toLower((element as HTMLInputElement).type || element.getAttribute("type")) === "submit") {
        return `input[type="submit"]`;
      }
      return null;
    };

    for (const selector of plan.selectors) {
      if (typeof selector !== "string" || selector.trim().length === 0) {
        continue;
      }
      let candidate: Element | null = null;
      try {
        candidate = document.querySelector(selector);
      } catch {
        candidate = null;
      }
      if (visible(candidate) && kindMatches(candidate, plan.kind)) {
        const selectorValue = buildSelector(candidate);
        if (selectorValue) {
          return {
            refId: plan.refId,
            selector: selectorValue,
          };
        }
      }
    }

    const exactTexts = new Set((plan.exactTexts ?? []).map((item) => collapse(item).toLowerCase()).filter((item) => item.length > 0));
    const tokens = new Set((plan.tokens ?? []).map((item) => toLower(item)).filter((item) => item.length > 0));
    let bestScore = 0;
    let bestSelector: string | null = null;

    for (const node of Array.from(document.querySelectorAll("input,textarea,select,button,[role='button'],[role='dialog'],dialog,table,[role='table'],[role='grid'],h1,h2,h3,h4,h5,h6,[role='heading']"))) {
      if (!visible(node) || !kindMatches(node, plan.kind)) {
        continue;
      }
      const selectorValue = buildSelector(node);
      if (!selectorValue) {
        continue;
      }
      const texts = collectTexts(node).map((item) => item.toLowerCase());
      const id = toLower(node.id);
      const name = toLower(node.getAttribute("name"));
      const scoreTokens = [id, name, ...texts];
      let score = 0;

      for (const token of tokens) {
        if (token.length === 0) {
          continue;
        }
        if (id === token || name === token) {
          score += 12;
          continue;
        }
        if (scoreTokens.some((candidate) => candidate.includes(token))) {
          score += 4;
        }
      }

      for (const text of exactTexts) {
        if (text.length === 0) {
          continue;
        }
        if (texts.includes(text)) {
          score += 10;
          continue;
        }
        if (texts.some((candidate) => candidate.includes(text) || text.includes(candidate))) {
          score += 5;
        }
      }

      if (plan.kind === "submit" && selectorValue.includes('type="submit"')) {
        score += 6;
      }
      if (score > bestScore) {
        bestScore = score;
        bestSelector = selectorValue;
      }
    }

    if (bestScore <= 0 || !bestSelector) {
      return null;
    }

    return {
      refId: plan.refId,
      selector: bestSelector,
    };
  }, recoveryPlan);
}

async function executeRequestWithConfiguredAdapter(params: {
  config: ExecutorConfig;
  request: ExecuteRequest;
  selectedNode: DeviceNodeDescriptor | null;
  sandbox: UiExecutorSandboxEvaluation;
}): Promise<ExecuteResponse> {
  // Pre-compute persistent-session locals so both the real-Playwright path
  // (executeWithPlaywright) and the simulation fallback (simulateExecution)
  // see the same persistence intent. These mirror the locals computed
  // inside executeWithPlaywright at lines ~1108-1112.
  const requestedSessionKey =
    typeof params.request.session?.key === "string" && params.request.session.key.trim().length > 0
      ? params.request.session.key.trim()
      : null;
  const persistenceRequested =
    params.request.session?.mode === "resumable" && requestedSessionKey !== null;
  const persistenceEnabled = params.config.persistentBrowserSessions && persistenceRequested;
  const persistAfterRun = persistenceEnabled && params.request.session?.persistAfterRun === true;
  const sessionLocals = {
    requestedSessionKey,
    persistenceRequested,
    persistenceEnabled,
    persistAfterRun,
  };

  if (params.config.forceSimulation) {
    return simulateExecution(
      params.request,
      "Forced simulation mode (UI_EXECUTOR_FORCE_SIMULATION=true)",
      params.selectedNode,
      params.sandbox,
      sessionLocals,
    );
  }

  const played = await executeWithPlaywright(params.request, params.selectedNode, params.sandbox);
  if (played) {
    return played;
  }

  if (params.config.strictPlaywright && !params.config.simulateIfUnavailable) {
    throw new Error("Playwright is unavailable in ui-executor environment. Install playwright or disable strict mode.");
  }

  return simulateExecution(
    params.request,
    "Playwright unavailable in ui-executor, simulation fallback used",
    params.selectedNode,
    params.sandbox,
    sessionLocals,
  );
}

function detectVerifyObservationKind(
  target: string,
): "table" | "button" | "heading" | "submit-disabled" | "submit-enabled" | null {
  if (!target.startsWith("css:")) {
    return null;
  }
  const selector = target.slice(4).toLowerCase();
  if (
    selector.includes('button[type="submit"]:disabled') ||
    selector.includes('input[type="submit"]:disabled')
  ) {
    return "submit-disabled";
  }
  if (
    selector.includes('button[type="submit"]:not(:disabled)') ||
    selector.includes('input[type="submit"]:not(:disabled)')
  ) {
    return "submit-enabled";
  }
  if (selector.includes("table") || selector.includes('[role="table"]') || selector.includes('[role="grid"]')) {
    return "table";
  }
  if (selector.includes("button") || selector.includes('[role="button"]')) {
    return "button";
  }
  if (selector.includes("h1") || selector.includes("h2") || selector.includes('[role="heading"]')) {
    return "heading";
  }
  return null;
}

async function collectVerifyObservation(
  page: {
    evaluate: <TReturn, TArg>(callback: (arg: TArg) => TReturn, arg: TArg) => Promise<TReturn>;
  },
  target: string,
): Promise<string | null> {
  const kind = detectVerifyObservationKind(target);
  if (!kind) {
    return null;
  }
  const selector = target.slice(4);
  try {
    return await page.evaluate(
      ({ selector: selectorValue, kind: observationKind }) => {
        const visibleElements = Array.from(document.querySelectorAll(selectorValue)).filter((element) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        });

        if (observationKind === "submit-disabled") {
          return visibleElements.length > 0 ? "submit state=disabled" : null;
        }

        if (observationKind === "submit-enabled") {
          return visibleElements.length > 0 ? "submit state=enabled" : null;
        }

        if (observationKind === "table") {
          const first = visibleElements[0];
          if (!(first instanceof HTMLElement)) {
            return null;
          }
          const rowCount = first.querySelectorAll("tbody tr,[role='row']").length;
          return `table rows=${rowCount}`;
        }

        const labels = visibleElements
          .map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? "")
          .filter((text) => text.length > 0)
          .slice(0, 3);

        if (observationKind === "button") {
          return labels.length > 0 ? `buttons=${labels.join("|")}` : `buttons=`;
        }

        if (observationKind === "heading") {
          return labels.length > 0 ? `headings=${labels.join("|")}` : null;
        }

        return null;
      },
      { selector, kind },
    );
  } catch {
    return null;
  }
}

async function executeWithPlaywright(
  request: ExecuteRequest,
  deviceNode: DeviceNodeDescriptor | null,
  sandbox: UiExecutorSandboxEvaluation,
): Promise<ExecuteResponse | null> {
  const config = currentConfig();
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<unknown>;

  let playwrightModule: unknown;
  try {
    playwrightModule = await dynamicImport("playwright");
  } catch {
    return null;
  }

  if (!isRecord(playwrightModule) || !isRecord(playwrightModule.chromium)) {
    return null;
  }

  const chromium = playwrightModule.chromium as {
    launch: (options: { headless: boolean }) => Promise<PlaywrightBrowserHandle>;
  };

  await sweepPersistentPlaywrightSessions(config.browserSessionTtlMs);

  const requestedSessionKey =
    typeof request.session?.key === "string" && request.session.key.trim().length > 0 ? request.session.key.trim() : null;
  const persistenceRequested = request.session?.mode === "resumable" && requestedSessionKey !== null;
  const persistenceEnabled = config.persistentBrowserSessions && persistenceRequested;
  const persistAfterRun = persistenceEnabled && request.session?.persistAfterRun === true;

  let browser: PlaywrightBrowserHandle;
  let page: PlaywrightPageHandle;
  let sessionReuseCount = Math.max(0, request.session?.reuseCount ?? 0);
  let sessionLastUrl: string | null = null;
  const sessionNotes: string[] = [];
  if (typeof request.context?.summary === "string" && request.context.summary.trim().length > 0) {
    sessionNotes.push("Summary-backed draft received.");
  }

  try {
    if (persistenceEnabled && requestedSessionKey) {
      const existing = persistentPlaywrightSessions.get(requestedSessionKey);
      if (existing) {
        browser = existing.browser;
        page = existing.page;
        existing.reuseCount += 1;
        existing.updatedAt = nowIso();
        sessionReuseCount = existing.reuseCount;
        sessionLastUrl = existing.lastPageUrl;
        sessionNotes.push("Persistent browser session reused.");
      } else {
        browser = await chromium.launch({ headless: true });
        page = await browser.newPage();
        persistentPlaywrightSessions.set(requestedSessionKey, {
          key: requestedSessionKey,
          browser,
          page,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          reuseCount: 0,
          lastPageUrl: null,
        });
        sessionReuseCount = 0;
        sessionNotes.push("Persistent browser session started.");
        if (request.actions[0]?.type !== "navigate" && typeof request.context?.url === "string" && request.context.url.trim()) {
          await page.goto(request.context.url.trim(), { waitUntil: "domcontentloaded", timeout: 15000 });
          sessionNotes.push("Bootstrapped browser session from job context URL.");
        }
      }
    } else {
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage();
      sessionNotes.push(
        config.persistentBrowserSessions
          ? "Ephemeral browser session executed for this slice."
          : "Persistent browser sessions are disabled in runtime config.",
      );
    }
  } catch {
    if (requestedSessionKey) {
      await releasePersistentPlaywrightSession(requestedSessionKey, "failed");
    }
    return null;
  }

  const screenshotSeed = request.context?.screenshotRef || `ui://executor/${Date.now()}`;

  const trace: TraceStep[] = [];
  const staleRefTargets = new Set<string>();
  const healedRefTargets = new Set<string>();
  const healedRefSelectors = new Map<string, string>();
  let retries = 0;
  let finalStatus: "completed" | "failed" = "completed";

  const runAction = async (action: UiAction): Promise<{ observation: string | null; note: string | null }> => {
    let observation: string | null = null;
    let note: string | null = null;
    try {
      const resolvedTarget = resolveGroundingTarget(action.target, request.context);
      if (resolvedTarget.mode === "ref" && resolvedTarget.status !== "resolved") {
        throw missingGroundingRefError(action.target);
      }
      let effectiveSelector = resolvedTarget.selector;
      if (resolvedTarget.refId && healedRefSelectors.has(resolvedTarget.refId)) {
        effectiveSelector = healedRefSelectors.get(resolvedTarget.refId) ?? effectiveSelector;
      }
      if ((action.type === "click" || action.type === "type" || action.type === "verify") && effectiveSelector) {
        try {
          await assertResolvedActionTarget(page, effectiveSelector, resolvedTarget.refId);
        } catch (error) {
          if (resolvedTarget.refId) {
            const healed = await recoverGroundingRefSelector(page, action.target, request.context);
            if (healed?.selector) {
              effectiveSelector = healed.selector;
              healedRefSelectors.set(healed.refId, healed.selector);
              healedRefTargets.add(healed.refId);
              note = `Recovered stale grounding ref ${healed.refId} with selector ${healed.selector}.`;
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      }
      if (action.type === "navigate") {
        const navigateTarget =
          action.target.startsWith("http://") || action.target.startsWith("https://")
            ? action.target
            : config.defaultNavigationUrl;
        await page.goto(navigateTarget, { waitUntil: "domcontentloaded", timeout: 15000 });
      } else if (action.type === "click") {
        if (effectiveSelector) {
          await page.click(effectiveSelector, { timeout: config.actionTimeoutMs });
        } else {
          await page.click(action.target, { timeout: config.actionTimeoutMs });
        }
      } else if (action.type === "type") {
        const value = action.text ?? "";
        if (effectiveSelector) {
          await page.fill(effectiveSelector, value, { timeout: config.actionTimeoutMs });
        } else {
          await page.fill(action.target, value, { timeout: config.actionTimeoutMs });
        }
      } else if (action.type === "scroll") {
        await page.evaluate(() => {
          window.scrollBy(0, Math.floor(window.innerHeight * 0.6));
        });
      } else if (action.type === "hotkey") {
        await page.press("body", action.text ?? "Enter", { timeout: config.actionTimeoutMs });
      } else if (action.type === "wait") {
        await page.waitForTimeout(300);
      } else if (action.type === "verify") {
        if (isVirtualVerifyTarget(action.target)) {
          await page.waitForTimeout(120);
          observation = `${action.target.toLowerCase()} observed`;
          if (resolvedTarget.refId && effectiveSelector && healedRefTargets.has(resolvedTarget.refId)) {
            observation = appendGroundingHealingObservation(observation, resolvedTarget.refId, effectiveSelector);
          }
          return { observation, note };
        }
        if (effectiveSelector) {
          await page.waitForSelector(effectiveSelector, {
            timeout: config.actionTimeoutMs,
            state: "visible",
          });
          const verifyTarget = action.target.startsWith("ref:") ? `css:${effectiveSelector}` : action.target;
          const verifyObservation = await collectVerifyObservation(page, verifyTarget);
          observation =
            verifyObservation ?? (resolvedTarget.refId ? `ref-visible ${resolvedTarget.refId}` : null);
        } else {
          await page.waitForTimeout(120);
        }
      }
      if (resolvedTarget.refId && effectiveSelector && healedRefTargets.has(resolvedTarget.refId)) {
        observation = appendGroundingHealingObservation(observation, resolvedTarget.refId, effectiveSelector);
      }
      return { observation, note };
    } catch (error) {
      if (action.target.startsWith("ref:")) {
        const refId = resolveGroundingTarget(action.target, request.context).refId ?? action.target.slice(4);
        staleRefTargets.add(refId);
        throw error instanceof Error && /need stronger grounding/i.test(error.message)
          ? error
          : staleGroundingRefError(refId);
      }
      const groundingObservation = resolveGroundingObservation(action.target, request.context);
      if (groundingObservation) {
        return { observation: groundingObservation, note };
      } else {
        throw error;
      }
    }
  };

  try {
    for (let index = 0; index < request.actions.length; index += 1) {
      const action = request.actions[index];
      const stepIndex = index + 1;
      const screenshotRef = `${screenshotSeed}/pw-step-${stepIndex}.png`;
      try {
        const execution = await runAction(action);

        trace.push({
          index: stepIndex,
          actionId: action.id,
          actionType: action.type,
          target: action.target,
          status: "ok",
          screenshotRef,
          notes: execution.note ?? "Executed by ui-executor playwright mode.",
          observation: execution.observation,
        });
      } catch (error) {
        retries += 1;
        trace.push({
          index: stepIndex,
          actionId: action.id,
          actionType: action.type,
          target: action.target,
          status: "retry",
          screenshotRef,
          notes: `Playwright retry: ${error instanceof Error ? error.message : String(error)}`,
          observation: null,
        });

        try {
          await page.waitForTimeout(220);
          const retryExecution = await runAction(action);
          trace.push({
            index: stepIndex,
            actionId: action.id,
            actionType: action.type,
            target: `${action.target} (retry)`,
            status: "ok",
            screenshotRef: `${screenshotSeed}/pw-step-${stepIndex}-retry.png`,
            notes: retryExecution.note ?? "Retry passed in ui-executor playwright mode.",
            observation: retryExecution.observation,
          });
        } catch (retryError) {
          trace.push({
            index: stepIndex,
            actionId: action.id,
            actionType: action.type,
            target: `${action.target} (retry)`,
            status: "failed",
            screenshotRef: `${screenshotSeed}/pw-step-${stepIndex}-retry.png`,
            notes: `Retry failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
            observation: null,
          });
          finalStatus = "failed";
          break;
        }
      }
    }
  } finally {
    sessionLastUrl = typeof page.url === "function" ? page.url() : sessionLastUrl;
    if (persistenceEnabled && requestedSessionKey) {
      const entry = persistentPlaywrightSessions.get(requestedSessionKey);
      if (entry) {
        entry.updatedAt = nowIso();
        entry.lastPageUrl = sessionLastUrl;
      }
      if (!persistAfterRun || finalStatus === "failed") {
        await releasePersistentPlaywrightSession(requestedSessionKey, finalStatus === "failed" ? "failed" : "released");
        sessionNotes.push(finalStatus === "failed" ? "Persistent browser session closed after failure." : "Persistent browser session released after slice.");
      } else {
        sessionNotes.push("Persistent browser session kept warm for resume.");
      }
    } else {
      await browser.close();
    }
  }

  return {
    trace,
    finalStatus,
    retries,
    executor: "ui-executor-service",
    adapterMode: "remote_http",
    adapterNotes: [
      "Executed via ui-executor playwright mode",
      sandbox.decision === "audit"
        ? `Sandbox audit noted ${sandbox.violations.length} findings`
        : `Sandbox policy ${sandbox.mode}`,
    ],
    deviceNode,
    sandbox: sandboxResponse(sandbox),
    grounding: groundingResponse(request, staleRefTargets, healedRefTargets),
    verification: buildExecutionVerificationSummary(request.actions, trace, finalStatus),
    session: {
      mode: persistenceRequested ? "resumable" : "ephemeral",
      key: persistenceEnabled ? requestedSessionKey : null,
      persistenceRequested,
      persistenceEnabled,
      status:
        !persistenceEnabled
          ? "ephemeral"
          : !persistAfterRun || finalStatus === "failed"
            ? finalStatus === "failed"
              ? "closed"
              : "released"
            : "ready",
      reuseCount: sessionReuseCount,
      lastPageUrl: sessionLastUrl,
      notes: sessionNotes,
    },
  };
}

function groundingResponse(
  request: ExecuteRequest,
  staleRefTargets: Iterable<string> = [],
  healedRefTargets: Iterable<string> = [],
): ExecuteResponse["grounding"] {
  const allRefIds = listGroundingRefIds(request.context?.refMap);
  const actionableRefIds = allRefIds.slice(0, 20);
  const staleTargets = Array.from(new Set(Array.from(staleRefTargets))).sort();
  const healedTargets = Array.from(new Set(Array.from(healedRefTargets))).sort();
  return {
    refMapCount: allRefIds.length,
    actionableRefIds,
    staleRefTargets: staleTargets,
    healedRefTargets: healedTargets,
    recoveryHint:
      staleTargets.length > 0
        ? `Refresh snapshot and rerun. Stale grounding refs detected: ${staleTargets.join(", ")}.`
        : actionableRefIds.length > 0
          ? null
          : "Need stronger grounding. Provide url, snapshot, or refMap entries for actionable elements.",
  };
}

async function canUsePlaywright(): Promise<boolean> {
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<unknown>;
  try {
    const playwrightModule = (await dynamicImport("playwright")) as {
      chromium?: { executablePath?: () => string };
    };
    const executablePath =
      typeof playwrightModule?.chromium?.executablePath === "function"
        ? playwrightModule.chromium.executablePath()
        : "";
    return typeof executablePath === "string" && executablePath.trim().length > 0 && existsSync(executablePath);
  } catch {
    return false;
  }
}

setBrowserJobRunner(async (input): Promise<BrowserJobExecutionResult> => {
  const config = currentConfig();
  const request: ExecuteRequest = {
    actions: input.actions.map((action) => ({
      id: action.id,
      type: action.type,
      target: action.target,
      text: action.text ?? null,
      coordinates: action.coordinates ? { ...action.coordinates } : null,
    })),
    context: {
      goal: toNonEmptyString(input.context.goal, ""),
      url: toNonEmptyString(input.context.url, ""),
      summary: toNonEmptyString(input.context.summary, ""),
      screenshotRef: input.screenshotSeed,
      domSnapshot: toNonEmptyString(input.context.domSnapshot, ""),
      accessibilityTree: toNonEmptyString(input.context.accessibilityTree, ""),
      markHints: Array.isArray(input.context.markHints) ? [...input.context.markHints] : [],
      refMap: normalizeGroundingRefMap(input.context.refMap),
      deviceNodeId: toNonEmptyString(input.deviceNode?.nodeId ?? input.context.deviceNodeId, "").toLowerCase(),
      cursor:
        input.context.cursor &&
        typeof input.context.cursor.x === "number" &&
        typeof input.context.cursor.y === "number"
          ? { x: input.context.cursor.x, y: input.context.cursor.y }
          : undefined,
    },
    session: input.session
      ? {
          key: input.session.key,
          mode: input.session.mode,
          persistAfterRun: input.persistSessionAfterRun === true,
          reuseCount: input.session.reuseCount,
        }
      : undefined,
  };
  const sandbox: UiExecutorSandboxEvaluation = {
    allowed: true,
    mode: input.sandbox?.mode === "audit" ? "audit" : input.sandbox?.mode === "enforce" ? "enforce" : "off",
    decision: input.sandbox?.decision === "audit" ? "audit" : "allow",
    violations: Array.isArray(input.sandbox?.violations) ? [...input.sandbox.violations] : [],
    warnings: Array.isArray(input.sandbox?.warnings) ? [...input.sandbox.warnings] : [],
    networkPolicy: "allow_all",
    inspectedTargets: input.actions.map((action) => action.target),
    inspectedPaths: [],
    setupMarkerStatus:
      input.sandbox?.setupMarkerStatus === "ready" ||
      input.sandbox?.setupMarkerStatus === "missing" ||
      input.sandbox?.setupMarkerStatus === "stale"
        ? input.sandbox.setupMarkerStatus === "ready"
          ? "current"
          : input.sandbox.setupMarkerStatus
        : "current",
  };
  const selectedNode = input.deviceNode
    ? {
        nodeId: input.deviceNode.nodeId,
        displayName: input.deviceNode.displayName,
        kind: input.deviceNode.kind,
        platform: input.deviceNode.platform,
        status: input.deviceNode.status,
        capabilities: Array.isArray(input.deviceNode.capabilities) ? [...input.deviceNode.capabilities] : [],
      }
    : null;
  const response = await executeRequestWithConfiguredAdapter({
    config,
    request,
    selectedNode,
    sandbox,
  });
  return {
    trace: response.trace.map((step) => ({
      ...step,
      observation: typeof step.observation === "string" ? step.observation : null,
    })),
    finalStatus: response.finalStatus,
    retries: response.retries,
    executor: response.executor,
    adapterMode: "remote_http",
    adapterNotes: [...response.adapterNotes],
    deviceNode: response.deviceNode
      ? {
          nodeId: response.deviceNode.nodeId,
          displayName: response.deviceNode.displayName,
          kind: response.deviceNode.kind,
          platform: response.deviceNode.platform,
          status: response.deviceNode.status,
          capabilities: Array.isArray(response.deviceNode.capabilities)
            ? [...response.deviceNode.capabilities]
            : [],
        }
      : null,
    grounding: {
      staleRefTargets: [...response.grounding.staleRefTargets],
      healedRefTargets: [...response.grounding.healedRefTargets],
      recoveryHint: response.grounding.recoveryHint,
    },
    verification: response.verification,
    session: response.session,
  };
});

setBrowserJobSessionReleaser(async (session, _reason) => {
  if (!session.key) {
    return;
  }
  await releasePersistentPlaywrightSession(session.key, session.status);
});

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
      const config = currentConfig();
      const playwrightAvailable = await canUsePlaywright();
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        mode: "remote_http",
        playwrightAvailable,
        strictPlaywright: config.strictPlaywright,
        simulateIfUnavailable: config.simulateIfUnavailable,
        forceSimulation: config.forceSimulation,
        registeredDeviceNodes: config.deviceNodes.size,
        runtime: runtimeState(),
      });
      return;
    }

    if (url.pathname === "/status" && req.method === "GET") {
      const config = currentConfig();
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        mode: "remote_http",
        forceSimulation: config.forceSimulation,
        runtime: runtimeState(),
      });
      return;
    }

    if (url.pathname === "/runtime/config" && req.method === "GET") {
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        runtime: runtimeConfigPayload(),
        store: getUiExecutorRuntimeConfigStoreStatus({
          env: process.env,
          cwd: process.cwd(),
        }),
      });
      return;
    }

    if (url.pathname === "/runtime/control-plane-override" && req.method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = parseJsonObjectBody(await readBody(req));
      } catch (error) {
        writeJson(res, 400, {
          error: error instanceof Error ? error.message : "invalid ui-executor control-plane override JSON",
          code: "UI_EXECUTOR_RUNTIME_OVERRIDE_INVALID_JSON",
        });
        return;
      }

      if (body.clear === true) {
        clearUiExecutorRuntimeControlPlaneOverride();
        writeJson(res, 200, {
          ok: true,
          service: serviceName,
          action: "clear",
          runtime: runtimeConfigPayload(),
          store: getUiExecutorRuntimeConfigStoreStatus({
            env: process.env,
            cwd: process.cwd(),
          }),
        });
        return;
      }

      const rawJson = toOptionalString(body.rawJson) ?? (isRecord(body.runtime) ? JSON.stringify(body.runtime) : null);
      if (!rawJson) {
        writeJson(res, 400, {
          error: "rawJson or runtime object is required",
          code: "UI_EXECUTOR_RUNTIME_OVERRIDE_INVALID",
        });
        return;
      }

      try {
        setUiExecutorRuntimeControlPlaneOverride({
          rawJson,
          reason: toOptionalString(body.reason),
          env: process.env,
          cwd: process.cwd(),
        });
      } catch (error) {
        writeJson(res, 400, {
          error: error instanceof Error ? error.message : "invalid ui-executor control-plane override",
          code: "UI_EXECUTOR_RUNTIME_OVERRIDE_INVALID",
        });
        return;
      }

      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        action: "set",
        runtime: runtimeConfigPayload(),
        store: getUiExecutorRuntimeConfigStoreStatus({
          env: process.env,
          cwd: process.cwd(),
        }),
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

    if (draining && url.pathname === "/execute" && req.method === "POST") {
      writeJson(res, 503, {
        error: "ui-executor is draining and does not accept new execute requests",
        code: "UI_EXECUTOR_DRAINING",
        runtime: runtimeState(),
      });
      return;
    }

    if (url.pathname === "/execute" && req.method === "POST") {
      const config = currentConfig();
      const raw = await readBody(req);
      const request = normalizeRequest(raw ? JSON.parse(raw) : {});
      if (request.actions.length === 0) {
        writeJson(res, 400, { error: "actions array is required" });
        return;
      }

      const sandbox = evaluateUiExecutorSandboxRequest({
        policy: config.sandboxPolicy,
        request,
        defaultNavigationUrl: config.defaultNavigationUrl,
      });
      if (!sandbox.allowed) {
        writeJson(res, 403, {
          error: "ui-executor request is blocked by sandbox policy",
          code: "UI_EXECUTOR_SANDBOX_POLICY_BLOCKED",
          sandbox,
        });
        return;
      }

      const headerNodeId = toNonEmptyString(req.headers["x-device-node-id"], "").toLowerCase();
      const nodeResolution = resolveSelectedDeviceNode(config, request, headerNodeId);
      if (nodeResolution.errorResponse) {
        writeJson(res, nodeResolution.errorStatusCode ?? 400, nodeResolution.errorResponse);
        return;
      }

      try {
        const result = await executeRequestWithConfiguredAdapter({
          config,
          request,
          selectedNode: nodeResolution.selectedNode,
          sandbox,
        });
        writeJson(res, 200, result);
      } catch (error) {
        writeJson(res, 503, {
          error: error instanceof Error ? error.message : "ui-executor adapter unavailable",
          code: "UI_EXECUTOR_PLAYWRIGHT_UNAVAILABLE",
        });
      }
      return;
    }

    if (draining && url.pathname === "/browser-jobs" && req.method === "POST") {
      writeJson(res, 503, {
        error: "ui-executor is draining and does not accept new browser jobs",
        code: "UI_EXECUTOR_DRAINING",
        runtime: runtimeState(),
      });
      return;
    }

    if (url.pathname === "/browser-jobs" && req.method === "GET") {
      const limit = toOptionalPositiveInt(url.searchParams.get("limit")) ?? 20;
      const statusRaw = toOptionalString(url.searchParams.get("status"));
      const status =
        statusRaw === "queued" ||
        statusRaw === "running" ||
        statusRaw === "paused" ||
        statusRaw === "completed" ||
        statusRaw === "failed" ||
        statusRaw === "cancelled"
          ? statusRaw
          : null;
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        data: getBrowserJobListSnapshot({
          limit,
          status,
        }),
      });
      return;
    }

    if (url.pathname === "/browser-jobs" && req.method === "POST") {
      const config = currentConfig();
      if (getBrowserJobRuntimeSnapshot().runtime.enabled !== true) {
        writeJson(res, 503, {
          error: "ui-executor browser worker runtime is disabled",
          code: "UI_EXECUTOR_BROWSER_WORKER_DISABLED",
          runtime: runtimeState(),
        });
        return;
      }
      const raw = await readBody(req);
      const request = normalizeBrowserJobSubmitRequest(raw ? JSON.parse(raw) : {});
      if (request.actions.length === 0) {
        writeJson(res, 400, {
          error: "actions array is required",
          code: "UI_EXECUTOR_BROWSER_JOB_INVALID",
        });
        return;
      }

      const sandbox = evaluateUiExecutorSandboxRequest({
        policy: config.sandboxPolicy,
        request,
        defaultNavigationUrl: config.defaultNavigationUrl,
      });
      if (!sandbox.allowed) {
        writeJson(res, 403, {
          error: "ui-executor browser job is blocked by sandbox policy",
          code: "UI_EXECUTOR_SANDBOX_POLICY_BLOCKED",
          sandbox,
        });
        return;
      }

      const headerNodeId = toNonEmptyString(req.headers["x-device-node-id"], "").toLowerCase();
      const nodeResolution = resolveSelectedDeviceNode(config, request, headerNodeId);
      if (nodeResolution.errorResponse) {
        writeJson(res, nodeResolution.errorStatusCode ?? 400, nodeResolution.errorResponse);
        return;
      }

      const job = submitBrowserJob({
        sessionId: request.sessionId ?? `browser-session-${randomUUID()}`,
        runId: request.runId ?? null,
        taskId: request.taskId ?? null,
        label: request.options?.label ?? request.context?.goal ?? null,
        reason: request.options?.reason ?? "repo_owned_browser_worker",
        actions: request.actions.map((action) => ({
          id: action.id,
          type: action.type,
          target: action.target,
          text: action.text ?? null,
          coordinates: action.coordinates ? { ...action.coordinates } : null,
        })),
        context: {
          goal: request.context?.goal,
          url: request.context?.url,
          screenshotRef: request.context?.screenshotRef,
          domSnapshot: request.context?.domSnapshot,
          accessibilityTree: request.context?.accessibilityTree,
          markHints: Array.isArray(request.context?.markHints) ? [...request.context.markHints] : [],
          refMap: normalizeGroundingRefMap(request.context?.refMap),
          deviceNodeId: nodeResolution.selectedNode?.nodeId ?? request.context?.deviceNodeId,
          cursor: request.context?.cursor ? { ...request.context.cursor } : null,
        },
        deviceNode: nodeResolution.selectedNode
          ? {
              nodeId: nodeResolution.selectedNode.nodeId,
              displayName: nodeResolution.selectedNode.displayName,
              kind: nodeResolution.selectedNode.kind,
              platform: nodeResolution.selectedNode.platform,
              status: nodeResolution.selectedNode.status,
              capabilities: [...nodeResolution.selectedNode.capabilities],
            }
          : null,
        checkpointEverySteps: request.options?.checkpointEverySteps ?? null,
        pauseAfterStep: request.options?.pauseAfterStep ?? null,
        sandbox: {
          mode: sandbox.mode,
          decision: sandbox.decision,
          violations: [...sandbox.violations],
          warnings: [...sandbox.warnings],
          setupMarkerStatus: sandbox.setupMarkerStatus,
        },
      });
      writeJson(res, 202, {
        ok: true,
        service: serviceName,
        action: "submit",
        data: {
          job,
          runtime: getBrowserJobRuntimeSnapshot(),
        },
      });
      return;
    }

    const browserJobDetailId = parseBrowserJobDetailPath(url.pathname);
    if (browserJobDetailId && req.method === "GET") {
      const job = getBrowserJob(browserJobDetailId);
      if (!job) {
        writeJson(res, 404, {
          error: "browser job not found",
          code: "UI_EXECUTOR_BROWSER_JOB_NOT_FOUND",
          jobId: browserJobDetailId,
        });
        return;
      }
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        data: {
          job,
          runtime: getBrowserJobRuntimeSnapshot(),
        },
      });
      return;
    }

    const browserJobAction = parseBrowserJobActionPath(url.pathname);
    if (browserJobAction && req.method === "POST") {
      const raw = await readBody(req);
      const body = raw.trim().length > 0 ? parseJsonObjectBody(raw) : {};
      const reason = toOptionalString(body.reason) ?? `browser job ${browserJobAction.action}`;
      const job =
        browserJobAction.action === "resume"
          ? resumeBrowserJob(browserJobAction.jobId, reason)
          : cancelBrowserJob(browserJobAction.jobId, reason);
      if (!job) {
        writeJson(res, 404, {
          error: "browser job not found or action is invalid for current state",
          code: "UI_EXECUTOR_BROWSER_JOB_ACTION_INVALID",
          jobId: browserJobAction.jobId,
          action: browserJobAction.action,
        });
        return;
      }
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        action: browserJobAction.action,
        data: {
          job,
          runtime: getBrowserJobRuntimeSnapshot(),
        },
      });
      return;
    }

    writeJson(res, 404, { error: "Not found" });
  } catch (error) {
    writeJson(res, 500, {
      error: error instanceof Error ? error.message : "unknown ui-executor error",
    });
  }
});

const startupConfig = currentConfig();

server.listen(startupConfig.port, () => {
  console.log(`[ui-executor] listening on :${startupConfig.port}`);
});
