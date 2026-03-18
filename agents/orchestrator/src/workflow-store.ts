import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import type { OrchestratorIntent } from "@mla/contracts";

export type AssistiveRouterProvider = "gemini_api" | "openai" | "anthropic" | "deepseek" | "moonshot";
export type AssistiveRouterBudgetPolicy =
  | "judged_default"
  | "long_context_operator"
  | "cost_sensitive_batch"
  | "watchlist_experimental";
export type AssistiveRouterPromptCaching = "none" | "provider_default" | "provider_prompt_cache" | "watchlist_only";

export type AssistiveRouterRuntimeConfig = {
  enabled: boolean;
  provider: AssistiveRouterProvider;
  model: string;
  apiKey: string | null;
  baseUrl: string;
  timeoutMs: number;
  minConfidence: number;
  allowIntents: OrchestratorIntent[];
  budgetPolicy: AssistiveRouterBudgetPolicy;
  promptCaching: AssistiveRouterPromptCaching;
  watchlistEnabled: boolean;
};

export type OrchestratorRetryPolicyConfig = {
  continuationStatusCode: number;
  continuationBackoffMs: number;
  transientErrorCodes: string[];
  transientErrorPatterns: string[];
  terminalErrorCodes: string[];
  terminalErrorPatterns: string[];
};

export type OrchestratorWorkflowConfig = {
  schemaVersion: number;
  loadedAt: string;
  sourceKind: "defaults" | "file" | "json" | "control_plane_json";
  sourcePath: string | null;
  idempotencyTtlMs: number;
  assistiveRouter: AssistiveRouterRuntimeConfig;
  retryPolicy: OrchestratorRetryPolicyConfig;
};

export type OrchestratorWorkflowStage =
  | "intake"
  | "planning"
  | "safety_review"
  | "execution"
  | "verification"
  | "reporting";

export type OrchestratorWorkflowRole =
  | "intake"
  | "planner"
  | "safety_reviewer"
  | "executor"
  | "verifier"
  | "reporter";

export type OrchestratorWorkflowExecutionStatus = "idle" | "running" | "pending_approval" | "completed" | "failed";

export type OrchestratorWorkflowExecutionState = {
  status: OrchestratorWorkflowExecutionStatus;
  currentStage: OrchestratorWorkflowStage | null;
  activeRole: OrchestratorWorkflowRole | null;
  runId: string | null;
  sessionId: string | null;
  taskId: string | null;
  intent: OrchestratorIntent | null;
  route: string | null;
  reason: string | null;
  updatedAt: string | null;
};

export type OrchestratorWorkflowStoreStatus = {
  loadedAt: string | null;
  lastAttemptAt: string | null;
  sourceKind: OrchestratorWorkflowConfig["sourceKind"] | null;
  sourcePath: string | null;
  fingerprint: string | null;
  usingLastKnownGood: boolean;
  lastError: string | null;
  assistiveRouter: {
    enabled: boolean;
    provider: AssistiveRouterProvider | null;
    model: string | null;
    apiKeyConfigured: boolean;
    allowIntents: OrchestratorIntent[];
    timeoutMs: number | null;
    minConfidence: number | null;
    budgetPolicy: AssistiveRouterBudgetPolicy | null;
    promptCaching: AssistiveRouterPromptCaching | null;
    watchlistEnabled: boolean | null;
  } | null;
  idempotencyTtlMs: number | null;
  workflowState: OrchestratorWorkflowExecutionState;
  controlPlaneOverride: {
    active: boolean;
    updatedAt: string | null;
    reason: string | null;
  };
};

type WorkflowFileOverlay = {
  schemaVersion?: unknown;
  idempotency?: {
    ttlMs?: unknown;
  };
  assistiveRouter?: {
    enabled?: unknown;
    provider?: unknown;
    model?: unknown;
    apiKey?: unknown;
    baseUrl?: unknown;
    timeoutMs?: unknown;
    minConfidence?: unknown;
    allowIntents?: unknown;
    budgetPolicy?: unknown;
    promptCaching?: unknown;
    watchlistEnabled?: unknown;
  };
  retryPolicy?: {
    continuationStatusCode?: unknown;
    continuationBackoffMs?: unknown;
    transientErrorCodes?: unknown;
    transientErrorPatterns?: unknown;
    terminalErrorCodes?: unknown;
    terminalErrorPatterns?: unknown;
  };
};

