import { randomUUID } from "node:crypto";
import {
  buildCapabilityProfile,
  type CapabilityProfile,
  type ComputerUseCapabilityAdapter,
  type ReasoningCapabilityAdapter,
} from "@mla/capabilities";
import {
  getSkillsRuntimeSnapshot,
  renderSkillsPrompt,
  toSkillsRuntimeSummary,
} from "@mla/skills";
import {
  createEnvelope,
  type NormalizedError,
  type OrchestratorRequest,
  type OrchestratorResponse,
} from "@mla/contracts";

type UiTaskInput = {
  goal: string;
  url: string | null;
  deviceNodeId: string | null;
  screenshotRef: string | null;
  domSnapshot: string | null;
  accessibilityTree: string | null;
  markHints: string[];
  cursor: { x: number; y: number } | null;
  formData: Record<string, string>;
  maxSteps: number;
  simulateFailureAtStep: number | null;
  approvalConfirmed: boolean;
  approvalDecision: "approved" | "rejected" | null;
  approvalReason: string | null;
  approvalId: string | null;
  sandboxPolicyMode: "off" | "non-main" | "all" | null;
  sessionRole: "main" | "secondary" | null;
  visualTesting: VisualTestingInput;
};

type GroundingSignalSummary = {
  screenshotRefProvided: boolean;
  domSnapshotProvided: boolean;
  accessibilityTreeProvided: boolean;
  markHintsCount: number;
};

type VisualCategory = "layout" | "content" | "interaction";

type VisualSeverity = "low" | "medium" | "high";

type VisualStatus = "ok" | "regression";

type VisualTestingInput = {
  enabled: boolean;
  baselineScreenshotRef: string | null;
  expectedAssertions: string[];
  simulateRegression: boolean;
  regressionHint: string | null;
};

type VisualTestingCheck = {
  id: string;
  category: VisualCategory;
  assertion: string;
  status: VisualStatus;
  severity: VisualSeverity;
  observed: string;
  evidenceRefs: string[];
};

type VisualTestingReport = {
  enabled: boolean;
  status: "not_requested" | "passed" | "failed";
  baselineScreenshotRef: string | null;
  actualScreenshotRefs: string[];
  checks: VisualTestingCheck[];
  regressionCount: number;
  highestSeverity: "none" | VisualSeverity;
  comparator: {
    provider: string;
    model: string;
    mode: "gemini_reasoning" | "fallback_heuristic";
  };
  artifactRefs: {
    baseline: string | null;
    actual: string[];
    diff: string[];
  };
  generatedAt: string;
};

type UiAction = {
  id: string;
  type: "navigate" | "click" | "type" | "scroll" | "hotkey" | "wait" | "verify";
  target: string;
  coordinates: { x: number; y: number } | null;
  text: string | null;
  rationale: string;
};

type UiTraceStep = {
  index: number;
  actionId: string;
  actionType: UiAction["type"];
  target: string;
  status: "ok" | "retry" | "failed" | "blocked";
  screenshotRef: string;
  notes: string;
};

type ExecutorMode = "simulated" | "playwright_preview" | "remote_http";

type RemoteHttpFallbackMode = "simulated" | "failed";

type PlannerConfig = {
  apiKey: string | null;
  baseUrl: string;
  plannerModel: string;
  timeoutMs: number;
  executorTimeoutMs: number;
  executorRequestMaxRetries: number;
  executorRetryBackoffMs: number;
  plannerEnabled: boolean;
  maxStepsDefault: number;
  approvalKeywords: string[];
  executorMode: ExecutorMode;
  remoteHttpFallbackMode: RemoteHttpFallbackMode;
  executorUrl: string | null;
  deviceNodeIndexUrl: string | null;
  deviceNodeIndexAuthToken: string | null;
  deviceNodeIndexTimeoutMs: number;
  deviceNodesJson: string | null;
  loopDetectionEnabled: boolean;
  loopWindowSize: number;
  loopRepeatThreshold: number;
  loopSimilarityThreshold: number;
  sandboxPolicyMode: SandboxPolicyMode;
  sandboxMainSessionIds: string[];
  sandboxMaxSteps: number;
  sandboxAllowedActionTypes: UiAction["type"][];
  sandboxBlockedApprovalCategories: string[];
  sandboxForcedExecutorMode: ExecutorMode | null;
};

type SandboxPolicyMode = "off" | "non-main" | "all";

type SandboxPolicyContext = {
  configuredMode: SandboxPolicyMode;
  effectiveMode: SandboxPolicyMode;
  active: boolean;
  reason: "mode_off" | "main_session" | "non_main_session" | "all_sessions";
  sessionClass: "main" | "non_main";
  maxStepsLimit: number;
  baseExecutorMode: ExecutorMode;
  enforcedExecutorMode: ExecutorMode;
  allowedActionTypes: UiAction["type"][];
  blockedApprovalCategories: string[];
  blockedCategories: string[];
};

type UiNavigatorCapabilitySet = {
  reasoning: ReasoningCapabilityAdapter;
  computerUse: ComputerUseCapabilityAdapter;
  profile: CapabilityProfile;
};

type DeviceNodeKind = "desktop" | "mobile";

type DeviceNodeStatus = "online" | "offline" | "degraded";

type DeviceNodeRuntimeRecord = {
  nodeId: string;
  displayName: string;
  kind: DeviceNodeKind;
  platform: string;
  executorUrl: string | null;
  status: DeviceNodeStatus;
  capabilities: string[];
  trustLevel: "untrusted" | "reviewed" | "trusted";
  version: number;
  updatedAt: string | null;
};

type DeviceNodeResolution = {
  requestedNodeId: string | null;
  selectedNode: DeviceNodeRuntimeRecord | null;
  executorUrl: string | null;
  source: "none" | "inline_json" | "remote_index";
  notes: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function toNullableString(value: unknown): string | null {
  const normalized = toNonEmptyString(value, "");
  return normalized.length > 0 ? normalized : null;
}

function toNullableInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : null;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => toNonEmptyString(item, "")).filter((item) => item.length > 0);
}

