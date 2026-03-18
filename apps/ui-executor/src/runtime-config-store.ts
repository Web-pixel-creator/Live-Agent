import {
  loadUiExecutorSandboxPolicy,
  type UiExecutorSandboxMode,
  type UiExecutorSandboxNetworkPolicy,
  type UiExecutorSandboxPolicy,
} from "./sandbox-policy.js";

export type DeviceNodeKind = "desktop" | "mobile";

export type DeviceNodeStatus = "online" | "offline" | "degraded";

export type DeviceNodeDescriptor = {
  nodeId: string;
  displayName: string;
  kind: DeviceNodeKind;
  platform: string;
  status: DeviceNodeStatus;
  capabilities: string[];
};

export type ExecutorConfigSourceKind = "env" | "control_plane_json";

export type ExecutorConfig = {
  port: number;
  defaultNavigationUrl: string;
  strictPlaywright: boolean;
  simulateIfUnavailable: boolean;
  forceSimulation: boolean;
  actionTimeoutMs: number;
  persistentBrowserSessions: boolean;
  browserSessionTtlMs: number;
  defaultDeviceNodeId: string | null;
  deviceNodes: Map<string, DeviceNodeDescriptor>;
  sandboxPolicy: UiExecutorSandboxPolicy;
  sourceKind: ExecutorConfigSourceKind;
};

type BaseExecutorConfig = Omit<ExecutorConfig, "sourceKind">;

type StoreOptions = {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
};

type UiExecutorSandboxPolicyOverride = {
  mode?: UiExecutorSandboxMode;
  networkPolicy?: UiExecutorSandboxNetworkPolicy;
  allowedOrigins?: string[];
  allowedReadRoots?: string[];
  allowedWriteRoots?: string[];
  blockFileUrls?: boolean;
  allowLoopbackHosts?: boolean;
  setupMarkerPath?: string | null;
  setupMarkerVersion?: string | null;
};

type UiExecutorRuntimeOverride = {
  defaultNavigationUrl?: string;
  strictPlaywright?: boolean;
  simulateIfUnavailable?: boolean;
  forceSimulation?: boolean;
  actionTimeoutMs?: number;
  persistentBrowserSessions?: boolean;
  browserSessionTtlMs?: number;
  defaultDeviceNodeId?: string | null;
  sandboxPolicy?: UiExecutorSandboxPolicyOverride;
};

type UiExecutorControlPlaneOverrideState = {
  rawJson: string;
  updatedAt: string;
  reason: string | null;
};

export type UiExecutorRuntimeConfigStoreStatus = {
  sourceKind: ExecutorConfigSourceKind;
  controlPlaneOverride: {
    active: boolean;
    updatedAt: string | null;
    reason: string | null;
  };
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

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPositiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeSandboxMode(value: unknown): UiExecutorSandboxMode | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "off") {
    return "off";
  }
  if (normalized === "audit") {
    return "audit";
  }
  if (normalized === "enforce" || normalized === "strict") {
    return "enforce";
  }
  throw new Error(`ui-executor sandbox mode override is invalid: ${value}`);
}

function normalizeSandboxNetworkPolicy(value: unknown): UiExecutorSandboxNetworkPolicy | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "allow_all" || normalized === "allow-all") {
    return "allow_all";
  }
  if (normalized === "allow_list" || normalized === "allow-list" || normalized === "allowlist") {
    return "allow_list";
  }
  if (normalized === "same_origin" || normalized === "same-origin") {
    return "same_origin";
  }
  throw new Error(`ui-executor sandbox network policy override is invalid: ${value}`);
}