const ALL_INTENTS: readonly OrchestratorIntent[] = [
  "conversation",
  "translation",
  "negotiation",
  "research",
  "story",
  "ui_task",
];
const ALL_ASSISTIVE_ROUTER_PROVIDERS: readonly AssistiveRouterProvider[] = [
  "gemini_api",
  "openai",
  "anthropic",
  "deepseek",
  "moonshot",
];
const ALL_ASSISTIVE_BUDGET_POLICIES: readonly AssistiveRouterBudgetPolicy[] = [
  "judged_default",
  "long_context_operator",
  "cost_sensitive_batch",
  "watchlist_experimental",
];
const ALL_ASSISTIVE_PROMPT_CACHING: readonly AssistiveRouterPromptCaching[] = [
  "none",
  "provider_default",
  "provider_prompt_cache",
  "watchlist_only",
];
const ALL_WORKFLOW_STAGES: readonly OrchestratorWorkflowStage[] = [
  "intake",
  "planning",
  "safety_review",
  "execution",
  "verification",
  "reporting",
];
const ALL_WORKFLOW_ROLES: readonly OrchestratorWorkflowRole[] = [
  "intake",
  "planner",
  "safety_reviewer",
  "executor",
  "verifier",
  "reporter",
];

const DEFAULT_WORKFLOW_PATH = resolvePath(process.cwd(), "configs", "orchestrator.workflow.json");
const DEFAULT_ASSISTIVE_ROUTER_PROVIDER: AssistiveRouterProvider = "gemini_api";
const DEFAULT_ASSISTIVE_INTENTS: readonly OrchestratorIntent[] = [
  "conversation",
  "translation",
  "negotiation",
  "research",
];
const DEFAULT_TRANSIENT_ERROR_CODES = [
  "abort_error",
  "etimedout",
  "econnreset",
  "econnrefused",
  "eai_again",
  "rate_limit",
  "service_unavailable",
  "unavailable",
  "upstream_unavailable",
];
const DEFAULT_TRANSIENT_ERROR_PATTERNS = [
  "timed out",
  "timeout",
  "rate limit",
  "temporarily unavailable",
  "service unavailable",
  "fetch failed",
  "econnreset",
  "econnrefused",
  "eai_again",
  "503",
  "502",
  "504",
  "429",
];
const DEFAULT_TERMINAL_ERROR_CODES = [
  "invalid_argument",
  "invalid_payload",
  "syntax_error",
  "forbidden",
  "unauthorized",
  "not_found",
];
const DEFAULT_TERMINAL_ERROR_PATTERNS = [
  "invalid payload",
  "invalid json",
  "syntaxerror",
  "unsupported",
  "forbidden",
  "permission denied",
  "unauthorized",
  "not found",
];

let cachedConfig: OrchestratorWorkflowConfig | null = null;
let lastKnownGoodConfig: OrchestratorWorkflowConfig | null = null;
let lastAttemptAt: string | null = null;
let lastError: string | null = null;
let usingLastKnownGood = false;
let fingerprint: string | null = null;
let refreshSignature: string | null = null;
let nextRefreshAtMs = 0;
let workflowExecutionState: OrchestratorWorkflowExecutionState = {
  status: "idle",
  currentStage: null,
  activeRole: null,
  runId: null,
  sessionId: null,
  taskId: null,
  intent: null,
  route: null,
  reason: null,
  updatedAt: null,
};
let controlPlaneOverride:
  | {
      rawJson: string;
      updatedAt: string;
      reason: string | null;
    }
  | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
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

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseStatusCode(value: unknown, fallback: number): number {
  const parsed = parsePositiveInt(value, fallback);
  if (parsed < 400 || parsed > 599) {
    return fallback;
  }
  return parsed;
}

function parseConfidence(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, parsed));
}

function parseAssistiveRouterProvider(value: unknown, fallback: AssistiveRouterProvider): AssistiveRouterProvider {
  const normalized = toNonEmptyString(value);
  if (normalized && (ALL_ASSISTIVE_ROUTER_PROVIDERS as readonly string[]).includes(normalized)) {
    return normalized as AssistiveRouterProvider;
  }
  return fallback;
}

function parseAssistiveRouterBudgetPolicy(
  value: unknown,
  fallback: AssistiveRouterBudgetPolicy,
): AssistiveRouterBudgetPolicy {
  const normalized = toNonEmptyString(value);
  if (normalized && (ALL_ASSISTIVE_BUDGET_POLICIES as readonly string[]).includes(normalized)) {
    return normalized as AssistiveRouterBudgetPolicy;
  }
  return fallback;
}