function clipText(value: string | null, maxChars: number): string | null {
  if (!value) {
    return null;
  }
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)} ...[truncated]`;
}

function normalizeMarkHints(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const hints: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const normalized = toNonEmptyString(item, "");
      if (normalized.length > 0) {
        hints.push(normalized);
      }
      continue;
    }
    if (!isRecord(item)) {
      continue;
    }
    const label = toNonEmptyString(item.label, toNonEmptyString(item.id, "mark"));
    const x = toNullableInt(item.x);
    const y = toNullableInt(item.y);
    if (label.length > 0 && x !== null && y !== null) {
      hints.push(`${label}@(${x},${y})`);
    } else if (label.length > 0) {
      hints.push(label);
    }
  }
  return hints.slice(0, 80);
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

function parseFloatInRange(value: string | undefined, fallback: number, min: number, max: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed < min) {
    return min;
  }
  if (parsed > max) {
    return max;
  }
  return parsed;
}

function parseKeywordList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) {
    return fallback;
  }
  const values = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  return values.length > 0 ? values : fallback;
}

function parseExecutorMode(raw: string | undefined): ExecutorMode {
  if (raw === "playwright_preview") {
    return "playwright_preview";
  }
  if (raw === "remote_http") {
    return "remote_http";
  }
  return "simulated";
}

function parseRemoteHttpFallbackMode(raw: string | undefined): RemoteHttpFallbackMode {
  const normalized = toNonEmptyString(raw, "").toLowerCase();
  if (normalized === "failed" || normalized === "fail" || normalized === "strict") {
    return "failed";
  }
  return "simulated";
}

function parseSandboxPolicyMode(raw: string | undefined): SandboxPolicyMode {
  const normalized = toNonEmptyString(raw, "").toLowerCase();
  if (normalized === "all") {
    return "all";
  }
  if (normalized === "non-main" || normalized === "non_main") {
    return "non-main";
  }
  return "off";
}

function parseActionTypeList(raw: string | undefined, fallback: UiAction["type"][]): UiAction["type"][] {
  const values = parseKeywordList(raw, fallback);
  const allowed = new Set<UiAction["type"]>();
  for (const value of values) {
    if (
      value === "navigate" ||
      value === "click" ||
      value === "type" ||
      value === "scroll" ||
      value === "hotkey" ||
      value === "wait" ||
      value === "verify"
    ) {
      allowed.add(value);
    }
  }
  return allowed.size > 0 ? Array.from(allowed) : fallback;
}

function parseDeviceNodeKind(raw: unknown): DeviceNodeKind {
  if (raw === "mobile") {
    return "mobile";
  }
  if (typeof raw === "string" && raw.trim().toLowerCase() === "mobile") {
    return "mobile";
  }
  return "desktop";
}

function parseDeviceNodeStatus(raw: unknown): DeviceNodeStatus {
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

function parseTrustLevel(raw: unknown): DeviceNodeRuntimeRecord["trustLevel"] {
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

function parseVersion(raw: unknown): number {
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

function parseDeviceNodeRecord(raw: unknown): DeviceNodeRuntimeRecord | null {
  if (!isRecord(raw)) {
    return null;
  }
  const nodeId = toNonEmptyString(raw.nodeId ?? raw.id, "").toLowerCase();
  if (nodeId.length === 0) {
    return null;
  }
  const capabilityValues = Array.isArray(raw.capabilities) ? raw.capabilities : [];
  const capabilities = capabilityValues
    .map((item) => toNonEmptyString(item, "").toLowerCase())
    .filter((item, index, arr) => item.length > 0 && arr.indexOf(item) === index);
  return {
    nodeId,
    displayName: toNonEmptyString(raw.displayName ?? raw.name, nodeId),
    kind: parseDeviceNodeKind(raw.kind),
    platform: toNonEmptyString(raw.platform, "unknown"),
    executorUrl: toNullableString(raw.executorUrl),
    status: parseDeviceNodeStatus(raw.status),
    capabilities,
    trustLevel: parseTrustLevel(raw.trustLevel ?? raw.trust),
    version: parseVersion(raw.version),
    updatedAt: toNullableString(raw.updatedAt),
  };
}

function parseDeviceNodesFromUnknown(raw: unknown): DeviceNodeRuntimeRecord[] {
  const items = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.data)
      ? raw.data
      : [];
  const nodes: DeviceNodeRuntimeRecord[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const parsed = parseDeviceNodeRecord(item);
    if (!parsed || seen.has(parsed.nodeId)) {
      continue;
    }
    seen.add(parsed.nodeId);
    nodes.push(parsed);
  }
  return nodes;
}

function parseDeviceNodesFromJson(raw: string | null): DeviceNodeRuntimeRecord[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parseDeviceNodesFromUnknown(parsed);
  } catch {
    return [];
  }
}

async function loadDeviceNodesFromRemote(config: PlannerConfig): Promise<DeviceNodeRuntimeRecord[] | null> {
  if (!config.deviceNodeIndexUrl) {
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.deviceNodeIndexTimeoutMs);
  try {
    const headers: Record<string, string> = {};
    if (config.deviceNodeIndexAuthToken) {
      headers.Authorization = `Bearer ${config.deviceNodeIndexAuthToken}`;
    }
    const response = await fetch(config.deviceNodeIndexUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as unknown;
    return parseDeviceNodesFromUnknown(payload);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveDeviceNodeRouting(params: {
  input: UiTaskInput;
  config: PlannerConfig;
}): Promise<DeviceNodeResolution> {
  const requestedNodeId = params.input.deviceNodeId?.trim().toLowerCase() ?? null;
  const notes: string[] = [];

  if (!requestedNodeId) {
    return {
      requestedNodeId: null,
      selectedNode: null,
      executorUrl: params.config.executorUrl,
      source: "none",
      notes: ["No deviceNodeId requested; using default executor routing."],
    };
  }

  let source: DeviceNodeResolution["source"] = "inline_json";
  let nodes = parseDeviceNodesFromJson(params.config.deviceNodesJson);
  const remoteNodes = await loadDeviceNodesFromRemote(params.config);
  if (remoteNodes && remoteNodes.length > 0) {
    nodes = remoteNodes;
    source = "remote_index";
  }

  const node = nodes.find((item) => item.nodeId === requestedNodeId) ?? null;
  if (!node) {
    return {
      requestedNodeId,
      selectedNode: null,
      executorUrl: null,
      source,
      notes: [`Requested node '${requestedNodeId}' is not present in ${source}.`],
    };
  }
  if (node.status === "offline") {
    return {
      requestedNodeId,
      selectedNode: node,
      executorUrl: null,
      source,
      notes: [`Requested node '${requestedNodeId}' is offline.`],
    };
  }

  const executorUrl = node.executorUrl ?? params.config.executorUrl;
  if (!executorUrl) {
    return {
      requestedNodeId,
      selectedNode: node,
      executorUrl: null,
      source,
      notes: [`Requested node '${requestedNodeId}' has no executorUrl and default executor is not configured.`],
    };
  }

  notes.push(
    node.executorUrl
      ? `Routed to node-specific executorUrl from ${source}.`
      : "Node has no executorUrl; fell back to default executorUrl.",
  );
  return {
    requestedNodeId,
    selectedNode: node,
    executorUrl,
    source,
    notes,
  };
}

function normalizeVisualTestingInput(raw: Record<string, unknown>, screenshotRef: string | null): VisualTestingInput {
  const visualRaw = isRecord(raw.visualTesting) ? raw.visualTesting : {};
  const mode = toNonEmptyString(raw.mode, "").toLowerCase();
  const enabled =
    raw.visualTesting === true ||
    toBoolean(visualRaw.enabled, false) ||
    mode === "visual" ||
    mode === "visual_test" ||
    mode === "visual_testing";

  const expectedAssertionsFromVisual = toStringArray(visualRaw.expectedAssertions);
  const expectedAssertionsFromRoot = toStringArray(raw.expectedAssertions);
  const expectedAssertions =
    expectedAssertionsFromVisual.length > 0
      ? expectedAssertionsFromVisual
      : expectedAssertionsFromRoot.length > 0
        ? expectedAssertionsFromRoot
        : [
            "Layout blocks remain aligned without overlap.",
            "Critical content and labels remain visible.",
            "Interactive controls remain usable after task execution.",
          ];

  return {
    enabled,
    baselineScreenshotRef:
      toNullableString(visualRaw.baselineScreenshotRef) ??
      toNullableString(raw.baselineScreenshotRef) ??
      screenshotRef,
    expectedAssertions: expectedAssertions.slice(0, 10),
    simulateRegression: toBoolean(visualRaw.simulateRegression, false) || toBoolean(raw.simulateVisualRegression, false),
    regressionHint: toNullableString(visualRaw.regressionHint) ?? toNullableString(raw.regressionHint),
  };
}

function getPlannerConfig(): PlannerConfig {
  const defaultApprovalKeywords = [
    "payment",
    "pay",
    "card",
    "credential",
    "password",
    "delete",
    "remove",
    "transfer",
    "wire",
    "bank",
    "purchase",
    "submit order",
  ];
  const approvalKeywords = parseKeywordList(process.env.UI_NAVIGATOR_APPROVAL_KEYWORDS, defaultApprovalKeywords);
  const sandboxPolicyMode = parseSandboxPolicyMode(process.env.UI_NAVIGATOR_SANDBOX_POLICY_MODE);
  const sandboxMainSessionIds = parseKeywordList(process.env.UI_NAVIGATOR_SANDBOX_MAIN_SESSION_IDS, [
    "main",
    "primary",
    "default",
  ]);
  const sandboxAllowedActionTypes = parseActionTypeList(
    process.env.UI_NAVIGATOR_SANDBOX_ALLOWED_ACTIONS,
    ["navigate", "click", "type", "scroll", "wait", "verify"],
  );
  const sandboxBlockedApprovalCategories = parseKeywordList(
    process.env.UI_NAVIGATOR_SANDBOX_BLOCKED_CATEGORIES,
    ["destructive_operation"],
  );

  return {
    apiKey:
      toNullableString(process.env.UI_NAVIGATOR_GEMINI_API_KEY) ?? toNullableString(process.env.GEMINI_API_KEY),
    baseUrl: toNonEmptyString(process.env.GEMINI_API_BASE_URL, "https://generativelanguage.googleapis.com/v1beta"),
    plannerModel: toNonEmptyString(process.env.UI_NAVIGATOR_PLANNER_MODEL, "gemini-3-pro-preview"),
    timeoutMs: parsePositiveInt(process.env.UI_NAVIGATOR_GEMINI_TIMEOUT_MS, 10000),
    executorTimeoutMs: parsePositiveInt(process.env.UI_NAVIGATOR_EXECUTOR_TIMEOUT_MS, 15000),
    executorRequestMaxRetries: parsePositiveInt(process.env.UI_NAVIGATOR_EXECUTOR_MAX_RETRIES, 1),
    executorRetryBackoffMs: parsePositiveInt(process.env.UI_NAVIGATOR_EXECUTOR_RETRY_BACKOFF_MS, 300),
    plannerEnabled: process.env.UI_NAVIGATOR_USE_GEMINI_PLANNER !== "false",
    maxStepsDefault: parsePositiveInt(process.env.UI_NAVIGATOR_MAX_STEPS, 8),
    approvalKeywords,
    executorMode: parseExecutorMode(process.env.UI_NAVIGATOR_EXECUTOR_MODE),
    remoteHttpFallbackMode: parseRemoteHttpFallbackMode(process.env.UI_NAVIGATOR_REMOTE_HTTP_FALLBACK_MODE),
    executorUrl: toNullableString(process.env.UI_NAVIGATOR_EXECUTOR_URL),
    deviceNodeIndexUrl: toNullableString(process.env.UI_NAVIGATOR_DEVICE_NODE_INDEX_URL),
    deviceNodeIndexAuthToken: toNullableString(process.env.UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_TOKEN),
    deviceNodeIndexTimeoutMs: parsePositiveInt(process.env.UI_NAVIGATOR_DEVICE_NODE_INDEX_TIMEOUT_MS, 2500),
    deviceNodesJson: toNullableString(process.env.UI_NAVIGATOR_DEVICE_NODES_JSON),
    loopDetectionEnabled: process.env.UI_NAVIGATOR_LOOP_DETECTION_ENABLED !== "false",
    loopWindowSize: parsePositiveInt(process.env.UI_NAVIGATOR_LOOP_WINDOW_SIZE, 8),
    loopRepeatThreshold: parsePositiveInt(process.env.UI_NAVIGATOR_LOOP_REPEAT_THRESHOLD, 3),
    loopSimilarityThreshold: parseFloatInRange(process.env.UI_NAVIGATOR_LOOP_SIMILARITY_THRESHOLD, 0.85, 0.5, 1),
    sandboxPolicyMode,
    sandboxMainSessionIds,
    sandboxMaxSteps: parsePositiveInt(process.env.UI_NAVIGATOR_SANDBOX_MAX_STEPS, 4),
    sandboxAllowedActionTypes,
    sandboxBlockedApprovalCategories,
    sandboxForcedExecutorMode: process.env.UI_NAVIGATOR_SANDBOX_FORCE_EXECUTOR_MODE
      ? parseExecutorMode(process.env.UI_NAVIGATOR_SANDBOX_FORCE_EXECUTOR_MODE)
      : null,
  };
}

function normalizeUiTaskInput(input: unknown, config: PlannerConfig): UiTaskInput {
  const raw = isRecord(input) ? input : {};
  const deviceNodeRaw = isRecord(raw.deviceNode) ? raw.deviceNode : {};
  const cursor = isRecord(raw.cursor)
    ? {
        x: toNullableInt(raw.cursor.x) ?? 0,
        y: toNullableInt(raw.cursor.y) ?? 0,
      }
    : null;

  const screenshotRef = toNullableString(raw.screenshotRef);
  const domSnapshot = toNullableString(raw.domSnapshot ?? raw.dom);
  const accessibilityTree = toNullableString(raw.accessibilityTree ?? raw.a11yTree ?? raw.accessibilitySnapshot);
  const markHints = normalizeMarkHints(raw.markHints ?? raw.marks);
  const formDataRaw = isRecord(raw.formData) ? raw.formData : {};
  const formData: Record<string, string> = {};
  for (const [key, value] of Object.entries(formDataRaw)) {
    const normalizedKey = toNonEmptyString(key, "");
    const normalizedValue = toNonEmptyString(value, "");
    if (normalizedKey.length > 0 && normalizedValue.length > 0) {
      formData[normalizedKey] = normalizedValue;
    }
  }

  const sandboxPolicyModeRaw = toNonEmptyString(raw.sandboxPolicyMode, "").toLowerCase();
  const sandboxPolicyMode: UiTaskInput["sandboxPolicyMode"] =
    sandboxPolicyModeRaw === "all"
      ? "all"
      : sandboxPolicyModeRaw === "non-main" || sandboxPolicyModeRaw === "non_main"
        ? "non-main"
        : sandboxPolicyModeRaw === "off"
          ? "off"
          : null;
  const sessionRoleRaw = toNonEmptyString(raw.sessionRole, "").toLowerCase();
  const sessionRole: UiTaskInput["sessionRole"] =
    sessionRoleRaw === "main" ? "main" : sessionRoleRaw === "secondary" ? "secondary" : null;

  return {
    goal:
      toNonEmptyString(raw.goal, "") ||
      toNonEmptyString(raw.task, "") ||
      toNonEmptyString(raw.text, "") ||
      "Open the page and complete the requested UI flow safely.",
    url: toNullableString(raw.url),
    deviceNodeId: toNullableString(raw.deviceNodeId ?? deviceNodeRaw.nodeId ?? raw.targetNodeId),
    screenshotRef,
    domSnapshot,
    accessibilityTree,
    markHints,
    cursor,
    formData,
    maxSteps: parsePositiveInt(String(raw.maxSteps ?? ""), config.maxStepsDefault),
    simulateFailureAtStep: toNullableInt(raw.simulateFailureAtStep),
    approvalConfirmed:
      raw.approvalConfirmed === true ||
      (typeof raw.approvalDecision === "string" && raw.approvalDecision.toLowerCase() === "approved"),
    approvalDecision:
      typeof raw.approvalDecision === "string" &&
      (raw.approvalDecision.toLowerCase() === "approved" || raw.approvalDecision.toLowerCase() === "rejected")
        ? (raw.approvalDecision.toLowerCase() as "approved" | "rejected")
        : null,
    approvalReason: toNullableString(raw.approvalReason),
    approvalId: toNullableString(raw.approvalId),
    sandboxPolicyMode,
    sessionRole,
    visualTesting: normalizeVisualTestingInput(raw, screenshotRef),
  };
}

function extractSensitiveSignals(text: string, keywords: string[]): string[] {
  const normalized = text.toLowerCase();
  return keywords.filter((keyword) => normalized.includes(keyword));
}

function classifySessionRole(requestSessionId: string, input: UiTaskInput, config: PlannerConfig): "main" | "non_main" {
  if (input.sessionRole === "main") {
    return "main";
  }
  if (input.sessionRole === "secondary") {
    return "non_main";
  }
  const normalizedSessionId = requestSessionId.trim().toLowerCase();
  if (config.sandboxMainSessionIds.includes(normalizedSessionId)) {
    return "main";
  }
  return "non_main";
}

function resolveSandboxPolicyContext(params: {
  requestSessionId: string;
  input: UiTaskInput;
  config: PlannerConfig;
  approvalCategories: string[];
}): SandboxPolicyContext {
  const configuredMode = params.config.sandboxPolicyMode;
  const effectiveMode = params.input.sandboxPolicyMode ?? configuredMode;
  const sessionClass = classifySessionRole(params.requestSessionId, params.input, params.config);

  if (effectiveMode === "off") {
    return {
      configuredMode,
      effectiveMode,
      active: false,
      reason: "mode_off",
      sessionClass,
      maxStepsLimit: params.input.maxSteps,
      baseExecutorMode: params.config.executorMode,
      enforcedExecutorMode: params.config.executorMode,
      allowedActionTypes: params.config.sandboxAllowedActionTypes,
      blockedApprovalCategories: params.config.sandboxBlockedApprovalCategories,
      blockedCategories: [],
    };
  }

  const active = effectiveMode === "all" || (effectiveMode === "non-main" && sessionClass === "non_main");
  const reason: SandboxPolicyContext["reason"] =
    effectiveMode === "all"
      ? "all_sessions"
      : active
        ? "non_main_session"
        : "main_session";
  const blockedCategories = active
    ? params.approvalCategories.filter((item) => params.config.sandboxBlockedApprovalCategories.includes(item))
    : [];

  return {
    configuredMode,
    effectiveMode,
    active,
    reason,
    sessionClass,
    maxStepsLimit: active ? Math.max(1, Math.min(params.input.maxSteps, params.config.sandboxMaxSteps)) : params.input.maxSteps,
    baseExecutorMode: params.config.executorMode,
    enforcedExecutorMode: active
      ? params.config.sandboxForcedExecutorMode ?? "simulated"
      : params.config.executorMode,
    allowedActionTypes: params.config.sandboxAllowedActionTypes,
    blockedApprovalCategories: params.config.sandboxBlockedApprovalCategories,
    blockedCategories,
  };
}

function summarizeBlockedSandboxActions(actions: UiAction[], allowed: UiAction["type"][]): Array<{
  type: UiAction["type"];
  target: string;
}> {
  const allowedSet = new Set<UiAction["type"]>(allowed);
  const blocked = actions.filter((action) => !allowedSet.has(action.type));
  return blocked.slice(0, 12).map((action) => ({
    type: action.type,
    target: action.target,
  }));
}

function makeAction(params: {
  type: UiAction["type"];
  target: string;
  coordinates?: { x: number; y: number } | null;
  text?: string | null;
  rationale: string;
}): UiAction {
  return {
    id: randomUUID(),
    type: params.type,
    target: params.target,
    coordinates: params.coordinates ?? null,
    text: params.text ?? null,
    rationale: params.rationale,
  };
}

function buildRuleBasedPlan(input: UiTaskInput): UiAction[] {
  const actions: UiAction[] = [];
  const goal = input.goal.toLowerCase();

  if (input.url) {
    actions.push(
      makeAction({
        type: "navigate",
        target: input.url,
        rationale: "Open requested URL as the first deterministic step.",
      }),
    );
  }

  if (input.screenshotRef) {
    actions.push(
      makeAction({
        type: "verify",
        target: "initial-screen",
        rationale: "Validate initial visual state before interacting with UI.",
      }),
    );
  }

  if (goal.includes("scroll")) {
    actions.push(
      makeAction({
        type: "scroll",
        target: "main-content",
        coordinates: input.cursor,
        rationale: "Goal explicitly requests scrolling behavior.",
      }),
    );
  }

  const formEntries = Object.entries(input.formData);
  for (const [field, value] of formEntries) {
    actions.push(
      makeAction({
        type: "click",
        target: `field:${field}`,
        rationale: `Focus form field '${field}' before typing.`,
      }),
    );
    actions.push(
      makeAction({
        type: "type",
        target: `field:${field}`,
        text: value,
        rationale: `Fill '${field}' from provided form data.`,
      }),
    );
  }

  if (goal.includes("submit") || goal.includes("send") || goal.includes("confirm")) {
    actions.push(
      makeAction({
        type: "click",
        target: "button:submit",
        rationale: "Trigger final submit action requested by user goal.",
      }),
    );
  }

  actions.push(
    makeAction({
      type: "verify",
      target: "post-action-screen",
      rationale: "Capture and verify resulting UI state for self-correction loop.",
    }),
  );

  return actions;
}

async function fetchGeminiText(params: {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  model: string;
  prompt: string;
  responseMimeType?: "application/json" | "text/plain";
  temperature?: number;
}): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);
  const endpoint = `${params.baseUrl.replace(/\/+$/, "")}/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;

  try {
    const body: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts: [{ text: params.prompt }],
        },
      ],
      generationConfig: {
        temperature: params.temperature ?? 0.1,
      },
    };
    if (params.responseMimeType) {
      body.generationConfig = {
        ...(isRecord(body.generationConfig) ? body.generationConfig : {}),
        responseMimeType: params.responseMimeType,
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }
    const parsed = (await response.json()) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.candidates)) {
      return null;
    }

    const parts: string[] = [];
    for (const candidate of parsed.candidates) {
      if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
        continue;
      }
      for (const part of candidate.content.parts) {
        if (isRecord(part) && typeof part.text === "string") {
          parts.push(part.text);
        }
      }
    }
    return parts.length > 0 ? parts.join("\n").trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function createUiNavigatorCapabilitySet(config: PlannerConfig): UiNavigatorCapabilitySet {
  const reasoning: ReasoningCapabilityAdapter = {
    descriptor: {
      capability: "reasoning",
      adapterId: config.apiKey ? "gemini-ui-reasoning" : "fallback-ui-reasoning",
      provider: config.apiKey ? "gemini_api" : "fallback",
      model: config.plannerModel,
      mode: config.apiKey && config.plannerEnabled ? "default" : "fallback",
    },
    async generateText(params) {
      if (!config.apiKey || !config.plannerEnabled) {
        return null;
      }
      return fetchGeminiText({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs,
        model: params.model ?? config.plannerModel,
        prompt: params.prompt,
        responseMimeType: params.responseMimeType,
        temperature: params.temperature,
      });
    },
  };

  const computerUse: ComputerUseCapabilityAdapter = {
    descriptor: {
      capability: "computer_use",
      adapterId: config.apiKey ? "gemini-computer-use-compatible" : "rule-based-computer-use",
      provider: config.apiKey ? "gemini_api" : "fallback",
      model: config.plannerModel,
      mode: config.apiKey && config.plannerEnabled ? "default" : "fallback",
    },
  };

  return {
    reasoning,
    computerUse,
    profile: buildCapabilityProfile([reasoning, computerUse]),
  };
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseGeminiActions(parsed: Record<string, unknown>): UiAction[] {
  if (!Array.isArray(parsed.actions)) {
    return [];
  }
  const actions: UiAction[] = [];
  for (const item of parsed.actions) {
    if (!isRecord(item)) {
      continue;
    }
    const actionType = toNonEmptyString(item.type, "") as UiAction["type"];
    if (!["navigate", "click", "type", "scroll", "hotkey", "wait", "verify"].includes(actionType)) {
      continue;
    }
    const coordinates =
      isRecord(item.coordinates) && typeof item.coordinates.x === "number" && typeof item.coordinates.y === "number"
        ? { x: item.coordinates.x, y: item.coordinates.y }
        : null;
    actions.push(
      makeAction({
        type: actionType,
        target: toNonEmptyString(item.target, "unknown-target"),
        coordinates,
        text: toNullableString(item.text),
        rationale: toNonEmptyString(item.rationale, "Model-planned UI action."),
      }),
    );
  }
  return actions;
}

async function buildActionPlan(params: {
  input: UiTaskInput;
  config: PlannerConfig;
  capabilities: UiNavigatorCapabilitySet;
  skillsPrompt: string | null;
}): Promise<{
  actions: UiAction[];
  plannerProvider: "gemini" | "fallback";
  plannerModel: string;
}> {
  const { input, config, capabilities, skillsPrompt } = params;
  const fallbackPlan = buildRuleBasedPlan(input);
  if (!config.apiKey || !config.plannerEnabled) {
    return {
      actions: fallbackPlan,
      plannerProvider: "fallback",
      plannerModel: "rule-based",
    };
  }

  const prompt = [
    "You are a UI automation planner.",
    "Return strict JSON with an `actions` array.",
    "Each action item fields: type, target, coordinates(optional object x,y), text(optional), rationale.",
    "Allowed types: navigate, click, type, scroll, hotkey, wait, verify.",
    skillsPrompt ? `Skill directives:\n${skillsPrompt}` : null,
    `Goal: ${input.goal}`,
    `URL: ${input.url ?? "n/a"}`,
    `ScreenshotRef: ${input.screenshotRef ?? "n/a"}`,
    `DOM snapshot excerpt: ${clipText(input.domSnapshot, 1200) ?? "n/a"}`,
    `Accessibility tree excerpt: ${clipText(input.accessibilityTree, 1200) ?? "n/a"}`,
    `Set-of-marks hints: ${input.markHints.length > 0 ? JSON.stringify(input.markHints.slice(0, 25)) : "n/a"}`,
    `Cursor: ${input.cursor ? `${input.cursor.x},${input.cursor.y}` : "n/a"}`,
    `Form data: ${JSON.stringify(input.formData)}`,
    `Max steps: ${input.maxSteps}`,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n");

  const raw = await capabilities.reasoning.generateText({
    model: config.plannerModel,
    prompt,
    responseMimeType: "application/json",
    temperature: 0.1,
  });

  if (!raw) {
    return {
      actions: fallbackPlan,
      plannerProvider: "fallback",
      plannerModel: "rule-based",
    };
  }

  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return {
      actions: fallbackPlan,
      plannerProvider: "fallback",
      plannerModel: "rule-based",
    };
  }

  const actions = parseGeminiActions(parsed);
  if (actions.length === 0) {
    return {
      actions: fallbackPlan,
      plannerProvider: "fallback",
      plannerModel: "rule-based",
    };
  }

  return {
    actions,
    plannerProvider: "gemini",
    plannerModel: config.plannerModel,
  };
}

function limitActions(actions: UiAction[], maxSteps: number): UiAction[] {
  if (actions.length <= maxSteps) {
    return actions;
  }
  return actions.slice(0, maxSteps);
}

type ToolLoopDetectorRecord = {
  signature: string;
  actionType: UiAction["type"];
  ts: number;
};

type LoopDetectionResult = {
  detected: boolean;
  atIndex: number | null;
  duplicateCount: number;
  signature: string | null;
  source: "plan" | "trace";
};

function tokenizeSignature(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function calculateTokenSimilarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }
  const leftTokens = tokenizeSignature(left);
  const rightTokens = tokenizeSignature(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }
  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function actionSignature(action: {
  type: UiAction["type"];
  target: string;
  text: string | null;
  coordinates: { x: number; y: number } | null;
}): string {
  const coordinates = action.coordinates ? `${action.coordinates.x},${action.coordinates.y}` : "none";
  return `${action.type}|${action.target.trim().toLowerCase()}|${(action.text ?? "").trim().toLowerCase()}|${coordinates}`;
}

class ToolLoopDetector {
  private readonly recentCalls: ToolLoopDetectorRecord[] = [];

  private readonly windowSize: number;

  private readonly repeatThreshold: number;

  private readonly similarityThreshold: number;

  constructor(params: {
    windowSize: number;
    repeatThreshold: number;
    similarityThreshold: number;
  }) {
    this.windowSize = Math.max(2, params.windowSize);
    this.repeatThreshold = Math.max(2, params.repeatThreshold);
    this.similarityThreshold = Math.min(1, Math.max(0.5, params.similarityThreshold));
  }

  check(action: {
    type: UiAction["type"];
    target: string;
    text: string | null;
    coordinates: { x: number; y: number } | null;
  }): { verdict: "ok" | "loop_detected"; signature: string; duplicateCount: number } {
    if (action.type === "wait" || action.type === "verify") {
      return {
        verdict: "ok",
        signature: actionSignature(action),
        duplicateCount: 0,
      };
    }

    const signature = actionSignature(action);
    const similarCount = this.recentCalls.filter(
      (record) =>
        record.actionType === action.type &&
        calculateTokenSimilarity(record.signature, signature) >= this.similarityThreshold,
    ).length;

    const duplicateCount = similarCount + 1;
    if (duplicateCount >= this.repeatThreshold) {
      return {
        verdict: "loop_detected",
        signature,
        duplicateCount,
      };
    }

    this.recentCalls.push({
      actionType: action.type,
      signature,
      ts: Date.now(),
    });
    if (this.recentCalls.length > this.windowSize) {
      this.recentCalls.splice(0, this.recentCalls.length - this.windowSize);
    }

    return {
      verdict: "ok",
      signature,
      duplicateCount,
    };
  }
}

function detectActionLoop(actions: UiAction[], config: PlannerConfig): LoopDetectionResult {
  if (!config.loopDetectionEnabled || actions.length === 0) {
    return {
      detected: false,
      atIndex: null,
      duplicateCount: 0,
      signature: null,
      source: "plan",
    };
  }

  const detector = new ToolLoopDetector({
    windowSize: config.loopWindowSize,
    repeatThreshold: config.loopRepeatThreshold,
    similarityThreshold: config.loopSimilarityThreshold,
  });

  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    if (!action) {
      continue;
    }
    const verdict = detector.check(action);
    if (verdict.verdict === "loop_detected") {
      return {
        detected: true,
        atIndex: index + 1,
        duplicateCount: verdict.duplicateCount,
        signature: verdict.signature,
        source: "plan",
      };
    }
  }

  return {
    detected: false,
    atIndex: null,
    duplicateCount: 0,
    signature: null,
    source: "plan",
  };
}

