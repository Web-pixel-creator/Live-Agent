import type { OrchestratorIntent, OrchestratorRequest } from "@mla/contracts";
import { routeIntent, type AgentRoute } from "./router.js";
import type {
  AssistiveRouterProvider,
  AssistiveRouterRuntimeConfig,
} from "./workflow-store.js";

type AssistiveRouterMode =
  | "deterministic"
  | "assistive_override"
  | "assistive_match"
  | "assistive_fallback";

type AssistiveRoutingContextSource = "input_only" | "case_wiki";
type CaseWikiIngressSource = "preserved_input_case_wiki" | "gateway_hydrated_case_wiki";

export type AssistiveRoutingDecision = {
  requestedIntent: OrchestratorIntent;
  routedIntent: OrchestratorIntent;
  route: AgentRoute;
  mode: AssistiveRouterMode;
  reason: string;
  confidence: number | null;
  provider: AssistiveRouterProvider;
  defaultProvider: AssistiveRouterProvider;
  model: string | null;
  defaultModel: string;
  selectionReason: string;
  budgetPolicy: AssistiveRouterRuntimeConfig["budgetPolicy"];
  promptCaching: AssistiveRouterRuntimeConfig["promptCaching"];
  watchlistEnabled: boolean;
  contextSource: AssistiveRoutingContextSource;
  contextIngressSource: CaseWikiIngressSource | null;
  contextFocusId: string | null;
  contextBlocker: string | null;
  contextNextAction: string | null;
};

type AssistiveRouterCandidate = {
  intent: OrchestratorIntent;
  confidence: number;
  reason: string;
};

type CaseWikiAssistiveRoutingContext = {
  source: "case_wiki";
  summary: string | null;
  status: string | null;
  currentStage: string | null;
  focusKind: string | null;
  focusId: string | null;
  focusLabel: string | null;
  blockingQuestion: string | null;
  nextAction: string | null;
  routingLane: string | null;
  routingActionId: string | null;
};

const ALL_INTENTS: readonly OrchestratorIntent[] = [
  "conversation",
  "translation",
  "negotiation",
  "research",
  "story",
  "ui_task",
];
const DEFAULT_ASSISTIVE_ROUTER_PROVIDER: AssistiveRouterProvider = "gemini_api";
const DEFAULT_ASSISTIVE_ROUTER_MODEL = "gemini-3.1-flash-lite-preview";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toCaseWikiIngressSource(value: unknown): CaseWikiIngressSource | null {
  const normalized = toNonEmptyString(value);
  if (!normalized) {
    return null;
  }
  return normalized === "preserved_input_case_wiki" || normalized === "gateway_hydrated_case_wiki"
    ? normalized
    : null;
}

function clipText(value: string | null, maxLength: number): string | null {
  if (!value) {
    return null;
  }
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is Record<string, unknown> => isRecord(item));
}

function extractText(value: unknown): string | null {
  const direct = toNonEmptyString(value);
  if (direct) {
    return direct;
  }
  if (!isRecord(value)) {
    return null;
  }
  const candidateKeys = ["text", "prompt", "goal", "message", "query", "utterance"];
  for (const key of candidateKeys) {
    const normalized = toNonEmptyString(value[key]);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function parseIntent(value: unknown): OrchestratorIntent | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if ((ALL_INTENTS as readonly string[]).includes(normalized)) {
    return normalized as OrchestratorIntent;
  }
  return null;
}

function parseCandidate(raw: unknown): AssistiveRouterCandidate | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const intent = parseIntent(record.intent);
  if (!intent) {
    return null;
  }
  const confidenceRaw = record.confidence;
  const confidence =
    typeof confidenceRaw === "number" && Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(1, confidenceRaw))
      : 0;
  const reason = typeof record.reason === "string" && record.reason.trim().length > 0 ? record.reason.trim() : "assistive_router";
  return { intent, confidence, reason };
}

