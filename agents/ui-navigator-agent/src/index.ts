import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import {
  buildCapabilityProfile,
  generateGoogleGenAiText,
  type CapabilityProfile,
  type ComputerUseCapabilityAdapter,
  type ReasoningCapabilityAdapter,
  type ReasoningTextResult,
  type ReasoningTextUsage,
} from "@mla/capabilities";
import {
  getSkillsRuntimeSnapshot,
  renderSkillsPrompt,
  resolveCredentialValueWithProfile,
  toSkillsRuntimeSummary,
} from "@mla/skills";
import {
  createEnvelope,
  type NormalizedError,
  type OrchestratorRequest,
  type OrchestratorResponse,
  type UiFailureClass,
  type UiPlannerVerification,
  type UiVerificationOutcome,
  type UiVerificationState,
} from "@mla/contracts";

type UiTaskInput = {
  goal: string;
  url: string | null;
  deviceNodeId: string | null;
  deviceNodeKind: DeviceNodeKind | null;
  deviceNodePlatform: string | null;
  deviceNodeCapabilities: string[];
  deviceNodeMinTrustLevel: DeviceNodeRuntimeRecord["trustLevel"] | null;
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
  browserWorker: BrowserWorkerInput;
  visualTesting: VisualTestingInput;
};

type BrowserWorkerInput = {
  enabled: boolean;
  checkpointEverySteps: number | null;
  pauseAfterStep: number | null;
  label: string | null;
};

type GroundingSignalSummary = {
  screenshotRefProvided: boolean;
  domSnapshotProvided: boolean;
  accessibilityTreeProvided: boolean;
  markHintsCount: number;
};

type VerificationExecutionSnapshot = {
  trace: UiTraceStep[];
  finalStatus: string;
  retries: number;
  adapterMode: ExecutorMode;
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
  observation?: string | null;
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
  damageControlEnabled: boolean;
  damageControlRulesPath: string | null;
  damageControlRulesJson: string | null;
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

type DamageControlRuleMode = "block" | "ask";

type DamageControlRule = {
  id: string;
  mode: DamageControlRuleMode;
  reason: string;
  goalPatterns: string[];
  actionTypes: UiAction["type"][];
  actionTargetPatterns: string[];
  approvalCategories: string[];
};

type DamageControlMatch = {
  ruleId: string;
  mode: DamageControlRuleMode;
  reason: string;
};

type DamageControlRuleset = {
  source: "default" | "file" | "env_json";
  path: string | null;
  warnings: string[];
  rules: DamageControlRule[];
};

type DamageControlVerdict = {
  enabled: boolean;
  source: DamageControlRuleset["source"];
  path: string | null;
  verdict: "allow" | "ask" | "block";
  matches: DamageControlMatch[];
  warnings: string[];
};

type UiNavigatorCapabilitySet = {
  reasoning: ReasoningCapabilityAdapter;
  computerUse: ComputerUseCapabilityAdapter;
  profile: CapabilityProfile;
};

type AgentUsageModelTotals = {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type AgentUsageTotals = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  byModel: Map<string, AgentUsageModelTotals>;
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
  requestedCriteria: {
    kind: DeviceNodeKind | null;
    platform: string | null;
    requiredCapabilities: string[];
    minTrustLevel: DeviceNodeRuntimeRecord["trustLevel"] | null;
  };
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

function toPositiveInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : null;
}

function toNonNegativeInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const normalized = Math.trunc(parsed);
  return normalized >= 0 ? normalized : null;
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

const VALID_UI_ACTION_TYPES: UiAction["type"][] = ["navigate", "click", "type", "scroll", "hotkey", "wait", "verify"];

const DEFAULT_DAMAGE_CONTROL_RULES: DamageControlRule[] = [
  {
    id: "dc-payment-ask",
    mode: "ask",
    reason: "Payment-related actions require explicit confirmation.",
    goalPatterns: [],
    actionTypes: [],
    actionTargetPatterns: [],
    approvalCategories: ["payment"],
  },
  {
    id: "dc-credential-ask",
    mode: "ask",
    reason: "Credential submission requires explicit confirmation.",
    goalPatterns: [],
    actionTypes: [],
    actionTargetPatterns: [],
    approvalCategories: ["credential_submission"],
  },
  {
    id: "dc-destructive-ask",
    mode: "ask",
    reason: "Destructive operations require explicit confirmation.",
    goalPatterns: [],
    actionTypes: [],
    actionTargetPatterns: [],
    approvalCategories: ["destructive_operation"],
  },
  {
    id: "dc-hotkey-block",
    mode: "block",
    reason: "Critical system hotkeys are blocked by policy.",
    goalPatterns: [],
    actionTypes: ["hotkey"],
    actionTargetPatterns: ["\\b(alt\\+f4|cmd\\+q|ctrl\\+alt\\+delete)\\b"],
    approvalCategories: [],
  },
];

let cachedDamageControlRules: { cacheKey: string; ruleset: DamageControlRuleset } | null = null;

function normalizeDamageControlMode(value: unknown): DamageControlRuleMode {
  return String(value).toLowerCase() === "block" ? "block" : "ask";
}

function normalizeDamageControlActionTypes(value: unknown): UiAction["type"][] {
  const candidates = toStringArray(value).map((item) => item.trim().toLowerCase());
  return candidates.filter((candidate): candidate is UiAction["type"] =>
    VALID_UI_ACTION_TYPES.includes(candidate as UiAction["type"]),
  );
}

function normalizeDamageControlRule(raw: unknown, index: number): DamageControlRule | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = toNonEmptyString(raw.id, `dc-rule-${index + 1}`);
  const reason = toNonEmptyString(raw.reason, "");
  if (reason.length === 0) {
    return null;
  }
  const goalPatterns = toStringArray(raw.goalPatterns).slice(0, 12);
  const actionTypes = normalizeDamageControlActionTypes(raw.actionTypes).slice(0, 8);
  const actionTargetPatterns = toStringArray(raw.actionTargetPatterns).slice(0, 12);
  const approvalCategories = toStringArray(raw.approvalCategories).slice(0, 12);
  if (
    goalPatterns.length === 0 &&
    actionTypes.length === 0 &&
    actionTargetPatterns.length === 0 &&
    approvalCategories.length === 0
  ) {
    return null;
  }
  return {
    id,
    mode: normalizeDamageControlMode(raw.mode),
    reason,
    goalPatterns,
    actionTypes,
    actionTargetPatterns,
    approvalCategories,
  };
}

function parseDamageControlRules(source: unknown): DamageControlRule[] {
  const rawRules = isRecord(source) ? source.rules : [];
  if (!Array.isArray(rawRules)) {
    return [];
  }
  const normalized: DamageControlRule[] = [];
  for (let index = 0; index < rawRules.length; index += 1) {
    const rule = normalizeDamageControlRule(rawRules[index], index);
    if (rule) {
      normalized.push(rule);
    }
  }
  return normalized;
}

function buildDefaultDamageControlRuleset(): DamageControlRuleset {
  return {
    source: "default",
    path: null,
    warnings: [],
    rules: DEFAULT_DAMAGE_CONTROL_RULES,
  };
}