function parseAssistiveRouterPromptCaching(
  value: unknown,
  fallback: AssistiveRouterPromptCaching,
): AssistiveRouterPromptCaching {
  const normalized = toNonEmptyString(value);
  if (normalized && (ALL_ASSISTIVE_PROMPT_CACHING as readonly string[]).includes(normalized)) {
    return normalized as AssistiveRouterPromptCaching;
  }
  return fallback;
}

function parseWorkflowStage(value: unknown): OrchestratorWorkflowStage | null {
  const normalized = toNonEmptyString(value);
  if (normalized && (ALL_WORKFLOW_STAGES as readonly string[]).includes(normalized)) {
    return normalized as OrchestratorWorkflowStage;
  }
  return null;
}

function parseWorkflowRole(value: unknown): OrchestratorWorkflowRole | null {
  const normalized = toNonEmptyString(value);
  if (normalized && (ALL_WORKFLOW_ROLES as readonly string[]).includes(normalized)) {
    return normalized as OrchestratorWorkflowRole;
  }
  return null;
}

function defaultAssistiveRouterModel(provider: AssistiveRouterProvider): string {
  switch (provider) {
    case "openai":
      return "gpt-5.4";
    case "anthropic":
      return "claude-4";
    case "deepseek":
      return "deepseek-v3.1";
    case "moonshot":
      return "kimi-k2.5";
    case "gemini_api":
    default:
      return "gemini-3.1-flash-lite-preview";
  }
}