function extractJsonObject(rawText: string): Record<string, unknown> | null {
  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fallback to slicing the first json object from text
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function extractGeminiText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const root = payload as Record<string, unknown>;
  const candidates = Array.isArray(root.candidates) ? root.candidates : [];
  if (candidates.length === 0) {
    return null;
  }
  const firstCandidate = candidates[0];
  if (typeof firstCandidate !== "object" || firstCandidate === null) {
    return null;
  }
  const candidate = firstCandidate as Record<string, unknown>;
  const content = candidate.content;
  if (typeof content !== "object" || content === null) {
    return null;
  }
  const parts = Array.isArray((content as Record<string, unknown>).parts)
    ? ((content as Record<string, unknown>).parts as unknown[])
    : [];
  for (const part of parts) {
    if (typeof part !== "object" || part === null) {
      continue;
    }
    const text = (part as Record<string, unknown>).text;
    if (typeof text === "string" && text.trim().length > 0) {
      return text;
    }
  }
  return null;
}

function extractOpenAiCompatibleText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const root = payload as Record<string, unknown>;
  const choices = Array.isArray(root.choices) ? root.choices : [];
  if (choices.length === 0) {
    return null;
  }
  const firstChoice = choices[0];
  if (typeof firstChoice !== "object" || firstChoice === null) {
    return null;
  }
  const message = (firstChoice as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null) {
    return null;
  }
  const content = (message as Record<string, unknown>).content;
  if (typeof content === "string" && content.trim().length > 0) {
    return content;
  }
  if (!Array.isArray(content)) {
    return null;
  }
  for (const part of content) {
    if (typeof part !== "object" || part === null) {
      continue;
    }
    const text = (part as Record<string, unknown>).text;
    if (typeof text === "string" && text.trim().length > 0) {
      return text;
    }
  }
  return null;
}

function extractAnthropicText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const root = payload as Record<string, unknown>;
  const content = Array.isArray(root.content) ? root.content : [];
  for (const part of content) {
    if (typeof part !== "object" || part === null) {
      continue;
    }
    const record = part as Record<string, unknown>;
    if (record.type !== "text") {
      continue;
    }
    const text = record.text;
    if (typeof text === "string" && text.trim().length > 0) {
      return text;
    }
  }
  return null;
}

function buildSelectionReason(config: AssistiveRouterRuntimeConfig): string {
  if (config.provider === "moonshot") {
    return config.watchlistEnabled ? "watchlist_override" : "watchlist_disabled";
  }
  if (config.provider !== DEFAULT_ASSISTIVE_ROUTER_PROVIDER) {
    return "provider_override";
  }
  return "judged_default";
}

function extractCaseWikiRecord(input: unknown): Record<string, unknown> | null {
  if (!isRecord(input)) {
    return null;
  }
  for (const key of ["caseWiki", "caseWikiSnapshot", "runtimeCaseWiki", "compiledCaseWiki"]) {
    if (isRecord(input[key])) {
      return input[key];
    }
  }
  const context = isRecord(input.context) ? input.context : null;
  return context && isRecord(context.caseWiki) ? context.caseWiki : null;
}

function extractCaseWikiIngressSource(request: OrchestratorRequest): CaseWikiIngressSource | null {
  const metadata = isRecord(request.metadata) ? request.metadata : null;
  const caseWikiIngress = metadata && isRecord(metadata.caseWikiIngress) ? metadata.caseWikiIngress : null;
  const source = toCaseWikiIngressSource(caseWikiIngress?.source);
  if (source) {
    return source;
  }
  return extractCaseWikiRecord(request.payload.input) ? "preserved_input_case_wiki" : null;
}

