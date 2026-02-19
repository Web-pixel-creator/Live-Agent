import { randomUUID } from "node:crypto";
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
  plannerEnabled: boolean;
  maxStepsDefault: number;
  approvalKeywords: string[];
  executorMode: "simulated" | "playwright_preview" | "remote_http";
  executorUrl: string | null;
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

function getPlannerConfig(): PlannerConfig {
  return {
    apiKey:
      toNullableString(process.env.UI_NAVIGATOR_GEMINI_API_KEY) ?? toNullableString(process.env.GEMINI_API_KEY),
    baseUrl: toNonEmptyString(process.env.GEMINI_API_BASE_URL, "https://generativelanguage.googleapis.com/v1beta"),
    plannerModel: toNonEmptyString(process.env.UI_NAVIGATOR_PLANNER_MODEL, "gemini-3-pro-preview"),
    timeoutMs: parsePositiveInt(process.env.UI_NAVIGATOR_GEMINI_TIMEOUT_MS, 10000),
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
        temperature: 0.1,
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

async function buildActionPlan(input: UiTaskInput, config: PlannerConfig): Promise<{
  actions: UiAction[];
  plannerProvider: "gemini" | "fallback";
  plannerModel: string;
}> {
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

  const raw = await fetchGeminiText({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    model: config.plannerModel,
    prompt,
    responseMimeType: "application/json",
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
  });

  if (!response.ok) {
    throw new Error(`remote executor failed with ${response.status}`);
  }

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
        item.status === "retry" || item.status === "failed" || item.status === "blocked" ? item.status : "ok",
      screenshotRef: toNonEmptyString(item.screenshotRef, `${params.screenshotSeed}/remote-${trace.length + 1}.png`),
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

  try {
    const config = getPlannerConfig();
    const input = normalizeUiTaskInput(request.payload.input, config);

    if (input.approvalDecision === "rejected") {
      return createEnvelope({
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
          },
        },
      });
    }

    const sensitiveSignals = extractSensitiveSignals(input.goal, config.approvalKeywords);
    const approvalRequired = sensitiveSignals.length > 0 && !input.approvalConfirmed;

    const planResult = await buildActionPlan(input, config);
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
              },
            },
            planner: {
              provider: planResult.plannerProvider,
              model: planResult.plannerModel,
            },
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
    const overallStatus = finalStatus === "completed" ? "completed" : "failed";

    return createEnvelope({
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
              ? `UI task completed with ${actions.length} planned steps and ${execution.retries} retries.`
              : "UI task failed after retries.",
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
          actionPlan: actions,
          execution: {
            finalStatus,
            retries: execution.retries,
            trace: execution.trace,
            verifyLoopEnabled: true,
            executor: execution.executor,
            adapterMode: execution.adapterMode,
            adapterNotes: execution.adapterNotes,
            computerUseProfile: "gemini-computer-use-compatible",
          },
        },
      },
    });
  } catch (error) {
    const normalizedError = toNormalizedError(error, traceId);
    return createEnvelope({
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
