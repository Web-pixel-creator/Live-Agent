type SanitizedAssistiveRouterConfig = {
  enabled: boolean | null;
  provider: string | null;
  model: string | null;
  apiKeyConfigured: boolean | null;
  baseUrl: string | null;
  timeoutMs: number | null;
  minConfidence: number | null;
  allowIntents: string[];
  budgetPolicy: string | null;
  promptCaching: string | null;
  watchlistEnabled: boolean | null;
};

type SanitizedRetryPolicyConfig = {
  continuationStatusCode: number | null;
  continuationBackoffMs: number | null;
  transientErrorCodes: string[];
  transientErrorPatterns: string[];
  terminalErrorCodes: string[];
  terminalErrorPatterns: string[];
};

export type SanitizedRuntimeWorkflowConfig = {
  schemaVersion: number | null;
  loadedAt: string | null;
  sourceKind: string | null;
  sourcePath: string | null;
  idempotencyTtlMs: number | null;
  assistiveRouter: SanitizedAssistiveRouterConfig | null;
  retryPolicy: SanitizedRetryPolicyConfig | null;
};

export type SanitizedRuntimeWorkflowStoreStatus = {
  loadedAt: string | null;
  lastAttemptAt: string | null;
  sourceKind: string | null;
  sourcePath: string | null;
  fingerprint: string | null;
  usingLastKnownGood: boolean | null;
  lastError: string | null;
  assistiveRouter: {
    enabled: boolean | null;
    provider: string | null;
    model: string | null;
    apiKeyConfigured: boolean | null;
    allowIntents: string[];
    timeoutMs: number | null;
    minConfidence: number | null;
    budgetPolicy: string | null;
    promptCaching: string | null;
    watchlistEnabled: boolean | null;
  } | null;
  idempotencyTtlMs: number | null;
  workflowState: SanitizedRuntimeWorkflowExecutionState | null;
  controlPlaneOverride: {
    active: boolean;
    updatedAt: string | null;
    reason: string | null;
  };
};

export type SanitizedRuntimeWorkflowExecutionState = {
  status: string | null;
  currentStage: string | null;
  activeRole: string | null;
  runId: string | null;
  sessionId: string | null;
  taskId: string | null;
  intent: string | null;
  route: string | null;
  reason: string | null;
  updatedAt: string | null;
};

export type RuntimeWorkflowControlPlaneSummary = {
  sourceKind: string | null;
  sourcePath: string | null;
  usingLastKnownGood: boolean | null;
  fingerprint: string | null;
  loadedAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  controlPlaneOverrideActive: boolean;
  controlPlaneOverrideUpdatedAt: string | null;
  controlPlaneOverrideReason: string | null;
  assistiveRouterEnabled: boolean | null;
  assistiveRouterApiKeyConfigured: boolean | null;
  assistiveRouterProvider: string | null;
  assistiveRouterModel: string | null;
  assistiveRouterBaseUrl: string | null;
  assistiveRouterTimeoutMs: number | null;
  assistiveRouterMinConfidence: number | null;
  assistiveRouterAllowIntents: string[];
  assistiveRouterBudgetPolicy: string | null;
  assistiveRouterPromptCaching: string | null;
  assistiveRouterWatchlistEnabled: boolean | null;
  idempotencyTtlMs: number | null;
  workflowExecutionStatus: string | null;
  workflowCurrentStage: string | null;
  workflowActiveRole: string | null;
  workflowRunId: string | null;
  workflowSessionId: string | null;
  workflowTaskId: string | null;
  workflowIntent: string | null;
  workflowRoute: string | null;
  workflowReason: string | null;
  workflowUpdatedAt: string | null;
  retryContinuationStatusCode: number | null;
  retryContinuationBackoffMs: number | null;
  retryTransientErrorCodes: string[];
  retryTransientErrorPatterns: string[];
  retryTerminalErrorCodes: string[];
  retryTerminalErrorPatterns: string[];
};

