import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type RuntimeFaultProfileSource = "path" | "env_json" | "missing" | "invalid";

export type RuntimeFaultProfileService =
  | "realtime-gateway"
  | "orchestrator"
  | "api-backend"
  | "ui-executor"
  | "ui-navigator-agent"
  | "storyteller-agent";

export type RuntimeFaultProfileCategory =
  | "transport"
  | "workflow"
  | "sandbox"
  | "approval"
  | "media"
  | "governance";

export type RuntimeFaultActionMode = "http_post" | "payload_flag" | "env_toggle" | "operator_action" | "none";

export type RuntimeFaultAction = {
  mode: RuntimeFaultActionMode;
  target: string;
  value: string | null;
};

export type RuntimeFaultProfile = {
  id: string;
  title: string;
  description: string;
  service: RuntimeFaultProfileService;
  category: RuntimeFaultProfileCategory;
  activation: RuntimeFaultAction;
  recovery: RuntimeFaultAction;
  expectedSignals: string[];
  expectedScenarios: string[];
  expectedArtifacts: string[];
  tags: string[];
};

export type RuntimeFaultProfilesSnapshot = {
  version: number;
  updatedAt: string | null;
  source: RuntimeFaultProfileSource;
  configPath: string | null;
  warnings: string[];
  profiles: RuntimeFaultProfile[];
};

type RuntimeFaultProfilesDocument = {
  version: number;
  updatedAt: string | null;
  profiles: RuntimeFaultProfile[];
};

type RuntimeFaultProfilesLoadResult = {
  source: RuntimeFaultProfileSource;
  configPath: string | null;
  warnings: string[];
  document: RuntimeFaultProfilesDocument;
};

const DEFAULT_RUNTIME_FAULT_PROFILES_PATH = "configs/runtime.fault-profiles.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeId(value: unknown, fallback: string): string {
  const normalized = (toNonEmptyString(value) ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized.length > 0 ? normalized : fallback;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizeStringList(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of values) {
    if (typeof item !== "string") {
      continue;
    }
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const lowered = trimmed.toLowerCase();
    if (seen.has(lowered)) {
      continue;
    }
    seen.add(lowered);
    normalized.push(trimmed);
  }
  return normalized;
}

function normalizeService(value: unknown): RuntimeFaultProfileService {
  const normalized = toNonEmptyString(value)?.toLowerCase();
  switch (normalized) {
    case "realtime-gateway":
    case "orchestrator":
    case "api-backend":
    case "ui-executor":
    case "ui-navigator-agent":
    case "storyteller-agent":
      return normalized;
    default:
      return "api-backend";
  }
}

function normalizeCategory(value: unknown): RuntimeFaultProfileCategory {
  const normalized = toNonEmptyString(value)?.toLowerCase();
  switch (normalized) {
    case "transport":
    case "workflow":
    case "sandbox":
    case "approval":
    case "media":
    case "governance":
      return normalized;
    default:
      return "workflow";
  }
}

function normalizeActionMode(value: unknown): RuntimeFaultActionMode {
  const normalized = toNonEmptyString(value)?.toLowerCase();
  switch (normalized) {
    case "http_post":
    case "payload_flag":
    case "env_toggle":
    case "operator_action":
    case "none":
      return normalized;
    default:
      return "none";
  }
}

function normalizeAction(value: unknown): RuntimeFaultAction {
  if (!isRecord(value)) {
    return {
      mode: "none",
      target: "manual",
      value: null,
    };
  }
  return {
    mode: normalizeActionMode(value.mode),
    target: toNonEmptyString(value.target) ?? "manual",
    value: toNonEmptyString(value.value),
  };
}

function normalizeProfile(raw: unknown, index: number): RuntimeFaultProfile | null {
  if (!isRecord(raw)) {
    return null;
  }
  const fallbackId = `runtime-fault-profile-${index + 1}`;
  const id = normalizeId(raw.id, fallbackId);
  const title = toNonEmptyString(raw.title) ?? id;
  const description =
    toNonEmptyString(raw.description) ?? `${title} fault profile for controlled runtime degradation.`;
  return {
    id,
    title,
    description,
    service: normalizeService(raw.service),
    category: normalizeCategory(raw.category),
    activation: normalizeAction(raw.activation),
    recovery: normalizeAction(raw.recovery),
    expectedSignals: normalizeStringList(raw.expectedSignals),
    expectedScenarios: normalizeStringList(raw.expectedScenarios),
    expectedArtifacts: normalizeStringList(raw.expectedArtifacts),
    tags: normalizeStringList(raw.tags).map((item) => item.toLowerCase()),
  };
}

function buildEmptyDocument(): RuntimeFaultProfilesDocument {
  return {
    version: 1,
    updatedAt: null,
    profiles: [],
  };
}

function normalizeDocument(raw: unknown): RuntimeFaultProfilesDocument {
  if (!isRecord(raw)) {
    return buildEmptyDocument();
  }
  const profilesRaw = Array.isArray(raw.profiles) ? raw.profiles : [];
  return {
    version: parsePositiveInt(raw.version, 1),
    updatedAt: toNonEmptyString(raw.updatedAt),
    profiles: profilesRaw
      .map((item, index) => normalizeProfile(item, index))
      .filter((item): item is RuntimeFaultProfile => item !== null),
  };
}

async function loadRuntimeFaultProfilesDocument(params: {
  env: NodeJS.ProcessEnv;
  cwd: string;
}): Promise<RuntimeFaultProfilesLoadResult> {
  const warnings: string[] = [];
  const envJson = toNonEmptyString(params.env.RUNTIME_FAULT_PROFILES_JSON);
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson) as unknown;
      return {
        source: "env_json",
        configPath: null,
        warnings,
        document: normalizeDocument(parsed),
      };
    } catch (error) {
      warnings.push(
        `Failed to parse RUNTIME_FAULT_PROFILES_JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        source: "invalid",
        configPath: null,
        warnings,
        document: buildEmptyDocument(),
      };
    }
  }

  const configuredPath = toNonEmptyString(params.env.RUNTIME_FAULT_PROFILES_PATH) ?? DEFAULT_RUNTIME_FAULT_PROFILES_PATH;
  const resolvedPath = resolve(params.cwd, configuredPath);
  try {
    const source = await readFile(resolvedPath, "utf8");
    const parsed = JSON.parse(source) as unknown;
    return {
      source: "path",
      configPath: resolvedPath,
      warnings,
      document: normalizeDocument(parsed),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Failed to load runtime fault profiles from ${resolvedPath}: ${message}`);
    return {
      source: message.toLowerCase().includes("no such file") || message.toLowerCase().includes("cannot find") ? "missing" : "invalid",
      configPath: resolvedPath,
      warnings,
      document: buildEmptyDocument(),
    };
  }
}

export async function getRuntimeFaultProfilesSnapshot(params: {
  env: NodeJS.ProcessEnv;
  cwd: string;
}): Promise<RuntimeFaultProfilesSnapshot> {
  const loadResult = await loadRuntimeFaultProfilesDocument(params);
  const warnings = [...loadResult.warnings];
  if (loadResult.document.profiles.length === 0) {
    warnings.push("Runtime fault profiles catalog has no configured profiles.");
  }
  return {
    version: loadResult.document.version,
    updatedAt: loadResult.document.updatedAt,
    source: loadResult.source,
    configPath: loadResult.configPath,
    warnings,
    profiles: loadResult.document.profiles,
  };
}