function findCaseWikiRoutingItem(
  caseWiki: Record<string, unknown>,
  focusKind: string | null,
  focusId: string | null,
): Record<string, unknown> | null {
  const routingPack = isRecord(caseWiki.routingPack) ? caseWiki.routingPack : null;
  if (!routingPack) {
    return null;
  }
  const proofItems = asRecordArray(routingPack.proofs);
  const questionItems = asRecordArray(routingPack.questions);
  const preferredItems =
    focusKind === "question" ? questionItems : focusKind === "proof" ? proofItems : [];
  const secondaryItems =
    focusKind === "question" ? proofItems : focusKind === "proof" ? questionItems : [...questionItems, ...proofItems];
  const match =
    (focusId ? preferredItems.find((item) => toNonEmptyString(item.focusId) === focusId) : null) ??
    (focusId ? secondaryItems.find((item) => toNonEmptyString(item.focusId) === focusId) : null);
  return match ?? preferredItems[0] ?? secondaryItems[0] ?? null;
}

function extractCaseWikiAssistiveRoutingContext(
  request: OrchestratorRequest,
): CaseWikiAssistiveRoutingContext | null {
  const caseWiki = extractCaseWikiRecord(request.payload.input);
  if (!caseWiki) {
    return null;
  }
  const overview = isRecord(caseWiki.overview) ? caseWiki.overview : {};
  const workspacePack = isRecord(caseWiki.workspacePack) ? caseWiki.workspacePack : {};
  const highlights = isRecord(caseWiki.highlights) ? caseWiki.highlights : {};
  const defaultFocus = isRecord(workspacePack.defaultFocus) ? workspacePack.defaultFocus : null;
  const topBlockingQuestion = isRecord(highlights.topBlockingQuestion) ? highlights.topBlockingQuestion : null;
  const recommendedNextAction = isRecord(caseWiki.recommendedNextAction) ? caseWiki.recommendedNextAction : {};
  const focusKind = toNonEmptyString(defaultFocus?.focusKind);
  const focusId = toNonEmptyString(defaultFocus?.focusId);
  const routingItem = findCaseWikiRoutingItem(caseWiki, focusKind, focusId);
  const route = isRecord(routingItem?.route) ? routingItem.route : null;
  const cta = isRecord(routingItem?.cta) ? routingItem.cta : null;
  const context: CaseWikiAssistiveRoutingContext = {
    source: "case_wiki",
    summary:
      toNonEmptyString(workspacePack.summaryValue) ??
      toNonEmptyString(overview.summary),
    status:
      toNonEmptyString(overview.status) ??
      toNonEmptyString(workspacePack.statusValue),
    currentStage: toNonEmptyString(overview.currentStage),
    focusKind,
    focusId,
    focusLabel:
      toNonEmptyString(defaultFocus?.focusLabel) ??
      toNonEmptyString(routingItem?.focusLabel),
    blockingQuestion:
      toNonEmptyString(topBlockingQuestion?.question) ??
      toNonEmptyString(workspacePack.blockerValue),
    nextAction:
      toNonEmptyString(recommendedNextAction.title) ??
      toNonEmptyString(recommendedNextAction.summary) ??
      toNonEmptyString(workspacePack.nextActionValue),
    routingLane: toNonEmptyString(route?.lane) ?? toNonEmptyString(cta?.lane),
    routingActionId: toNonEmptyString(cta?.actionId),
  };
  const hasUsefulContext = [
    context.summary,
    context.status,
    context.currentStage,
    context.focusLabel,
    context.blockingQuestion,
    context.nextAction,
    context.routingLane,
    context.routingActionId,
  ].some((value) => Boolean(value));
  return hasUsefulContext ? context : null;
}

