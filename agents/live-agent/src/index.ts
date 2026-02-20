import { randomUUID } from "node:crypto";
import {
  buildCapabilityProfile,
  type CapabilityProfile,
  type LiveCapabilityAdapter,
  type ReasoningCapabilityAdapter,
} from "@mla/capabilities";
import {
  createEnvelope,
  type NormalizedError,
  type OrchestratorIntent,
  type OrchestratorRequest,
  type OrchestratorResponse,
} from "@mla/contracts";

type NegotiationConstraints = {
  maxPrice: number | null;
  maxDeliveryDays: number | null;
  minSla: number | null;
  forbiddenActions: string[];
};

type NormalizedLiveInput = {
  text: string;
  targetLanguage: string | null;
  constraints: NegotiationConstraints;
};

type Offer = {
  price: number | null;
  deliveryDays: number | null;
  sla: number | null;
};

type EvaluationResult = {
  priceOk: boolean;
  deliveryOk: boolean;
  slaOk: boolean;
  allSatisfied: boolean;
};

type GeminiConfig = {
  apiKey: string | null;
  baseUrl: string;
  timeoutMs: number;
  liveModel: string;
  translationModel: string;
  conversationModel: string;
};

type TranslationResult = {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  provider: "gemini" | "fallback";
  model: string;
  confidence: number | null;
};

type DelegationRequest = {
  intent: Extract<OrchestratorIntent, "story" | "ui_task">;
  input: Record<string, unknown>;
  reason: string;
};

type LiveAgentCapabilitySet = {
  live: LiveCapabilityAdapter;
  reasoning: ReasoningCapabilityAdapter;
  profile: CapabilityProfile;
};

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

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeLanguageTag(input: unknown): string | null {
  const value = toNonEmptyString(input);
  if (!value) {
    return null;
  }
  return value.toLowerCase();
}

function normalizeForbiddenActions(rawConstraints: Record<string, unknown>): string[] {
  const direct = rawConstraints.forbiddenActions;
  if (!Array.isArray(direct)) {
    return [];
  }
  return direct
    .map((value) => toNonEmptyString(value))
    .filter((value): value is string => Boolean(value));
}

function normalizeInput(input: unknown): NormalizedLiveInput {
  const payload = isRecord(input) ? input : {};
  const rawConstraints = isRecord(payload.constraints) ? payload.constraints : {};

  return {
    text: toNonEmptyString(payload.text) ?? "",
    targetLanguage: normalizeLanguageTag(payload.targetLanguage),
    constraints: {
      maxPrice: toNullableNumber(rawConstraints.maxPrice),
      maxDeliveryDays: toNullableNumber(rawConstraints.maxDeliveryDays),
      minSla: toNullableNumber(rawConstraints.minSla),
      forbiddenActions: normalizeForbiddenActions(rawConstraints),
    },
  };
}