function defaultAssistiveRouterBaseUrl(provider: AssistiveRouterProvider): string {
  switch (provider) {
    case "openai":
      return (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    case "anthropic":
      return (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1").replace(/\/+$/, "");
    case "deepseek":
      return (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");
    case "moonshot":
      return (process.env.MOONSHOT_BASE_URL ?? "https://api.moonshot.ai/v1").replace(/\/+$/, "");
    case "gemini_api":
    default:
      return (process.env.GEMINI_API_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  }
}

function defaultAssistiveRouterBudgetPolicy(provider: AssistiveRouterProvider): AssistiveRouterBudgetPolicy {
  switch (provider) {
    case "openai":
    case "anthropic":
      return "long_context_operator";
    case "deepseek":
      return "cost_sensitive_batch";
    case "moonshot":
      return "watchlist_experimental";
    case "gemini_api":
    default:
      return "judged_default";
  }
}

function defaultAssistiveRouterPromptCaching(provider: AssistiveRouterProvider): AssistiveRouterPromptCaching {
  switch (provider) {
    case "anthropic":
      return "provider_prompt_cache";
    case "openai":
      return "provider_default";
    case "moonshot":
      return "watchlist_only";
    case "deepseek":
    case "gemini_api":
    default:
      return "none";
  }
}

function defaultAssistiveRouterWatchlistEnabled(provider: AssistiveRouterProvider): boolean {
  return false;
}

function providerApiKeyFromEnv(provider: AssistiveRouterProvider): string | null {
  switch (provider) {
    case "openai":
      return toNonEmptyString(process.env.OPENAI_API_KEY);
    case "anthropic":
      return toNonEmptyString(process.env.ANTHROPIC_API_KEY);
    case "deepseek":
      return toNonEmptyString(process.env.DEEPSEEK_API_KEY);
    case "moonshot":
      return toNonEmptyString(process.env.MOONSHOT_API_KEY);
    case "gemini_api":
    default:
      return toNonEmptyString(process.env.GEMINI_API_KEY);
  }
}

function normalizeStringList(value: unknown, fallback: readonly string[]): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const normalized = values
    .map((entry) => toNonEmptyString(entry))
    .filter((entry): entry is string => entry !== null)
    .map((entry) => entry.toLowerCase());
  return normalized.length > 0 ? Array.from(new Set(normalized)) : [...fallback];
}

function parseIntentList(value: unknown, fallback: readonly OrchestratorIntent[]): OrchestratorIntent[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const intents = values
    .map((entry) => toNonEmptyString(entry))
    .filter((entry): entry is string => entry !== null)
    .filter((entry): entry is OrchestratorIntent => (ALL_INTENTS as readonly string[]).includes(entry));
  return intents.length > 0 ? Array.from(new Set(intents)) : [...fallback];
}

function defaultConfig(): OrchestratorWorkflowConfig {
  const provider = DEFAULT_ASSISTIVE_ROUTER_PROVIDER;
  const baseUrl = defaultAssistiveRouterBaseUrl(provider);
  const apiKey = providerApiKeyFromEnv(provider);
  return {
    schemaVersion: 1,
    loadedAt: new Date().toISOString(),
    sourceKind: "defaults",
    sourcePath: null,
    idempotencyTtlMs: 120_000,
    assistiveRouter: {
      enabled: false,
      provider,
      model: defaultAssistiveRouterModel(provider),
      apiKey,
      baseUrl,
      timeoutMs: 2_500,
      minConfidence: 0.75,
      allowIntents: [...DEFAULT_ASSISTIVE_INTENTS],
      budgetPolicy: defaultAssistiveRouterBudgetPolicy(provider),
      promptCaching: defaultAssistiveRouterPromptCaching(provider),
      watchlistEnabled: defaultAssistiveRouterWatchlistEnabled(provider),
    },
    retryPolicy: {
      continuationStatusCode: 503,
      continuationBackoffMs: 1_200,
      transientErrorCodes: [...DEFAULT_TRANSIENT_ERROR_CODES],
      transientErrorPatterns: [...DEFAULT_TRANSIENT_ERROR_PATTERNS],
      terminalErrorCodes: [...DEFAULT_TERMINAL_ERROR_CODES],
      terminalErrorPatterns: [...DEFAULT_TERMINAL_ERROR_PATTERNS],
    },
  };
}

function applyOverlay(
  base: OrchestratorWorkflowConfig,
  overlay: WorkflowFileOverlay,
  sourceKind: OrchestratorWorkflowConfig["sourceKind"],
  sourcePath: string | null,
): OrchestratorWorkflowConfig {
  const provider = parseAssistiveRouterProvider(overlay.assistiveRouter?.provider, base.assistiveRouter.provider);
  const providerChanged = provider !== base.assistiveRouter.provider;
  const baseUrl =
    toNonEmptyString(overlay.assistiveRouter?.baseUrl)?.replace(/\/+$/, "") ??
    (providerChanged ? defaultAssistiveRouterBaseUrl(provider) : base.assistiveRouter.baseUrl);
  const model =
    toNonEmptyString(overlay.assistiveRouter?.model) ??
    (providerChanged ? defaultAssistiveRouterModel(provider) : base.assistiveRouter.model);
  const budgetPolicy = parseAssistiveRouterBudgetPolicy(
    overlay.assistiveRouter?.budgetPolicy,
    providerChanged ? defaultAssistiveRouterBudgetPolicy(provider) : base.assistiveRouter.budgetPolicy,
  );
  const promptCaching = parseAssistiveRouterPromptCaching(
    overlay.assistiveRouter?.promptCaching,
    providerChanged ? defaultAssistiveRouterPromptCaching(provider) : base.assistiveRouter.promptCaching,
  );
  const watchlistEnabled = parseBoolean(
    overlay.assistiveRouter?.watchlistEnabled,
    providerChanged ? defaultAssistiveRouterWatchlistEnabled(provider) : base.assistiveRouter.watchlistEnabled,
  );
  const apiKey =
    overlay.assistiveRouter?.apiKey === null
      ? null
      : toNonEmptyString(overlay.assistiveRouter?.apiKey) ?? (providerChanged ? null : base.assistiveRouter.apiKey);
  return {
    ...base,
    schemaVersion: parsePositiveInt(overlay.schemaVersion, base.schemaVersion),
    sourceKind,
    sourcePath,
    idempotencyTtlMs: parsePositiveInt(overlay.idempotency?.ttlMs, base.idempotencyTtlMs),
    assistiveRouter: {
      ...base.assistiveRouter,
      enabled: parseBoolean(overlay.assistiveRouter?.enabled, base.assistiveRouter.enabled),
      provider,
      model,
      apiKey,
      baseUrl,
      timeoutMs: parsePositiveInt(overlay.assistiveRouter?.timeoutMs, base.assistiveRouter.timeoutMs),
      minConfidence: parseConfidence(overlay.assistiveRouter?.minConfidence, base.assistiveRouter.minConfidence),
      allowIntents: parseIntentList(overlay.assistiveRouter?.allowIntents, base.assistiveRouter.allowIntents),
      budgetPolicy,
      promptCaching,
      watchlistEnabled,
    },
    retryPolicy: {
      ...base.retryPolicy,
      continuationStatusCode: parseStatusCode(
        overlay.retryPolicy?.continuationStatusCode,
        base.retryPolicy.continuationStatusCode,
      ),
      continuationBackoffMs: parsePositiveInt(
        overlay.retryPolicy?.continuationBackoffMs,
        base.retryPolicy.continuationBackoffMs,
      ),
      transientErrorCodes: normalizeStringList(
        overlay.retryPolicy?.transientErrorCodes,
        base.retryPolicy.transientErrorCodes,
      ),
      transientErrorPatterns: normalizeStringList(
        overlay.retryPolicy?.transientErrorPatterns,
        base.retryPolicy.transientErrorPatterns,
      ),
      terminalErrorCodes: normalizeStringList(
        overlay.retryPolicy?.terminalErrorCodes,
        base.retryPolicy.terminalErrorCodes,
      ),
      terminalErrorPatterns: normalizeStringList(
        overlay.retryPolicy?.terminalErrorPatterns,
        base.retryPolicy.terminalErrorPatterns,
      ),
    },
  };
}

function applyEnvOverrides(base: OrchestratorWorkflowConfig): OrchestratorWorkflowConfig {
  const provider = parseAssistiveRouterProvider(
    process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER,
    base.assistiveRouter.provider,
  );
  const providerChanged = provider !== base.assistiveRouter.provider;
  const assistiveBaseUrlRaw = process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL ?? null;
  const assistiveBaseUrl =
    toNonEmptyString(assistiveBaseUrlRaw)?.replace(/\/+$/, "") ??
    (providerChanged ? defaultAssistiveRouterBaseUrl(provider) : base.assistiveRouter.baseUrl);
  const assistiveApiKey =
    toNonEmptyString(process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY) ??
    providerApiKeyFromEnv(provider) ??
    (providerChanged ? null : base.assistiveRouter.apiKey);
  const assistiveModel =
    toNonEmptyString(process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL) ??
    (providerChanged ? defaultAssistiveRouterModel(provider) : base.assistiveRouter.model);
  const budgetPolicy = parseAssistiveRouterBudgetPolicy(
    process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY,
    providerChanged ? defaultAssistiveRouterBudgetPolicy(provider) : base.assistiveRouter.budgetPolicy,
  );
  const promptCaching = parseAssistiveRouterPromptCaching(
    process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING,
    providerChanged ? defaultAssistiveRouterPromptCaching(provider) : base.assistiveRouter.promptCaching,
  );
  const watchlistEnabled = parseBoolean(
    process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED,
    providerChanged ? defaultAssistiveRouterWatchlistEnabled(provider) : base.assistiveRouter.watchlistEnabled,
  );

  return {
    ...base,
    idempotencyTtlMs: parsePositiveInt(process.env.ORCHESTRATOR_IDEMPOTENCY_TTL_MS, base.idempotencyTtlMs),
    assistiveRouter: {
      ...base.assistiveRouter,
      enabled: parseBoolean(process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED, base.assistiveRouter.enabled),
      provider,
      model: assistiveModel,
      apiKey: assistiveApiKey,
      baseUrl: assistiveBaseUrl,
      timeoutMs: parsePositiveInt(process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_TIMEOUT_MS, base.assistiveRouter.timeoutMs),
      minConfidence: parseConfidence(
        process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE,
        base.assistiveRouter.minConfidence,
      ),
      allowIntents: parseIntentList(
        process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ALLOW_INTENTS,
        base.assistiveRouter.allowIntents,
      ),
      budgetPolicy,
      promptCaching,
      watchlistEnabled,
    },
    retryPolicy: {
      ...base.retryPolicy,
      continuationStatusCode: parseStatusCode(
        process.env.ORCHESTRATOR_CONTINUATION_STATUS_CODE,
        base.retryPolicy.continuationStatusCode,
      ),
      continuationBackoffMs: parsePositiveInt(
        process.env.ORCHESTRATOR_CONTINUATION_RETRY_BACKOFF_MS,
        base.retryPolicy.continuationBackoffMs,
      ),
      transientErrorCodes: normalizeStringList(
        process.env.ORCHESTRATOR_TRANSIENT_ERROR_CODES,
        base.retryPolicy.transientErrorCodes,
      ),
      transientErrorPatterns: normalizeStringList(
        process.env.ORCHESTRATOR_TRANSIENT_ERROR_PATTERNS,
        base.retryPolicy.transientErrorPatterns,
      ),
      terminalErrorCodes: normalizeStringList(
        process.env.ORCHESTRATOR_TERMINAL_ERROR_CODES,
        base.retryPolicy.terminalErrorCodes,
      ),
      terminalErrorPatterns: normalizeStringList(
        process.env.ORCHESTRATOR_TERMINAL_ERROR_PATTERNS,
        base.retryPolicy.terminalErrorPatterns,
      ),
    },
  };
}

function readSource(): {
  kind: OrchestratorWorkflowConfig["sourceKind"];
  sourcePath: string | null;
  raw: string | null;
} {
  const inlineJson = toNonEmptyString(process.env.ORCHESTRATOR_WORKFLOW_CONFIG_JSON);
  if (inlineJson) {
    return {
      kind: "json",
      sourcePath: null,
      raw: inlineJson,
    };
  }

  const configuredPath = toNonEmptyString(process.env.ORCHESTRATOR_WORKFLOW_CONFIG_PATH);
  const sourcePath = configuredPath ?? (existsSync(DEFAULT_WORKFLOW_PATH) ? DEFAULT_WORKFLOW_PATH : null);
  if (!sourcePath) {
    return {
      kind: "defaults",
      sourcePath: null,
      raw: null,
    };
  }

  return {
    kind: "file",
    sourcePath,
    raw: readFileSync(sourcePath, "utf8"),
  };
}

function createFingerprint(config: OrchestratorWorkflowConfig): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        schemaVersion: config.schemaVersion,
        sourceKind: config.sourceKind,
        sourcePath: config.sourcePath,
        idempotencyTtlMs: config.idempotencyTtlMs,
        assistiveRouter: {
          enabled: config.assistiveRouter.enabled,
          provider: config.assistiveRouter.provider,
          model: config.assistiveRouter.model,
          apiKeyConfigured: config.assistiveRouter.apiKey !== null,
          baseUrl: config.assistiveRouter.baseUrl,
          timeoutMs: config.assistiveRouter.timeoutMs,
          minConfidence: config.assistiveRouter.minConfidence,
          allowIntents: config.assistiveRouter.allowIntents,
          budgetPolicy: config.assistiveRouter.budgetPolicy,
          promptCaching: config.assistiveRouter.promptCaching,
          watchlistEnabled: config.assistiveRouter.watchlistEnabled,
        },
        retryPolicy: config.retryPolicy,
      }),
      "utf8",
    )
    .digest("hex");
}