function buildCaseWikiRoutingPromptBlock(context: CaseWikiAssistiveRoutingContext | null): string | null {
  if (!context) {
    return null;
  }
  return [
    "Case Wiki compiled memory (primary routing context).",
    context.summary ? `Case summary: ${clipText(context.summary, 280)}` : null,
    context.status ? `Case status: ${clipText(context.status, 120)}` : null,
    context.currentStage ? `Current stage: ${clipText(context.currentStage, 120)}` : null,
    context.focusKind || context.focusId || context.focusLabel
      ? `Default focus: ${[
          context.focusKind ? `kind=${context.focusKind}` : null,
          context.focusId ? `id=${context.focusId}` : null,
          context.focusLabel ? `label=${clipText(context.focusLabel, 160)}` : null,
        ]
          .filter((value): value is string => Boolean(value))
          .join("; ")}`
      : null,
    context.blockingQuestion ? `Blocking question: ${clipText(context.blockingQuestion, 220)}` : null,
    context.nextAction ? `Next action: ${clipText(context.nextAction, 220)}` : null,
    context.routingLane ? `Routing lane: ${context.routingLane}` : null,
    context.routingActionId ? `Routing CTA: ${context.routingActionId}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
}

function baseDecision(
  request: OrchestratorRequest,
  config: AssistiveRouterRuntimeConfig,
  params: {
    routedIntent?: OrchestratorIntent;
    route?: AgentRoute;
    mode: AssistiveRouterMode;
    reason: string;
    confidence: number | null;
    model: string | null;
  },
  routingContext?: CaseWikiAssistiveRoutingContext | null,
): AssistiveRoutingDecision {
  const routedIntent = params.routedIntent ?? request.payload.intent;
  const contextIngressSource =
    routingContext?.source === "case_wiki" ? extractCaseWikiIngressSource(request) : null;
  return {
    requestedIntent: request.payload.intent,
    routedIntent,
    route: params.route ?? routeIntent(routedIntent),
    mode: params.mode,
    reason: params.reason,
    confidence: params.confidence,
    provider: config.provider,
    defaultProvider: DEFAULT_ASSISTIVE_ROUTER_PROVIDER,
    model: params.model,
    defaultModel: DEFAULT_ASSISTIVE_ROUTER_MODEL,
    selectionReason: buildSelectionReason(config),
    budgetPolicy: config.budgetPolicy,
    promptCaching: config.promptCaching,
    watchlistEnabled: config.watchlistEnabled,
    contextSource: routingContext?.source ?? "input_only",
    contextIngressSource,
    contextFocusId: routingContext?.focusId ?? null,
    contextBlocker: routingContext?.blockingQuestion ?? null,
    contextNextAction: routingContext?.nextAction ?? null,
  };
}

function deterministicDecision(
  request: OrchestratorRequest,
  config: AssistiveRouterRuntimeConfig,
  reason: string,
  routingContext?: CaseWikiAssistiveRoutingContext | null,
): AssistiveRoutingDecision {
  return baseDecision(request, config, {
    mode: "deterministic",
    reason,
    confidence: null,
    model: config.model,
  }, routingContext);
}

function buildClassifierPrompt(
  request: OrchestratorRequest,
  text: string,
  routingContext: CaseWikiAssistiveRoutingContext | null,
): string {
  return [
    "You classify intent for an orchestrator router.",
    `Current intent: ${request.payload.intent}`,
    buildCaseWikiRoutingPromptBlock(routingContext),
    `User input: ${text}`,
    "Return strict JSON with keys: intent, confidence, reason.",
    "intent must be one of: conversation, translation, negotiation, research, story, ui_task.",
    "confidence is a number from 0 to 1.",
  ].join("\n");
}

async function classifyWithGemini(params: {
  config: AssistiveRouterRuntimeConfig;
  request: OrchestratorRequest;
  text: string;
  routingContext: CaseWikiAssistiveRoutingContext | null;
}): Promise<AssistiveRouterCandidate | null> {
  const prompt = buildClassifierPrompt(params.request, params.text, params.routingContext);

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  };
  const endpoint = `${params.config.baseUrl}/models/${params.config.model}:generateContent?key=${params.config.apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.config.timeoutMs);

  try {
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
    const payload = (await response.json()) as unknown;
    const text = extractGeminiText(payload);
    if (!text) {
      return null;
    }
    const parsed = extractJsonObject(text);
    return parsed ? parseCandidate(parsed) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function classifyWithOpenAiCompatible(params: {
  config: AssistiveRouterRuntimeConfig;
  request: OrchestratorRequest;
  text: string;
  routingContext: CaseWikiAssistiveRoutingContext | null;
}): Promise<AssistiveRouterCandidate | null> {
  const prompt = buildClassifierPrompt(params.request, params.text, params.routingContext);
  const body = {
    model: params.config.model,
    temperature: 0,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content: "You are an intent classifier for an orchestrator router.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  };
  const endpoint = `${params.config.baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.config.timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as unknown;
    const text = extractOpenAiCompatibleText(payload);
    if (!text) {
      return null;
    }
    const parsed = extractJsonObject(text);
    return parsed ? parseCandidate(parsed) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function classifyWithAnthropic(params: {
  config: AssistiveRouterRuntimeConfig;
  request: OrchestratorRequest;
  text: string;
  routingContext: CaseWikiAssistiveRoutingContext | null;
}): Promise<AssistiveRouterCandidate | null> {
  const prompt = buildClassifierPrompt(params.request, params.text, params.routingContext);
  const body = {
    model: params.config.model,
    max_tokens: 256,
    temperature: 0,
    system: "You are an intent classifier for an orchestrator router. Return strict JSON only.",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  };
  const endpoint = `${params.config.baseUrl}/messages`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.config.timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": params.config.apiKey ?? "",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as unknown;
    const text = extractAnthropicText(payload);
    if (!text) {
      return null;
    }
    const parsed = extractJsonObject(text);
    return parsed ? parseCandidate(parsed) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function classifyAssistiveRoute(params: {
  config: AssistiveRouterRuntimeConfig;
  request: OrchestratorRequest;
  text: string;
  routingContext: CaseWikiAssistiveRoutingContext | null;
}): Promise<AssistiveRouterCandidate | null> {
  switch (params.config.provider) {
    case "openai":
    case "deepseek":
    case "moonshot":
      return classifyWithOpenAiCompatible(params);
    case "anthropic":
      return classifyWithAnthropic(params);
    case "gemini_api":
    default:
      return classifyWithGemini(params);
  }
}

export async function resolveAssistiveRoute(
  request: OrchestratorRequest,
  config: AssistiveRouterRuntimeConfig,
): Promise<AssistiveRoutingDecision> {
  const routingContext = extractCaseWikiAssistiveRoutingContext(request);
  if (!config.enabled) {
    return deterministicDecision(request, config, "assistive_router_disabled", routingContext);
  }
  if (config.provider === "moonshot" && config.watchlistEnabled !== true) {
    return deterministicDecision(request, config, "assistive_router_watchlist_disabled", routingContext);
  }
  if (!config.apiKey) {
    return deterministicDecision(request, config, "assistive_router_missing_api_key", routingContext);
  }
  if (!config.allowIntents.includes(request.payload.intent)) {
    return deterministicDecision(request, config, "assistive_router_intent_not_eligible", routingContext);
  }

  const text = extractText(request.payload.input);
  if (!text) {
    return deterministicDecision(request, config, "assistive_router_missing_text_input", routingContext);
  }

  const candidate = await classifyAssistiveRoute({
    config,
    request,
    text,
    routingContext,
  });
  if (!candidate) {
    return deterministicDecision(request, config, "assistive_router_no_candidate", routingContext);
  }

  if (candidate.confidence < config.minConfidence) {
    return baseDecision(request, config, {
      mode: "assistive_fallback",
      reason: `assistive_low_confidence:${candidate.confidence.toFixed(3)}`,
      confidence: candidate.confidence,
      model: config.model,
    }, routingContext);
  }

  const suggestedRoute = routeIntent(candidate.intent);
  if (candidate.intent === request.payload.intent) {
    return baseDecision(request, config, {
      routedIntent: request.payload.intent,
      route: suggestedRoute,
      mode: "assistive_match",
      reason: candidate.reason,
      confidence: candidate.confidence,
      model: config.model,
    }, routingContext);
  }

  return baseDecision(request, config, {
    routedIntent: candidate.intent,
    route: suggestedRoute,
    mode: "assistive_override",
    reason: candidate.reason,
    confidence: candidate.confidence,
    model: config.model,
  }, routingContext);
}
