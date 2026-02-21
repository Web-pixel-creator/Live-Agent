import { randomUUID } from "node:crypto";
import {
  buildCapabilityProfile,
  type CapabilityProfile,
  type LiveCapabilityAdapter,
  type ReasoningCapabilityAdapter,
} from "@mla/capabilities";
import {
  getSkillsRuntimeSnapshot,
  renderSkillsPrompt,
  toSkillsRuntimeSummary,
} from "@mla/skills";
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

type ConversationTurn = {
  role: "user" | "assistant";
  text: string;
  intent: OrchestratorIntent;
  at: string;
};

type ConversationSessionState = {
  summary: string | null;
  turns: ConversationTurn[];
  revision: number;
  compactionCount: number;
  approxTokens: number;
  lastCompactedAt: string | null;
  updatedAtMs: number;
};

type ConversationContextConfig = {
  enabled: boolean;
  maxTokens: number;
  targetTokens: number;
  keepRecentTurns: number;
  maxSessions: number;
  summaryModel: string;
};

type CompactionOutcome = {
  applied: boolean;
  reason:
    | "disabled"
    | "below_threshold"
    | "no_compactable_turns"
    | "compacted"
    | "compacted_with_fallback_summary";
  beforeTokens: number;
  afterTokens: number;
  compactedTurns: number;
  retainedTurns: number;
  minRetainedTurns: number;
  targetReached: boolean;
  summaryModel: string | null;
  at: string | null;
};