function loadDamageControlRules(config: PlannerConfig): DamageControlRuleset {
  const cacheKey = `${config.damageControlRulesPath ?? ""}::${config.damageControlRulesJson ?? ""}`;
  if (cachedDamageControlRules && cachedDamageControlRules.cacheKey === cacheKey) {
    return cachedDamageControlRules.ruleset;
  }

  const fallback = buildDefaultDamageControlRuleset();
  const warnings: string[] = [];

  if (config.damageControlRulesJson) {
    try {
      const parsed = JSON.parse(config.damageControlRulesJson) as unknown;
      const rules = parseDamageControlRules(parsed);
      if (rules.length > 0) {
        const ruleset: DamageControlRuleset = {
          source: "env_json",
          path: null,
          warnings,
          rules,
        };
        cachedDamageControlRules = { cacheKey, ruleset };
        return ruleset;
      }
      warnings.push("UI_NAVIGATOR_DAMAGE_CONTROL_RULES_JSON did not provide any valid rules.");
    } catch (error) {
      warnings.push(
        `Failed to parse UI_NAVIGATOR_DAMAGE_CONTROL_RULES_JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (config.damageControlRulesPath) {
    try {
      const absolutePath = resolvePath(process.cwd(), config.damageControlRulesPath);
      if (existsSync(absolutePath)) {
        const raw = readFileSync(absolutePath, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        const rules = parseDamageControlRules(parsed);
        if (rules.length > 0) {
          const ruleset: DamageControlRuleset = {
            source: "file",
            path: config.damageControlRulesPath,
            warnings,
            rules,
          };
          cachedDamageControlRules = { cacheKey, ruleset };
          return ruleset;
        }
        warnings.push(`Damage-control rules file has no valid rules: ${config.damageControlRulesPath}`);
      }
    } catch (error) {
      warnings.push(
        `Failed to load damage-control rules file '${config.damageControlRulesPath}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const ruleset: DamageControlRuleset = {
    source: fallback.source,
    path: fallback.path,
    warnings,
    rules: fallback.rules,
  };
  cachedDamageControlRules = { cacheKey, ruleset };
  return ruleset;
}

function containsPatternMatch(text: string, patterns: string[]): boolean {
  if (patterns.length === 0) {
    return true;
  }
  for (const pattern of patterns) {
    try {
      if (new RegExp(pattern, "i").test(text)) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

function intersects<T extends string>(left: T[], right: T[]): boolean {
  const rightSet = new Set<T>(right);
  return left.some((item) => rightSet.has(item));
}

function evaluateDamageControl(params: {
  config: PlannerConfig;
  input: UiTaskInput;
  actions: UiAction[];
  approvalCategories: string[];
}): DamageControlVerdict {
  if (!params.config.damageControlEnabled) {
    return {
      enabled: false,
      source: "default",
      path: null,
      verdict: "allow",
      matches: [],
      warnings: [],
    };
  }

  const ruleset = loadDamageControlRules(params.config);
  const actionTypes = params.actions.map((action) => action.type);
  const actionTargets = params.actions.map((action) => action.target);
  const matches: DamageControlMatch[] = [];

  for (const rule of ruleset.rules) {
    if (!containsPatternMatch(params.input.goal, rule.goalPatterns)) {
      continue;
    }
    if (rule.actionTypes.length > 0 && !intersects(rule.actionTypes, actionTypes)) {
      continue;
    }
    if (rule.actionTargetPatterns.length > 0) {
      const targetMatched = actionTargets.some((target) => containsPatternMatch(target, rule.actionTargetPatterns));
      if (!targetMatched) {
        continue;
      }
    }
    if (rule.approvalCategories.length > 0 && !intersects(rule.approvalCategories, params.approvalCategories)) {
      continue;
    }
    matches.push({
      ruleId: rule.id,
      mode: rule.mode,
      reason: rule.reason,
    });
  }

  const hasBlock = matches.some((match) => match.mode === "block");
  const hasAsk = matches.some((match) => match.mode === "ask");
  const approvalAlreadyConfirmed = params.input.approvalConfirmed || params.input.approvalDecision === "approved";

  return {
    enabled: true,
    source: ruleset.source,
    path: ruleset.path,
    verdict: hasBlock ? "block" : hasAsk && !approvalAlreadyConfirmed ? "ask" : "allow",
    matches,
    warnings: ruleset.warnings,
  };
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

function createAgentUsageTotals(): AgentUsageTotals {
  return {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    byModel: new Map<string, AgentUsageModelTotals>(),
  };
}

function recordAgentUsage(totals: AgentUsageTotals, model: string, usage: ReasoningTextUsage | undefined): void {
  if (!usage) {
    return;
  }

  const inputTokens = toNonNegativeInt(usage.inputTokens) ?? 0;
  const outputTokens = toNonNegativeInt(usage.outputTokens) ?? 0;
  const totalTokens = Math.max(toNonNegativeInt(usage.totalTokens) ?? 0, inputTokens + outputTokens);

  totals.calls += 1;
  totals.inputTokens += inputTokens;
  totals.outputTokens += outputTokens;
  totals.totalTokens += totalTokens;

  const current = totals.byModel.get(model) ?? {
    model,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  current.calls += 1;
  current.inputTokens += inputTokens;
  current.outputTokens += outputTokens;
  current.totalTokens += totalTokens;
  totals.byModel.set(model, current);
}

function buildAgentUsagePayload(totals: AgentUsageTotals): Record<string, unknown> {
  const models = Array.from(totals.byModel.values()).sort((left, right) => left.model.localeCompare(right.model));
  return {
    source: totals.calls > 0 ? "gemini_usage_metadata" : "none",
    calls: totals.calls,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    totalTokens: totals.totalTokens,
    models,
  };
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

function parseOptionalDeviceNodeKind(raw: unknown): DeviceNodeKind | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw === "string" && raw.trim().length === 0) {
    return null;
  }
  return parseDeviceNodeKind(raw);
}

function parseOptionalTrustLevel(raw: unknown): DeviceNodeRuntimeRecord["trustLevel"] | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw === "string" && raw.trim().length === 0) {
    return null;
  }
  return parseTrustLevel(raw);
}

function normalizeCapabilityHints(raw: unknown): string[] {
  const entries = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const normalized = toNonEmptyString(entry, "").toLowerCase();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

function trustLevelRank(value: DeviceNodeRuntimeRecord["trustLevel"]): number {
  if (value === "trusted") {
    return 3;
  }
  if (value === "reviewed") {
    return 2;
  }
  return 1;
}

function nodeStatusRank(value: DeviceNodeStatus): number {
  if (value === "online") {
    return 3;
  }
  if (value === "degraded") {
    return 2;
  }
  return 1;
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

function hasDeviceNodeResolveCriteria(input: UiTaskInput): boolean {
  return (
    input.deviceNodeKind !== null ||
    input.deviceNodePlatform !== null ||
    input.deviceNodeCapabilities.length > 0 ||
    input.deviceNodeMinTrustLevel !== null
  );
}

function sortDeviceNodeCandidates(nodes: DeviceNodeRuntimeRecord[]): DeviceNodeRuntimeRecord[] {
  return [...nodes].sort((left, right) => {
    const statusDelta = nodeStatusRank(right.status) - nodeStatusRank(left.status);
    if (statusDelta !== 0) {
      return statusDelta;
    }
    const trustDelta = trustLevelRank(right.trustLevel) - trustLevelRank(left.trustLevel);
    if (trustDelta !== 0) {
      return trustDelta;
    }
    const leftSeen = left.updatedAt ?? "";
    const rightSeen = right.updatedAt ?? "";
    const seenDelta = rightSeen.localeCompare(leftSeen);
    if (seenDelta !== 0) {
      return seenDelta;
    }
    const versionDelta = right.version - left.version;
    if (versionDelta !== 0) {
      return versionDelta;
    }
    return left.nodeId.localeCompare(right.nodeId);
  });
}

async function resolveDeviceNodeRouting(params: {
  input: UiTaskInput;
  config: PlannerConfig;
}): Promise<DeviceNodeResolution> {
  const requestedNodeId = params.input.deviceNodeId?.trim().toLowerCase() ?? null;
  const requestedCriteria: DeviceNodeResolution["requestedCriteria"] = {
    kind: params.input.deviceNodeKind,
    platform: params.input.deviceNodePlatform,
    requiredCapabilities: [...params.input.deviceNodeCapabilities],
    minTrustLevel: params.input.deviceNodeMinTrustLevel,
  };
  const notes: string[] = [];

  if (!requestedNodeId && !hasDeviceNodeResolveCriteria(params.input)) {
    return {
      requestedNodeId: null,
      requestedCriteria,
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
  if (requestedNodeId && !node) {
    return {
      requestedNodeId,
      requestedCriteria,
      selectedNode: null,
      executorUrl: null,
      source,
      notes: [`Requested node '${requestedNodeId}' is not present in ${source}.`],
    };
  }

  const filtered = (requestedNodeId ? [node] : nodes)
    .filter((item): item is DeviceNodeRuntimeRecord => Boolean(item))
    .filter((item) => item.status !== "offline")
    .filter((item) => (requestedCriteria.kind ? item.kind === requestedCriteria.kind : true))
    .filter((item) =>
      requestedCriteria.platform ? item.platform.toLowerCase() === requestedCriteria.platform : true,
    )
    .filter((item) =>
      requestedCriteria.requiredCapabilities.every((capability) => item.capabilities.includes(capability)),
    )
    .filter((item) =>
      requestedCriteria.minTrustLevel
        ? trustLevelRank(item.trustLevel) >= trustLevelRank(requestedCriteria.minTrustLevel)
        : true,
    );

  if (filtered.length === 0) {
    const criteriaNotes = hasDeviceNodeResolveCriteria(params.input)
      ? [
          `No available node matches criteria (kind=${requestedCriteria.kind ?? "any"}, platform=${requestedCriteria.platform ?? "any"}, capabilities=${
            requestedCriteria.requiredCapabilities.join(",") || "any"
          }, minTrustLevel=${requestedCriteria.minTrustLevel ?? "any"}).`,
        ]
      : [];
    return {
      requestedNodeId,
      requestedCriteria,
      selectedNode: null,
      executorUrl: null,
      source,
      notes: requestedNodeId
        ? [`Requested node '${requestedNodeId}' is offline or filtered by criteria.`]
        : criteriaNotes,
    };
  }

  const selectedNode = sortDeviceNodeCandidates(filtered)[0] ?? null;
  if (!selectedNode) {
    return {
      requestedNodeId,
      requestedCriteria,
      selectedNode: null,
      executorUrl: null,
      source,
      notes: ["No available device node found after candidate ranking."],
    };
  }

  const executorUrl = selectedNode.executorUrl ?? params.config.executorUrl;
  if (!executorUrl) {
    return {
      requestedNodeId,
      requestedCriteria,
      selectedNode,
      executorUrl: null,
      source,
      notes: [
        requestedNodeId
          ? `Requested node '${requestedNodeId}' has no executorUrl and default executor is not configured.`
          : "Resolved device node has no executorUrl and default executor is not configured.",
      ],
    };
  }

  notes.push(
    selectedNode.executorUrl
      ? `Routed to node-specific executorUrl from ${source}.`
      : "Resolved node has no executorUrl; fell back to default executorUrl.",
  );
  if (!requestedNodeId && hasDeviceNodeResolveCriteria(params.input)) {
    notes.push(`Auto-selected node '${selectedNode.nodeId}' using requested routing criteria.`);
  }
  return {
    requestedNodeId,
    requestedCriteria,
    selectedNode,
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

  const deviceNodeIndexAuthToken = resolveCredentialValueWithProfile({
    namespace: "ui_navigator.device_node_index.auth_token",
    profileId:
      toNullableString(process.env.UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_PROFILE) ??
      "ui-navigator-device-index",
    directValue: process.env.UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_TOKEN,
    credentialName: process.env.UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_CREDENTIAL,
    env: process.env,
    cwd: process.cwd(),
  });

  return {
    apiKey:
      toNullableString(process.env.UI_NAVIGATOR_GEMINI_API_KEY) ?? toNullableString(process.env.GEMINI_API_KEY),
    baseUrl: toNonEmptyString(process.env.GEMINI_API_BASE_URL, "https://generativelanguage.googleapis.com/v1beta"),
    plannerModel: toNonEmptyString(process.env.UI_NAVIGATOR_PLANNER_MODEL, "gemini-3.1-pro-preview"),
    timeoutMs: parsePositiveInt(process.env.UI_NAVIGATOR_GEMINI_TIMEOUT_MS, 20000),
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
    deviceNodeIndexAuthToken: deviceNodeIndexAuthToken.value,
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
    damageControlEnabled: process.env.UI_NAVIGATOR_DAMAGE_CONTROL_ENABLED !== "false",
    damageControlRulesPath: toNullableString(
      process.env.UI_NAVIGATOR_DAMAGE_CONTROL_RULES_PATH ?? ".kiro/policies/ui-damage-control.rules.json",
    ),
    damageControlRulesJson: toNullableString(process.env.UI_NAVIGATOR_DAMAGE_CONTROL_RULES_JSON),
  };
}

function normalizeUiTaskInput(input: unknown, config: PlannerConfig): UiTaskInput {
  const raw = isRecord(input) ? input : {};
  const deviceNodeRaw = isRecord(raw.deviceNode) ? raw.deviceNode : {};
  const browserWorkerRaw = isRecord(raw.browserWorker) ? raw.browserWorker : {};
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
  const deviceNodeKind = parseOptionalDeviceNodeKind(raw.deviceNodeKind ?? deviceNodeRaw.kind);
  const deviceNodePlatformRaw = toNullableString(raw.deviceNodePlatform ?? deviceNodeRaw.platform);
  const deviceNodePlatform = deviceNodePlatformRaw ? deviceNodePlatformRaw.toLowerCase() : null;
  const deviceNodeCapabilities = normalizeCapabilityHints(
    raw.deviceNodeCapabilities ?? raw.requiredCapabilities ?? deviceNodeRaw.capabilities,
  );
  const deviceNodeMinTrustLevel = parseOptionalTrustLevel(
    raw.deviceNodeMinTrustLevel ?? raw.deviceNodeTrustLevel ?? deviceNodeRaw.minTrustLevel ?? deviceNodeRaw.trustLevel,
  );

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
  const browserWorkerEnabled =
    raw.asyncExecution === true ||
    raw.backgroundExecution === true ||
    raw.executionMode === "background" ||
    raw.executionMode === "browser_worker" ||
    browserWorkerRaw.enabled === true;
  const browserWorkerCheckpointEverySteps =
    toPositiveInt(browserWorkerRaw.checkpointEverySteps) ??
    toPositiveInt(raw.browserWorkerCheckpointEverySteps) ??
    null;
  const browserWorkerPauseAfterStep =
    toPositiveInt(browserWorkerRaw.pauseAfterStep) ?? toPositiveInt(raw.browserWorkerPauseAfterStep) ?? null;
  const browserWorkerLabel = toNullableString(browserWorkerRaw.label ?? raw.browserWorkerLabel);

  return {
    goal:
      toNonEmptyString(raw.goal, "") ||
      toNonEmptyString(raw.task, "") ||
      toNonEmptyString(raw.text, "") ||
      "Open the page and complete the requested UI flow safely.",
    url: toNullableString(raw.url),
    deviceNodeId: toNullableString(raw.deviceNodeId ?? deviceNodeRaw.nodeId ?? raw.targetNodeId),
    deviceNodeKind,
    deviceNodePlatform,
    deviceNodeCapabilities,
    deviceNodeMinTrustLevel,
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
    browserWorker: {
      enabled: browserWorkerEnabled,
      checkpointEverySteps: browserWorkerCheckpointEverySteps,
      pauseAfterStep: browserWorkerPauseAfterStep,
      label: browserWorkerLabel,
    },
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

function buildRuleBasedGoalVerificationActions(goal: string): UiAction[] {
  const normalized = goal.toLowerCase();
  const actions: UiAction[] = [];
  const seenTargets = new Set<string>();

  const pushVerify = (target: string, rationale: string) => {
    if (seenTargets.has(target)) {
      return;
    }
    seenTargets.add(target);
    actions.push(
      makeAction({
        type: "verify",
        target,
        rationale,
      }),
    );
  };

  if (/(invoice|invoices|table|grid)/.test(normalized)) {
    pushVerify(
      'css:table,[role="table"],[role="grid"],#invoices-table,[data-testid="invoices-table"]',
      "Verify that the requested table or grid is visible after navigation.",
    );
  } else if (/(list|rows|items)/.test(normalized)) {
    pushVerify(
      'css:table,[role="table"],[role="grid"],[role="list"],ul,ol',
      "Verify that a list-like result surface is visible after navigation.",
    );
  }

  if (/(button|cta|action|submit)/.test(normalized)) {
    pushVerify(
      'css:button,[role="button"],input[type="button"],input[type="submit"]',
      "Verify that the expected action surface is visible.",
    );
  }

  if (/(form|field|input|email)/.test(normalized)) {
    pushVerify(
      'css:form,input,textarea,select,[role="textbox"]',
      "Verify that the requested form controls are visible.",
    );
  }

  if (/(dialog|modal|popup)/.test(normalized)) {
    pushVerify(
      'css:dialog,[role="dialog"],[aria-modal="true"]',
      "Verify that the requested dialog surface is visible.",
    );
  }

  if (/(heading|title|headline)/.test(normalized)) {
    pushVerify(
      'css:h1,h2,[role="heading"]',
      "Verify that a page heading is visible after navigation.",
    );
  }

  return actions;
}

function goalRequestsEmailSubmitUnlock(goal: string): boolean {
  const normalized = goal.toLowerCase();
  return (
    /\bsubmit\b/.test(normalized) &&
    /\b(disabled|disable|stays|remains)\b/.test(normalized) &&
    /\bemail\b/.test(normalized) &&
    /\b(fill|filled|until|before)\b/.test(normalized)
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
    evaluate: {
      <TReturn>(callback: () => TReturn): Promise<TReturn>;
      <TReturn, TArg>(callback: (arg: TArg) => TReturn, arg: TArg): Promise<TReturn>;
    };
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
          return labels.length > 0 ? `buttons=${labels.join("|")}` : "buttons=";
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

function hasConcreteUiGrounding(input: UiTaskInput): boolean {
  return Boolean(
    input.url ||
      input.screenshotRef ||
      input.domSnapshot ||
      input.accessibilityTree ||
      input.markHints.length > 0 ||
      Object.keys(input.formData).length > 0,
  );
}

function shouldAutoSubmit(goal: string, input: UiTaskInput): boolean {
  if (!hasConcreteUiGrounding(input)) {
    return false;
  }

  const referencesSubmit = /\bsubmit\b/.test(goal);
  const referencesButtonState =
    referencesSubmit && /\b(disabled|disable|enabled|stays|remains|until|before)\b/.test(goal);
  if (referencesButtonState) {
    return false;
  }

  if (referencesSubmit) {
    return true;
  }

  return /\b(send|confirm)\b/.test(goal);
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

  if (input.url || input.screenshotRef || input.domSnapshot || input.accessibilityTree || input.markHints.length > 0) {
    if (goalRequestsEmailSubmitUnlock(goal) && hasConcreteUiGrounding(input)) {
      const emailValue =
        typeof input.formData.email === "string" && input.formData.email.trim().length > 0
          ? input.formData.email.trim()
          : "designer@example.com";
      actions.push(
        makeAction({
          type: "verify",
          target: 'css:button[type="submit"]:disabled,input[type="submit"]:disabled',
          rationale: "Confirm that the submit control is disabled before email entry.",
        }),
      );
      actions.push(
        makeAction({
          type: "click",
          target: "field:email",
          rationale: "Focus the email field before typing a sample address.",
        }),
      );
      actions.push(
        makeAction({
          type: "type",
          target: "field:email",
          text: emailValue,
          rationale: "Fill the email field to verify the submit-state change.",
        }),
      );
      actions.push(
        makeAction({
          type: "verify",
          target: 'css:button[type="submit"]:not(:disabled),input[type="submit"]:not(:disabled)',
          rationale: "Confirm that the submit control becomes enabled after email entry.",
        }),
      );
    }
    actions.push(...buildRuleBasedGoalVerificationActions(goal));
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

  if (shouldAutoSubmit(goal, input)) {
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
}): Promise<ReasoningTextResult | null> {
  return generateGoogleGenAiText({
    apiKey: params.apiKey,
    baseUrl: params.baseUrl,
    timeoutMs: params.timeoutMs,
    model: params.model,
    prompt: params.prompt,
    responseMimeType: params.responseMimeType,
    temperature: params.temperature,
  });
}

function createUiNavigatorCapabilitySet(config: PlannerConfig, usageTotals: AgentUsageTotals): UiNavigatorCapabilitySet {
  const reasoning: ReasoningCapabilityAdapter = {
    descriptor: {
      capability: "reasoning",
      adapterId: config.apiKey ? "google-genai-sdk-ui-reasoning" : "fallback-ui-reasoning",
      provider: config.apiKey ? "gemini_api" : "fallback",
      model: config.plannerModel,
      mode: config.apiKey && config.plannerEnabled ? "default" : "fallback",
    },
    async generateText(params) {
      if (!config.apiKey || !config.plannerEnabled) {
        return null;
      }
      const model = params.model ?? config.plannerModel;
      const result = await fetchGeminiText({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs,
        model,
        prompt: params.prompt,
        responseMimeType: params.responseMimeType,
        temperature: params.temperature,
      });
      if (result) {
        recordAgentUsage(usageTotals, model, result.usage);
      }
      return result;
    },
  };

  const computerUse: ComputerUseCapabilityAdapter = {
    descriptor: {
      capability: "computer_use",
      adapterId: config.apiKey ? "google-genai-sdk-computer-use-compatible" : "rule-based-computer-use",
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

  const rawResult = await capabilities.reasoning.generateText({
    model: config.plannerModel,
    prompt,
    responseMimeType: "application/json",
    temperature: 0.1,
  });

  if (!rawResult?.text) {
    return {
      actions: fallbackPlan,
      plannerProvider: "fallback",
      plannerModel: "rule-based",
    };
  }

  const parsed = parseJsonObject(rawResult.text);
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

function buildUiVerificationPlan(params: {
  input: UiTaskInput;
  actions: UiAction[];
  approvalRequired: boolean;
  damageControl: DamageControlVerdict;
  sandboxPolicy: SandboxPolicyContext;
}): UiPlannerVerification {
  const groundingReady = hasConcreteUiGrounding(params.input);
  const checkpoints = uniqueStrings([
    params.actions.some((action) => action.type === "verify") ? "post_action_verify" : null,
    params.input.visualTesting.enabled ? "visual_compare" : null,
    groundingReady ? "grounded_target" : null,
    params.approvalRequired ? "approval_gate" : null,
    params.damageControl.verdict !== "allow" ? `damage_control_${params.damageControl.verdict}` : null,
    params.sandboxPolicy.active ? "sandbox_policy" : null,
  ].filter((item): item is string => item !== null));

  const targetState: UiVerificationState =
    params.approvalRequired
      ? "blocked_pending_approval"
      : params.actions.some((action) => action.type === "verify") || params.input.visualTesting.enabled
        ? "verified"
        : groundingReady
          ? "partially_verified"
          : "unverified";

  return {
    required: params.actions.length > 0 || params.input.visualTesting.enabled || params.approvalRequired,
    targetState,
    checkpoints,
    approvalSensitive:
      params.approvalRequired || params.damageControl.verdict !== "allow" || params.sandboxPolicy.active,
    groundingReady,
  };
}

function buildUiVerificationRecoveryHint(failureClass: UiFailureClass | null): string | null {
  switch (failureClass) {
    case "approval_required":
      return "Ask for confirmation before continuing.";
    case "approval_rejected":
      return "Collect a new approval decision before retrying.";
    case "damage_control_blocked":
      return "Adjust the action plan or confirm a safer alternative.";
    case "device_node_unavailable":
      return "Choose a different device node or relax the routing constraint.";
    case "execution_failed":
      return "Retry with a fresh executor session and confirm the page still matches the plan.";
    case "loop_detected":
      return "Rewrite the plan so the agent stops repeating the same step.";
    case "missing_grounding":
      return "Need stronger grounding. Share a page link, screenshot, DOM snapshot, or accessibility tree.";
    case "sandbox_blocked":
      return "Switch to an allowed action or relax the sandbox policy for this session.";
    case "stale_grounding":
      return "Refresh snapshot and rerun. The page likely changed after the last grounding capture.";
    case "verification_failed":
      return "Add a clearer post-action verify step or rerun with stronger grounding.";
    case "visual_regression":
      return "Refresh the visual baseline and rerun the check.";
    default:
      return null;
  }
}

function applyUiVerificationPlanOutcome(
  plan: UiPlannerVerification,
  verification: UiVerificationOutcome,
): UiPlannerVerification {
  return {
    ...plan,
    targetState: verification.state,
  };
}

function buildUiVerificationOutcome(params: {
  input: UiTaskInput;
  actions?: UiAction[];
  execution?: VerificationExecutionSnapshot | null;
  visualTesting?: VisualTestingReport | null;
  approvalState?: "approved" | "pending" | "rejected" | "not_required";
  approvalRequired?: boolean;
  runtimeLoop?: LoopDetectionResult | null;
  damageControl?: DamageControlVerdict | null;
  sandboxPolicy?: SandboxPolicyContext | null;
  deviceNodeRouting?: DeviceNodeResolution | null;
}): UiVerificationOutcome {
  const actions = params.actions ?? [];
  const execution = params.execution ?? null;
  const approvalState = params.approvalState ?? "not_required";
  const approvalRequired = params.approvalRequired ?? false;
  const runtimeLoop = params.runtimeLoop ?? null;
  const damageControl = params.damageControl ?? null;
  const sandboxPolicy = params.sandboxPolicy ?? null;
  const deviceNodeRouting = params.deviceNodeRouting ?? null;
  const grounding = buildGroundingSignalSummary(params.input);
  const trace = execution?.trace ?? [];
  const traceSteps = trace.length;
  const completedSteps = trace.filter((step) => step.status === "ok").length;
  const verifySteps = trace.filter((step) => step.actionType === "verify" && step.status === "ok").length;
  const blockedSteps = trace.filter((step) => step.status === "blocked").length;
  const screenshotRefs = uniqueStrings(
    trace
      .map((step) => step.screenshotRef)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  );
  const visualChecks = params.visualTesting?.enabled ? params.visualTesting.checks.length : 0;
  const visualRegressions = params.visualTesting?.enabled ? params.visualTesting.regressionCount : 0;
  const hasGrounding = grounding.screenshotRefProvided || grounding.domSnapshotProvided || grounding.accessibilityTreeProvided || grounding.markHintsCount > 0;
  const deviceNodeMissing =
    deviceNodeRouting !== null &&
    (params.input.deviceNodeId !== null || hasDeviceNodeResolveCriteria(params.input)) &&
    deviceNodeRouting.selectedNode === null;
  const shouldFlagApprovalBlock = approvalRequired || approvalState === "pending" || approvalState === "rejected";
  let state: UiVerificationState;
  let failureClass: UiFailureClass | null = null;

  if (shouldFlagApprovalBlock) {
    state = "blocked_pending_approval";
    failureClass = approvalState === "rejected" ? "approval_rejected" : "approval_required";
  } else if (execution?.finalStatus === "background_submitted") {
    state = "partially_verified";
    failureClass = null;
  } else if (runtimeLoop?.detected) {
    state = traceSteps > 0 || completedSteps > 0 ? "partially_verified" : "unverified";
    failureClass = "loop_detected";
  } else if (deviceNodeMissing) {
    state = "unverified";
    failureClass = "device_node_unavailable";
  } else if (damageControl?.verdict === "block") {
    state = traceSteps > 0 || completedSteps > 0 ? "partially_verified" : "unverified";
    failureClass = "damage_control_blocked";
  } else if (sandboxPolicy?.active === true && sandboxPolicy.blockedCategories.length > 0) {
    state = traceSteps > 0 || completedSteps > 0 ? "partially_verified" : "unverified";
    failureClass = "sandbox_blocked";
  } else if (params.visualTesting?.enabled && params.visualTesting.status === "failed") {
    state = completedSteps > 0 || verifySteps > 0 ? "partially_verified" : "unverified";
    failureClass = "visual_regression";
  } else if (!execution || execution.finalStatus !== "completed") {
    state = traceSteps > 0 || completedSteps > 0 ? "partially_verified" : "unverified";
    failureClass = execution?.finalStatus === "failed_background_submission" ? "execution_failed" : hasGrounding ? "stale_grounding" : "execution_failed";
  } else if (!hasGrounding) {
    state = "unverified";
    failureClass = "missing_grounding";
  } else if (execution.adapterMode === "simulated") {
    state = verifySteps > 0 ? "partially_verified" : "unverified";
    failureClass = hasGrounding ? "verification_failed" : "missing_grounding";
  } else if (verifySteps > 0 || (params.visualTesting?.enabled && params.visualTesting.status === "passed")) {
    state = "verified";
  } else if (completedSteps > 0) {
    state = "partially_verified";
    failureClass = hasGrounding ? "verification_failed" : "missing_grounding";
  } else {
    state = "unverified";
    failureClass = hasGrounding ? "verification_failed" : "missing_grounding";
  }

  if (state === "verified") {
    failureClass = null;
  }

  const summary = (() => {
    if (state === "blocked_pending_approval") {
      return approvalState === "rejected"
        ? "Execution is blocked pending a fresh approval decision."
        : "Execution is blocked pending approval before any post-action verification can run.";
    }
    if (execution?.finalStatus === "background_submitted") {
      return "Background browser worker staged; verification will resume after the worker reports back.";
    }
    if (state === "verified") {
      return `Execution verified ${verifySteps > 0 ? `with ${verifySteps} verification step${verifySteps === 1 ? "" : "s"}` : "with strong post-action evidence"}.`;
    }
    if (state === "partially_verified") {
      return `Execution produced partial verification evidence from ${completedSteps} completed step${completedSteps === 1 ? "" : "s"}${verifySteps > 0 ? ` and ${verifySteps} verification step${verifySteps === 1 ? "" : "s"}` : ""}.`;
    }
    return "Execution is not yet verified against a concrete UI result.";
  })();

  return {
    state,
    failureClass,
    summary,
    recoveryHint: buildUiVerificationRecoveryHint(failureClass),
    evidence: {
      traceSteps,
      completedSteps,
      verifySteps,
      blockedSteps,
      screenshotRefs,
      groundingSignals: grounding,
      visualChecks,
      visualRegressions,
    },
  };
}

function verificationStateDisplayLabel(state: UiVerificationState): string {
  switch (state) {
    case "blocked_pending_approval":
      return "blocked pending approval";
    case "partially_verified":
      return "partially verified";
    case "verified":
      return "verified";
    default:
      return "unverified";
  }
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
            url: params.input.url,
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
            observation: toNullableString(item.observation),
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
        waitForSelector: (
          selector: string,
          options?: { timeout?: number; state?: "attached" | "detached" | "visible" | "hidden" },
        ) => Promise<void>;
        evaluate: {
          <TReturn>(callback: () => TReturn): Promise<TReturn>;
          <TReturn, TArg>(callback: (arg: TArg) => TReturn, arg: TArg): Promise<TReturn>;
        };
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

  const runAction = async (action: UiAction): Promise<string | null> => {
    let observation: string | null = null;
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
      if (action.target.startsWith("css:")) {
        await page.waitForSelector(action.target.slice(4), { timeout: 2500, state: "visible" });
        observation = await collectVerifyObservation(page, action.target);
      } else {
        await page.waitForTimeout(150);
      }
    }
    return observation;
  };

  try {
    for (let index = 0; index < params.actions.length; index += 1) {
      const action = params.actions[index];
      const stepIndex = index + 1;
      const screenshotRef = `${params.screenshotSeed}/playwright-step-${stepIndex}.png`;
      try {
        const observation = await runAction(action);

        trace.push({
          index: stepIndex,
          actionId: action.id,
          actionType: action.type,
          target: action.target,
          status: "ok",
          screenshotRef,
          notes: "Executed by playwright preview adapter.",
          observation,
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
          observation: null,
        });
        try {
          await page.waitForTimeout(250);
          const retryObservation = await runAction(action);
          trace.push({
            index: stepIndex,
            actionId: action.id,
            actionType: action.type,
            target: `${action.target} (retry)`,
            status: "ok",
            screenshotRef: `${params.screenshotSeed}/playwright-step-${stepIndex}-retry.png`,
            notes: "Retry passed in playwright preview mode.",
            observation: retryObservation,
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
            observation: null,
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

async function submitBrowserWorkerJob(params: {
  config: PlannerConfig;
  input: UiTaskInput;
  actions: UiAction[];
  request: OrchestratorRequest;
  runId: string;
  routing: DeviceNodeResolution;
}): Promise<{ job: Record<string, unknown>; runtime: Record<string, unknown> | null }> {
  if (!params.routing.executorUrl) {
    throw new Error("background browser worker requires repo-owned executorUrl");
  }

  const endpoint = `${params.routing.executorUrl.replace(/\/+$/, "")}/browser-jobs`;
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
        sessionId: params.request.sessionId,
        runId: params.runId,
        taskId:
          isRecord(params.request.payload) && isRecord(params.request.payload.task)
            ? toNullableString(params.request.payload.task.taskId)
            : null,
        actions: params.actions,
        context: {
          screenshotRef: params.input.screenshotRef,
          domSnapshot: params.input.domSnapshot,
          accessibilityTree: params.input.accessibilityTree,
          markHints: params.input.markHints,
          cursor: params.input.cursor,
          goal: params.input.goal,
          url: params.input.url,
          deviceNodeId: params.routing.selectedNode?.nodeId ?? params.input.deviceNodeId,
        },
        options: {
          label: params.input.browserWorker.label ?? params.input.goal,
          reason: "ui_navigator_background_browser_worker",
          checkpointEverySteps: params.input.browserWorker.checkpointEverySteps,
          pauseAfterStep: params.input.browserWorker.pauseAfterStep,
        },
      }),
      signal: controller.signal,
    });

    const parsed = (await response.json()) as unknown;
    if (!response.ok) {
      if (isRecord(parsed) && typeof parsed.error === "string") {
        throw new Error(parsed.error);
      }
      throw new Error(`background browser worker failed with ${response.status}`);
    }
    if (!isRecord(parsed) || !isRecord(parsed.data) || !isRecord(parsed.data.job)) {
      throw new Error("background browser worker returned invalid payload");
    }
    return {
      job: parsed.data.job,
      runtime: isRecord(parsed.data.runtime) ? parsed.data.runtime : null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`background browser worker timed out after ${params.config.executorTimeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

function compactUiTaskDisplayText(value: string, maxLength = 72): string {
  const normalized = toNonEmptyString(value, "").replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function humanizeUiTaskTarget(target: string): string {
  const normalized = toNonEmptyString(target, "UI target");
  if (normalized.startsWith("css:")) {
    const selector = normalized.slice(4).toLowerCase();
    if (selector.includes("table") || selector.includes('[role="table"]') || selector.includes('[role="grid"]')) {
      return "a table or grid";
    }
    if (selector.includes("button") || selector.includes('[role="button"]')) {
      return "a button";
    }
    if (selector.includes("form") || selector.includes("input") || selector.includes("textarea")) {
      return "a form or input field";
    }
    if (selector.includes("dialog") || selector.includes('[role="dialog"]') || selector.includes("[aria-modal")) {
      return "a dialog";
    }
    if (selector.includes("h1") || selector.includes("h2") || selector.includes('[role="heading"]')) {
      return "a page heading";
    }
    return "a UI element matched by the selector";
  }
  if (normalized === "initial-screen") {
    return "the initial screen";
  }
  if (normalized === "post-action-screen") {
    return "the resulting screen";
  }
  if (normalized === "main-content") {
    return "the main content";
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return compactUiTaskDisplayText(
    normalized
      .replace(/\s+\(retry\)$/i, "")
      .replace(/^(field|button|page|dialog|section|table):/i, "$1 ")
      .replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    64,
  );
}

function describeUiStepForDisplay(
  type: UiAction["type"],
  targetValue: string,
  textValue: string | null = null,
): string {
  const target = humanizeUiTaskTarget(targetValue);
  switch (type) {
    case "navigate":
      return `open ${target}`;
    case "click":
      return `click ${target}`;
    case "type": {
      const typedText = toNullableString(textValue);
      return typedText
        ? `enter "${compactUiTaskDisplayText(typedText, 24)}" in ${target}`
        : `type in ${target}`;
    }
    case "scroll":
      return target === "the main content" ? "scroll the page" : `scroll ${target}`;
    case "hotkey":
      return `press ${target}`;
    case "wait":
      return `wait for ${target}`;
    case "verify":
    default:
      return `check ${target}`;
  }
}

function describeUiActionForDisplay(action: UiAction): string {
  return describeUiStepForDisplay(action.type, action.target, action.text ?? null);
}

function buildUiTaskStepPreview(actions: UiAction[], limit = 3): string {
  if (actions.length === 0) {
    return "";
  }
  const preview = actions
    .slice(0, limit)
    .map((action, index) => `${index + 1}. ${describeUiActionForDisplay(action)}`);
  const remaining = actions.length - preview.length;
  return remaining > 0
    ? `Planned steps: ${preview.join("; ")}; + ${remaining} more.`
    : `${actions.length === 1 ? "Planned step" : "Planned steps"}: ${preview.join("; ")}.`;
}

function buildUiTaskExecutionPreview(trace: UiTraceStep[], limit = 3): string {
  if (trace.length === 0) {
    return "";
  }
  const canonicalSteps = new Map<number, UiTraceStep>();
  for (const step of trace) {
    const current = canonicalSteps.get(step.index);
    if (!current) {
      canonicalSteps.set(step.index, step);
      continue;
    }
    if (current.status === "retry" && step.status !== "retry") {
      canonicalSteps.set(step.index, step);
      continue;
    }
    if (step.status === "failed") {
      canonicalSteps.set(step.index, step);
    }
  }

  const steps = Array.from(canonicalSteps.values())
    .sort((left, right) => left.index - right.index)
    .slice(0, limit);
  if (steps.length === 0) {
    return "";
  }

  const preview = steps.map((step, index) => {
    const description = describeUiStepForDisplay(step.actionType, step.target);
    return `${index + 1}. ${step.status === "failed" ? `failed to ${description}` : description}`;
  });
  const remaining = canonicalSteps.size - steps.length;
  return remaining > 0
    ? `Executed steps: ${preview.join("; ")}; + ${remaining} more.`
    : `${canonicalSteps.size === 1 ? "Executed step" : "Executed steps"}: ${preview.join("; ")}.`;
}

function humanizeUiObservation(observation: string): string | null {
  const normalized = toNonEmptyString(observation, "");
  if (!normalized) {
    return null;
  }

  const tableMatch = /^table rows=(\d+)$/i.exec(normalized);
  if (tableMatch) {
    const rowCount = Number(tableMatch[1]);
    if (Number.isFinite(rowCount)) {
      return `Observed a table or grid with ${Math.max(0, Math.floor(rowCount))} visible rows.`;
    }
  }

  const buttonsMatch = /^buttons=(.*)$/i.exec(normalized);
  if (buttonsMatch) {
    const labels = buttonsMatch[1]
      .split("|")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .slice(0, 3);
    if (labels.length > 0) {
      return `Observed action buttons: ${labels.join("; ")}.`;
    }
  }

  const submitStateMatch = /^submit state=(disabled|enabled)$/i.exec(normalized);
  if (submitStateMatch) {
    return submitStateMatch[1].toLowerCase() === "disabled"
      ? "Observed the Submit button disabled before email entry."
      : "Observed the Submit button enabled after email entry.";
  }

  const headingsMatch = /^headings=(.*)$/i.exec(normalized);
  if (headingsMatch) {
    const labels = headingsMatch[1]
      .split("|")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .slice(0, 2);
    if (labels.length > 0) {
      return `Observed heading: ${labels.join("; ")}.`;
    }
  }

  return null;
}

function buildUiTaskObservationPreview(trace: UiTraceStep[], limit = 3): string {
  const previews: string[] = [];
  const seen = new Set<string>();
  for (const step of trace) {
    if (step.status !== "ok" || typeof step.observation !== "string") {
      continue;
    }
    const preview = humanizeUiObservation(step.observation);
    if (!preview || seen.has(preview)) {
      continue;
    }
    seen.add(preview);
    previews.push(preview);
    if (previews.length >= limit) {
      break;
    }
  }
  return previews.join(" ");
}

function extractSafeNextActionLabel(trace: UiTraceStep[]): string | null {
  const blockedPattern = /\b(delete|remove|submit|purchase|pay|transfer|wire|cancel|destroy|drop)\b/i;
  for (const step of trace) {
    if (step.status !== "ok" || typeof step.observation !== "string") {
      continue;
    }
    const match = /^buttons=(.*)$/i.exec(step.observation);
    if (!match) {
      continue;
    }
    const labels = match[1]
      .split("|")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const safeLabel = labels.find((label) => !blockedPattern.test(label));
    if (safeLabel) {
      return compactUiTaskDisplayText(safeLabel, 80);
    }
  }
  return null;
}

function isGenericVerificationOnlyPlan(actions: UiAction[]): boolean {
  return (
    actions.length === 1 &&
    actions[0]?.type === "verify" &&
    (actions[0].target === "post-action-screen" || actions[0].target === "initial-screen")
  );
}

function buildUiTaskDisplayText(params: {
  input: UiTaskInput;
  actions: UiAction[];
  execution: ExecutionResult;
  overallStatus: "completed" | "failed";
  verification: UiVerificationOutcome;
}): string {
  const parts: string[] = [];
  const noGrounding =
    params.input.url === null &&
    params.input.screenshotRef === null &&
    params.input.domSnapshot === null &&
    params.input.accessibilityTree === null &&
    params.input.markHints.length === 0;
  const genericVerificationOnly = isGenericVerificationOnlyPlan(params.actions);
  const executionPreview = buildUiTaskExecutionPreview(params.execution.trace);
  const observationPreview = buildUiTaskObservationPreview(params.execution.trace);
  const safeNextAction = extractSafeNextActionLabel(params.execution.trace);
  const stepPreview = buildUiTaskStepPreview(params.actions);
  const verificationLabel = verificationStateDisplayLabel(params.verification.state);

  if (params.overallStatus === "completed") {
    if (params.execution.adapterMode === "simulated") {
      parts.push("UI task finished in simulation mode. No real browser actions were performed.");
    } else if (params.execution.adapterMode === "playwright_preview") {
      parts.push("UI task finished in a separate test browser. This page did not visibly change.");
    } else {
      parts.push("UI task finished in a separate test browser. This page did not visibly change.");
    }

    if (params.execution.deviceNode?.displayName) {
      parts.push(`Execution target: ${params.execution.deviceNode.displayName}.`);
    }

    if (params.input.url) {
      parts.push(`Target page: ${params.input.url}.`);
    } else if (genericVerificationOnly && noGrounding) {
      parts.push(
        "I couldn't open a specific page because you didn't provide a page link or page details.",
      );
      parts.push("So I only ran a generic check and did not verify your real page yet.");
    }

    if (executionPreview && !(genericVerificationOnly && noGrounding)) {
      parts.push(executionPreview);
    } else if (stepPreview && !(genericVerificationOnly && noGrounding)) {
      parts.push(stepPreview);
    }

    if (observationPreview) {
      parts.push(observationPreview);
    }

    if (safeNextAction) {
      parts.push(`Safe next action: "${safeNextAction}".`);
    }

    if (params.execution.retries > 0) {
      parts.push(`Retries used: ${params.execution.retries}.`);
    }

    parts.push(`Verification state: ${verificationLabel}.`);
    parts.push(params.verification.summary);
    if (params.verification.recoveryHint && params.verification.state !== "verified") {
      parts.push(params.verification.recoveryHint);
    }

    if (params.execution.adapterMode === "simulated") {
      parts.push(
        noGrounding
          ? "Next time, add the page link on the left if you want a real page check."
          : "Switch to a real executor if you want visible browser actions instead of a dry run.",
      );
    } else if (genericVerificationOnly && noGrounding) {
      parts.push("Add the page link on the left and run it again.");
    }

    return parts.join(" ");
  }

  parts.push("UI task failed before it produced a reliable UI result.");
  if (params.execution.adapterMode !== "simulated") {
    parts.push("The run happened in a separate test browser, so this page stayed unchanged.");
  }
  if (executionPreview) {
    parts.push(executionPreview);
  } else if (stepPreview) {
    parts.push(stepPreview);
  }
  if (observationPreview) {
    parts.push(observationPreview);
  }
  parts.push(`Verification state: ${verificationLabel}.`);
  parts.push(params.verification.summary);
  if (params.verification.recoveryHint) {
    parts.push(params.verification.recoveryHint);
  }
  return parts.join(" ");
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

  const rawResult = await params.capabilities.reasoning.generateText({
    model: params.config.plannerModel,
    prompt,
    responseMimeType: "application/json",
    temperature: 0.1,
  });
  if (!rawResult?.text) {
    return null;
  }

  const parsed = parseJsonObject(rawResult.text);
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

function buildDamageControlPayload(verdict: DamageControlVerdict): Record<string, unknown> {
  return {
    enabled: verdict.enabled,
    source: verdict.source,
    path: verdict.path,
    verdict: verdict.verdict,
    matchedRuleCount: verdict.matches.length,
    matches: verdict.matches,
    warnings: verdict.warnings,
  };
}

export async function runUiNavigatorAgent(
  request: OrchestratorRequest,
): Promise<OrchestratorResponse> {
  const traceId = randomUUID();
  const runId = request.runId ?? request.id;
  const startedAt = Date.now();
  const config = getPlannerConfig();
  const usageTotals = createAgentUsageTotals();
  const capabilities = createUiNavigatorCapabilitySet(config, usageTotals);
  const skillsRuntime = await getSkillsRuntimeSnapshot({
    agentId: "ui-navigator-agent",
  });
  const skillsPrompt = renderSkillsPrompt(skillsRuntime, {
    maxSkills: 4,
    maxChars: 1200,
  });
  const createEnvelopeWithUsage = (
    envelope: Parameters<typeof createEnvelope>[0],
  ): OrchestratorResponse => {
    const response = createEnvelope(envelope as any) as OrchestratorResponse;
    const responsePayload = (response as { payload?: unknown }).payload;
    if (isRecord(responsePayload) && isRecord(responsePayload.output)) {
      responsePayload.output.usage = buildAgentUsagePayload(usageTotals);
    }
    return response;
  };

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
      const verification = buildUiVerificationOutcome({
        input,
        approvalState: "rejected",
        approvalRequired: true,
        damageControl: null,
        sandboxPolicy,
      });
      return createEnvelopeWithUsage({
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
            verificationState: verification.state,
            verificationFailureClass: verification.failureClass,
            verification,
          },
        },
      });
    }

    const planResult = await buildActionPlan({
      input,
      config,
      capabilities,
      skillsPrompt,
    });
    const actions = limitActions(planResult.actions, sandboxPolicy.maxStepsLimit);
    const damageControl = evaluateDamageControl({
      config,
      input,
      actions,
      approvalCategories,
    });
    let verificationPlan = buildUiVerificationPlan({
      input,
      actions,
      approvalRequired: false,
      damageControl,
      sandboxPolicy,
    });
    if (damageControl.verdict === "block") {
      const verification = buildUiVerificationOutcome({
        input,
        actions,
        damageControl,
        sandboxPolicy,
        approvalState: "not_required",
        approvalRequired: false,
      });
      return createEnvelopeWithUsage({
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
            message: "UI task is blocked by damage-control policy.",
            handledIntent: request.payload.intent,
            traceId,
            latencyMs: Date.now() - startedAt,
            approvalRequired: false,
            approvalCategories,
            planner: {
              provider: planResult.plannerProvider,
              model: planResult.plannerModel,
              verification: applyUiVerificationPlanOutcome(verificationPlan, verification),
            },
            sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
            damageControl: buildDamageControlPayload(damageControl),
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
            actionPlan: actions,
            verificationState: verification.state,
            verificationFailureClass: verification.failureClass,
            verification,
            execution: {
              finalStatus: "failed_damage_control",
              retries: 0,
              trace: [],
              verifyLoopEnabled: true,
              sandbox: buildSandboxPolicyPayload(sandboxPolicy),
              verification,
            },
          },
        },
      });
    }
    const damageControlApprovalCategories = damageControl.matches
      .filter((match) => match.mode === "ask")
      .map((match) => `damage_control:${match.ruleId}`);
    const effectiveApprovalCategories = uniqueStrings([...approvalCategories, ...damageControlApprovalCategories]);
    const approvalRequired = effectiveApprovalCategories.length > 0 && !input.approvalConfirmed;
    verificationPlan = buildUiVerificationPlan({
      input,
      actions,
      approvalRequired,
      damageControl,
      sandboxPolicy,
    });

    const plannedLoop = detectActionLoop(actions, config);
    if (plannedLoop.detected) {
      const verification = buildUiVerificationOutcome({
        input,
        actions,
        runtimeLoop: plannedLoop,
        damageControl,
        sandboxPolicy,
        approvalState: "not_required",
        approvalRequired: false,
      });
      return createEnvelopeWithUsage({
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
              verification: applyUiVerificationPlanOutcome(verificationPlan, verification),
            },
            sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
            damageControl: buildDamageControlPayload(damageControl),
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
            actionPlan: actions,
            verificationState: verification.state,
            verificationFailureClass: verification.failureClass,
            verification,
            execution: {
              finalStatus: "failed_loop",
              retries: 0,
              trace: [],
              verifyLoopEnabled: true,
              sandbox: buildSandboxPolicyPayload(sandboxPolicy),
              verification,
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
    const deviceRoutingRequested = input.deviceNodeId !== null || hasDeviceNodeResolveCriteria(input);

    if (deviceRoutingRequested && !deviceNodeRouting.selectedNode) {
      const verification = buildUiVerificationOutcome({
        input,
        actions,
        deviceNodeRouting,
        damageControl,
        sandboxPolicy,
        approvalState: "not_required",
        approvalRequired: false,
      });
      return createEnvelopeWithUsage({
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
            message:
              input.deviceNodeId !== null
                ? `Requested device node '${input.deviceNodeId}' is unavailable.`
                : "No available device node matches requested routing criteria.",
            handledIntent: request.payload.intent,
            traceId,
            latencyMs: Date.now() - startedAt,
            approvalRequired: false,
            planner: {
              provider: planResult.plannerProvider,
              model: planResult.plannerModel,
              verification: applyUiVerificationPlanOutcome(verificationPlan, verification),
            },
            sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
            damageControl: buildDamageControlPayload(damageControl),
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
            deviceNodeRouting,
            actionPlan: actions,
            verificationState: verification.state,
            verificationFailureClass: verification.failureClass,
            verification,
            execution: {
              finalStatus: "failed_device_node",
              retries: 0,
              trace: [],
              verifyLoopEnabled: true,
              sandbox: buildSandboxPolicyPayload(sandboxPolicy),
              verification,
            },
          },
        },
      });
    }

    if (
      deviceRoutingRequested &&
      executionConfig.executorMode === "remote_http" &&
      !deviceNodeRouting.executorUrl
    ) {
      const verification = buildUiVerificationOutcome({
        input,
        actions,
        deviceNodeRouting,
        damageControl,
        sandboxPolicy,
        approvalState: "not_required",
        approvalRequired: false,
      });
      return createEnvelopeWithUsage({
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
            message:
              input.deviceNodeId !== null
                ? "Requested device node cannot be routed to an executor URL."
                : "Resolved device node cannot be routed to an executor URL.",
            handledIntent: request.payload.intent,
            traceId,
            latencyMs: Date.now() - startedAt,
            approvalRequired: false,
            planner: {
              provider: planResult.plannerProvider,
              model: planResult.plannerModel,
              verification: applyUiVerificationPlanOutcome(verificationPlan, verification),
            },
            sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
            damageControl: buildDamageControlPayload(damageControl),
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
            deviceNodeRouting,
            actionPlan: actions,
            verificationState: verification.state,
            verificationFailureClass: verification.failureClass,
            verification,
            execution: {
              finalStatus: "failed_device_node",
              retries: 0,
              trace: [],
              verifyLoopEnabled: true,
              sandbox: buildSandboxPolicyPayload(sandboxPolicy),
              verification,
            },
          },
        },
      });
    }

    if (sandboxPolicy.active && input.approvalConfirmed && sandboxPolicy.blockedCategories.length > 0) {
      const verification = buildUiVerificationOutcome({
        input,
        actions,
        damageControl,
        sandboxPolicy,
        approvalState: "not_required",
        approvalRequired: false,
      });
      return createEnvelopeWithUsage({
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
              verification: applyUiVerificationPlanOutcome(verificationPlan, verification),
            },
            sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
            damageControl: buildDamageControlPayload(damageControl),
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
            actionPlan: actions,
            verificationState: verification.state,
            verificationFailureClass: verification.failureClass,
            verification,
            execution: {
              finalStatus: "failed_sandbox_policy",
              retries: 0,
              trace: [],
              verifyLoopEnabled: true,
              sandbox: buildSandboxPolicyPayload(sandboxPolicy),
              verification,
            },
          },
        },
      });
    }

    const blockedSandboxActions = sandboxPolicy.active
      ? summarizeBlockedSandboxActions(actions, sandboxPolicy.allowedActionTypes)
      : [];
    if (blockedSandboxActions.length > 0) {
      const verification = buildUiVerificationOutcome({
        input,
        actions,
        damageControl,
        sandboxPolicy,
        approvalState: "not_required",
        approvalRequired: false,
      });
      return createEnvelopeWithUsage({
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
              verification: applyUiVerificationPlanOutcome(verificationPlan, verification),
            },
            sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
            damageControl: buildDamageControlPayload(damageControl),
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
            actionPlan: actions,
            verificationState: verification.state,
            verificationFailureClass: verification.failureClass,
            verification,
            execution: {
              finalStatus: "failed_sandbox_policy",
              retries: 0,
              trace: [],
              verifyLoopEnabled: true,
              sandbox: buildSandboxPolicyPayload(sandboxPolicy),
              verification,
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
      const verification = buildUiVerificationOutcome({
        input,
        actions,
        execution: {
          trace: blockedTrace,
          finalStatus: "needs_approval",
          retries: 0,
          adapterMode: executionConfig.executorMode,
        },
        approvalState: "pending",
        approvalRequired: true,
        damageControl,
        sandboxPolicy,
        deviceNodeRouting,
      });

      return createEnvelopeWithUsage({
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
            message: "Sensitive action detected. User approval is required before execution. Verification state: blocked pending approval.",
            text: `Sensitive action detected. User approval is required before execution. Verification state: blocked pending approval. ${verification.summary} ${verification.recoveryHint ?? ""}`.trim(),
            handledIntent: request.payload.intent,
            traceId,
            latencyMs: Date.now() - startedAt,
            approvalRequired: true,
            approvalId,
            approvalCategories: effectiveApprovalCategories,
            sensitiveSignals,
            resumeRequestTemplate: {
              intent: "ui_task",
              input: {
                goal: input.goal,
                url: input.url,
                deviceNodeId: input.deviceNodeId,
                deviceNodeKind: input.deviceNodeKind,
                deviceNodePlatform: input.deviceNodePlatform,
                deviceNodeCapabilities: input.deviceNodeCapabilities,
                deviceNodeMinTrustLevel: input.deviceNodeMinTrustLevel,
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
              verification: applyUiVerificationPlanOutcome(verificationPlan, verification),
            },
            sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
            damageControl: buildDamageControlPayload(damageControl),
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
            deviceNodeRouting,
            actionPlan: actions,
            verificationState: verification.state,
            verificationFailureClass: verification.failureClass,
            verification,
            execution: {
              finalStatus: "needs_approval",
              retries: 0,
              trace: blockedTrace,
              sandbox: buildSandboxPolicyPayload(sandboxPolicy),
              verification,
            },
          },
        },
      });
    }

    if (input.browserWorker.enabled) {
      try {
        const submission = await submitBrowserWorkerJob({
          config: executionConfig,
          input,
          actions,
          request,
          runId,
          routing: deviceNodeRouting,
        });
        const job = submission.job;
        const jobStatus = toNonEmptyString(job.status, "queued") ?? "queued";
        const jobId = toNonEmptyString(job.jobId);
        const jobExecutedSteps = toNonNegativeInt(job.executedSteps) ?? 0;
        const jobTotalSteps = toNonNegativeInt(job.totalSteps) ?? actions.length;
        const checkpoints = Array.isArray(job.checkpoints) ? job.checkpoints : [];
        const latestCheckpoint =
          checkpoints.length > 0 && isRecord(checkpoints[checkpoints.length - 1]) ? checkpoints[checkpoints.length - 1] : null;
        const verification = buildUiVerificationOutcome({
          input,
          actions,
          execution: {
            trace: [],
            finalStatus: "background_submitted",
            retries: 0,
            adapterMode: "remote_http",
          },
          damageControl,
          sandboxPolicy,
          deviceNodeRouting,
          approvalState: "not_required",
          approvalRequired: false,
        });

        return createEnvelopeWithUsage({
          userId: request.userId,
          sessionId: request.sessionId,
          runId,
          type: "orchestrator.response",
          source: "ui-navigator-agent",
          payload: {
            route: "ui-navigator-agent",
            status: "completed",
            traceId,
            output: {
              message: `UI task was staged as a background browser worker (${jobId ?? "pending job"}).`,
              handledIntent: request.payload.intent,
              traceId,
              latencyMs: Date.now() - startedAt,
              approvalRequired: false,
              planner: {
                provider: planResult.plannerProvider,
                model: planResult.plannerModel,
                verification: applyUiVerificationPlanOutcome(verificationPlan, verification),
              },
              sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
              damageControl: buildDamageControlPayload(damageControl),
              capabilityProfile: capabilities.profile,
              skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
              deviceNodeRouting,
              actionPlan: actions,
              verificationState: verification.state,
              verificationFailureClass: verification.failureClass,
              verification,
              execution: {
                finalStatus: "background_submitted",
                retries: 0,
                trace: [],
                verifyLoopEnabled: true,
                sandbox: buildSandboxPolicyPayload(sandboxPolicy),
                executor: "repo-owned-browser-worker",
                adapterMode: "remote_http",
                adapterNotes: [
                  `background browser worker jobId=${jobId ?? "unknown"}`,
                  `checkpointEverySteps=${input.browserWorker.checkpointEverySteps ?? "none"}`,
                  `pauseAfterStep=${input.browserWorker.pauseAfterStep ?? "none"}`,
                ],
                deviceNode: deviceNodeRouting.selectedNode
                  ? {
                      nodeId: deviceNodeRouting.selectedNode.nodeId,
                      displayName: deviceNodeRouting.selectedNode.displayName,
                      kind: deviceNodeRouting.selectedNode.kind,
                      platform: deviceNodeRouting.selectedNode.platform,
                      status: deviceNodeRouting.selectedNode.status,
                    }
                  : null,
                computerUseProfile: capabilities.computerUse.descriptor.adapterId,
                verification,
              },
              browserWorker: {
                enabled: true,
                jobId,
                status: jobStatus,
                executedSteps: jobExecutedSteps,
                totalSteps: jobTotalSteps,
                checkpointEverySteps: input.browserWorker.checkpointEverySteps,
                pauseAfterStep: input.browserWorker.pauseAfterStep,
                latestCheckpoint: latestCheckpoint
                  ? {
                      checkpointId: toNonEmptyString(latestCheckpoint.checkpointId),
                      stepIndex: toNonNegativeInt(latestCheckpoint.stepIndex),
                      status: toNonEmptyString(latestCheckpoint.status),
                      artifactRef: toNonEmptyString(latestCheckpoint.artifactRef),
                    }
                  : null,
                runtime: submission.runtime,
                operatorControl: {
                  apiListPath: "/v1/runtime/browser-jobs",
                  apiDetailPath: jobId ? `/v1/runtime/browser-jobs/${jobId}` : null,
                  resumePath: jobId ? `/v1/runtime/browser-jobs/${jobId}/resume` : null,
                  cancelPath: jobId ? `/v1/runtime/browser-jobs/${jobId}/cancel` : null,
                },
              },
            },
          },
        });
      } catch (error) {
        const verification = buildUiVerificationOutcome({
          input,
          actions,
          execution: {
            trace: [],
            finalStatus: "failed_background_submission",
            retries: 0,
            adapterMode: "remote_http",
          },
          damageControl,
          sandboxPolicy,
          deviceNodeRouting,
          approvalState: "not_required",
          approvalRequired: false,
        });
        return createEnvelopeWithUsage({
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
              message: `Background browser worker submission failed: ${error instanceof Error ? error.message : String(error)}`,
              handledIntent: request.payload.intent,
              traceId,
              latencyMs: Date.now() - startedAt,
              approvalRequired: false,
              planner: {
                provider: planResult.plannerProvider,
                model: planResult.plannerModel,
                verification: applyUiVerificationPlanOutcome(verificationPlan, verification),
              },
              sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
              damageControl: buildDamageControlPayload(damageControl),
              capabilityProfile: capabilities.profile,
              skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
              deviceNodeRouting,
              actionPlan: actions,
              verificationState: verification.state,
              verificationFailureClass: verification.failureClass,
              verification,
              browserWorker: {
                enabled: true,
                error: error instanceof Error ? error.message : String(error),
              },
              execution: {
                finalStatus: "failed_background_submission",
                retries: 0,
                trace: [],
                verifyLoopEnabled: true,
                sandbox: buildSandboxPolicyPayload(sandboxPolicy),
                verification,
              },
            },
          },
        });
      }
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
    const verification = buildUiVerificationOutcome({
      input,
      actions,
      execution,
      visualTesting,
      approvalState: input.approvalConfirmed ? "approved" : "not_required",
      approvalRequired,
      runtimeLoop,
      damageControl,
      sandboxPolicy,
      deviceNodeRouting,
    });
    const displayText = buildUiTaskDisplayText({
      input,
      actions,
      execution,
      overallStatus,
      verification,
    });

    return createEnvelopeWithUsage({
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
          text: displayText,
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
            verification: applyUiVerificationPlanOutcome(verificationPlan, verification),
          },
          sandboxPolicy: buildSandboxPolicyPayload(sandboxPolicy),
          damageControl: buildDamageControlPayload(damageControl),
          capabilityProfile: capabilities.profile,
          skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
          deviceNodeRouting,
          actionPlan: actions,
          verificationState: verification.state,
          verificationFailureClass: verification.failureClass,
          verification,
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
            verification,
          },
          visualTesting,
        },
      },
    });
  } catch (error) {
    const normalizedError = toNormalizedError(error, traceId);
    return createEnvelopeWithUsage({
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
