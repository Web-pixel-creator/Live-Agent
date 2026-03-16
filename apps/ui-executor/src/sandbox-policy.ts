import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAbsolute, normalize as normalizePath, resolve as resolvePath } from "node:path";

export type UiExecutorSandboxMode = "off" | "audit" | "enforce";
export type UiExecutorSandboxNetworkPolicy = "allow_all" | "allow_list" | "same_origin";
export type UiExecutorSandboxSetupStatus = "unconfigured" | "missing" | "stale" | "current";

export type UiExecutorSandboxRequest = {
  actions?: Array<{
    type?: string | null;
    target?: string | null;
  }>;
  context?: {
    url?: string | null;
    screenshotRef?: string | null;
  };
};

export type UiExecutorSandboxPolicy = {
  mode: UiExecutorSandboxMode;
  networkPolicy: UiExecutorSandboxNetworkPolicy;
  defaultNavigationOrigin: string | null;
  allowedOrigins: string[];
  allowedReadRoots: string[];
  allowedWriteRoots: string[];
  blockFileUrls: boolean;
  allowLoopbackHosts: boolean;
  setupMarker: {
    path: string | null;
    version: string | null;
    status: UiExecutorSandboxSetupStatus;
    observedVersion: string | null;
  };
  warnings: string[];
};

export type UiExecutorSandboxEvaluation = {
  mode: UiExecutorSandboxMode;
  decision: "allow" | "audit" | "block";
  allowed: boolean;
  networkPolicy: UiExecutorSandboxNetworkPolicy;
  violations: string[];
  warnings: string[];
  inspectedTargets: string[];
  inspectedPaths: string[];
  setupMarkerStatus: UiExecutorSandboxSetupStatus;
};

type LoadUiExecutorSandboxPolicyOptions = {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  defaultNavigationUrl: string;
};

type SandboxTarget = {
  raw: string;
  kind: "url" | "file_url" | "local_path";
  access: "read" | "write";
  normalized: string;
};

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toLowerTrimmed(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = toLowerTrimmed(value);
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
}

function parseMode(value: string | undefined): UiExecutorSandboxMode {
  const normalized = toLowerTrimmed(value);
  if (normalized === "audit") {
    return "audit";
  }
  if (normalized === "enforce" || normalized === "strict") {
    return "enforce";
  }
  return "off";
}

function parseNetworkPolicy(value: string | undefined): UiExecutorSandboxNetworkPolicy {
  const normalized = toLowerTrimmed(value);
  if (normalized === "allow_list" || normalized === "allowlist" || normalized === "allow-list") {
    return "allow_list";
  }
  if (normalized === "same_origin" || normalized === "same-origin") {
    return "same_origin";
  }
  return "allow_all";
}

function parseOriginList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  const origins = new Set<string>();
  for (const token of raw.split(/[,\r\n;]+/)) {
    const value = token.trim();
    if (!value) {
      continue;
    }
    try {
      const parsed = new URL(value);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        origins.add(parsed.origin.toLowerCase());
      }
    } catch {
      continue;
    }
  }
  return [...origins];
}

function parsePathList(raw: string | undefined, cwd: string): string[] {
  if (!raw) {
    return [];
  }
  const roots = new Set<string>();
  for (const token of raw.split(/[;\r\n]+/)) {
    const value = token.trim();
    if (!value) {
      continue;
    }
    const resolved = normalizePath(resolvePath(cwd, value));
    roots.add(resolved);
  }
  return [...roots];
}

function readSetupMarker(path: string | null, version: string | null): UiExecutorSandboxPolicy["setupMarker"] {
  if (!path && !version) {
    return {
      path: null,
      version: null,
      status: "unconfigured",
      observedVersion: null,
    };
  }

  if (!path) {
    return {
      path: null,
      version,
      status: "unconfigured",
      observedVersion: null,
    };
  }

  if (!existsSync(path)) {
    return {
      path,
      version,
      status: "missing",
      observedVersion: null,
    };
  }

  const observedVersion = readFileSync(path, "utf8").trim() || null;
  if (!version) {
    return {
      path,
      version: null,
      status: "current",
      observedVersion,
    };
  }

  return {
    path,
    version,
    status: observedVersion === version ? "current" : "stale",
    observedVersion,
  };
}

function safeOrigin(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.origin.toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}

function isWindowsAbsolutePath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value) || /^\\\\/.test(value);
}

function isLikelyLocalPath(value: string): boolean {
  return isAbsolute(value) || isWindowsAbsolutePath(value) || value.startsWith("./") || value.startsWith("../");
}

function normalizeLocalPath(value: string, cwd: string): string {
  return normalizePath(resolvePath(cwd, value));
}