function toStringList(value: unknown): string[] | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }
  if (typeof value === "string") {
    return value
      .split(/[;,\r\n]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (!Array.isArray(value)) {
    throw new Error("ui-executor sandbox override list fields must be a string or string array");
  }
  return value
    .map((item) => toOptionalString(item))
    .filter((item): item is string => item !== null);
}

function parseDeviceNodes(raw: string | undefined): Map<string, DeviceNodeDescriptor> {
  const nodes = new Map<string, DeviceNodeDescriptor>();
  if (!raw || raw.trim().length === 0) {
    return nodes;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return nodes;
    }
    for (const item of parsed) {
      if (!isRecord(item)) {
        continue;
      }
      const nodeId = toNonEmptyString(item.nodeId ?? item.id, "").toLowerCase();
      if (!nodeId) {
        continue;
      }
      const kind = toNonEmptyString(item.kind, "desktop") === "mobile" ? "mobile" : "desktop";
      const statusRaw = toNonEmptyString(item.status, "online").toLowerCase();
      const status: DeviceNodeStatus =
        statusRaw === "offline" || statusRaw === "degraded" ? statusRaw : "online";
      const capabilitiesRaw = Array.isArray(item.capabilities) ? item.capabilities : [];
      const capabilities = capabilitiesRaw
        .map((capability) => toNonEmptyString(capability, "").toLowerCase())
        .filter((capability) => capability.length > 0);

      nodes.set(nodeId, {
        nodeId,
        displayName: toNonEmptyString(item.displayName ?? item.name, nodeId),
        kind,
        platform: toNonEmptyString(item.platform, "unknown"),
        status,
        capabilities,
      });
    }
    return nodes;
  } catch {
    return nodes;
  }
}

function cloneDeviceNodes(deviceNodes: Map<string, DeviceNodeDescriptor>): Map<string, DeviceNodeDescriptor> {
  return new Map(
    Array.from(deviceNodes.entries(), ([nodeId, node]) => [
      nodeId,
      {
        ...node,
        capabilities: [...node.capabilities],
      },
    ]),
  );
}

function loadBaseConfig(options: StoreOptions = {}): BaseExecutorConfig {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const portRaw = Number(env.PORT ?? env.UI_EXECUTOR_PORT ?? 8090);
  const timeoutRaw = Number(env.UI_EXECUTOR_ACTION_TIMEOUT_MS ?? 2500);
  const browserSessionTtlRaw = Number(env.UI_EXECUTOR_BROWSER_SESSION_TTL_MS ?? 5 * 60 * 1000);
  const deviceNodes = parseDeviceNodes(env.UI_EXECUTOR_DEVICE_NODES_JSON);
  const defaultDeviceNodeId = toOptionalString(env.UI_EXECUTOR_DEFAULT_DEVICE_NODE_ID)?.toLowerCase() ?? null;
  const defaultNavigationUrl = env.UI_EXECUTOR_DEFAULT_URL ?? "https://example.com";
  return {
    port: Number.isFinite(portRaw) && portRaw > 0 ? Math.floor(portRaw) : 8090,
    defaultNavigationUrl,
    strictPlaywright: env.UI_EXECUTOR_STRICT_PLAYWRIGHT === "true",
    simulateIfUnavailable: env.UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE !== "false",
    forceSimulation: env.UI_EXECUTOR_FORCE_SIMULATION === "true",
    actionTimeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? Math.floor(timeoutRaw) : 2500,
    persistentBrowserSessions: env.UI_EXECUTOR_PERSISTENT_BROWSER_SESSIONS !== "false",
    browserSessionTtlMs: Number.isFinite(browserSessionTtlRaw) && browserSessionTtlRaw > 0
      ? Math.floor(browserSessionTtlRaw)
      : 5 * 60 * 1000,
    defaultDeviceNodeId,
    deviceNodes,
    sandboxPolicy: loadUiExecutorSandboxPolicy({
      env,
      cwd,
      defaultNavigationUrl,
    }),
  };
}