function cloneWorkflowExecutionState(
  state: OrchestratorWorkflowExecutionState,
): OrchestratorWorkflowExecutionState {
  return {
    ...state,
  };
}

function defaultWorkflowExecutionState(): OrchestratorWorkflowExecutionState {
  return {
    status: "idle",
    currentStage: null,
    activeRole: null,
    runId: null,
    sessionId: null,
    taskId: null,
    intent: null,
    route: null,
    reason: null,
    updatedAt: null,
  };
}

export function getOrchestratorWorkflowExecutionState(): OrchestratorWorkflowExecutionState {
  return cloneWorkflowExecutionState(workflowExecutionState);
}

export function setOrchestratorWorkflowExecutionState(params: {
  status?: OrchestratorWorkflowExecutionStatus;
  currentStage?: OrchestratorWorkflowStage | string | null;
  activeRole?: OrchestratorWorkflowRole | string | null;
  runId?: string | null;
  sessionId?: string | null;
  taskId?: string | null;
  intent?: OrchestratorIntent | null;
  route?: string | null;
  reason?: string | null;
  updatedAt?: string | null;
}): OrchestratorWorkflowExecutionState {
  workflowExecutionState = {
    status: params.status ?? workflowExecutionState.status,
    currentStage: parseWorkflowStage(params.currentStage) ?? workflowExecutionState.currentStage,
    activeRole: parseWorkflowRole(params.activeRole) ?? workflowExecutionState.activeRole,
    runId: toNonEmptyString(params.runId) ?? workflowExecutionState.runId,
    sessionId: toNonEmptyString(params.sessionId) ?? workflowExecutionState.sessionId,
    taskId: toNonEmptyString(params.taskId) ?? workflowExecutionState.taskId,
    intent: params.intent ?? workflowExecutionState.intent,
    route: toNonEmptyString(params.route) ?? workflowExecutionState.route,
    reason: toNonEmptyString(params.reason) ?? workflowExecutionState.reason,
    updatedAt: toNonEmptyString(params.updatedAt) ?? new Date().toISOString(),
  };
  return getOrchestratorWorkflowExecutionState();
}