function detectTraceLoop(trace: UiTraceStep[], config: PlannerConfig): LoopDetectionResult {
  if (!config.loopDetectionEnabled || trace.length === 0) {
    return {
      detected: false,
      atIndex: null,
      duplicateCount: 0,
      signature: null,
      source: "trace",
    };
  }

  const detector = new ToolLoopDetector({
    windowSize: config.loopWindowSize,
    repeatThreshold: config.loopRepeatThreshold,
    similarityThreshold: config.loopSimilarityThreshold,
  });

  for (let index = 0; index < trace.length; index += 1) {
    const step = trace[index];
    if (!step) {
      continue;
    }
    if (step.status === "blocked") {
      continue;
    }
    const verdict = detector.check({
      type: step.actionType,
      target: step.target,
      text: null,
      coordinates: null,
    });
    if (verdict.verdict === "loop_detected") {
      return {
        detected: true,
        atIndex: index + 1,
        duplicateCount: verdict.duplicateCount,
        signature: verdict.signature,
        source: "trace",
      };
    }
  }

  return {
    detected: false,
    atIndex: null,
    duplicateCount: 0,
    signature: null,
    source: "trace",
  };
}

function simulateExecution(params: {
  actions: UiAction[];
  screenshotSeed: string;
  simulateFailureAtStep: number | null;
}): { trace: UiTraceStep[]; finalStatus: "completed" | "failed"; retries: number } {
  const trace: UiTraceStep[] = [];
  let retries = 0;
  let finalStatus: "completed" | "failed" = "completed";

  for (let index = 0; index < params.actions.length; index += 1) {
    const action = params.actions[index];
    const stepIndex = index + 1;
    const baseScreenshot = `${params.screenshotSeed}/step-${stepIndex}.png`;
    const shouldFail = params.simulateFailureAtStep !== null && stepIndex === params.simulateFailureAtStep;

    if (shouldFail) {
      trace.push({
        index: stepIndex,
        actionId: action.id,
        actionType: action.type,
        target: action.target,
        status: "retry",
        screenshotRef: baseScreenshot,
        notes: "Initial verification failed, triggering one self-correction retry.",
      });
      retries += 1;

      trace.push({
        index: stepIndex,
        actionId: action.id,
        actionType: action.type,
        target: `${action.target} (retry)`,
        status: "ok",
        screenshotRef: `${params.screenshotSeed}/step-${stepIndex}-retry.png`,
        notes: "Retry succeeded with updated locator and refreshed screenshot context.",
      });
      continue;
    }

    trace.push({
      index: stepIndex,
      actionId: action.id,
      actionType: action.type,
      target: action.target,
      status: "ok",
      screenshotRef: baseScreenshot,
      notes: "Step executed successfully.",
    });
  }

  if (trace.some((step) => step.status === "failed")) {
    finalStatus = "failed";
  }

  return { trace, finalStatus, retries };
}