function extractMetric(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match || !match[1]) {
      continue;
    }
    const parsed = Number(match[1].replace(",", "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function extractOffer(text: string): Offer {
  return {
    price: extractMetric(text, [
      /price\D{0,12}(\d+(?:[.,]\d+)?)/i,
      /цена\D{0,12}(\d+(?:[.,]\d+)?)/i,
    ]),
    deliveryDays: extractMetric(text, [
      /delivery\D{0,12}(\d+(?:[.,]\d+)?)/i,
      /достав\D{0,12}(\d+(?:[.,]\d+)?)/i,
    ]),
    sla: extractMetric(text, [
      /sla\D{0,12}(\d+(?:[.,]\d+)?)/i,
      /uptime\D{0,12}(\d+(?:[.,]\d+)?)/i,
    ]),
  };
}

function fallbackIfMissing(value: number | null, fallback: number | null): number | null {
  if (value !== null) {
    return value;
  }
  return fallback;
}

function buildCounterOffer(offer: Offer, constraints: NegotiationConstraints): Offer {
  const basePrice = fallbackIfMissing(offer.price, constraints.maxPrice);
  const baseDelivery = fallbackIfMissing(offer.deliveryDays, constraints.maxDeliveryDays);
  const baseSla = fallbackIfMissing(offer.sla, constraints.minSla);

  const adjustedPrice =
    constraints.maxPrice !== null && basePrice !== null ? Math.min(basePrice, constraints.maxPrice) : basePrice;
  const adjustedDelivery =
    constraints.maxDeliveryDays !== null && baseDelivery !== null
      ? Math.min(baseDelivery, constraints.maxDeliveryDays)
      : baseDelivery;
  const adjustedSla =
    constraints.minSla !== null && baseSla !== null ? Math.max(baseSla, constraints.minSla) : baseSla;

  return {
    price: adjustedPrice,
    deliveryDays: adjustedDelivery,
    sla: adjustedSla,
  };
}

function evaluateOffer(offer: Offer, constraints: NegotiationConstraints): EvaluationResult {
  const priceOk =
    constraints.maxPrice === null ? true : offer.price === null ? false : offer.price <= constraints.maxPrice;
  const deliveryOk =
    constraints.maxDeliveryDays === null
      ? true
      : offer.deliveryDays === null
        ? false
        : offer.deliveryDays <= constraints.maxDeliveryDays;
  const slaOk = constraints.minSla === null ? true : offer.sla === null ? false : offer.sla >= constraints.minSla;

  return {
    priceOk,
    deliveryOk,
    slaOk,
    allSatisfied: priceOk && deliveryOk && slaOk,
  };
}

function formatNumber(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2);
}

function detectLanguage(text: string): string {
  if (/[\u0400-\u04FF]/u.test(text)) {
    return "ru";
  }
  if (/[\u4E00-\u9FFF]/u.test(text)) {
    return "zh";
  }
  if (/[\u3040-\u30FF]/u.test(text)) {
    return "ja";
  }
  if (/[\u0600-\u06FF]/u.test(text)) {
    return "ar";
  }
  if (/[A-Za-z]/.test(text)) {
    return "en";
  }
  return "unknown";
}