export function clearOrchestratorWorkflowExecutionState(): void {
  workflowExecutionState = defaultWorkflowExecutionState();
}

function buildRefreshSignature(): string {
  return JSON.stringify({
    configPath: process.env.ORCHESTRATOR_WORKFLOW_CONFIG_PATH ?? null,
    configJson: process.env.ORCHESTRATOR_WORKFLOW_CONFIG_JSON ?? null,
    refreshMs: process.env.ORCHESTRATOR_WORKFLOW_REFRESH_MS ?? null,
    idempotencyTtlMs: process.env.ORCHESTRATOR_IDEMPOTENCY_TTL_MS ?? null,
    assistiveRouterEnabled: process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED ?? null,
    assistiveRouterProvider: process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER ?? null,
    assistiveRouterModel: process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL ?? null,
    assistiveRouterApiKey: process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY ?? null,
    assistiveRouterBaseUrl: process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL ?? null,
    assistiveRouterTimeoutMs: process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_TIMEOUT_MS ?? null,
    assistiveRouterMinConfidence: process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE ?? null,
    assistiveRouterAllowIntents: process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ALLOW_INTENTS ?? null,
    assistiveRouterBudgetPolicy: process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY ?? null,
    assistiveRouterPromptCaching: process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING ?? null,
    assistiveRouterWatchlistEnabled: process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED ?? null,
    continuationStatusCode: process.env.ORCHESTRATOR_CONTINUATION_STATUS_CODE ?? null,
    continuationRetryBackoffMs: process.env.ORCHESTRATOR_CONTINUATION_RETRY_BACKOFF_MS ?? null,
    transientErrorCodes: process.env.ORCHESTRATOR_TRANSIENT_ERROR_CODES ?? null,
    transientErrorPatterns: process.env.ORCHESTRATOR_TRANSIENT_ERROR_PATTERNS ?? null,
    terminalErrorCodes: process.env.ORCHESTRATOR_TERMINAL_ERROR_CODES ?? null,
    terminalErrorPatterns: process.env.ORCHESTRATOR_TERMINAL_ERROR_PATTERNS ?? null,
    geminiApiBaseUrl: process.env.GEMINI_API_BASE_URL ?? null,
    geminiApiKey: process.env.GEMINI_API_KEY ?? null,
    openAiBaseUrl: process.env.OPENAI_BASE_URL ?? null,
    openAiApiKey: process.env.OPENAI_API_KEY ?? null,
    anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL ?? null,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? null,
    deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? null,
    deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? null,
    moonshotBaseUrl: process.env.MOONSHOT_BASE_URL ?? null,
    moonshotApiKey: process.env.MOONSHOT_API_KEY ?? null,
    controlPlaneOverrideRawJson: controlPlaneOverride?.rawJson ?? null,
    controlPlaneOverrideUpdatedAt: controlPlaneOverride?.updatedAt ?? null,
    controlPlaneOverrideReason: controlPlaneOverride?.reason ?? null,
  });
}