function createSandboxPolicyEnv(policy: UiExecutorSandboxPolicy): NodeJS.ProcessEnv {
  return {
    UI_EXECUTOR_SANDBOX_MODE: policy.mode,
    UI_EXECUTOR_SANDBOX_NETWORK_POLICY: policy.networkPolicy,
    UI_EXECUTOR_SANDBOX_ALLOWED_ORIGINS: policy.allowedOrigins.join(";"),
    UI_EXECUTOR_SANDBOX_ALLOWED_READ_ROOTS: policy.allowedReadRoots.join(";"),
    UI_EXECUTOR_SANDBOX_ALLOWED_WRITE_ROOTS: policy.allowedWriteRoots.join(";"),
    UI_EXECUTOR_SANDBOX_BLOCK_FILE_URLS: String(policy.blockFileUrls),
    UI_EXECUTOR_SANDBOX_ALLOW_LOOPBACK_HOSTS: String(policy.allowLoopbackHosts),
    UI_EXECUTOR_SANDBOX_SETUP_MARKER_PATH: policy.setupMarker.path ?? undefined,
    UI_EXECUTOR_SANDBOX_SETUP_MARKER_VERSION: policy.setupMarker.version ?? undefined,
  };
}

function parseSandboxPolicyOverride(raw: unknown): UiExecutorSandboxPolicyOverride | undefined {
  if (typeof raw === "undefined") {
    return undefined;
  }
  if (!isRecord(raw)) {
    throw new Error("ui-executor sandboxPolicy override must be a JSON object");
  }
  const override: UiExecutorSandboxPolicyOverride = {};
  const mode = normalizeSandboxMode(raw.mode);
  if (typeof mode !== "undefined") {
    override.mode = mode;
  }
  const networkPolicy = normalizeSandboxNetworkPolicy(raw.networkPolicy);
  if (typeof networkPolicy !== "undefined") {
    override.networkPolicy = networkPolicy;
  }
  const allowedOrigins = toStringList(raw.allowedOrigins);
  if (typeof allowedOrigins !== "undefined") {
    override.allowedOrigins = allowedOrigins;
  }
  const allowedReadRoots = toStringList(raw.allowedReadRoots);
  if (typeof allowedReadRoots !== "undefined") {
    override.allowedReadRoots = allowedReadRoots;
  }
  const allowedWriteRoots = toStringList(raw.allowedWriteRoots);
  if (typeof allowedWriteRoots !== "undefined") {
    override.allowedWriteRoots = allowedWriteRoots;
  }
  const blockFileUrls = toOptionalBoolean(raw.blockFileUrls);
  if (typeof blockFileUrls !== "undefined") {
    override.blockFileUrls = blockFileUrls;
  }
  const allowLoopbackHosts = toOptionalBoolean(raw.allowLoopbackHosts);
  if (typeof allowLoopbackHosts !== "undefined") {
    override.allowLoopbackHosts = allowLoopbackHosts;
  }
  if (Object.prototype.hasOwnProperty.call(raw, "setupMarkerPath")) {
    override.setupMarkerPath = raw.setupMarkerPath === null ? null : toOptionalString(raw.setupMarkerPath);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "setupMarkerVersion")) {
    override.setupMarkerVersion = raw.setupMarkerVersion === null ? null : toOptionalString(raw.setupMarkerVersion);
  }
  return override;
}

