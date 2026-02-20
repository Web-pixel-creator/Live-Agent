import { randomUUID } from "node:crypto";
import {
  buildCapabilityProfile,
  type CapabilityProfile,
  type ComputerUseCapabilityAdapter,
  type ReasoningCapabilityAdapter,
} from "@mla/capabilities";
import {
  createEnvelope,
  type NormalizedError,
  type OrchestratorRequest,
  type OrchestratorResponse,
} from "@mla/contracts";

type UiTaskInput = {
  goal: string;
  url: string | null;
  screenshotRef: string | null;
  cursor: { x: number; y: number } | null;
  formData: Record<string, string>;
  maxSteps: number;
  simulateFailureAtStep: number | null;
  approvalConfirmed: boolean;
  approvalDecision: "approved" | "rejected" | null;
  approvalReason: string | null;
  approvalId: string | null;
  visualTesting: VisualTestingInput;
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
  executorMode: "simulated" | "playwright_preview" | "remote_http";
  executorUrl: string | null;
};

type UiNavigatorCapabilitySet = {
  reasoning: ReasoningCapabilityAdapter;
  computerUse: ComputerUseCapabilityAdapter;
  profile: CapabilityProfile;
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

function parseExecutorMode(raw: string | undefined): PlannerConfig["executorMode"] {
  if (raw === "playwright_preview") {
    return "playwright_preview";
  }
  if (raw === "remote_http") {
    return "remote_http";
  }
  return "simulated";
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
    approvalKeywords: parseKeywordList(process.env.UI_NAVIGATOR_APPROVAL_KEYWORDS, [
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
    ]),
    executorMode: parseExecutorMode(process.env.UI_NAVIGATOR_EXECUTOR_MODE),
    executorUrl: toNullableString(process.env.UI_NAVIGATOR_EXECUTOR_URL),
  };
}

function normalizeUiTaskInput(input: unknown, config: PlannerConfig): UiTaskInput {
  const raw = isRecord(input) ? input : {};
  const cursor = isRecord(raw.cursor)
    ? {
        x: toNullableInt(raw.cursor.x) ?? 0,
        y: toNullableInt(raw.cursor.y) ?? 0,
      }
    : null;

  const screenshotRef = toNullableString(raw.screenshotRef);
  const formDataRaw = isRecord(raw.formData) ? raw.formData : {};
  const formData: Record<string, string> = {};
  for (const [key, value] of Object.entries(formDataRaw)) {
    const normalizedKey = toNonEmptyString(key, "");
    const normalizedValue = toNonEmptyString(value, "");
    if (normalizedKey.length > 0 && normalizedValue.length > 0) {
      formData[normalizedKey] = normalizedValue;
    }
  }

  return {
    goal:
      toNonEmptyString(raw.goal, "") ||
      toNonEmptyString(raw.task, "") ||
      toNonEmptyString(raw.text, "") ||
      "Open the page and complete the requested UI flow safely.",
    url: toNullableString(raw.url),
    screenshotRef,
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
    visualTesting: normalizeVisualTestingInput(raw, screenshotRef),
  };
}

function extractSensitiveSignals(text: string, keywords: string[]): string[] {
  const normalized = text.toLowerCase();
  return keywords.filter((keyword) => normalized.includes(keyword));
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
}): Promise<{
  actions: UiAction[];
  plannerProvider: "gemini" | "fallback";
  plannerModel: string;
}> {
  const { input, config, capabilities } = params;
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
    `Goal: ${input.goal}`,
    `URL: ${input.url ?? "n/a"}`,
    `ScreenshotRef: ${input.screenshotRef ?? "n/a"}`,
    `Cursor: ${input.cursor ? `${input.cursor.x},${input.cursor.y}` : "n/a"}`,
    `Form data: ${JSON.stringify(input.formData)}`,
    `Max steps: ${input.maxSteps}`,
  ].join("\n");

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
};

function defaultExecutionResult(params: {
  trace: UiTraceStep[];
  finalStatus: "completed" | "failed";
  retries: number;
  executor: string;
  adapterMode: PlannerConfig["executorMode"];
  adapterNotes?: string[];
}): ExecutionResult {
  return {
    trace: params.trace,
    finalStatus: params.finalStatus,
    retries: params.retries,
    executor: params.executor,
    adapterMode: params.adapterMode,
    adapterNotes: params.adapterNotes ?? [],
  };
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
}): Promise<ExecutionResult | null> {
  if (!params.config.executorUrl) {
    return null;
  }

  const endpoint = `${params.config.executorUrl.replace(/\/+$/, "")}/execute`;
  let lastError: Error | null = null;
  const totalAttempts = params.config.executorRequestMaxRetries + 1;

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), params.config.executorTimeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actions: params.actions,
          context: {
            screenshotRef: params.input.screenshotRef,
            cursor: params.input.cursor,
            goal: params.input.goal,
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
        return defaultExecutionResult({
          trace,
          finalStatus,
          retries,
          executor: "remote-http-adapter",
          adapterMode: "remote_http",
          adapterNotes: ["Executed via remote HTTP adapter"],
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
  actions: UiAction[];
  screenshotSeed: string;
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
    adapterNotes: ["Executed with optional local playwright preview adapter"],
  });
}