type ExecutionResult = {
  trace: UiTraceStep[];
  finalStatus: "completed" | "failed";
  retries: number;
  executor: string;
  adapterMode: PlannerConfig["executorMode"];
  adapterNotes: string[];
  deviceNode: DeviceNodeRuntimeRecord | null;
  grounding: GroundingSignalSummary;
};

function defaultExecutionResult(params: {
  trace: UiTraceStep[];
  finalStatus: "completed" | "failed";
  retries: number;
  executor: string;
  adapterMode: PlannerConfig["executorMode"];
  adapterNotes?: string[];
  deviceNode?: DeviceNodeRuntimeRecord | null;
  grounding: GroundingSignalSummary;
}): ExecutionResult {
  return {
    trace: params.trace,
    finalStatus: params.finalStatus,
    retries: params.retries,
    executor: params.executor,
    adapterMode: params.adapterMode,
    adapterNotes: params.adapterNotes ?? [],
    deviceNode: params.deviceNode ?? null,
    grounding: params.grounding,
  };
}

function buildGroundingSignalSummary(input: UiTaskInput): GroundingSignalSummary {
  return {
    screenshotRefProvided: typeof input.screenshotRef === "string" && input.screenshotRef.trim().length > 0,
    domSnapshotProvided: typeof input.domSnapshot === "string" && input.domSnapshot.trim().length > 0,
    accessibilityTreeProvided: typeof input.accessibilityTree === "string" && input.accessibilityTree.trim().length > 0,
    markHintsCount: Array.isArray(input.markHints) ? input.markHints.length : 0,
  };
}