function parseRuntimeOverride(rawJson: string): UiExecutorRuntimeOverride {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch (error) {
    throw new Error(
      `ui-executor runtime control-plane override must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!isRecord(parsed)) {
    throw new Error("ui-executor runtime control-plane override must be a JSON object");
  }

  const override: UiExecutorRuntimeOverride = {};
  const defaultNavigationUrl = toOptionalString(parsed.defaultNavigationUrl);
  if (defaultNavigationUrl !== null) {
    override.defaultNavigationUrl = defaultNavigationUrl;
  }
  const strictPlaywright = toOptionalBoolean(parsed.strictPlaywright);
  if (typeof strictPlaywright !== "undefined") {
    override.strictPlaywright = strictPlaywright;
  }
  const simulateIfUnavailable = toOptionalBoolean(parsed.simulateIfUnavailable);
  if (typeof simulateIfUnavailable !== "undefined") {
    override.simulateIfUnavailable = simulateIfUnavailable;
  }
  const forceSimulation = toOptionalBoolean(parsed.forceSimulation);
  if (typeof forceSimulation !== "undefined") {
    override.forceSimulation = forceSimulation;
  }
  const actionTimeoutMs = toPositiveInt(parsed.actionTimeoutMs);
  if (typeof actionTimeoutMs !== "undefined") {
    override.actionTimeoutMs = actionTimeoutMs;
  }
  const persistentBrowserSessions = toOptionalBoolean(parsed.persistentBrowserSessions);
  if (typeof persistentBrowserSessions !== "undefined") {
    override.persistentBrowserSessions = persistentBrowserSessions;
  }
  const browserSessionTtlMs = toPositiveInt(parsed.browserSessionTtlMs);
  if (typeof browserSessionTtlMs !== "undefined") {
    override.browserSessionTtlMs = browserSessionTtlMs;
  }
  if (Object.prototype.hasOwnProperty.call(parsed, "defaultDeviceNodeId")) {
    override.defaultDeviceNodeId =
      parsed.defaultDeviceNodeId === null ? null : toOptionalString(parsed.defaultDeviceNodeId)?.toLowerCase() ?? null;
  }
  const sandboxPolicy = parseSandboxPolicyOverride(parsed.sandboxPolicy);
  if (typeof sandboxPolicy !== "undefined") {
    override.sandboxPolicy = sandboxPolicy;
  }

  if (Object.keys(override).length === 0) {
    throw new Error("ui-executor runtime control-plane override must include at least one supported field");
  }

  return override;
}

function applyRuntimeOverride(
  baseConfig: BaseExecutorConfig,
  rawJson: string,
  options: StoreOptions = {},
): ExecutorConfig {
  const cwd = options.cwd ?? process.cwd();
  const override = parseRuntimeOverride(rawJson);
  const defaultNavigationUrl = override.defaultNavigationUrl ?? baseConfig.defaultNavigationUrl;
  const sandboxEnv = createSandboxPolicyEnv(baseConfig.sandboxPolicy);
  const sandboxPolicyOverride = override.sandboxPolicy;

  if (sandboxPolicyOverride) {
    if (typeof sandboxPolicyOverride.mode !== "undefined") {
      sandboxEnv.UI_EXECUTOR_SANDBOX_MODE = sandboxPolicyOverride.mode;
    }
    if (typeof sandboxPolicyOverride.networkPolicy !== "undefined") {
      sandboxEnv.UI_EXECUTOR_SANDBOX_NETWORK_POLICY = sandboxPolicyOverride.networkPolicy;
    }
    if (typeof sandboxPolicyOverride.allowedOrigins !== "undefined") {
      sandboxEnv.UI_EXECUTOR_SANDBOX_ALLOWED_ORIGINS = sandboxPolicyOverride.allowedOrigins.join(";");
    }
    if (typeof sandboxPolicyOverride.allowedReadRoots !== "undefined") {
      sandboxEnv.UI_EXECUTOR_SANDBOX_ALLOWED_READ_ROOTS = sandboxPolicyOverride.allowedReadRoots.join(";");
    }
    if (typeof sandboxPolicyOverride.allowedWriteRoots !== "undefined") {
      sandboxEnv.UI_EXECUTOR_SANDBOX_ALLOWED_WRITE_ROOTS = sandboxPolicyOverride.allowedWriteRoots.join(";");
    }
    if (typeof sandboxPolicyOverride.blockFileUrls !== "undefined") {
      sandboxEnv.UI_EXECUTOR_SANDBOX_BLOCK_FILE_URLS = String(sandboxPolicyOverride.blockFileUrls);
    }
    if (typeof sandboxPolicyOverride.allowLoopbackHosts !== "undefined") {
      sandboxEnv.UI_EXECUTOR_SANDBOX_ALLOW_LOOPBACK_HOSTS = String(sandboxPolicyOverride.allowLoopbackHosts);
    }
    if (Object.prototype.hasOwnProperty.call(sandboxPolicyOverride, "setupMarkerPath")) {
      if (sandboxPolicyOverride.setupMarkerPath === null) {
        delete sandboxEnv.UI_EXECUTOR_SANDBOX_SETUP_MARKER_PATH;
      } else {
        sandboxEnv.UI_EXECUTOR_SANDBOX_SETUP_MARKER_PATH = sandboxPolicyOverride.setupMarkerPath;
      }
    }
    if (Object.prototype.hasOwnProperty.call(sandboxPolicyOverride, "setupMarkerVersion")) {
      if (sandboxPolicyOverride.setupMarkerVersion === null) {
        delete sandboxEnv.UI_EXECUTOR_SANDBOX_SETUP_MARKER_VERSION;
      } else {
        sandboxEnv.UI_EXECUTOR_SANDBOX_SETUP_MARKER_VERSION = sandboxPolicyOverride.setupMarkerVersion;
      }
    }
  }

  return {
    port: baseConfig.port,
    defaultNavigationUrl,
    strictPlaywright:
      typeof override.strictPlaywright === "boolean" ? override.strictPlaywright : baseConfig.strictPlaywright,
    simulateIfUnavailable:
      typeof override.simulateIfUnavailable === "boolean"
        ? override.simulateIfUnavailable
        : baseConfig.simulateIfUnavailable,
    forceSimulation:
      typeof override.forceSimulation === "boolean" ? override.forceSimulation : baseConfig.forceSimulation,
    actionTimeoutMs:
      typeof override.actionTimeoutMs === "number" ? override.actionTimeoutMs : baseConfig.actionTimeoutMs,
    persistentBrowserSessions:
      typeof override.persistentBrowserSessions === "boolean"
        ? override.persistentBrowserSessions
        : baseConfig.persistentBrowserSessions,
    browserSessionTtlMs:
      typeof override.browserSessionTtlMs === "number" ? override.browserSessionTtlMs : baseConfig.browserSessionTtlMs,
    defaultDeviceNodeId:
      typeof override.defaultDeviceNodeId === "undefined"
        ? baseConfig.defaultDeviceNodeId
        : override.defaultDeviceNodeId,
    deviceNodes: cloneDeviceNodes(baseConfig.deviceNodes),
    sandboxPolicy: loadUiExecutorSandboxPolicy({
      env: sandboxEnv,
      cwd,
      defaultNavigationUrl,
    }),
    sourceKind: "control_plane_json",
  };
}

let controlPlaneOverride: UiExecutorControlPlaneOverrideState | null = null;

export function getUiExecutorRuntimeConfig(options: StoreOptions = {}): ExecutorConfig {
  const baseConfig = loadBaseConfig(options);
  if (!controlPlaneOverride) {
    return {
      ...baseConfig,
      deviceNodes: cloneDeviceNodes(baseConfig.deviceNodes),
      sourceKind: "env",
    };
  }
  return applyRuntimeOverride(baseConfig, controlPlaneOverride.rawJson, options);
}

export function getUiExecutorRuntimeConfigStoreStatus(options: StoreOptions = {}): UiExecutorRuntimeConfigStoreStatus {
  const config = getUiExecutorRuntimeConfig(options);
  return {
    sourceKind: config.sourceKind,
    controlPlaneOverride: {
      active: controlPlaneOverride !== null,
      updatedAt: controlPlaneOverride?.updatedAt ?? null,
      reason: controlPlaneOverride?.reason ?? null,
    },
  };
}

export function setUiExecutorRuntimeControlPlaneOverride(
  params: {
    rawJson: string;
    reason?: string | null;
  } & StoreOptions,
): ExecutorConfig {
  const rawJson = toOptionalString(params.rawJson);
  if (!rawJson) {
    throw new Error("ui-executor runtime control-plane override requires rawJson");
  }
  const baseConfig = loadBaseConfig(params);
  const effectiveConfig = applyRuntimeOverride(baseConfig, rawJson, params);
  controlPlaneOverride = {
    rawJson,
    updatedAt: new Date().toISOString(),
    reason: params.reason ?? null,
  };
  return effectiveConfig;
}

export function clearUiExecutorRuntimeControlPlaneOverride(): void {
  controlPlaneOverride = null;
}

export function resetUiExecutorRuntimeConfigStoreForTests(): void {
  controlPlaneOverride = null;
}