export type RuntimeWorkflowControlPlaneSnapshot = {
  ok: boolean | null;
  service: string | null;
  action: string | null;
  workflow: SanitizedRuntimeWorkflowConfig | null;
  store: SanitizedRuntimeWorkflowStoreStatus | null;
  summary: RuntimeWorkflowControlPlaneSummary;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  return parsed === null ? null : Math.floor(parsed);
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => toNonEmptyString(item))
    .filter((item): item is string => item !== null);
}

function pickFirst<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
}

function pickStringList(primary: string[] | null | undefined, fallback: string[] | null | undefined): string[] {
  if (Array.isArray(primary) && primary.length > 0) {
    return primary;
  }
  if (Array.isArray(fallback) && fallback.length > 0) {
    return fallback;
  }
  return [];
}

function sanitizeAssistiveRouterConfig(value: unknown): SanitizedAssistiveRouterConfig | null {
  if (!isRecord(value)) {
    return null;
  }
  const apiKeyConfigured = hasOwn(value, "apiKey") ? toNonEmptyString(value.apiKey) !== null : null;
  return {
    enabled: toBoolean(value.enabled),
    provider: toNonEmptyString(value.provider),
    model: toNonEmptyString(value.model),
    apiKeyConfigured,
    baseUrl: toNonEmptyString(value.baseUrl),
    timeoutMs: toInteger(value.timeoutMs),
    minConfidence: toFiniteNumber(value.minConfidence),
    allowIntents: toStringList(value.allowIntents),
    budgetPolicy: toNonEmptyString(value.budgetPolicy),
    promptCaching: toNonEmptyString(value.promptCaching),
    watchlistEnabled: toBoolean(value.watchlistEnabled),
  };
}

function sanitizeRetryPolicyConfig(value: unknown): SanitizedRetryPolicyConfig | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    continuationStatusCode: toInteger(value.continuationStatusCode),
    continuationBackoffMs: toInteger(value.continuationBackoffMs),
    transientErrorCodes: toStringList(value.transientErrorCodes),
    transientErrorPatterns: toStringList(value.transientErrorPatterns),
    terminalErrorCodes: toStringList(value.terminalErrorCodes),
    terminalErrorPatterns: toStringList(value.terminalErrorPatterns),
  };
}

function sanitizeRuntimeWorkflowConfig(value: unknown): SanitizedRuntimeWorkflowConfig | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    schemaVersion: toInteger(value.schemaVersion),
    loadedAt: toNonEmptyString(value.loadedAt),
    sourceKind: toNonEmptyString(value.sourceKind),
    sourcePath: toNonEmptyString(value.sourcePath),
    idempotencyTtlMs: toInteger(value.idempotencyTtlMs),
    assistiveRouter: sanitizeAssistiveRouterConfig(value.assistiveRouter),
    retryPolicy: sanitizeRetryPolicyConfig(value.retryPolicy),
  };
}