function isLikelyFinalAgreement(text: string): boolean {
  return /(?:^|\b)(agree|agreed|accepted|accept|confirm|final|deal|закрываем|подтверждаю)(?:\b|$)/i.test(text);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceDictionary(text: string, dictionary: Record<string, string>): string {
  let output = text;
  for (const [from, to] of Object.entries(dictionary)) {
    const pattern = new RegExp(`(?<!\\p{L})${escapeRegex(from)}(?!\\p{L})`, "giu");
    output = output.replace(pattern, to);
  }
  return output;
}

function fallbackTranslate(text: string, sourceLanguage: string, targetLanguage: string): TranslationResult {
  const ruToEn: Record<string, string> = {
    привет: "hello",
    пожалуйста: "please",
    цена: "price",
    доставка: "delivery",
    сделка: "deal",
    подтвердите: "confirm",
    спасибо: "thank you",
  };
  const enToRu: Record<string, string> = {
    hello: "привет",
    please: "пожалуйста",
    price: "цена",
    delivery: "доставка",
    deal: "сделка",
    confirm: "подтвердите",
    thanks: "спасибо",
  };

  let translatedText = text;
  if (sourceLanguage.startsWith("ru") && targetLanguage.startsWith("en")) {
    translatedText = replaceDictionary(text, ruToEn);
  } else if (sourceLanguage.startsWith("en") && targetLanguage.startsWith("ru")) {
    translatedText = replaceDictionary(text, enToRu);
  }

  if (translatedText === text) {
    translatedText = `[${sourceLanguage}->${targetLanguage}] ${text}`;
  }

  return {
    translatedText,
    sourceLanguage,
    targetLanguage,
    provider: "fallback",
    model: "fallback-dictionary",
    confidence: null,
  };
}

function getGeminiConfig(): GeminiConfig {
  const defaultBaseUrl = "https://generativelanguage.googleapis.com/v1beta";
  const timeoutMs = toNullableNumber(process.env.LIVE_AGENT_GEMINI_TIMEOUT_MS) ?? 8000;

  return {
    apiKey:
      toNonEmptyString(process.env.LIVE_AGENT_GEMINI_API_KEY) ?? toNonEmptyString(process.env.GEMINI_API_KEY),
    baseUrl: toNonEmptyString(process.env.GEMINI_API_BASE_URL) ?? defaultBaseUrl,
    timeoutMs,
    liveModel: toNonEmptyString(process.env.LIVE_AGENT_LIVE_MODEL) ?? "gemini-live-2.5-flash-native-audio",
    translationModel: toNonEmptyString(process.env.LIVE_AGENT_TRANSLATION_MODEL) ?? "gemini-3-flash",
    conversationModel: toNonEmptyString(process.env.LIVE_AGENT_CONVERSATION_MODEL) ?? "gemini-3-flash",
  };
}

async function fetchGeminiText(params: {
  config: GeminiConfig;
  model: string;
  prompt: string;
  responseMimeType?: "application/json" | "text/plain";
  temperature?: number;
}): Promise<string | null> {
  const { config } = params;
  if (!config.apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(
    config.apiKey,
  )}`;

  try {
    const body: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts: [{ text: params.prompt }],
        },
      ],
      generationConfig: {
        temperature: params.temperature ?? 0.2,
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
      if (!isRecord(candidate)) {
        continue;
      }
      const content = candidate.content;
      if (!isRecord(content) || !Array.isArray(content.parts)) {
        continue;
      }
      for (const part of content.parts) {
        if (!isRecord(part) || typeof part.text !== "string") {
          continue;
        }
        parts.push(part.text);
      }
    }

    if (parts.length === 0) {
      return null;
    }

    return parts.join("\n").trim();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function createLiveAgentCapabilitySet(config: GeminiConfig): LiveAgentCapabilitySet {
  const reasoning: ReasoningCapabilityAdapter = {
    descriptor: {
      capability: "reasoning",
      adapterId: config.apiKey ? "gemini-reasoning" : "fallback-reasoning",
      provider: config.apiKey ? "gemini_api" : "fallback",
      model: config.conversationModel,
      mode: config.apiKey ? "default" : "fallback",
    },
    async generateText(params) {
      return fetchGeminiText({
        config,
        model: params.model ?? config.conversationModel,
        prompt: params.prompt,
        responseMimeType: params.responseMimeType,
        temperature: params.temperature,
      });
    },
  };

  const live: LiveCapabilityAdapter = {
    descriptor: {
      capability: "live",
      adapterId: config.apiKey ? "gemini-live-default" : "fallback-live",
      provider: config.apiKey ? "vertex_ai" : "fallback",
      model: config.liveModel,
      mode: config.apiKey ? "default" : "fallback",
    },
  };

  return {
    live,
    reasoning,
    profile: buildCapabilityProfile([live, reasoning]),
  };
}

function tryParseJsonObject(value: string): Record<string, unknown> | null {
  const withoutFence = value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(withoutFence) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function translateWithGemini(params: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  config: GeminiConfig;
  capabilities: LiveAgentCapabilitySet;
}): Promise<TranslationResult | null> {
  if (!params.config.apiKey) {
    return null;
  }

  const prompt = [
    "Translate the user text.",
    "Return strict JSON with keys: translatedText, sourceLanguage, targetLanguage, confidence.",
    `Source language hint: ${params.sourceLanguage}`,
    `Target language: ${params.targetLanguage}`,
    `User text: ${params.text}`,
  ].join("\n");

  const raw = await params.capabilities.reasoning.generateText({
    model: params.config.translationModel,
    prompt,
    responseMimeType: "application/json",
    temperature: 0.2,
  });

  if (!raw) {
    return null;
  }

  const parsed = tryParseJsonObject(raw);
  if (!parsed) {
    return null;
  }

  const translatedText = toNonEmptyString(parsed.translatedText);
  if (!translatedText) {
    return null;
  }

  const sourceLanguage = normalizeLanguageTag(parsed.sourceLanguage) ?? params.sourceLanguage;
  const targetLanguage = normalizeLanguageTag(parsed.targetLanguage) ?? params.targetLanguage;
  const confidence = toNullableNumber(parsed.confidence);

  return {
    translatedText,
    sourceLanguage,
    targetLanguage,
    provider: "gemini",
    model: params.config.translationModel,
    confidence,
  };
}

async function generateConversationReply(params: {
  inputText: string;
  config: GeminiConfig;
  capabilities: LiveAgentCapabilitySet;
}): Promise<{ text: string; provider: string; model: string }> {
  const inputText = params.inputText;
  const fallback = {
    text: inputText.length > 0
      ? `Received: "${inputText}". I can continue the dialogue, translate this message, or switch to negotiation mode.`
      : "Ready for live conversation. Send text or voice and I will respond in real time.",
    provider: "fallback",
    model: "fallback-rule",
  };

  if (process.env.LIVE_AGENT_USE_GEMINI_CHAT === "false") {
    return fallback;
  }

  if (!params.config.apiKey) {
    return fallback;
  }

  const prompt = [
    "You are a concise real-time voice assistant.",
    "Respond in at most 2 short sentences.",
    "Keep tone neutral-professional.",
    `User message: ${inputText || "(empty)"}`,
  ].join("\n");

  const generated = await params.capabilities.reasoning.generateText({
    model: params.config.conversationModel,
    prompt,
    responseMimeType: "text/plain",
    temperature: 0.2,
  });

  if (!generated) {
    return fallback;
  }

  return {
    text: generated,
    provider: "gemini",
    model: params.config.conversationModel,
  };
}

function detectDelegationRequest(text: string): DelegationRequest | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const uiMatch = trimmed.match(/(?:^|\b)delegate\s+ui\s*[:\-]\s*(.+)$/i);
  if (uiMatch && uiMatch[1]) {
    return {
      intent: "ui_task",
      input: {
        goal: uiMatch[1].trim(),
      },
      reason: "User requested UI delegation from live conversation.",
    };
  }

  const storyMatch = trimmed.match(/(?:^|\b)delegate\s+story\s*[:\-]\s*(.+)$/i);
  if (storyMatch && storyMatch[1]) {
    return {
      intent: "story",
      input: {
        prompt: storyMatch[1].trim(),
      },
      reason: "User requested storytelling delegation from live conversation.",
    };
  }

  return null;
}

async function handleConversation(params: {
  input: NormalizedLiveInput;
  config: GeminiConfig;
  capabilities: LiveAgentCapabilitySet;
}): Promise<Record<string, unknown>> {
  const { input } = params;
  const delegationRequest = detectDelegationRequest(input.text);
  if (delegationRequest) {
    return {
      message: `Delegation requested: ${delegationRequest.intent}. Routing task to specialized agent.`,
      mode: "conversation",
      delegationRequest,
      model: {
        provider: "fallback",
        model: "delegation-router",
      },
    };
  }

  const reply = await generateConversationReply({
    inputText: input.text,
    config: params.config,
    capabilities: params.capabilities,
  });
  return {
    message: reply.text,
    mode: "conversation",
    model: {
      provider: reply.provider,
      model: reply.model,
    },
  };
}

async function handleTranslation(params: {
  input: NormalizedLiveInput;
  config: GeminiConfig;
  capabilities: LiveAgentCapabilitySet;
}): Promise<Record<string, unknown>> {
  const { input } = params;
  const sourceLanguage = detectLanguage(input.text);
  const targetLanguage = input.targetLanguage ?? (sourceLanguage === "ru" ? "en" : "ru");

  if (input.text.length === 0) {
    return {
      message: "Translation mode is ready. Provide text or voice input.",
      mode: "translation",
      translation: {
        sourceLanguage,
        targetLanguage,
      },
    };
  }

  const translation =
    (await translateWithGemini({
      text: input.text,
      sourceLanguage,
      targetLanguage,
      config: params.config,
      capabilities: params.capabilities,
    })) ?? fallbackTranslate(input.text, sourceLanguage, targetLanguage);

  return {
    message: `Translation (${translation.sourceLanguage} -> ${translation.targetLanguage}): ${translation.translatedText}`,
    mode: "translation",
    translation,
  };
}

function handleNegotiation(input: NormalizedLiveInput): Record<string, unknown> {
  const sourceOffer = extractOffer(input.text);
  const proposedOffer = buildCounterOffer(sourceOffer, input.constraints);
  const evaluation = evaluateOffer(proposedOffer, input.constraints);

  const forbiddenTriggered = input.constraints.forbiddenActions.filter((action) =>
    input.text.toLowerCase().includes(action.toLowerCase()),
  );

  const requiresUserConfirmation = isLikelyFinalAgreement(input.text) && evaluation.allSatisfied;

  const rationale: string[] = [];
  if (sourceOffer.price !== null && proposedOffer.price !== null && sourceOffer.price !== proposedOffer.price) {
    rationale.push("Price adjusted to meet maximum target.");
  }
  if (
    sourceOffer.deliveryDays !== null &&
    proposedOffer.deliveryDays !== null &&
    sourceOffer.deliveryDays !== proposedOffer.deliveryDays
  ) {
    rationale.push("Delivery adjusted to meet deadline target.");
  }
  if (sourceOffer.sla !== null && proposedOffer.sla !== null && sourceOffer.sla !== proposedOffer.sla) {
    rationale.push("SLA adjusted to meet minimum target.");
  }
  if (forbiddenTriggered.length > 0) {
    rationale.push(`Forbidden actions referenced: ${forbiddenTriggered.join(", ")}.`);
  }
  if (rationale.length === 0) {
    rationale.push("Offer already aligns with current constraints.");
  }

  const messageParts = [
    `Negotiation update: price ${formatNumber(proposedOffer.price)}, delivery ${formatNumber(proposedOffer.deliveryDays)} days, sla ${formatNumber(proposedOffer.sla)}.`,
    evaluation.allSatisfied ? "Constraints satisfied." : "Constraints still need adjustment.",
    requiresUserConfirmation
      ? "Final agreement detected. Explicit user confirmation is required before commit."
      : "Continue negotiation until both sides confirm.",
  ];

  return {
    message: messageParts.join(" "),
    mode: "negotiation",
    negotiation: {
      sourceOffer,
      proposedOffer,
      constraints: input.constraints,
      evaluation,
      forbiddenTriggered,
      rationale,
      requiresUserConfirmation,
    },
  };
}

function toNormalizedError(error: unknown, traceId: string): NormalizedError {
  if (error instanceof Error) {
    return {
      code: "LIVE_AGENT_ERROR",
      message: error.message,
      traceId,
    };
  }
  return {
    code: "LIVE_AGENT_ERROR",
    message: "Unknown live-agent failure",
    traceId,
  };
}

async function handleByIntent(params: {
  intent: OrchestratorIntent;
  input: NormalizedLiveInput;
  config: GeminiConfig;
  capabilities: LiveAgentCapabilitySet;
}): Promise<Record<string, unknown>> {
  const { intent, input, config, capabilities } = params;
  switch (intent) {
    case "translation":
      return handleTranslation({
        input,
        config,
        capabilities,
      });
    case "negotiation":
      return handleNegotiation(input);
    case "conversation":
    default:
      return handleConversation({
        input,
        config,
        capabilities,
      });
  }
}

export async function runLiveAgent(request: OrchestratorRequest): Promise<OrchestratorResponse> {
  const traceId = randomUUID();
  const runId = request.runId ?? request.id;
  const startedAt = Date.now();
  const config = getGeminiConfig();
  const capabilities = createLiveAgentCapabilitySet(config);

  try {
    const intent = request.payload.intent;
    const input = normalizeInput(request.payload.input);
    const result = await handleByIntent({
      intent,
      input,
      config,
      capabilities,
    });

    return createEnvelope({
      userId: request.userId,
      sessionId: request.sessionId,
      runId,
      type: "orchestrator.response",
      source: "live-agent",
      payload: {
        route: "live-agent",
        status: "completed",
        traceId,
        output: {
          ...result,
          handledIntent: intent,
          capabilityProfile: capabilities.profile,
          traceId,
          latencyMs: Date.now() - startedAt,
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
      source: "live-agent",
      payload: {
        route: "live-agent",
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
  console.log("[live-agent] ready");
}