async function executeActionPlan(params: {
  config: PlannerConfig;
  actions: UiAction[];
  screenshotSeed: string;
  input: UiTaskInput;
}): Promise<ExecutionResult> {
  let fallbackNote: string | null = null;

  if (params.config.executorMode === "remote_http") {
    try {
      const remoteResult = await executeWithRemoteHttpAdapter(params);
      if (remoteResult) {
        return remoteResult;
      }
      fallbackNote = params.config.executorUrl
        ? "remote_http adapter returned no result, switched to simulation"
        : "remote_http mode requested without UI_NAVIGATOR_EXECUTOR_URL, switched to simulation";
    } catch (error) {
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
        adapterNotes: [`remote_http fallback: ${error instanceof Error ? error.message : String(error)}`],
      });
    }
  }

  if (params.config.executorMode === "playwright_preview") {
    try {
      const playwrightResult = await executeWithPlaywrightPreview({
        actions: params.actions,
        screenshotSeed: params.screenshotSeed,
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
      return defaultExecutionResult({
        trace: fallbackSimulation.trace,
        finalStatus: fallbackSimulation.finalStatus,
        retries: fallbackSimulation.retries,
        executor: "playwright-adapter",
        adapterMode: "simulated",
        adapterNotes: [`playwright_preview fallback: ${error instanceof Error ? error.message : String(error)}`],
      });
    }
  }

  const simulation = simulateExecution({
    actions: params.actions,
    screenshotSeed: params.screenshotSeed,
    simulateFailureAtStep: params.input.simulateFailureAtStep,
  });

  return defaultExecutionResult({
    trace: simulation.trace,
    finalStatus: simulation.finalStatus,
    retries: simulation.retries,
    executor: "playwright-adapter",
    adapterMode: "simulated",
    adapterNotes: [fallbackNote ?? "Executed in deterministic simulation mode"],
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
}): Promise<VisualTestingCheck[] | null> {
  if (!params.config.apiKey || !params.config.plannerEnabled) {
    return null;
  }

  const prompt = [
    "You are a visual QA evaluator for UI automation outputs.",
    "Given screenshot references and execution trace, produce strict JSON.",
    "Schema: {\"checks\":[{\"assertion\":\"string\",\"category\":\"layout|content|interaction\",\"status\":\"ok|regression\",\"severity\":\"low|medium|high\",\"observed\":\"string\",\"evidenceRefs\":[\"string\"]}]}",
    "Only output JSON.",
    `Baseline screenshot ref: ${params.input.visualTesting.baselineScreenshotRef ?? "n/a"}`,
    `Actual screenshot refs: ${JSON.stringify(params.actualScreenshotRefs.slice(0, 8))}`,
    `Expected assertions: ${JSON.stringify(params.input.visualTesting.expectedAssertions)}`,
    `Regression hint: ${params.input.visualTesting.regressionHint ?? "none"}`,
    `Execution finalStatus: ${params.execution.finalStatus}, retries: ${params.execution.retries}`,
    `Trace summary:\n${summarizeTraceForPrompt(params.execution.trace)}`,
  ].join("\n");

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

export async function runUiNavigatorAgent(
  request: OrchestratorRequest,
): Promise<OrchestratorResponse> {
  const traceId = randomUUID();
  const runId = request.runId ?? request.id;
  const startedAt = Date.now();
  const config = getPlannerConfig();
  const capabilities = createUiNavigatorCapabilitySet(config);

  try {
    const input = normalizeUiTaskInput(request.payload.input, config);

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
            capabilityProfile: capabilities.profile,
          },
        },
      });
    }

    const sensitiveSignals = extractSensitiveSignals(input.goal, config.approvalKeywords);
    const approvalRequired = sensitiveSignals.length > 0 && !input.approvalConfirmed;

    const planResult = await buildActionPlan({
      input,
      config,
      capabilities,
    });
    const actions = limitActions(planResult.actions, input.maxSteps);

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
            approvalCategories: buildApprovalCategories(sensitiveSignals),
            sensitiveSignals,
            resumeRequestTemplate: {
              intent: "ui_task",
              input: {
                goal: input.goal,
                url: input.url,
                screenshotRef: input.screenshotRef,
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
            capabilityProfile: capabilities.profile,
            actionPlan: actions,
            execution: {
              finalStatus: "needs_approval",
              retries: 0,
              trace: blockedTrace,
            },
          },
        },
      });
    }

    const screenshotSeed = input.screenshotRef ?? `ui://trace/${runId}`;
    const execution = await executeActionPlan({
      config,
      actions,
      screenshotSeed,
      input,
    });

    const finalStatus = execution.finalStatus;
    const visualTesting = await buildVisualTestingReport({
      input,
      execution,
      screenshotSeed,
      capabilities,
      config,
    });
    const overallStatus =
      finalStatus === "completed" && visualTesting.status !== "failed" ? "completed" : "failed";
    const visualTestingSummary = visualTesting.enabled
      ? visualTesting.status === "passed"
        ? ` Visual testing passed (${visualTesting.checks.length} checks).`
        : ` Visual testing found ${visualTesting.regressionCount} regressions (highest severity: ${visualTesting.highestSeverity}).`
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
              : `UI task failed after retries.${visualTestingSummary}`,
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
          capabilityProfile: capabilities.profile,
          actionPlan: actions,
          execution: {
            finalStatus,
            retries: execution.retries,
            trace: execution.trace,
            verifyLoopEnabled: true,
            executor: execution.executor,
            adapterMode: execution.adapterMode,
            adapterNotes: execution.adapterNotes,
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