function sanitizeRuntimeWorkflowStoreStatus(value: unknown): SanitizedRuntimeWorkflowStoreStatus | null {
  if (!isRecord(value)) {
    return null;
  }
  const assistiveRouter = isRecord(value.assistiveRouter) ? value.assistiveRouter : null;
  const workflowState = isRecord(value.workflowState) ? value.workflowState : null;
  const controlPlaneOverride = isRecord(value.controlPlaneOverride) ? value.controlPlaneOverride : null;
  return {
    loadedAt: toNonEmptyString(value.loadedAt),
    lastAttemptAt: toNonEmptyString(value.lastAttemptAt),
    sourceKind: toNonEmptyString(value.sourceKind),
    sourcePath: toNonEmptyString(value.sourcePath),
    fingerprint: toNonEmptyString(value.fingerprint),
    usingLastKnownGood: toBoolean(value.usingLastKnownGood),
    lastError: toNonEmptyString(value.lastError),
    assistiveRouter: assistiveRouter
      ? {
          enabled: toBoolean(assistiveRouter.enabled),
          provider: toNonEmptyString(assistiveRouter.provider),
          model: toNonEmptyString(assistiveRouter.model),
          apiKeyConfigured: toBoolean(assistiveRouter.apiKeyConfigured),
          allowIntents: toStringList(assistiveRouter.allowIntents),
          timeoutMs: toInteger(assistiveRouter.timeoutMs),
          minConfidence: toFiniteNumber(assistiveRouter.minConfidence),
          budgetPolicy: toNonEmptyString(assistiveRouter.budgetPolicy),
          promptCaching: toNonEmptyString(assistiveRouter.promptCaching),
          watchlistEnabled: toBoolean(assistiveRouter.watchlistEnabled),
        }
      : null,
    idempotencyTtlMs: toInteger(value.idempotencyTtlMs),
    workflowState: workflowState
      ? {
          status: toNonEmptyString(workflowState.status),
          currentStage: toNonEmptyString(workflowState.currentStage),
          activeRole: toNonEmptyString(workflowState.activeRole),
          runId: toNonEmptyString(workflowState.runId),
          sessionId: toNonEmptyString(workflowState.sessionId),
          taskId: toNonEmptyString(workflowState.taskId),
          intent: toNonEmptyString(workflowState.intent),
          route: toNonEmptyString(workflowState.route),
          reason: toNonEmptyString(workflowState.reason),
          updatedAt: toNonEmptyString(workflowState.updatedAt),
        }
      : null,
    controlPlaneOverride: {
      active: controlPlaneOverride ? controlPlaneOverride.active === true : false,
      updatedAt: controlPlaneOverride ? toNonEmptyString(controlPlaneOverride.updatedAt) : null,
      reason: controlPlaneOverride ? toNonEmptyString(controlPlaneOverride.reason) : null,
    },
  };
}

function buildRuntimeWorkflowControlPlaneSummary(
  workflow: SanitizedRuntimeWorkflowConfig | null,
  store: SanitizedRuntimeWorkflowStoreStatus | null,
): RuntimeWorkflowControlPlaneSummary {
  const workflowAssistiveRouter = workflow?.assistiveRouter ?? null;
  const storeAssistiveRouter = store?.assistiveRouter ?? null;
  const workflowState = store?.workflowState ?? null;
  const retryPolicy = workflow?.retryPolicy ?? null;
  const controlPlaneOverride = store?.controlPlaneOverride ?? {
    active: false,
    updatedAt: null,
    reason: null,
  };

  return {
    sourceKind: pickFirst(store?.sourceKind, workflow?.sourceKind),
    sourcePath: pickFirst(store?.sourcePath, workflow?.sourcePath),
    usingLastKnownGood: store?.usingLastKnownGood ?? null,
    fingerprint: store?.fingerprint ?? null,
    loadedAt: pickFirst(store?.loadedAt, workflow?.loadedAt),
    lastAttemptAt: store?.lastAttemptAt ?? null,
    lastError: store?.lastError ?? null,
    controlPlaneOverrideActive: controlPlaneOverride.active,
    controlPlaneOverrideUpdatedAt: controlPlaneOverride.updatedAt,
    controlPlaneOverrideReason: controlPlaneOverride.reason,
    assistiveRouterEnabled: pickFirst(workflowAssistiveRouter?.enabled, storeAssistiveRouter?.enabled),
    assistiveRouterApiKeyConfigured: pickFirst(
      workflowAssistiveRouter?.apiKeyConfigured,
      storeAssistiveRouter?.apiKeyConfigured,
    ),
    assistiveRouterProvider: pickFirst(workflowAssistiveRouter?.provider, storeAssistiveRouter?.provider),
    assistiveRouterModel: pickFirst(workflowAssistiveRouter?.model, storeAssistiveRouter?.model),
    assistiveRouterBaseUrl: workflowAssistiveRouter?.baseUrl ?? null,
    assistiveRouterTimeoutMs: pickFirst(workflowAssistiveRouter?.timeoutMs, storeAssistiveRouter?.timeoutMs),
    assistiveRouterMinConfidence: pickFirst(
      workflowAssistiveRouter?.minConfidence,
      storeAssistiveRouter?.minConfidence,
    ),
    assistiveRouterAllowIntents: pickStringList(workflowAssistiveRouter?.allowIntents, storeAssistiveRouter?.allowIntents),
    assistiveRouterBudgetPolicy: pickFirst(workflowAssistiveRouter?.budgetPolicy, storeAssistiveRouter?.budgetPolicy),
    assistiveRouterPromptCaching: pickFirst(
      workflowAssistiveRouter?.promptCaching,
      storeAssistiveRouter?.promptCaching,
    ),
    assistiveRouterWatchlistEnabled: pickFirst(
      workflowAssistiveRouter?.watchlistEnabled,
      storeAssistiveRouter?.watchlistEnabled,
    ),
    idempotencyTtlMs: pickFirst(workflow?.idempotencyTtlMs, store?.idempotencyTtlMs),
    workflowExecutionStatus: workflowState?.status ?? null,
    workflowCurrentStage: workflowState?.currentStage ?? null,
    workflowActiveRole: workflowState?.activeRole ?? null,
    workflowRunId: workflowState?.runId ?? null,
    workflowSessionId: workflowState?.sessionId ?? null,
    workflowTaskId: workflowState?.taskId ?? null,
    workflowIntent: workflowState?.intent ?? null,
    workflowRoute: workflowState?.route ?? null,
    workflowReason: workflowState?.reason ?? null,
    workflowUpdatedAt: workflowState?.updatedAt ?? null,
    retryContinuationStatusCode: retryPolicy?.continuationStatusCode ?? null,
    retryContinuationBackoffMs: retryPolicy?.continuationBackoffMs ?? null,
    retryTransientErrorCodes: retryPolicy?.transientErrorCodes ?? [],
    retryTransientErrorPatterns: retryPolicy?.transientErrorPatterns ?? [],
    retryTerminalErrorCodes: retryPolicy?.terminalErrorCodes ?? [],
    retryTerminalErrorPatterns: retryPolicy?.terminalErrorPatterns ?? [],
  };
}