function applyControlPlaneOverride(base: OrchestratorWorkflowConfig): OrchestratorWorkflowConfig {
  if (!controlPlaneOverride) {
    return base;
  }
  const parsed = JSON.parse(controlPlaneOverride.rawJson) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("orchestrator workflow control-plane override must be a JSON object");
  }
  return applyOverlay(base, parsed as WorkflowFileOverlay, "control_plane_json", null);
}

function loadFreshConfig(): OrchestratorWorkflowConfig {
  const base = defaultConfig();
  const source = readSource();
  let config = {
    ...base,
    sourceKind: source.kind,
    sourcePath: source.sourcePath,
  } as OrchestratorWorkflowConfig;

  if (source.raw) {
    const parsed = JSON.parse(source.raw) as unknown;
    if (!isRecord(parsed)) {
      throw new Error("orchestrator workflow config must be a JSON object");
    }
    config = applyOverlay(config, parsed as WorkflowFileOverlay, source.kind, source.sourcePath);
  }

  config = applyEnvOverrides(config);
  config = applyControlPlaneOverride(config);
  config.loadedAt = new Date().toISOString();
  return config;
}

function invalidateWorkflowCache(): void {
  cachedConfig = null;
  fingerprint = null;
  refreshSignature = null;
  nextRefreshAtMs = 0;
}