function isWithinAllowedRoots(candidatePath: string, allowedRoots: string[]): boolean {
  const normalizedCandidate = normalizePath(candidatePath).toLowerCase();
  return allowedRoots.some((root) => {
    const normalizedRoot = normalizePath(root).toLowerCase();
    return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}\\`) || normalizedCandidate.startsWith(`${normalizedRoot}/`);
  });
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized.endsWith(".localhost");
}

function collectTargets(request: UiExecutorSandboxRequest, defaultNavigationUrl: string, cwd: string): SandboxTarget[] {
  const targets: SandboxTarget[] = [];
  const pushTarget = (
    value: string | null | undefined,
    options: {
      access?: SandboxTarget["access"];
      treatAsNavigate?: boolean;
    } = {},
  ): void => {
    const raw = toNonEmptyString(value);
    if (!raw) {
      return;
    }
    const access = options.access ?? "read";

    if (raw.startsWith("file://")) {
      try {
        const filePath = normalizePath(fileURLToPath(raw));
        targets.push({ raw, kind: "file_url", access, normalized: filePath });
      } catch {
        targets.push({ raw, kind: "file_url", access, normalized: raw });
      }
      return;
    }

    try {
      const parsed = new URL(raw);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        targets.push({ raw, kind: "url", access: "read", normalized: parsed.toString() });
        return;
      }
    } catch {
      // not a URL, continue below
    }

    if (isLikelyLocalPath(raw)) {
      targets.push({ raw, kind: "local_path", access, normalized: normalizeLocalPath(raw, cwd) });
      return;
    }

    if (options.treatAsNavigate) {
      const fallbackOrigin = safeOrigin(defaultNavigationUrl);
      if (fallbackOrigin) {
        targets.push({
          raw: defaultNavigationUrl,
          kind: "url",
          access: "read",
          normalized: defaultNavigationUrl,
        });
      }
    }
  };

  pushTarget(request.context?.url, { access: "read" });
  pushTarget(request.context?.screenshotRef, { access: "write" });

  const actions = Array.isArray(request.actions) ? request.actions : [];
  for (const action of actions) {
    if (toLowerTrimmed(action?.type) !== "navigate") {
      continue;
    }
    pushTarget(action?.target, { access: "read", treatAsNavigate: true });
  }

  return targets;
}

export function loadUiExecutorSandboxPolicy(
  options: LoadUiExecutorSandboxPolicyOptions,
): UiExecutorSandboxPolicy {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const mode = parseMode(env.UI_EXECUTOR_SANDBOX_MODE);
  const networkPolicy = parseNetworkPolicy(env.UI_EXECUTOR_SANDBOX_NETWORK_POLICY);
  const defaultNavigationOrigin = safeOrigin(options.defaultNavigationUrl);
  const allowedOrigins = parseOriginList(env.UI_EXECUTOR_SANDBOX_ALLOWED_ORIGINS);
  const allowedReadRoots = parsePathList(env.UI_EXECUTOR_SANDBOX_ALLOWED_READ_ROOTS, cwd);
  const allowedWriteRoots = parsePathList(env.UI_EXECUTOR_SANDBOX_ALLOWED_WRITE_ROOTS, cwd);
  const setupMarkerPathRaw = toNonEmptyString(env.UI_EXECUTOR_SANDBOX_SETUP_MARKER_PATH);
  const setupMarkerVersion = toNonEmptyString(env.UI_EXECUTOR_SANDBOX_SETUP_MARKER_VERSION);
  const setupMarker = readSetupMarker(
    setupMarkerPathRaw ? normalizePath(resolvePath(cwd, setupMarkerPathRaw)) : null,
    setupMarkerVersion,
  );
  const warnings: string[] = [];

  if (networkPolicy === "same_origin" && !defaultNavigationOrigin) {
    warnings.push("UI executor sandbox same_origin policy requires a valid UI_EXECUTOR_DEFAULT_URL origin.");
  }
  if (networkPolicy === "allow_list" && allowedOrigins.length === 0) {
    warnings.push("UI executor sandbox allow_list policy has no UI_EXECUTOR_SANDBOX_ALLOWED_ORIGINS entries.");
  }
  if (setupMarker.status === "stale") {
    warnings.push("UI executor sandbox setup marker version is stale.");
  }
  if (setupMarker.status === "missing") {
    warnings.push("UI executor sandbox setup marker file is missing.");
  }

  return {
    mode,
    networkPolicy,
    defaultNavigationOrigin,
    allowedOrigins,
    allowedReadRoots,
    allowedWriteRoots,
    blockFileUrls: parseBoolean(env.UI_EXECUTOR_SANDBOX_BLOCK_FILE_URLS, true),
    allowLoopbackHosts: parseBoolean(env.UI_EXECUTOR_SANDBOX_ALLOW_LOOPBACK_HOSTS, true),
    setupMarker,
    warnings,
  };
}

export function sandboxPolicyRuntimeSnapshot(policy: UiExecutorSandboxPolicy): Record<string, unknown> {
  return {
    mode: policy.mode,
    networkPolicy: policy.networkPolicy,
    defaultNavigationOrigin: policy.defaultNavigationOrigin,
    allowedOriginsCount: policy.allowedOrigins.length,
    allowedReadRootsCount: policy.allowedReadRoots.length,
    allowedWriteRootsCount: policy.allowedWriteRoots.length,
    blockFileUrls: policy.blockFileUrls,
    allowLoopbackHosts: policy.allowLoopbackHosts,
    setupMarker: {
      status: policy.setupMarker.status,
      version: policy.setupMarker.version,
      observedVersion: policy.setupMarker.observedVersion,
      configured: policy.setupMarker.path !== null,
    },
    warnings: [...policy.warnings],
  };
}

export function evaluateUiExecutorSandboxRequest(options: {
  policy: UiExecutorSandboxPolicy;
  request: UiExecutorSandboxRequest;
  defaultNavigationUrl: string;
  cwd?: string;
}): UiExecutorSandboxEvaluation {
  const cwd = options.cwd ?? process.cwd();
  const policy = options.policy;
  const targets = collectTargets(options.request, options.defaultNavigationUrl, cwd);
  const inspectedTargets = targets.map((target) => target.raw);
  const inspectedPaths = targets
    .filter((target) => target.kind === "file_url" || target.kind === "local_path")
    .map((target) => target.normalized);
  const violations: string[] = [];
  const warnings = [...policy.warnings];

  if (policy.setupMarker.status === "missing" || policy.setupMarker.status === "stale") {
    const message =
      policy.setupMarker.status === "missing"
        ? "Sandbox setup marker is missing."
        : "Sandbox setup marker version is stale.";
    if (policy.mode === "enforce") {
      violations.push(message);
    } else if (policy.mode === "audit") {
      warnings.push(message);
    }
  }

  for (const target of targets) {
    if (target.kind === "url") {
      const parsed = new URL(target.normalized);
      if (!policy.allowLoopbackHosts && isLoopbackHost(parsed.hostname)) {
        violations.push(`Loopback origin is blocked by sandbox policy: ${parsed.origin}`);
        continue;
      }
      if (policy.networkPolicy === "same_origin") {
        if (!policy.defaultNavigationOrigin) {
          violations.push("same_origin sandbox policy requires a valid UI_EXECUTOR_DEFAULT_URL origin.");
          continue;
        }
        if (parsed.origin.toLowerCase() !== policy.defaultNavigationOrigin) {
          violations.push(`Navigation origin '${parsed.origin}' is outside same_origin sandbox policy.`);
        }
      } else if (
        policy.networkPolicy === "allow_list" &&
        !policy.allowedOrigins.includes(parsed.origin.toLowerCase())
      ) {
        violations.push(`Navigation origin '${parsed.origin}' is outside allowed sandbox origins.`);
      }
      continue;
    }

    const allowedRoots = target.access === "write" ? policy.allowedWriteRoots : policy.allowedReadRoots;
    const pathMessage =
      target.access === "write"
        ? `Local path '${target.normalized}' is outside allowed write roots.`
        : `Local path '${target.normalized}' is outside allowed read roots.`;
    if (target.kind === "file_url" && policy.blockFileUrls) {
      violations.push(`File URL access is blocked by sandbox policy: ${target.raw}`);
      continue;
    }
    if (allowedRoots.length === 0) {
      violations.push(pathMessage);
      continue;
    }
    if (!isWithinAllowedRoots(target.normalized, allowedRoots)) {
      violations.push(pathMessage);
    }
  }

  if (policy.mode === "off") {
    return {
      mode: policy.mode,
      decision: "allow",
      allowed: true,
      networkPolicy: policy.networkPolicy,
      violations: [],
      warnings,
      inspectedTargets,
      inspectedPaths,
      setupMarkerStatus: policy.setupMarker.status,
    };
  }

  if (policy.mode === "audit") {
    return {
      mode: policy.mode,
      decision: violations.length > 0 ? "audit" : "allow",
      allowed: true,
      networkPolicy: policy.networkPolicy,
      violations,
      warnings,
      inspectedTargets,
      inspectedPaths,
      setupMarkerStatus: policy.setupMarker.status,
    };
  }

  return {
    mode: policy.mode,
    decision: violations.length > 0 ? "block" : "allow",
    allowed: violations.length === 0,
    networkPolicy: policy.networkPolicy,
    violations,
    warnings,
    inspectedTargets,
    inspectedPaths,
    setupMarkerStatus: policy.setupMarker.status,
  };
}