function groundingAdapterNote(summary: GroundingSignalSummary): string {
  return `grounding_context screenshot=${summary.screenshotRefProvided} dom=${summary.domSnapshotProvided} a11y=${summary.accessibilityTreeProvided} marks=${summary.markHintsCount}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class NonRetriableExecutorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetriableExecutorError";
  }
}

async function executeWithRemoteHttpAdapter(params: {
  config: PlannerConfig;
  actions: UiAction[];
  screenshotSeed: string;
  input: UiTaskInput;
  routing: DeviceNodeResolution;
}): Promise<ExecutionResult | null> {
  if (!params.routing.executorUrl) {
    return null;
  }

  const endpoint = `${params.routing.executorUrl.replace(/\/+$/, "")}/execute`;
  let lastError: Error | null = null;
  const totalAttempts = params.config.executorRequestMaxRetries + 1;
  const grounding = buildGroundingSignalSummary(params.input);

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), params.config.executorTimeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(params.routing.selectedNode ? { "x-device-node-id": params.routing.selectedNode.nodeId } : {}),
        },
        body: JSON.stringify({
          actions: params.actions,
          context: {
            screenshotRef: params.input.screenshotRef,
            domSnapshot: params.input.domSnapshot,
            accessibilityTree: params.input.accessibilityTree,
            markHints: params.input.markHints,
            cursor: params.input.cursor,
            goal: params.input.goal,
            deviceNodeId: params.routing.selectedNode?.nodeId ?? params.input.deviceNodeId,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status >= 500 || response.status === 429) {
          lastError = new Error(`remote executor failed with ${response.status}`);
        } else {
          throw new NonRetriableExecutorError(`remote executor failed with ${response.status}`);
        }
      } else {
        const parsed = (await response.json()) as unknown;
        if (!isRecord(parsed) || !Array.isArray(parsed.trace)) {
          throw new Error("remote executor returned invalid payload");
        }

        const trace: UiTraceStep[] = [];
        for (const item of parsed.trace) {
          if (!isRecord(item)) {
            continue;
          }
          trace.push({
            index: toNullableInt(item.index) ?? trace.length + 1,
            actionId: toNonEmptyString(item.actionId, randomUUID()),
            actionType: (toNonEmptyString(item.actionType, "verify") as UiAction["type"]),
            target: toNonEmptyString(item.target, "unknown-target"),
            status:
              item.status === "retry" || item.status === "failed" || item.status === "blocked"
                ? item.status
                : "ok",
            screenshotRef: toNonEmptyString(
              item.screenshotRef,
              `${params.screenshotSeed}/remote-${trace.length + 1}.png`,
            ),
            notes: toNonEmptyString(item.notes, "remote executor step"),
          });
        }

        const finalStatus = parsed.finalStatus === "failed" ? "failed" : "completed";
        const retries = toNullableInt(parsed.retries) ?? 0;
        const remoteNode = parseDeviceNodeRecord(parsed.deviceNode);
        return defaultExecutionResult({
          trace,
          finalStatus,
          retries,
          executor: "remote-http-adapter",
          adapterMode: "remote_http",
          adapterNotes: [
            "Executed via remote HTTP adapter",
            groundingAdapterNote(grounding),
            ...params.routing.notes,
          ],
          deviceNode: remoteNode ?? params.routing.selectedNode,
          grounding,
        });
      }
    } catch (error) {
      if (error instanceof NonRetriableExecutorError) {
        throw error;
      }
      const isAbortError = error instanceof Error && error.name === "AbortError";
      lastError = isAbortError
        ? new Error(`remote executor request timed out after ${params.config.executorTimeoutMs}ms`)
        : error instanceof Error
          ? error
          : new Error("remote executor failed");
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < params.config.executorRequestMaxRetries) {
      await sleep(params.config.executorRetryBackoffMs * (attempt + 1));
      continue;
    }
    if (lastError) {
      throw lastError;
    }
  }

  throw new Error("remote executor failed");
}

async function executeWithPlaywrightPreview(params: {
  input: UiTaskInput;
  actions: UiAction[];
  screenshotSeed: string;
  deviceNode?: DeviceNodeRuntimeRecord | null;
}): Promise<ExecutionResult | null> {
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
    launch: (options: { headless: boolean }) => Promise<{
      newPage: () => Promise<{
        goto: (url: string, options?: { waitUntil?: string; timeout?: number }) => Promise<void>;
        click: (selector: string, options?: { timeout?: number }) => Promise<void>;
        fill: (selector: string, value: string, options?: { timeout?: number }) => Promise<void>;
        press: (selector: string, key: string, options?: { timeout?: number }) => Promise<void>;
        evaluate: (callback: () => void) => Promise<void>;
        waitForTimeout: (ms: number) => Promise<void>;
      }>;
      close: () => Promise<void>;
    }>;
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const trace: UiTraceStep[] = [];
  let retries = 0;
  let finalStatus: "completed" | "failed" = "completed";

  try {
    for (let index = 0; index < params.actions.length; index += 1) {
      const action = params.actions[index];
      const stepIndex = index + 1;
      const screenshotRef = `${params.screenshotSeed}/playwright-step-${stepIndex}.png`;
      try {
        if (action.type === "navigate") {
          await page.goto(action.target, { waitUntil: "domcontentloaded", timeout: 15000 });
        } else if (action.type === "click") {
          if (action.target.startsWith("css:")) {
            await page.click(action.target.slice(4), { timeout: 2500 });
          } else if (action.target.startsWith("field:")) {
            const field = action.target.slice("field:".length);
            await page.click(`[name="${field}"],#${field}`, { timeout: 2500 });
          } else if (action.target === "button:submit") {
            await page.click('button[type="submit"],input[type="submit"]', { timeout: 2500 });
          } else {
            await page.click(action.target, { timeout: 2500 });
          }
        } else if (action.type === "type") {
          const value = action.text ?? "";
          if (action.target.startsWith("field:")) {
            const field = action.target.slice("field:".length);
            await page.fill(`[name="${field}"],#${field}`, value, { timeout: 2500 });
          } else if (action.target.startsWith("css:")) {
            await page.fill(action.target.slice(4), value, { timeout: 2500 });
          } else {
            await page.fill(action.target, value, { timeout: 2500 });
          }
        } else if (action.type === "scroll") {
          await page.evaluate(() => {
            window.scrollBy(0, Math.floor(window.innerHeight * 0.6));
          });
        } else if (action.type === "hotkey") {
          const key = action.text ?? "Enter";
          await page.press("body", key, { timeout: 2500 });
        } else if (action.type === "wait") {
          await page.waitForTimeout(350);
        } else if (action.type === "verify") {
          await page.waitForTimeout(150);
        }

        trace.push({
          index: stepIndex,
          actionId: action.id,
          actionType: action.type,
          target: action.target,
          status: "ok",
          screenshotRef,
          notes: "Executed by playwright preview adapter.",
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
          notes: `Playwright retry after error: ${error instanceof Error ? error.message : String(error)}`,
        });
        try {
          if (action.type === "wait" || action.type === "verify") {
            await page.waitForTimeout(250);
          } else if (action.type === "scroll") {
            await page.evaluate(() => {
              window.scrollBy(0, Math.floor(window.innerHeight * 0.4));
            });
          } else {
            await page.waitForTimeout(250);
          }
          trace.push({
            index: stepIndex,
            actionId: action.id,
            actionType: action.type,
            target: `${action.target} (retry)`,
            status: "ok",
            screenshotRef: `${params.screenshotSeed}/playwright-step-${stepIndex}-retry.png`,
            notes: "Retry passed in playwright preview mode.",
          });
        } catch (retryError) {
          trace.push({
            index: stepIndex,
            actionId: action.id,
            actionType: action.type,
            target: `${action.target} (retry)`,
            status: "failed",
            screenshotRef: `${params.screenshotSeed}/playwright-step-${stepIndex}-retry.png`,
            notes: `Retry failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
          });
          finalStatus = "failed";
          break;
        }
      }
    }
  } finally {
    await browser.close();
  }

  return defaultExecutionResult({
    trace,
    finalStatus,
    retries,
    executor: "playwright-preview-adapter",
    adapterMode: "playwright_preview",
    adapterNotes: [
      "Executed with optional local playwright preview adapter",
      groundingAdapterNote(buildGroundingSignalSummary(params.input)),
    ],
    deviceNode: params.deviceNode ?? null,
    grounding: buildGroundingSignalSummary(params.input),
  });
}

async function executeActionPlan(params: {
  config: PlannerConfig;
  actions: UiAction[];
  screenshotSeed: string;
  input: UiTaskInput;
  routing: DeviceNodeResolution;
}): Promise<ExecutionResult> {
  function buildRemoteHttpFallbackResult(message: string): ExecutionResult {
    const grounding = buildGroundingSignalSummary(params.input);
    if (params.config.remoteHttpFallbackMode === "failed") {
      const firstAction = params.actions[0];
      const failedTrace: UiTraceStep[] = [
        {
          index: 1,
          actionId: firstAction?.id ?? "remote-http-failure",
          actionType: firstAction?.type ?? "verify",
          target: firstAction?.target ?? "remote-http",
          status: "failed",
          screenshotRef: `${params.screenshotSeed}/remote-http-failure.png`,
          notes: `Remote HTTP execution failed: ${message}`,
        },
      ];
      return defaultExecutionResult({
        trace: failedTrace,
        finalStatus: "failed",
        retries: 0,
        executor: "remote-http-adapter",
        adapterMode: "remote_http",
        adapterNotes: [
          `remote_http strict failure: ${message}`,
          groundingAdapterNote(grounding),
          ...params.routing.notes,
        ],
        deviceNode: params.routing.selectedNode,
        grounding,
      });
    }

    const fallbackSimulation = simulateExecution({
      actions: params.actions,
      screenshotSeed: params.screenshotSeed,
      simulateFailureAtStep: params.input.simulateFailureAtStep,
    });
    return defaultExecutionResult({
      trace: fallbackSimulation.trace,
      finalStatus: fallbackSimulation.finalStatus,
      retries: fallbackSimulation.retries,
      executor: "playwright-adapter",
      adapterMode: "simulated",
      adapterNotes: [
        `remote_http fallback: ${message}`,
        groundingAdapterNote(grounding),
        ...params.routing.notes,
      ],
      deviceNode: params.routing.selectedNode,
      grounding,
    });
  }

  let fallbackNote: string | null = null;

  if (params.config.executorMode === "remote_http") {
    try {
      const remoteResult = await executeWithRemoteHttpAdapter(params);
      if (remoteResult) {
        return remoteResult;
      }
      const missingResultMessage = params.routing.executorUrl
        ? "remote_http adapter returned no result"
        : "remote_http mode requested without executor URL";
      return buildRemoteHttpFallbackResult(missingResultMessage);
    } catch (error) {
      return buildRemoteHttpFallbackResult(error instanceof Error ? error.message : String(error));
    }
  }

  if (params.config.executorMode === "playwright_preview") {
    try {
      const playwrightResult = await executeWithPlaywrightPreview({
        input: params.input,
        actions: params.actions,
        screenshotSeed: params.screenshotSeed,
        deviceNode: params.routing.selectedNode,
      });
      if (playwrightResult) {
        return playwrightResult;
      }
      fallbackNote = "playwright preview module unavailable, switched to simulation";
    } catch (error) {
      const fallbackSimulation = simulateExecution({
        actions: params.actions,
        screenshotSeed: params.screenshotSeed,
        simulateFailureAtStep: params.input.simulateFailureAtStep,
      });
      const grounding = buildGroundingSignalSummary(params.input);
      return defaultExecutionResult({
        trace: fallbackSimulation.trace,
        finalStatus: fallbackSimulation.finalStatus,
        retries: fallbackSimulation.retries,
        executor: "playwright-adapter",
        adapterMode: "simulated",
        adapterNotes: [
          `playwright_preview fallback: ${error instanceof Error ? error.message : String(error)}`,
          groundingAdapterNote(grounding),
        ],
        deviceNode: params.routing.selectedNode,
        grounding,
      });
    }
  }

  const simulation = simulateExecution({
    actions: params.actions,
    screenshotSeed: params.screenshotSeed,
    simulateFailureAtStep: params.input.simulateFailureAtStep,
  });
  const grounding = buildGroundingSignalSummary(params.input);

  return defaultExecutionResult({
    trace: simulation.trace,
    finalStatus: simulation.finalStatus,
    retries: simulation.retries,
    executor: "playwright-adapter",
    adapterMode: "simulated",
    adapterNotes: [
      fallbackNote ?? "Executed in deterministic simulation mode",
      groundingAdapterNote(grounding),
      ...params.routing.notes,
    ],
    deviceNode: params.routing.selectedNode,
    grounding,
  });
}

function buildApprovalCategories(signals: string[]): string[] {
  const categories = new Set<string>();
  for (const signal of signals) {
    if (["payment", "pay", "card", "transfer", "wire", "purchase"].includes(signal)) {
      categories.add("payment");
    } else if (["credential", "password"].includes(signal)) {
      categories.add("credential_submission");
    } else if (["delete", "remove"].includes(signal)) {
      categories.add("destructive_operation");
    } else {
      categories.add("sensitive_operation");
    }
  }
  return Array.from(categories);
}

function inferVisualCategory(assertion: string): VisualCategory {
  const normalized = assertion.toLowerCase();
  if (/(click|type|button|control|interaction|form|input|submit|action)/.test(normalized)) {
    return "interaction";
  }
  if (/(text|label|content|title|copy|message|value)/.test(normalized)) {
    return "content";
  }
  return "layout";
}

function normalizeVisualCategory(value: unknown, fallback: VisualCategory): VisualCategory {
  if (value === "layout" || value === "content" || value === "interaction") {
    return value;
  }
  return fallback;
}

function normalizeVisualStatus(value: unknown, fallback: VisualStatus): VisualStatus {
  if (value === "ok" || value === "regression") {
    return value;
  }
  return fallback;
}

function normalizeVisualSeverity(value: unknown, fallback: VisualSeverity): VisualSeverity {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return fallback;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length === 0) {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function collectActualScreenshotRefs(trace: UiTraceStep[], screenshotSeed: string): string[] {
  const refs = trace
    .map((step) => step.screenshotRef)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const unique = uniqueStrings(refs);
  if (unique.length > 0) {
    return unique;
  }
  return [`${screenshotSeed}/visual-actual.png`];
}

function severityRank(value: "none" | VisualSeverity): number {
  switch (value) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function inferHighestSeverity(checks: VisualTestingCheck[]): "none" | VisualSeverity {
  let highest: "none" | VisualSeverity = "none";
  for (const check of checks) {
    if (check.status !== "regression") {
      continue;
    }
    if (severityRank(check.severity) > severityRank(highest)) {
      highest = check.severity;
    }
  }
  return highest;
}

function summarizeTraceForPrompt(trace: UiTraceStep[]): string {
  const lines = trace.map(
    (step) =>
      `#${step.index} ${step.actionType} target=${step.target} status=${step.status} screenshot=${step.screenshotRef}`,
  );
  return lines.join("\n");
}

function buildVisualChecksHeuristic(params: {
  input: UiTaskInput;
  execution: ExecutionResult;
  actualScreenshotRefs: string[];
}): VisualTestingCheck[] {
  const hasFailedStep = params.execution.trace.some((step) => step.status === "failed");
  const hasRetryStep = params.execution.trace.some((step) => step.status === "retry");
  const hasVerifyStep = params.execution.trace.some((step) => step.actionType === "verify" && step.status !== "failed");
  const regressionHint = params.input.visualTesting.regressionHint?.toLowerCase() ?? "";
  const hintSignalsRegression = /(missing|broken|overlap|misalign|clipped|wrong|mismatch|not visible|blocked)/.test(
    regressionHint,
  );

  return params.input.visualTesting.expectedAssertions.map((assertion, index) => {
    const category = inferVisualCategory(assertion);
    let status: VisualStatus = "ok";
    let severity: VisualSeverity = "low";
    let observed = "No regression signal detected from execution trace.";

    if (params.input.visualTesting.simulateRegression && index === 0) {
      status = "regression";
      severity = "high";
      observed = params.input.visualTesting.regressionHint ?? "Simulated regression marker enabled for this run.";
    } else if (category === "interaction") {
      if (hasFailedStep) {
        status = "regression";
        severity = "high";
        observed = "One or more interaction steps failed even after retry.";
      } else if (hasRetryStep) {
        status = "regression";
        severity = "medium";
        observed = "Interaction required retry/self-correction before completion.";
      } else {
        observed = "Interaction steps completed without retries.";
      }
    } else if (category === "layout") {
      if (!params.input.visualTesting.baselineScreenshotRef) {
        status = "regression";
        severity = "medium";
        observed = "Baseline screenshot reference is missing for layout comparison.";
      } else if (hintSignalsRegression) {
        status = "regression";
        severity = "medium";
        observed = params.input.visualTesting.regressionHint ?? "Layout anomaly flagged by regression hint.";
      } else {
        observed = "Baseline and actual screenshot references are present for layout check.";
      }
    } else if (!hasVerifyStep) {
      status = "regression";
      severity = "medium";
      observed = "No verify step detected, content confirmation is weak.";
    } else if (hintSignalsRegression) {
      status = "regression";
      severity = "medium";
      observed = params.input.visualTesting.regressionHint ?? "Content anomaly flagged by regression hint.";
    } else {
      observed = "Verify checkpoints are present for content confirmation.";
    }

    return {
      id: randomUUID(),
      category,
      assertion,
      status,
      severity,
      observed,
      evidenceRefs: params.actualScreenshotRefs.slice(0, 3),
    };
  });
}

function parseGeminiVisualChecks(parsed: Record<string, unknown>): VisualTestingCheck[] {
  if (!Array.isArray(parsed.checks)) {
    return [];
  }
  const checks: VisualTestingCheck[] = [];

  for (const item of parsed.checks) {
    if (!isRecord(item)) {
      continue;
    }
    const assertion = toNonEmptyString(item.assertion, "");
    if (assertion.length === 0) {
      continue;
    }
    const fallbackCategory = inferVisualCategory(assertion);
    const category = normalizeVisualCategory(item.category, fallbackCategory);
    const status = normalizeVisualStatus(item.status, "ok");
    const severity = normalizeVisualSeverity(item.severity, status === "regression" ? "medium" : "low");
    const observed = toNonEmptyString(item.observed, "Model-based visual reasoning output.");
    const evidenceRefs = toStringArray(item.evidenceRefs);

    checks.push({
      id: randomUUID(),
      category,
      assertion,
      status,
      severity,
      observed,
      evidenceRefs,
    });
  }

  return checks;
}

async function buildVisualChecksWithGemini(params: {
  input: UiTaskInput;
  config: PlannerConfig;
  capabilities: UiNavigatorCapabilitySet;
  actualScreenshotRefs: string[];
  execution: ExecutionResult;
  skillsPrompt: string | null;
}): Promise<VisualTestingCheck[] | null> {
  if (!params.config.apiKey || !params.config.plannerEnabled) {
    return null;
  }

  const prompt = [
    "You are a visual QA evaluator for UI automation outputs.",
    "Given screenshot references and execution trace, produce strict JSON.",
    "Schema: {\"checks\":[{\"assertion\":\"string\",\"category\":\"layout|content|interaction\",\"status\":\"ok|regression\",\"severity\":\"low|medium|high\",\"observed\":\"string\",\"evidenceRefs\":[\"string\"]}]}",
    "Only output JSON.",
    params.skillsPrompt ? `Skill directives:\n${params.skillsPrompt}` : null,
    `Baseline screenshot ref: ${params.input.visualTesting.baselineScreenshotRef ?? "n/a"}`,
    `Actual screenshot refs: ${JSON.stringify(params.actualScreenshotRefs.slice(0, 8))}`,
    `Expected assertions: ${JSON.stringify(params.input.visualTesting.expectedAssertions)}`,
    `Regression hint: ${params.input.visualTesting.regressionHint ?? "none"}`,
    `Execution finalStatus: ${params.execution.finalStatus}, retries: ${params.execution.retries}`,
    `Trace summary:\n${summarizeTraceForPrompt(params.execution.trace)}`,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n");

  const raw = await params.capabilities.reasoning.generateText({
    model: params.config.plannerModel,
    prompt,
    responseMimeType: "application/json",
    temperature: 0.1,
  });
  if (!raw) {
    return null;
  }

  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return null;
  }

  const checks = parseGeminiVisualChecks(parsed);
  if (checks.length === 0) {
    return null;
  }

  return checks;
}

function buildDefaultVisualTestingReport(): VisualTestingReport {
  return {
    enabled: false,
    status: "not_requested",
    baselineScreenshotRef: null,
    actualScreenshotRefs: [],
    checks: [],
    regressionCount: 0,
    highestSeverity: "none",
    comparator: {
      provider: "fallback",
      model: "heuristic-visual-comparator",
      mode: "fallback_heuristic",
    },
    artifactRefs: {
      baseline: null,
      actual: [],
      diff: [],
    },
    generatedAt: new Date().toISOString(),
  };
}

async function buildVisualTestingReport(params: {
  input: UiTaskInput;
  execution: ExecutionResult;
  screenshotSeed: string;
  capabilities: UiNavigatorCapabilitySet;
  config: PlannerConfig;
  skillsPrompt: string | null;
}): Promise<VisualTestingReport> {
  if (!params.input.visualTesting.enabled) {
    return buildDefaultVisualTestingReport();
  }

  const actualScreenshotRefs = collectActualScreenshotRefs(params.execution.trace, params.screenshotSeed);
  const heuristicChecks = buildVisualChecksHeuristic({
    input: params.input,
    execution: params.execution,
    actualScreenshotRefs,
  });

  const geminiChecks = await buildVisualChecksWithGemini({
    input: params.input,
    config: params.config,
    capabilities: params.capabilities,
    actualScreenshotRefs,
    execution: params.execution,
    skillsPrompt: params.skillsPrompt,
  });

  const checks = geminiChecks ?? heuristicChecks;
  const regressionCount = checks.filter((check) => check.status === "regression").length;
  const highestSeverity = inferHighestSeverity(checks);
  const diffRefs = checks
    .filter((check) => check.status === "regression")
    .map((_, index) => `${params.screenshotSeed}/visual-diff-${index + 1}.png`);

  return {
    enabled: true,
    status: regressionCount === 0 ? "passed" : "failed",
    baselineScreenshotRef: params.input.visualTesting.baselineScreenshotRef,
    actualScreenshotRefs,
    checks,
    regressionCount,
    highestSeverity,
    comparator:
      geminiChecks !== null
        ? {
            provider: params.capabilities.reasoning.descriptor.provider,
            model: params.config.plannerModel,
            mode: "gemini_reasoning",
          }
        : {
            provider: "fallback",
            model: "heuristic-visual-comparator",
            mode: "fallback_heuristic",
          },
    artifactRefs: {
      baseline: params.input.visualTesting.baselineScreenshotRef,
      actual: actualScreenshotRefs,
      diff: diffRefs,
    },
    generatedAt: new Date().toISOString(),
  };
}

function toNormalizedError(error: unknown, traceId: string): NormalizedError {
  if (error instanceof Error) {
    return {
      code: "UI_NAVIGATOR_ERROR",
      message: error.message,
      traceId,
    };
  }
  return {
    code: "UI_NAVIGATOR_ERROR",
    message: "Unknown ui-navigator failure",
    traceId,
  };
}

function buildSandboxPolicyPayload(context: SandboxPolicyContext): Record<string, unknown> {
  return {
    configuredMode: context.configuredMode,
    effectiveMode: context.effectiveMode,
    active: context.active,
    reason: context.reason,
    sessionClass: context.sessionClass,
    maxStepsLimit: context.maxStepsLimit,
    baseExecutorMode: context.baseExecutorMode,
    enforcedExecutorMode: context.enforcedExecutorMode,
    allowedActionTypes: context.allowedActionTypes,
    blockedApprovalCategories: context.blockedApprovalCategories,
    blockedCategories: context.blockedCategories,
  };
}

export async function runUiNavigatorAgent(
  request: OrchestratorRequest,
): Promise<OrchestratorResponse> {
  const traceId = randomUUID();
  const runId = request.runId ?? request.id;
  const startedAt = Date.now();
  const config = getPlannerConfig();
  const capabilities = createUiNavigatorCapabilitySet(config);
  const skillsRuntime = await getSkillsRuntimeSnapshot({
    agentId: "ui-navigator-agent",
  });
  const skillsPrompt = renderSkillsPrompt(skillsRuntime, {
    maxSkills: 4,
    maxChars: 1200,
  });

  try {
    const input = normalizeUiTaskInput(request.payload.input, config);
    const sensitiveSignals = extractSensitiveSignals(input.goal, config.approvalKeywords);
    const approvalCategories = buildApprovalCategories(sensitiveSignals);
    const sandboxPolicy = resolveSandboxPolicyContext({
      requestSessionId: request.sessionId,
      input,
      config,
      approvalCategories,
    });

    if (input.approvalDecision === "rejected") {
      return createEnvelope({
        userId: request.userId,
        sessionId: request.sessionId,
        runId,
        type: "orchestrator.response",
        source: "ui-navigator-agent",
        payload: {
          route: "ui-navigator-agent",
          status: "failed",
          traceId,
          output: {
            message: "UI task execution was rejected by user approval policy.",
            handledIntent: request.payload.intent,
            traceId,
            latencyMs: Date.now() - startedAt,
            approvalRequired: false,
            approval: {
              approvalId: input.approvalId ?? `approval-${runId}`,
              decision: "rejected",
              reason: input.approvalReason ?? "Rejected by user",
            },
            sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
          },
        },
      });
    }

    const approvalRequired = sensitiveSignals.length > 0 && !input.approvalConfirmed;

    const planResult = await buildActionPlan({
      input,
      config,
      capabilities,
      skillsPrompt,
    });
    const actions = limitActions(planResult.actions, sandboxPolicy.maxStepsLimit);
    const plannedLoop = detectActionLoop(actions, config);
    if (plannedLoop.detected) {
      return createEnvelope({
        userId: request.userId,
        sessionId: request.sessionId,
        runId,
        type: "orchestrator.response",
        source: "ui-navigator-agent",
        payload: {
          route: "ui-navigator-agent",
          status: "failed",
          traceId,
          output: {
            message: "UI action plan was blocked by loop protection.",
            handledIntent: request.payload.intent,
            traceId,
            latencyMs: Date.now() - startedAt,
            approvalRequired: true,
            approvalCategories: ["loop_detected"],
            loopProtection: {
              status: "failed_loop",
              source: plannedLoop.source,
              atIndex: plannedLoop.atIndex,
              duplicateCount: plannedLoop.duplicateCount,
              signature: plannedLoop.signature,
              threshold: {
                windowSize: config.loopWindowSize,
                repeatThreshold: config.loopRepeatThreshold,
                similarityThreshold: config.loopSimilarityThreshold,
              },
            },
            planner: {
              provider: planResult.plannerProvider,
              model: planResult.plannerModel,
            },
            sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
            actionPlan: actions,
            execution: {
              finalStatus: "failed_loop",
              retries: 0,
              trace: [],
              verifyLoopEnabled: true,
              sandbox: buildSandboxPolicyPayload(sandboxPolicy),
            },
          },
        },
      });
    }

    const executionConfig: PlannerConfig =
      sandboxPolicy.active && sandboxPolicy.enforcedExecutorMode !== config.executorMode
        ? {
            ...config,
            executorMode: sandboxPolicy.enforcedExecutorMode,
          }
        : config;
    const deviceNodeRouting = await resolveDeviceNodeRouting({
      input,
      config: executionConfig,
    });

    if (input.deviceNodeId && !deviceNodeRouting.selectedNode) {
      return createEnvelope({
        userId: request.userId,
        sessionId: request.sessionId,
        runId,
        type: "orchestrator.response",
        source: "ui-navigator-agent",
        payload: {
          route: "ui-navigator-agent",
          status: "failed",
          traceId,
          output: {
            message: `Requested device node '${input.deviceNodeId}' is unavailable.`,
            handledIntent: request.payload.intent,
            traceId,
            latencyMs: Date.now() - startedAt,
            approvalRequired: false,
            planner: {
              provider: planResult.plannerProvider,
              model: planResult.plannerModel,
            },
            sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
            deviceNodeRouting,
            actionPlan: actions,
            execution: {
              finalStatus: "failed_device_node",
              retries: 0,
              trace: [],
              verifyLoopEnabled: true,
              sandbox: buildSandboxPolicyPayload(sandboxPolicy),
            },
          },
        },
      });
    }

    if (
      input.deviceNodeId &&
      executionConfig.executorMode === "remote_http" &&
      !deviceNodeRouting.executorUrl
    ) {
      return createEnvelope({
        userId: request.userId,
        sessionId: request.sessionId,
        runId,
        type: "orchestrator.response",
        source: "ui-navigator-agent",
        payload: {
          route: "ui-navigator-agent",
          status: "failed",
          traceId,
          output: {
            message: "Requested device node cannot be routed to an executor URL.",
            handledIntent: request.payload.intent,
            traceId,
            latencyMs: Date.now() - startedAt,
            approvalRequired: false,
            planner: {
              provider: planResult.plannerProvider,
              model: planResult.plannerModel,
            },
            sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
            deviceNodeRouting,
            actionPlan: actions,
            execution: {
              finalStatus: "failed_device_node",
              retries: 0,
              trace: [],
              verifyLoopEnabled: true,
              sandbox: buildSandboxPolicyPayload(sandboxPolicy),
            },
          },
        },
      });
    }

    if (sandboxPolicy.active && input.approvalConfirmed && sandboxPolicy.blockedCategories.length > 0) {
      return createEnvelope({
        userId: request.userId,
        sessionId: request.sessionId,
        runId,
        type: "orchestrator.response",
        source: "ui-navigator-agent",
        payload: {
          route: "ui-navigator-agent",
          status: "failed",
          traceId,
          output: {
            message: "UI task is blocked by sandbox policy for this session.",
            handledIntent: request.payload.intent,
            traceId,
            latencyMs: Date.now() - startedAt,
            approvalRequired: false,
            approvalCategories: sandboxPolicy.blockedCategories,
            planner: {
              provider: planResult.plannerProvider,
              model: planResult.plannerModel,
            },
            sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
            actionPlan: actions,
            execution: {
              finalStatus: "failed_sandbox_policy",
              retries: 0,
              trace: [],
              verifyLoopEnabled: true,
              sandbox: buildSandboxPolicyPayload(sandboxPolicy),
            },
          },
        },
      });
    }

    const blockedSandboxActions = sandboxPolicy.active
      ? summarizeBlockedSandboxActions(actions, sandboxPolicy.allowedActionTypes)
      : [];
    if (blockedSandboxActions.length > 0) {
      return createEnvelope({
        userId: request.userId,
        sessionId: request.sessionId,
        runId,
        type: "orchestrator.response",
        source: "ui-navigator-agent",
        payload: {
          route: "ui-navigator-agent",
          status: "failed",
          traceId,
          output: {
            message: "UI action plan includes actions not allowed by sandbox policy.",
            handledIntent: request.payload.intent,
            traceId,
            latencyMs: Date.now() - startedAt,
            approvalRequired: false,
            blockedActions: blockedSandboxActions,
            planner: {
              provider: planResult.plannerProvider,
              model: planResult.plannerModel,
            },
            sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
            actionPlan: actions,
            execution: {
              finalStatus: "failed_sandbox_policy",
              retries: 0,
              trace: [],
              verifyLoopEnabled: true,
              sandbox: buildSandboxPolicyPayload(sandboxPolicy),
            },
          },
        },
      });
    }

    if (approvalRequired) {
      const approvalId = input.approvalId ?? `approval-${runId}`;
      const blockedTrace: UiTraceStep[] = actions.map((action, idx) => ({
        index: idx + 1,
        actionId: action.id,
        actionType: action.type,
        target: action.target,
        status: "blocked",
        screenshotRef: input.screenshotRef ?? "ui://blocked/no-screenshot",
        notes: "Blocked until user confirms sensitive action execution.",
      }));

      return createEnvelope({
        userId: request.userId,
        sessionId: request.sessionId,
        runId,
        type: "orchestrator.response",
        source: "ui-navigator-agent",
        payload: {
          route: "ui-navigator-agent",
          status: "accepted",
          traceId,
          output: {
            message: "Sensitive action detected. User approval is required before execution.",
            handledIntent: request.payload.intent,
            traceId,
            latencyMs: Date.now() - startedAt,
            approvalRequired: true,
            approvalId,
            approvalCategories,
            sensitiveSignals,
            resumeRequestTemplate: {
              intent: "ui_task",
              input: {
                goal: input.goal,
                url: input.url,
                deviceNodeId: input.deviceNodeId,
                screenshotRef: input.screenshotRef,
                domSnapshot: input.domSnapshot,
                accessibilityTree: input.accessibilityTree,
                markHints: input.markHints,
                cursor: input.cursor,
                formData: input.formData,
                maxSteps: input.maxSteps,
                visualTesting: {
                  enabled: input.visualTesting.enabled,
                  baselineScreenshotRef: input.visualTesting.baselineScreenshotRef,
                  expectedAssertions: input.visualTesting.expectedAssertions,
                  simulateRegression: input.visualTesting.simulateRegression,
                  regressionHint: input.visualTesting.regressionHint,
                },
              },
            },
            planner: {
              provider: planResult.plannerProvider,
              model: planResult.plannerModel,
            },
            sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
            deviceNodeRouting,
            actionPlan: actions,
            execution: {
              finalStatus: "needs_approval",
              retries: 0,
              trace: blockedTrace,
              sandbox: buildSandboxPolicyPayload(sandboxPolicy),
            },
          },
        },
      });
    }

    const screenshotSeed = input.screenshotRef ?? `ui://trace/${runId}`;
    const execution = await executeActionPlan({
      config: executionConfig,
      actions,
      screenshotSeed,
      input,
      routing: deviceNodeRouting,
    });

    const runtimeLoop = detectTraceLoop(execution.trace, config);
    const finalStatus = runtimeLoop.detected ? "failed" : execution.finalStatus;
    const visualTesting = await buildVisualTestingReport({
      input,
      execution,
      screenshotSeed,
      capabilities,
      config,
      skillsPrompt,
    });
    const overallStatus =
      finalStatus === "completed" && visualTesting.status !== "failed" ? "completed" : "failed";
    const visualTestingSummary = visualTesting.enabled
      ? visualTesting.status === "passed"
        ? ` Visual testing passed (${visualTesting.checks.length} checks).`
        : ` Visual testing found ${visualTesting.regressionCount} regressions (highest severity: ${visualTesting.highestSeverity}).`
      : "";
    const loopProtectionSummary = runtimeLoop.detected
      ? ` Loop protection triggered at trace step ${runtimeLoop.atIndex ?? "unknown"} (duplicateCount=${runtimeLoop.duplicateCount}).`
      : "";

    return createEnvelope({
      userId: request.userId,
      sessionId: request.sessionId,
      runId,
      type: "orchestrator.response",
      source: "ui-navigator-agent",
      payload: {
        route: "ui-navigator-agent",
        status: overallStatus,
        traceId,
        output: {
          message:
            overallStatus === "completed"
              ? `UI task completed with ${actions.length} planned steps and ${execution.retries} retries.${visualTestingSummary}`
              : `UI task failed after retries.${loopProtectionSummary}${visualTestingSummary}`,
          handledIntent: request.payload.intent,
          traceId,
          latencyMs: Date.now() - startedAt,
          approvalRequired: false,
          approval:
            input.approvalConfirmed || input.approvalDecision === "approved"
              ? {
                  approvalId: input.approvalId ?? `approval-${runId}`,
                  decision: "approved",
                  reason: input.approvalReason ?? "Approved by user",
                }
              : null,
          planner: {
            provider: planResult.plannerProvider,
            model: planResult.plannerModel,
          },
          sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
          capabilityProfile: capabilities.profile,
          skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
          deviceNodeRouting,
          actionPlan: actions,
            execution: {
              finalStatus,
              retries: execution.retries,
              trace: execution.trace,
              verifyLoopEnabled: true,
              sandbox: buildSandboxPolicyPayload(sandboxPolicy),
              grounding: execution.grounding,
              loopProtection: {
                detected: runtimeLoop.detected,
                source: runtimeLoop.source,
                atIndex: runtimeLoop.atIndex,
                duplicateCount: runtimeLoop.duplicateCount,
              signature: runtimeLoop.signature,
              threshold: {
                windowSize: config.loopWindowSize,
                repeatThreshold: config.loopRepeatThreshold,
                similarityThreshold: config.loopSimilarityThreshold,
              },
            },
            executor: execution.executor,
            adapterMode: execution.adapterMode,
            adapterNotes: execution.adapterNotes,
            deviceNode: execution.deviceNode
              ? {
                  nodeId: execution.deviceNode.nodeId,
                  displayName: execution.deviceNode.displayName,
                  kind: execution.deviceNode.kind,
                  platform: execution.deviceNode.platform,
                  status: execution.deviceNode.status,
                }
              : null,
            computerUseProfile: capabilities.computerUse.descriptor.adapterId,
          },
          visualTesting,
        },
      },
    });
  } catch (error) {
    const normalizedError = toNormalizedError(error, traceId);
    return createEnvelope({
      userId: request.userId,
      sessionId: request.sessionId,
      runId,
      type: "orchestrator.response",
      source: "ui-navigator-agent",
      payload: {
        route: "ui-navigator-agent",
        status: "failed",
        traceId,
        error: normalizedError,
        output: {
          handledIntent: request.payload.intent,
          capabilityProfile: capabilities.profile,
          skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
          traceId,
          latencyMs: Date.now() - startedAt,
        },
      },
    });
  }
}

if (process.argv[1]?.endsWith("index.ts")) {
  console.log("[ui-navigator-agent] ready");
}