export function getOrchestratorWorkflowConfig(): OrchestratorWorkflowConfig {
  const nowMs = Date.now();
  const refreshMs = parsePositiveInt(process.env.ORCHESTRATOR_WORKFLOW_REFRESH_MS, 1_500);
  const currentSignature = buildRefreshSignature();
  if (
    cachedConfig !== null &&
    fingerprint !== null &&
    refreshSignature === currentSignature &&
    nowMs < nextRefreshAtMs
  ) {
    return cachedConfig;
  }

  lastAttemptAt = new Date(nowMs).toISOString();
  try {
    const fresh = loadFreshConfig();
    cachedConfig = fresh;
    lastKnownGoodConfig = fresh;
    lastError = null;
    usingLastKnownGood = false;
    fingerprint = createFingerprint(fresh);
    refreshSignature = currentSignature;
    nextRefreshAtMs = nowMs + refreshMs;
    return fresh;
  } catch (error) {
    lastError = error instanceof Error ? error.message : "failed to load orchestrator workflow config";
    refreshSignature = currentSignature;
    nextRefreshAtMs = nowMs + refreshMs;
    if (lastKnownGoodConfig !== null) {
      cachedConfig = lastKnownGoodConfig;
      usingLastKnownGood = true;
      fingerprint = createFingerprint(lastKnownGoodConfig);
      return lastKnownGoodConfig;
    }

    const fallback = applyEnvOverrides(defaultConfig());
    fallback.loadedAt = new Date(nowMs).toISOString();
    cachedConfig = fallback;
    usingLastKnownGood = false;
    fingerprint = createFingerprint(fallback);
    return fallback;
  }
}

export function getOrchestratorWorkflowStoreStatus(): OrchestratorWorkflowStoreStatus {
  return {
    loadedAt: cachedConfig?.loadedAt ?? null,
    lastAttemptAt,
    sourceKind: cachedConfig?.sourceKind ?? null,
    sourcePath: cachedConfig?.sourcePath ?? null,
    fingerprint,
    usingLastKnownGood,
    lastError,
    assistiveRouter: cachedConfig
      ? {
          enabled: cachedConfig.assistiveRouter.enabled,
          provider: cachedConfig.assistiveRouter.provider,
          model: cachedConfig.assistiveRouter.model,
          apiKeyConfigured: cachedConfig.assistiveRouter.apiKey !== null,
          allowIntents: [...cachedConfig.assistiveRouter.allowIntents],
          timeoutMs: cachedConfig.assistiveRouter.timeoutMs,
          minConfidence: cachedConfig.assistiveRouter.minConfidence,
          budgetPolicy: cachedConfig.assistiveRouter.budgetPolicy,
          promptCaching: cachedConfig.assistiveRouter.promptCaching,
          watchlistEnabled: cachedConfig.assistiveRouter.watchlistEnabled,
      }
    : null,
    idempotencyTtlMs: cachedConfig?.idempotencyTtlMs ?? null,
    workflowState: getOrchestratorWorkflowExecutionState(),
    controlPlaneOverride: {
      active: controlPlaneOverride !== null,
      updatedAt: controlPlaneOverride?.updatedAt ?? null,
      reason: controlPlaneOverride?.reason ?? null,
    },
  };
}

export function setOrchestratorWorkflowControlPlaneOverride(params: {
  rawJson: string;
  reason?: string | null;
}): void {
  controlPlaneOverride = {
    rawJson: params.rawJson,
    updatedAt: new Date().toISOString(),
    reason: toNonEmptyString(params.reason) ?? null,
  };
  invalidateWorkflowCache();
}

export function clearOrchestratorWorkflowControlPlaneOverride(): void {
  controlPlaneOverride = null;
  invalidateWorkflowCache();
}

export function resetOrchestratorWorkflowStoreForTests(): void {
  cachedConfig = null;
  lastKnownGoodConfig = null;
  lastAttemptAt = null;
  lastError = null;
  usingLastKnownGood = false;
  fingerprint = null;
  refreshSignature = null;
  nextRefreshAtMs = 0;
  workflowExecutionState = defaultWorkflowExecutionState();
  controlPlaneOverride = null;
}