export function buildRuntimeWorkflowControlPlaneSnapshot(payload: unknown): RuntimeWorkflowControlPlaneSnapshot {
  const source = isRecord(payload) ? payload : {};
  const workflow = sanitizeRuntimeWorkflowConfig(source.workflow);
  const store = sanitizeRuntimeWorkflowStoreStatus(source.store);
  return {
    ok: toBoolean(source.ok),
    service: toNonEmptyString(source.service),
    action: toNonEmptyString(source.action),
    workflow,
    store,
    summary: buildRuntimeWorkflowControlPlaneSummary(workflow, store),
  };
}

export function summarizeRuntimeWorkflowControlPlaneOverrideInput(value: unknown): Record<string, unknown> {
  const source = isRecord(value) ? value : {};
  const clear = source.clear === true;
  const workflowInput = isRecord(source.workflow) ? source.workflow : null;
  const rawJson = toNonEmptyString(source.rawJson);
  let rawJsonWorkflowInput: Record<string, unknown> | null = null;
  let rawJsonParsed = false;

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      if (isRecord(parsed)) {
        rawJsonWorkflowInput = parsed;
        rawJsonParsed = true;
      }
    } catch {
      rawJsonParsed = false;
    }
  }

  const inputMode = clear ? "clear" : rawJson ? "rawJson" : workflowInput ? "workflow" : "unknown";
  const workflowPreview =
    inputMode === "rawJson"
      ? sanitizeRuntimeWorkflowConfig(rawJsonWorkflowInput)
      : sanitizeRuntimeWorkflowConfig(workflowInput);

  return {
    clear,
    reason: toNonEmptyString(source.reason),
    inputMode,
    rawJsonProvided: rawJson !== null,
    rawJsonParsed,
    rawJsonLength: rawJson?.length ?? null,
    workflowPreview,
    requestedAssistiveRouterApiKeyConfigured: workflowPreview?.assistiveRouter?.apiKeyConfigured ?? null,
    requestedAssistiveRouterProvider: workflowPreview?.assistiveRouter?.provider ?? null,
    requestedAssistiveRouterBudgetPolicy: workflowPreview?.assistiveRouter?.budgetPolicy ?? null,
    requestedAssistiveRouterPromptCaching: workflowPreview?.assistiveRouter?.promptCaching ?? null,
    requestedAssistiveRouterWatchlistEnabled: workflowPreview?.assistiveRouter?.watchlistEnabled ?? null,
  };
}