const conversationSessions = new Map<string, ConversationSessionState>();

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

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = toNullableNumber(value);
  if (parsed === null || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function toBooleanFlag(value: unknown, fallback: boolean): boolean {
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

function getConversationContextConfig(config: GeminiConfig): ConversationContextConfig {
  const maxTokens = toPositiveInt(process.env.LIVE_AGENT_CONTEXT_MAX_TOKENS, 3200);
  const targetTokens = toPositiveInt(process.env.LIVE_AGENT_CONTEXT_TARGET_TOKENS, Math.floor(maxTokens * 0.6));
  return {
    enabled: toBooleanFlag(process.env.LIVE_AGENT_CONTEXT_COMPACTION_ENABLED, true),
    maxTokens,
    targetTokens: Math.min(targetTokens, maxTokens),
    keepRecentTurns: toPositiveInt(process.env.LIVE_AGENT_CONTEXT_KEEP_RECENT_TURNS, 8),
    maxSessions: toPositiveInt(process.env.LIVE_AGENT_CONTEXT_MAX_SESSIONS, 200),
    summaryModel: toNonEmptyString(process.env.LIVE_AGENT_CONTEXT_SUMMARY_MODEL) ?? config.conversationModel,
  };
}

function estimateTextTokens(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(text.length / 4));
}

function estimateSessionTokens(state: ConversationSessionState): number {
  const summaryTokens = state.summary ? estimateTextTokens(state.summary) : 0;
  const turnsTokens = state.turns.reduce((sum, turn) => sum + estimateTextTokens(turn.text) + 4, 0);
  return summaryTokens + turnsTokens;
}

function getOrCreateConversationSession(sessionId: string, config: ConversationContextConfig): ConversationSessionState {
  const existing = conversationSessions.get(sessionId);
  if (existing) {
    existing.updatedAtMs = Date.now();
    return existing;
  }

  const state: ConversationSessionState = {
    summary: null,
    turns: [],
    revision: 0,
    compactionCount: 0,
    approxTokens: 0,
    lastCompactedAt: null,
    updatedAtMs: Date.now(),
  };
  conversationSessions.set(sessionId, state);

  if (conversationSessions.size > config.maxSessions) {
    let oldestSessionId: string | null = null;
    let oldestUpdatedAt = Number.POSITIVE_INFINITY;
    for (const [candidateSessionId, candidateState] of conversationSessions.entries()) {
      if (candidateState.updatedAtMs < oldestUpdatedAt) {
        oldestUpdatedAt = candidateState.updatedAtMs;
        oldestSessionId = candidateSessionId;
      }
    }
    if (oldestSessionId) {
      conversationSessions.delete(oldestSessionId);
    }
  }

  return state;
}

function addConversationTurn(params: {
  state: ConversationSessionState;
  role: "user" | "assistant";
  text: string;
  intent: OrchestratorIntent;
}): void {
  const text = params.text.trim();
  if (text.length === 0) {
    return;
  }
  params.state.turns.push({
    role: params.role,
    text,
    intent: params.intent,
    at: new Date().toISOString(),
  });
  if (params.state.turns.length > 80) {
    params.state.turns = params.state.turns.slice(-80);
  }
  params.state.revision += 1;
  params.state.updatedAtMs = Date.now();
  params.state.approxTokens = estimateSessionTokens(params.state);
}

function clipText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(1, maxChars - 1))}...`;
}

function clipTailText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  const tailSize = Math.max(1, maxChars - 3);
  return `...${text.slice(text.length - tailSize)}`;
}

function renderTurns(turns: ConversationTurn[], maxCharsPerTurn = 240): string {
  return turns
    .map((turn) => `${turn.role === "user" ? "USER" : "ASSISTANT"}: ${clipText(turn.text, maxCharsPerTurn)}`)
    .join("\n");
}

function buildCompactionPrompt(params: {
  state: ConversationSessionState;
  turnsToCompact: ConversationTurn[];
}): string {
  const sections = [
    "Summarize the dialogue context for a live assistant session.",
    "Keep critical constraints, commitments, pending questions, and user goals.",
    "Output plain text summary in 6-10 short bullet points.",
  ];
  if (params.state.summary) {
    sections.push(`Previous summary:\n${clipTailText(params.state.summary, 1600)}`);
  }
  sections.push(`Transcript to compact:\n${renderTurns(params.turnsToCompact, 200)}`);
  return sections.join("\n\n");
}

function buildFallbackSummary(turns: ConversationTurn[]): string {
  const lines = turns
    .slice(-10)
    .map((turn) => `- ${turn.role === "user" ? "User" : "Assistant"}: ${clipText(turn.text, 120)}`);
  if (lines.length === 0) {
    return "No prior context.";
  }
  return ["Session summary:", ...lines].join("\n");
}

function mergeSummary(previous: string | null, next: string): string {
  const cleanNext = next.trim();
  if (!previous || previous.trim().length === 0) {
    return cleanNext;
  }
  const merged = `${previous.trim()}\n${cleanNext}`;
  return clipTailText(merged, 3200);
}

async function maybeCompactConversationContext(params: {
  state: ConversationSessionState;
  contextConfig: ConversationContextConfig;
  capabilities: LiveAgentCapabilitySet;
}): Promise<CompactionOutcome> {
  const beforeTokens = params.state.approxTokens;
  const minRetainedTurns = Math.min(
    params.state.turns.length,
    Math.max(1, params.contextConfig.keepRecentTurns),
  );
  if (!params.contextConfig.enabled) {
    return {
      applied: false,
      reason: "disabled",
      beforeTokens,
      afterTokens: beforeTokens,
      compactedTurns: 0,
      retainedTurns: params.state.turns.length,
      minRetainedTurns,
      targetReached: beforeTokens <= params.contextConfig.targetTokens,
      summaryModel: null,
      at: null,
    };
  }
  if (beforeTokens <= params.contextConfig.maxTokens) {
    return {
      applied: false,
      reason: "below_threshold",
      beforeTokens,
      afterTokens: beforeTokens,
      compactedTurns: 0,
      retainedTurns: params.state.turns.length,
      minRetainedTurns,
      targetReached: beforeTokens <= params.contextConfig.targetTokens,
      summaryModel: null,
      at: null,
    };
  }

  const compactCount = Math.max(0, params.state.turns.length - params.contextConfig.keepRecentTurns);
  if (compactCount <= 0) {
    return {
      applied: false,
      reason: "no_compactable_turns",
      beforeTokens,
      afterTokens: beforeTokens,
      compactedTurns: 0,
      retainedTurns: params.state.turns.length,
      minRetainedTurns,
      targetReached: beforeTokens <= params.contextConfig.targetTokens,
      summaryModel: null,
      at: null,
    };
  }

  const turnsToCompact = params.state.turns.slice(0, compactCount);
  const retainedTurns = params.state.turns.slice(compactCount);
  const summaryPrompt = buildCompactionPrompt({
    state: params.state,
    turnsToCompact,
  });

  let nextSummary = await params.capabilities.reasoning.generateText({
    model: params.contextConfig.summaryModel,
    prompt: summaryPrompt,
    responseMimeType: "text/plain",
    temperature: 0.1,
  });

  let reason: CompactionOutcome["reason"] = "compacted";
  if (!nextSummary || nextSummary.trim().length === 0) {
    nextSummary = buildFallbackSummary(turnsToCompact);
    reason = "compacted_with_fallback_summary";
  }

  params.state.summary = mergeSummary(params.state.summary, nextSummary);
  params.state.turns = retainedTurns;
  params.state.compactionCount += 1;
  params.state.lastCompactedAt = new Date().toISOString();
  params.state.revision += 1;
  params.state.updatedAtMs = Date.now();
  params.state.approxTokens = estimateSessionTokens(params.state);

  while (
    params.state.approxTokens > params.contextConfig.targetTokens &&
    params.state.turns.length > minRetainedTurns
  ) {
    params.state.turns.shift();
    params.state.approxTokens = estimateSessionTokens(params.state);
  }

  return {
    applied: true,
    reason,
    beforeTokens,
    afterTokens: params.state.approxTokens,
    compactedTurns: turnsToCompact.length,
    retainedTurns: params.state.turns.length,
    minRetainedTurns,
    targetReached: params.state.approxTokens <= params.contextConfig.targetTokens,
    summaryModel: reason === "compacted" ? params.contextConfig.summaryModel : "fallback-summary",
    at: params.state.lastCompactedAt,
  };
}

function buildConversationContextPrompt(state: ConversationSessionState): string | null {
  const sections: string[] = [];
  if (state.summary) {
    sections.push(`Session summary:\n${clipTailText(state.summary, 1800)}`);
  }
  const recentTurns = state.turns.slice(-8);
  if (recentTurns.length > 0) {
    sections.push(`Recent turns:\n${renderTurns(recentTurns, 240)}`);
  }
  if (sections.length === 0) {
    return null;
  }
  return sections.join("\n\n");
}

function buildContextDiagnostics(params: {
  state: ConversationSessionState;
  preReplyCompaction: CompactionOutcome;
  postReplyCompaction?: CompactionOutcome;
}): Record<string, unknown> {
  return {
    revision: params.state.revision,
    approxTokens: params.state.approxTokens,
    compactionCount: params.state.compactionCount,
    summaryPresent: Boolean(params.state.summary),
    summaryChars: params.state.summary ? params.state.summary.length : 0,
    retainedTurns: params.state.turns.length,
    lastCompactedAt: params.state.lastCompactedAt,
    preReplyCompaction: params.preReplyCompaction,
    ...(params.postReplyCompaction ? { postReplyCompaction: params.postReplyCompaction } : {}),
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
  skillsPrompt: string | null;
}): Promise<TranslationResult | null> {
  if (!params.config.apiKey) {
    return null;
  }

  const prompt = [
    "Translate the user text.",
    "Return strict JSON with keys: translatedText, sourceLanguage, targetLanguage, confidence.",
    params.skillsPrompt ? `Skill directives:\n${params.skillsPrompt}` : null,
    `Source language hint: ${params.sourceLanguage}`,
    `Target language: ${params.targetLanguage}`,
    `User text: ${params.text}`,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n");

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
  contextPrompt?: string | null;
  skillsPrompt: string | null;
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
    params.skillsPrompt ? `Skill directives:\n${params.skillsPrompt}` : null,
    params.contextPrompt ? `Session context:\n${params.contextPrompt}` : null,
    `User message: ${inputText || "(empty)"}`,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n");

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
  sessionId: string;
  input: NormalizedLiveInput;
  config: GeminiConfig;
  capabilities: LiveAgentCapabilitySet;
  skillsPrompt: string | null;
}): Promise<Record<string, unknown>> {
  const { input } = params;
  const contextConfig = getConversationContextConfig(params.config);
  const sessionContext = getOrCreateConversationSession(params.sessionId, contextConfig);

  if (input.text.length > 0) {
    addConversationTurn({
      state: sessionContext,
      role: "user",
      text: input.text,
      intent: "conversation",
    });
  }

  const preReplyCompaction = await maybeCompactConversationContext({
    state: sessionContext,
    contextConfig,
    capabilities: params.capabilities,
  });

  const delegationRequest = detectDelegationRequest(input.text);
  if (delegationRequest) {
    const delegationMessage = `Delegation requested: ${delegationRequest.intent}. Routing task to specialized agent.`;
    addConversationTurn({
      state: sessionContext,
      role: "assistant",
      text: delegationMessage,
      intent: "conversation",
    });
    return {
      message: delegationMessage,
      mode: "conversation",
      delegationRequest,
      model: {
        provider: "fallback",
        model: "delegation-router",
      },
      context: buildContextDiagnostics({
        state: sessionContext,
        preReplyCompaction,
      }),
    };
  }

  const reply = await generateConversationReply({
    inputText: input.text,
    config: params.config,
    capabilities: params.capabilities,
    contextPrompt: buildConversationContextPrompt(sessionContext),
    skillsPrompt: params.skillsPrompt,
  });
  addConversationTurn({
    state: sessionContext,
    role: "assistant",
    text: reply.text,
    intent: "conversation",
  });
  const postReplyCompaction = await maybeCompactConversationContext({
    state: sessionContext,
    contextConfig,
    capabilities: params.capabilities,
  });
  return {
    message: reply.text,
    mode: "conversation",
    model: {
      provider: reply.provider,
      model: reply.model,
    },
    context: buildContextDiagnostics({
      state: sessionContext,
      preReplyCompaction,
      postReplyCompaction,
    }),
  };
}

async function handleTranslation(params: {
  input: NormalizedLiveInput;
  config: GeminiConfig;
  capabilities: LiveAgentCapabilitySet;
  skillsPrompt: string | null;
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
      skillsPrompt: params.skillsPrompt,
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
  sessionId: string;
  intent: OrchestratorIntent;
  input: NormalizedLiveInput;
  config: GeminiConfig;
  capabilities: LiveAgentCapabilitySet;
  skillsPrompt: string | null;
}): Promise<Record<string, unknown>> {
  const { intent, input, config, capabilities, sessionId, skillsPrompt } = params;
  switch (intent) {
    case "translation":
      return handleTranslation({
        input,
        config,
        capabilities,
        skillsPrompt,
      });
    case "negotiation":
      return handleNegotiation(input);
    case "conversation":
    default:
      return handleConversation({
        sessionId,
        input,
        config,
        capabilities,
        skillsPrompt,
      });
  }
}

export async function runLiveAgent(request: OrchestratorRequest): Promise<OrchestratorResponse> {
  const traceId = randomUUID();
  const runId = request.runId ?? request.id;
  const startedAt = Date.now();
  const config = getGeminiConfig();
  const capabilities = createLiveAgentCapabilitySet(config);
  const skillsRuntime = await getSkillsRuntimeSnapshot({
    agentId: "live-agent",
  });
  const skillsPrompt = renderSkillsPrompt(skillsRuntime, {
    maxSkills: 4,
    maxChars: 1200,
  });

  try {
    const intent = request.payload.intent;
    const input = normalizeInput(request.payload.input);
    const result = await handleByIntent({
      sessionId: request.sessionId,
      intent,
      input,
      config,
      capabilities,
      skillsPrompt,
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
          skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
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
          skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
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
