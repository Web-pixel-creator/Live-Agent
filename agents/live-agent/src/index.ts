import { randomUUID } from "node:crypto";
import {
  buildCapabilityProfile,
  generateGoogleGenAiText,
  type CapabilityProfile,
  type LiveCapabilityAdapter,
  type ReasoningCapabilityAdapter,
  type ResearchCapabilityAdapter,
  type ResearchCitation,
  type ResearchResult,
  type ReasoningTextResult,
  type ReasoningTextUsage,
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
  query: string;
  maxCitations: number;
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

type LiveAgentTextProvider = "gemini_api" | "moonshot";

type GeminiConfig = {
  textProvider: LiveAgentTextProvider;
  apiKey: string | null;
  baseUrl: string;
  moonshotApiKey: string | null;
  moonshotBaseUrl: string;
  moonshotTemperature: number;
  moonshotTimeoutMs: number;
  timeoutMs: number;
  liveModel: string;
  translationModel: string;
  conversationModel: string;
  moonshotTranslationModel: string;
  moonshotConversationModel: string;
  researchApiKey: string | null;
  researchBaseUrl: string;
  researchModel: string;
  researchMockResponseJson: string | null;
};

type TranslationResult = {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  provider: "gemini" | "moonshot" | "google_translate" | "fallback";
  model: string;
  confidence: number | null;
};

type DelegationRequest = {
  intent: Extract<OrchestratorIntent, "story" | "ui_task">;
  input: Record<string, unknown>;
  reason: string;
};

type DelegatedStoryDirectives = {
  prompt: string;
  includeImages?: boolean;
  includeVideo?: boolean;
  segmentCount?: number;
};

type LiveAgentCapabilitySet = {
  live: LiveCapabilityAdapter;
  reasoning: ReasoningCapabilityAdapter;
  research: ResearchCapabilityAdapter;
  profile: CapabilityProfile;
};

type LiveAgentResearchSelectionReason = "api_live" | "mock_response" | "fallback_pack";

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

function toNonNegativeInt(value: unknown): number | null {
  const parsed = toNullableNumber(value);
  if (parsed === null) {
    return null;
  }
  const normalized = Math.trunc(parsed);
  return normalized >= 0 ? normalized : null;
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
  const text =
    toNonEmptyString(payload.text) ??
    toNonEmptyString(payload.query) ??
    toNonEmptyString(payload.message) ??
    "";
  const maxCitations = Math.max(1, Math.min(8, toPositiveInt(payload.maxCitations, 3)));

  return {
    text,
    query: toNonEmptyString(payload.query) ?? text,
    maxCitations,
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

function normalizeLooseLookupText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\u0451/g, "\u0435")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeLooseLookupText(text: string): string[] {
  return normalizeLooseLookupText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}

function isAmbiguousKeyResearchQuery(query: string): boolean {
  const normalized = normalizeLooseLookupText(query);
  if (normalized.length === 0 || normalized.length > 96) {
    return false;
  }

  const tokens = tokenizeLooseLookupText(normalized);
  if (tokens.length === 0 || tokens.length > 8) {
    return false;
  }

  const hasAmbiguousKeyToken = tokens.some((token) =>
    ["key", "keys", "\u043a\u043b\u044e\u0447", "\u043a\u043b\u044e\u0447\u044c", "\u043a\u043b\u044e\u0447\u0438"].includes(token),
  );
  if (!hasAmbiguousKeyToken) {
    return false;
  }

  const disambiguationHints = [
    "api",
    "ssh",
    "gpg",
    "pgp",
    "windows",
    "product key",
    "license",
    "licence",
    "\u043b\u0438\u0446\u0435\u043d\u0437",
    "\u0430\u043a\u0442\u0438\u0432\u0430\u0446",
    "\u043e\u0442 \u043a\u0432\u0430\u0440\u0442\u0438\u0440",
    "\u043e\u0442 \u0434\u043e\u043c",
    "\u043e\u0442 \u0434\u0432\u0435\u0440",
    "\u043e\u0442 \u043c\u0430\u0448\u0438\u043d",
    "\u043e\u0442 \u0430\u0432\u0442\u043e",
    "\u043e\u0442 \u0433\u0430\u0440\u0430\u0436",
    "\u043e\u0442 \u0434\u043e\u043c\u043e\u0444\u043e\u043d",
    "\u043e\u0442 \u0441\u0435\u0439\u0444",
    "\u0434\u043e\u043c\u043e\u0444\u043e\u043d",
    "\u0430\u0432\u0442\u043e",
    "\u043c\u0430\u0448\u0438\u043d",
    "\u043a\u0432\u0430\u0440\u0442\u0438\u0440",
    "\u0434\u0432\u0435\u0440",
    "\u0433\u0430\u0440\u0430\u0436",
    "\u0441\u0435\u0439\u0444",
    "\u043a\u0440\u0438\u043f\u0442",
    "\u043a\u043e\u0448\u0435\u043b",
    "\u043f\u0430\u0440\u043e\u043b",
    "crypto",
    "wallet",
    "car",
    "door",
    "house",
    "apartment",
    "office",
    "garage",
    "intercom",
    "safe",
  ];

  return !disambiguationHints.some((hint) => normalized.includes(hint));
}

function buildResearchClarificationPrompt(query: string): string {
  const language = detectLanguage(query);
  if (language === "ru") {
    return "\u0423\u0442\u043e\u0447\u043d\u0438, \u043a\u0430\u043a\u043e\u0439 \u0438\u043c\u0435\u043d\u043d\u043e \u043a\u043b\u044e\u0447 \u0442\u044b \u0438\u0449\u0435\u0448\u044c: \u043e\u0442 \u043a\u0432\u0430\u0440\u0442\u0438\u0440\u044b/\u0434\u043e\u043c\u0430, \u043e\u0442 \u043c\u0430\u0448\u0438\u043d\u044b, \u0434\u043e\u043c\u043e\u0444\u043e\u043d\u0430, API-\u043a\u043b\u044e\u0447, \u043a\u043b\u044e\u0447 Windows \u0438\u043b\u0438 \u043a\u0440\u0438\u043f\u0442\u043e\u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u043a\u043b\u044e\u0447? \u041f\u043e\u0441\u043b\u0435 \u0443\u0442\u043e\u0447\u043d\u0435\u043d\u0438\u044f \u0434\u0430\u043c \u0442\u043e\u0447\u043d\u044b\u0439 \u043e\u0442\u0432\u0435\u0442.";
  }
  return "Clarify which key you mean: house/apartment, car, intercom, API key, Windows product key, or cryptographic key. Then I can give a precise answer.";
}

function buildResearchDisplayText(answer: string): string {
  const normalized = normalizeResearchText(answer) ?? answer.trim();
  const withoutMarkdownLinks = normalized.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1");
  const withoutInlineCitations = withoutMarkdownLinks.replace(/\[(\d+)\]/g, "");
  const withoutHeadings = withoutInlineCitations.replace(/^#{1,6}\s+/gm, "");
  const withoutBold = withoutHeadings.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");
  const withoutInlineCode = withoutBold.replace(/`([^`]+)`/g, "$1");
  const normalizedBullets = withoutInlineCode.replace(/^\s*[-*]\s+/gm, "- ");
  const compacted = normalizedBullets.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return compacted.length > 0 ? compacted : answer.trim();
}

function buildResearchDebugSummary(params: {
  provider: string;
  model: string;
  citationCount: number;
  sourceUrlCount: number;
  clarificationRequired?: boolean;
}): string {
  if (params.clarificationRequired === true) {
    return `Research clarification required before grounding (${params.provider}/${params.model})`;
  }
  return `Research sources: ${params.provider}/${params.model} · citations=${params.citationCount} · urls=${params.sourceUrlCount}`;
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
  const ruToEnPhrases: Record<string, string> = {
    "как дела": "how are you",
    "как дела?": "how are you?",
    "доброе утро": "good morning",
    "добрый день": "good afternoon",
    "добрый вечер": "good evening",
    "спокойной ночи": "good night",
    "до свидания": "goodbye",
    "до встречи": "see you",
    "всего хорошего": "all the best",
    "я согласен": "I agree",
    "я не согласен": "I disagree",
    "конечно": "of course",
    "хорошо": "okay",
    "нет проблем": "no problem",
    "не за что": "you're welcome",
    "извините": "sorry",
    "мне нужна помощь": "I need help",
    "что это": "what is this",
    "сколько стоит": "how much does it cost",
    "можно скидку": "can I get a discount",
    "когда доставка": "when is the delivery",
    "давайте обсудим": "let's discuss",
    "я понял": "I understand",
    "повторите пожалуйста": "please repeat",
    "отлично": "excellent",
    "плохо": "bad",
    "большое спасибо": "thank you very much",
  };
  const ruToEnWords: Record<string, string> = {
    привет: "hello",
    здравствуйте: "hello",
    пожалуйста: "please",
    спасибо: "thank you",
    да: "yes",
    нет: "no",
    цена: "price",
    доставка: "delivery",
    сделка: "deal",
    подтвердите: "confirm",
    помощь: "help",
    вопрос: "question",
    ответ: "answer",
    время: "time",
    деньги: "money",
    работа: "work",
    проблема: "problem",
    решение: "solution",
    договор: "contract",
    условия: "terms",
    оплата: "payment",
    скидка: "discount",
    качество: "quality",
    количество: "quantity",
  };
  const enToRuPhrases: Record<string, string> = {
    "how are you": "как дела",
    "how are you?": "как дела?",
    "good morning": "доброе утро",
    "good afternoon": "добрый день",
    "good evening": "добрый вечер",
    "good night": "спокойной ночи",
    "see you": "до встречи",
    "all the best": "всего хорошего",
    "i agree": "я согласен",
    "i disagree": "я не согласен",
    "of course": "конечно",
    "no problem": "нет проблем",
    "you're welcome": "не за что",
    "i need help": "мне нужна помощь",
    "how much": "сколько стоит",
    "let's discuss": "давайте обсудим",
    "i understand": "я понял",
    "please repeat": "повторите пожалуйста",
    "thank you very much": "большое спасибо",
  };
  const enToRuWords: Record<string, string> = {
    hello: "привет",
    hi: "привет",
    please: "пожалуйста",
    thanks: "спасибо",
    yes: "да",
    no: "нет",
    price: "цена",
    delivery: "доставка",
    deal: "сделка",
    confirm: "подтвердите",
    goodbye: "до свидания",
    sorry: "извините",
    help: "помощь",
    question: "вопрос",
    answer: "ответ",
    time: "время",
    money: "деньги",
    work: "работа",
    problem: "проблема",
    solution: "решение",
    contract: "договор",
    terms: "условия",
    payment: "оплата",
    discount: "скидка",
    quality: "качество",
    okay: "хорошо",
    excellent: "отлично",
    bad: "плохо",
  };

  let translatedText = text;
  const lowerText = text.trim().toLowerCase().replace(/[?!.,]+$/, "");

  if (sourceLanguage.startsWith("ru") && targetLanguage.startsWith("en")) {
    const phraseMatch = ruToEnPhrases[lowerText] ?? ruToEnPhrases[text.trim().toLowerCase()];
    if (phraseMatch) {
      translatedText = text.endsWith("?") ? phraseMatch.replace(/\??$/, "?") : phraseMatch;
    } else {
      translatedText = replaceDictionary(text, ruToEnWords);
    }
  } else if (sourceLanguage.startsWith("en") && targetLanguage.startsWith("ru")) {
    const phraseMatch = enToRuPhrases[lowerText] ?? enToRuPhrases[text.trim().toLowerCase()];
    if (phraseMatch) {
      translatedText = text.endsWith("?") ? phraseMatch.replace(/\??$/, "?") : phraseMatch;
    } else {
      translatedText = replaceDictionary(text, enToRuWords);
    }
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

function normalizeLiveAgentTextProvider(value: unknown): LiveAgentTextProvider | null {
  const normalized = toNonEmptyString(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "gemini" || normalized === "gemini_api" || normalized === "default") {
    return "gemini_api";
  }
  if (normalized === "moonshot" || normalized === "kimi" || normalized === "kimi-k2.5") {
    return "moonshot";
  }
  return null;
}

function resolveReasoningProvider(config: GeminiConfig): LiveAgentTextProvider | "fallback" {
  if (config.textProvider === "moonshot") {
    if (config.moonshotApiKey) {
      return "moonshot";
    }
    if (config.apiKey) {
      return "gemini_api";
    }
    return "fallback";
  }
  if (config.apiKey) {
    return "gemini_api";
  }
  if (config.moonshotApiKey) {
    return "moonshot";
  }
  return "fallback";
}

function getReasoningModel(config: GeminiConfig, lane: "translation" | "conversation"): string {
  const provider = resolveReasoningProvider(config);
  if (provider === "moonshot") {
    return lane === "translation" ? config.moonshotTranslationModel : config.moonshotConversationModel;
  }
  return lane === "translation" ? config.translationModel : config.conversationModel;
}

function getReasoningSelectionReason(config: GeminiConfig, provider: LiveAgentTextProvider | "fallback"): string {
  if (provider === "moonshot") {
    return config.textProvider === "moonshot" ? "provider_override" : "secondary_provider_fallback";
  }
  if (provider === "gemini_api") {
    return config.textProvider === "moonshot" && !config.moonshotApiKey ? "missing_override_key" : "judged_default";
  }
  return "fallback";
}

function normalizeMoonshotTemperature(model: string, requested: number | undefined, fallback: number): number {
  const normalizedModel = model.trim().toLowerCase();
  const candidate = typeof requested === "number" && Number.isFinite(requested) ? requested : fallback;
  if (normalizedModel === "kimi-k2.5" || normalizedModel.startsWith("kimi-k2.5-")) {
    return 1;
  }
  return candidate;
}

function getGeminiConfig(): GeminiConfig {
  const defaultBaseUrl = "https://generativelanguage.googleapis.com/v1beta";
  const defaultMoonshotBaseUrl = "https://api.moonshot.ai/v1";
  const timeoutMs = toNullableNumber(process.env.LIVE_AGENT_GEMINI_TIMEOUT_MS) ?? 12000;

  return {
    textProvider: normalizeLiveAgentTextProvider(process.env.LIVE_AGENT_TEXT_PROVIDER) ?? "gemini_api",
    apiKey:
      toNonEmptyString(process.env.LIVE_AGENT_GEMINI_API_KEY) ?? toNonEmptyString(process.env.GEMINI_API_KEY),
    baseUrl: toNonEmptyString(process.env.GEMINI_API_BASE_URL) ?? defaultBaseUrl,
    moonshotApiKey:
      toNonEmptyString(process.env.LIVE_AGENT_MOONSHOT_API_KEY) ?? toNonEmptyString(process.env.MOONSHOT_API_KEY),
    moonshotBaseUrl:
      toNonEmptyString(process.env.LIVE_AGENT_MOONSHOT_BASE_URL) ??
      toNonEmptyString(process.env.MOONSHOT_BASE_URL) ??
      defaultMoonshotBaseUrl,
    moonshotTemperature: toNullableNumber(process.env.LIVE_AGENT_MOONSHOT_TEMPERATURE) ?? 1,
    moonshotTimeoutMs: toNullableNumber(process.env.LIVE_AGENT_MOONSHOT_TIMEOUT_MS) ?? Math.max(timeoutMs, 15000),
    timeoutMs,
    liveModel: toNonEmptyString(process.env.LIVE_AGENT_LIVE_MODEL) ?? "gemini-live-2.5-flash-native-audio",
    translationModel: toNonEmptyString(process.env.LIVE_AGENT_TRANSLATION_MODEL) ?? "gemini-3.1-flash-lite-preview",
    conversationModel: toNonEmptyString(process.env.LIVE_AGENT_CONVERSATION_MODEL) ?? "gemini-3.1-flash-lite-preview",
    moonshotTranslationModel: toNonEmptyString(process.env.LIVE_AGENT_MOONSHOT_TRANSLATION_MODEL) ?? "kimi-k2.5",
    moonshotConversationModel: toNonEmptyString(process.env.LIVE_AGENT_MOONSHOT_CONVERSATION_MODEL) ?? "kimi-k2.5",
    researchApiKey:
      toNonEmptyString(process.env.LIVE_AGENT_RESEARCH_API_KEY) ?? toNonEmptyString(process.env.PERPLEXITY_API_KEY),
    researchBaseUrl: toNonEmptyString(process.env.LIVE_AGENT_RESEARCH_BASE_URL) ?? "https://api.perplexity.ai",
    researchModel: toNonEmptyString(process.env.LIVE_AGENT_RESEARCH_MODEL) ?? "sonar-pro",
    researchMockResponseJson: toNonEmptyString(process.env.LIVE_AGENT_RESEARCH_MOCK_RESPONSE_JSON),
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
    summaryModel: toNonEmptyString(process.env.LIVE_AGENT_CONTEXT_SUMMARY_MODEL) ?? getReasoningModel(config, "conversation"),
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

  const nextSummaryResult = await params.capabilities.reasoning.generateText({
    model: params.contextConfig.summaryModel,
    prompt: summaryPrompt,
    responseMimeType: "text/plain",
    temperature: 0.1,
  });
  let nextSummary = nextSummaryResult?.text ?? null;

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
}): Promise<ReasoningTextResult | null> {
  if (!params.config.apiKey) {
    return null;
  }
  return generateGoogleGenAiText({
    apiKey: params.config.apiKey,
    baseUrl: params.config.baseUrl,
    timeoutMs: params.config.timeoutMs,
    model: params.model,
    prompt: params.prompt,
    responseMimeType: params.responseMimeType,
    temperature: params.temperature,
  });
}

function extractOpenAiCompatibleText(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = choices.find((value) => isRecord(value) && isRecord(value.message));
  if (!firstChoice || !isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return null;
  }
  const content = firstChoice.message.content;
  if (typeof content === "string" && content.trim().length > 0) {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return null;
  }
  const parts: string[] = [];
  for (const part of content) {
    if (!isRecord(part) || typeof part.text !== "string") {
      continue;
    }
    parts.push(part.text);
  }
  return parts.length > 0 ? parts.join("\n").trim() : null;
}

function parseOpenAiCompatibleUsage(payload: Record<string, unknown>): ReasoningTextUsage | undefined {
  if (!isRecord(payload.usage)) {
    return undefined;
  }
  const inputTokens = toNonNegativeInt(payload.usage.prompt_tokens);
  const outputTokens = toNonNegativeInt(payload.usage.completion_tokens);
  const totalTokens = toNonNegativeInt(payload.usage.total_tokens);
  if (inputTokens === null && outputTokens === null && totalTokens === null) {
    return undefined;
  }
  return {
    inputTokens: inputTokens ?? undefined,
    outputTokens: outputTokens ?? undefined,
    totalTokens: totalTokens ?? undefined,
    raw: payload.usage,
  };
}

async function fetchMoonshotText(params: {
  config: GeminiConfig;
  model: string;
  prompt: string;
  systemPrompt?: string;
  responseMimeType?: "application/json" | "text/plain";
  temperature?: number;
}): Promise<ReasoningTextResult | null> {
  if (!params.config.moonshotApiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.config.moonshotTimeoutMs);
  const baseUrl = params.config.moonshotBaseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/chat/completions`;

  try {
    const body: Record<string, unknown> = {
      model: params.model,
      temperature: normalizeMoonshotTemperature(
        params.model,
        params.temperature,
        params.config.moonshotTemperature,
      ),
      messages: [
        {
          role: "system",
          content: params.systemPrompt ?? "You are a concise multimodal assistant. Follow the user instructions exactly.",
        },
        {
          role: "user",
          content: params.prompt,
        },
      ],
    };

    if (params.responseMimeType === "application/json") {
      body.response_format = {
        type: "json_object",
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.config.moonshotApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "(unreadable)");
      console.error(
        `[live-agent] Moonshot translation failed: HTTP ${response.status} ${response.statusText}`,
        { model: params.model, endpoint, errorBody: errorBody.slice(0, 300) },
      );
      return null;
    }
    const parsed = (await response.json()) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }
    const text = extractOpenAiCompatibleText(parsed);
    if (!text) {
      return null;
    }
    return {
      text,
      usage: parseOpenAiCompatibleUsage(parsed),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonValue(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function normalizeResearchText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const withoutThinking = value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  return withoutThinking.length > 0 ? withoutThinking : null;
}

function toUrlString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  try {
    return new URL(normalized).toString();
  } catch {
    return null;
  }
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

function normalizeResearchCitation(value: unknown): ResearchCitation | null {
  if (!isRecord(value)) {
    return null;
  }
  const url =
    toUrlString(value.url) ??
    toUrlString(value.link) ??
    toUrlString(value.uri) ??
    toUrlString(value.source_url);
  if (!url) {
    return null;
  }
  return {
    title: toNonEmptyString(value.title) ?? extractDomain(url) ?? "source",
    url,
    domain: toNonEmptyString(value.domain) ?? extractDomain(url),
    snippet: toNonEmptyString(value.snippet) ?? toNonEmptyString(value.summary) ?? null,
    publishedAt:
      toNonEmptyString(value.publishedAt) ??
      toNonEmptyString(value.published_at) ??
      toNonEmptyString(value.date) ??
      toNonEmptyString(value.last_updated) ??
      null,
    source: toNonEmptyString(value.source) ?? toNonEmptyString(value.provider) ?? null,
  };
}

function buildResearchCitations(payload: Record<string, unknown>, maxCitations: number): ResearchCitation[] {
  const searchResults = Array.isArray(payload.search_results) ? payload.search_results : [];
  const normalizedSearchResults = searchResults
    .map((value) => normalizeResearchCitation(value))
    .filter((value): value is ResearchCitation => value !== null);
  const byUrl = new Map(normalizedSearchResults.map((item) => [item.url, item]));

  const citations: ResearchCitation[] = [];
  const seen = new Set<string>();
  const citationUrls = Array.isArray(payload.citations) ? payload.citations : [];
  for (const value of citationUrls) {
    const url = toUrlString(value);
    if (!url || seen.has(url)) {
      continue;
    }
    const mapped = byUrl.get(url);
    citations.push(
      mapped ?? {
        title: extractDomain(url) ?? "source",
        url,
        domain: extractDomain(url),
        snippet: null,
        publishedAt: null,
        source: null,
      },
    );
    seen.add(url);
    if (citations.length >= maxCitations) {
      return citations;
    }
  }

  for (const item of normalizedSearchResults) {
    if (seen.has(item.url)) {
      continue;
    }
    citations.push(item);
    seen.add(item.url);
    if (citations.length >= maxCitations) {
      break;
    }
  }

  return citations;
}

function parseResearchUsage(payload: Record<string, unknown>): ReasoningTextUsage | undefined {
  if (!isRecord(payload.usage)) {
    return undefined;
  }
  const inputTokens = toNonNegativeInt(payload.usage.prompt_tokens);
  const outputTokens = toNonNegativeInt(payload.usage.completion_tokens);
  const totalTokens = toNonNegativeInt(payload.usage.total_tokens);
  if (inputTokens === null && outputTokens === null && totalTokens === null) {
    return undefined;
  }
  return {
    inputTokens: inputTokens ?? undefined,
    outputTokens: outputTokens ?? undefined,
    totalTokens: totalTokens ?? undefined,
    raw: payload.usage,
  };
}

function parsePerplexityResearchPayload(params: {
  payload: Record<string, unknown>;
  query: string;
  maxCitations: number;
  provider: "perplexity";
  model: string;
}): ResearchResult | null {
  const choices = Array.isArray(params.payload.choices) ? params.payload.choices : [];
  const firstChoice = choices.find((value) => isRecord(value) && isRecord(value.message));
  const answer =
    normalizeResearchText(
      firstChoice && isRecord(firstChoice)
        ? isRecord(firstChoice.message)
          ? firstChoice.message.content
          : null
        : null,
    ) ??
    normalizeResearchText(params.payload.answer) ??
    normalizeResearchText(params.payload.output);
  if (!answer) {
    return null;
  }

  const citations = buildResearchCitations(params.payload, params.maxCitations);
  return {
    answer,
    citations,
    sourceUrls: citations.map((item) => item.url),
    usage: parseResearchUsage(params.payload),
    raw: {
      provider: params.provider,
      model: params.model,
      query: params.query,
    },
  };
}

function buildFallbackResearchResult(params: { query: string; maxCitations: number }): ResearchResult {
  return {
    answer: `Grounded research provider unavailable. Returning deterministic fallback summary for query: ${params.query}`,
    citations: [],
    sourceUrls: [],
    raw: {
      provider: "fallback",
      model: "fallback-research-pack",
      query: params.query,
    },
  };
}

async function queryPerplexityResearch(params: {
  config: GeminiConfig;
  query: string;
  maxCitations: number;
}): Promise<ResearchResult | null> {
  if (params.config.researchMockResponseJson) {
    const parsed = parseJsonValue(params.config.researchMockResponseJson);
    if (isRecord(parsed)) {
      return parsePerplexityResearchPayload({
        payload: parsed,
        query: params.query,
        maxCitations: params.maxCitations,
        provider: "perplexity",
        model: params.config.researchModel,
      });
    }
  }

  if (!params.config.researchApiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.config.timeoutMs);
  const baseUrl = params.config.researchBaseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.config.researchApiKey}`,
      },
      body: JSON.stringify({
        model: params.config.researchModel,
        messages: [
          {
            role: "system",
            content:
              "You are a concise grounded research assistant. Answer directly and rely on the provider citation/search results for provenance.",
          },
          {
            role: "user",
            content: params.query,
          },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const parsed = (await response.json()) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }
    return parsePerplexityResearchPayload({
      payload: parsed,
      query: params.query,
      maxCitations: params.maxCitations,
      provider: "perplexity",
      model: params.config.researchModel,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function createLiveAgentCapabilitySet(config: GeminiConfig, usageTotals: AgentUsageTotals): LiveAgentCapabilitySet {
  const reasoningProvider = resolveReasoningProvider(config);
  const reasoningModel = getReasoningModel(config, "conversation");
  const reasoningSelectionReason = getReasoningSelectionReason(config, reasoningProvider);

  console.info("[live-agent] capability init", {
    textProvider: config.textProvider,
    reasoningProvider,
    reasoningModel,
    hasMoonshotKey: Boolean(config.moonshotApiKey),
    hasGeminiKey: Boolean(config.apiKey),
  });

  const reasoning: ReasoningCapabilityAdapter = {
    descriptor: {
      capability: "reasoning",
      adapterId:
        reasoningProvider === "moonshot"
          ? "moonshot-kimi-k2_5-reasoning"
          : reasoningProvider === "gemini_api"
            ? "google-genai-sdk-reasoning"
            : "fallback-reasoning",
      provider: reasoningProvider === "fallback" ? "fallback" : reasoningProvider,
      model: reasoningModel,
      mode: reasoningProvider === "fallback" ? "fallback" : "default",
      selection: {
        defaultProvider: "gemini_api",
        defaultModel: config.conversationModel,
        secondaryProvider: config.moonshotApiKey ? "moonshot" : null,
        secondaryModel: config.moonshotApiKey ? config.moonshotConversationModel : null,
        selectionReason: reasoningSelectionReason,
      },
    },
    async generateText(params) {
      const model = params.model ?? reasoningModel;
      const result =
        reasoningProvider === "moonshot"
          ? await fetchMoonshotText({
              config,
              model,
              prompt: params.prompt,
              responseMimeType: params.responseMimeType,
              temperature: params.temperature,
              systemPrompt:
                "You are a concise real-time reasoning assistant. Follow the prompt exactly and return only the requested content.",
            })
          : reasoningProvider === "gemini_api"
            ? await fetchGeminiText({
                config,
                model,
                prompt: params.prompt,
                responseMimeType: params.responseMimeType,
                temperature: params.temperature,
              })
            : null;
      if (result?.usage) {
        recordAgentUsage(usageTotals, model, result.usage);
      }
      return result;
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

  const researchSelectionReason: LiveAgentResearchSelectionReason = config.researchMockResponseJson
    ? "mock_response"
    : config.researchApiKey
      ? "api_live"
      : "fallback_pack";
  const research: ResearchCapabilityAdapter = {
    descriptor: {
      capability: "research",
      adapterId: config.researchMockResponseJson
        ? "perplexity-sonar-mock"
        : config.researchApiKey
          ? "perplexity-sonar-live"
          : "fallback-research-pack",
      provider: config.researchMockResponseJson || config.researchApiKey ? "perplexity" : "fallback",
      model: config.researchMockResponseJson || config.researchApiKey ? config.researchModel : "fallback-research-pack",
      mode: config.researchMockResponseJson ? "simulated" : config.researchApiKey ? "default" : "fallback",
      selection: {
        defaultProvider: "perplexity",
        defaultModel: config.researchModel,
        selectionReason: researchSelectionReason,
      },
    },
    async query(params) {
      const query = params.query.trim();
      if (query.length === 0) {
        return null;
      }
      const maxCitations = Math.max(1, Math.min(8, params.maxCitations ?? 3));
      const result = await queryPerplexityResearch({
        config,
        query,
        maxCitations,
      });
      return result ?? buildFallbackResearchResult({ query, maxCitations });
    },
  };

  return {
    live,
    reasoning,
    research,
    profile: buildCapabilityProfile([live, reasoning, research]),
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

async function translateWithConfiguredProvider(params: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  config: GeminiConfig;
  capabilities: LiveAgentCapabilitySet;
  skillsPrompt: string | null;
}): Promise<TranslationResult | null> {
  if (params.capabilities.reasoning.descriptor.provider === "fallback") {
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

  /* Try primary provider first */
  const primaryModel = getReasoningModel(params.config, "translation");
  const primaryResult = await tryTranslationCall({
    capabilities: params.capabilities,
    model: primaryModel,
    prompt,
    provider: params.capabilities.reasoning.descriptor.provider === "moonshot" ? "moonshot" : "gemini",
    sourceLanguage: params.sourceLanguage,
    targetLanguage: params.targetLanguage,
  });
  if (primaryResult) {
    return primaryResult;
  }

  /* Secondary provider fallback: if Moonshot failed, try Gemini and vice versa */
  const secondaryProvider = params.capabilities.reasoning.descriptor.provider === "moonshot" && params.config.apiKey
    ? "gemini_api"
    : params.capabilities.reasoning.descriptor.provider !== "moonshot" && params.config.moonshotApiKey
      ? "moonshot"
      : null;

  if (secondaryProvider) {
    console.warn(
      `[live-agent] Primary translation provider failed, trying secondary: ${secondaryProvider}`,
    );
    const secondaryModel = secondaryProvider === "moonshot"
      ? params.config.moonshotTranslationModel
      : params.config.translationModel;
    const secondaryResult = secondaryProvider === "moonshot"
      ? await fetchMoonshotText({
          config: params.config,
          model: secondaryModel,
          prompt,
          responseMimeType: "application/json",
          temperature: 0.2,
        })
      : await fetchGeminiText({
          config: params.config,
          model: secondaryModel,
          prompt,
          responseMimeType: "application/json",
          temperature: 0.2,
        });
    if (secondaryResult) {
      const parsed = tryParseJsonObject(secondaryResult.text);
      const translatedText = parsed ? toNonEmptyString(parsed.translatedText) : null;
      if (translatedText) {
        return {
          translatedText,
          sourceLanguage: (parsed && normalizeLanguageTag(parsed.sourceLanguage)) ?? params.sourceLanguage,
          targetLanguage: (parsed && normalizeLanguageTag(parsed.targetLanguage)) ?? params.targetLanguage,
          provider: secondaryProvider === "moonshot" ? "moonshot" : "gemini",
          model: secondaryModel,
          confidence: parsed ? toNullableNumber(parsed.confidence) : null,
        };
      }
    }
  }

  /* Google Translate free endpoint fallback */
  const googleResult = await fetchGoogleTranslate({
    text: params.text,
    sourceLanguage: params.sourceLanguage,
    targetLanguage: params.targetLanguage,
  });
  if (googleResult) {
    console.info(
      `[live-agent] Google Translate fallback succeeded for: "${params.text.slice(0, 40)}"`,
    );
    return googleResult;
  }

  console.warn(
    `[live-agent] All translation providers (incl. Google Translate) failed for: "${params.text.slice(0, 80)}" (${params.sourceLanguage} -> ${params.targetLanguage}). Falling back to dictionary.`,
  );
  return null;
}

async function tryTranslationCall(params: {
  capabilities: LiveAgentCapabilitySet;
  model: string;
  prompt: string;
  provider: string;
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<TranslationResult | null> {
  const rawResult = await params.capabilities.reasoning.generateText({
    model: params.model,
    prompt: params.prompt,
    responseMimeType: "application/json",
    temperature: 0.2,
  });

  if (!rawResult) {
    return null;
  }

  const parsed = tryParseJsonObject(rawResult.text);
  if (!parsed) {
    return null;
  }

  const translatedText = toNonEmptyString(parsed.translatedText);
  if (!translatedText) {
    return null;
  }

  return {
    translatedText,
    sourceLanguage: normalizeLanguageTag(parsed.sourceLanguage) ?? params.sourceLanguage,
    targetLanguage: normalizeLanguageTag(parsed.targetLanguage) ?? params.targetLanguage,
    provider: params.provider === "moonshot" ? "moonshot" : "gemini",
    model: params.model,
    confidence: toNullableNumber(parsed.confidence),
  };
}

async function fetchGoogleTranslate(params: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<TranslationResult | null> {
  const sl = params.sourceLanguage.startsWith("ru") ? "ru" : params.sourceLanguage.startsWith("en") ? "en" : params.sourceLanguage;
  const tl = params.targetLanguage.startsWith("ru") ? "ru" : params.targetLanguage.startsWith("en") ? "en" : params.targetLanguage;

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(params.text)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[live-agent] Google Translate failed: HTTP ${response.status}`);
      return null;
    }

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      return null;
    }

    /* Google Translate returns [[['translated text','original text',...], ...], ...] */
    const segments = data[0] as unknown[];
    const translatedParts: string[] = [];
    for (const segment of segments) {
      if (Array.isArray(segment) && typeof segment[0] === "string") {
        translatedParts.push(segment[0]);
      }
    }
    const translatedText = translatedParts.join("").trim();
    if (!translatedText || translatedText === params.text) {
      return null;
    }

    return {
      translatedText,
      sourceLanguage: sl,
      targetLanguage: tl,
      provider: "google_translate",
      model: "google-translate-free",
      confidence: 0.85,
    };
  } catch (err) {
    console.error(`[live-agent] Google Translate error:`, err instanceof Error ? err.message : String(err));
    return null;
  }
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
      ? `Received: "${inputText}". I can continue the dialogue, translate this message, run grounded research, or switch to negotiation mode.`
      : "Ready for live conversation. Send text or voice and I will respond in real time.",
    provider: "fallback",
    model: "fallback-rule",
  };

  if (
    process.env.LIVE_AGENT_USE_GEMINI_CHAT === "false" &&
    params.capabilities.reasoning.descriptor.provider === "gemini_api"
  ) {
    return fallback;
  }

  if (params.capabilities.reasoning.descriptor.provider === "fallback") {
    return fallback;
  }

  const model = getReasoningModel(params.config, "conversation");
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

  const generatedResult = await params.capabilities.reasoning.generateText({
    model,
    prompt,
    responseMimeType: "text/plain",
    temperature: 0.2,
  });

  console.info(
    `[live-agent] conversation generateText result: ${generatedResult ? `"${generatedResult.text.slice(0, 80)}"` : "null"}`,
    { model, provider: params.capabilities.reasoning.descriptor.provider },
  );

  if (!generatedResult) {
    return fallback;
  }

  return {
    text: generatedResult.text,
    provider: params.capabilities.reasoning.descriptor.provider,
    model,
  };
}

function parseDelegatedStoryDirectives(rawPrompt: string): DelegatedStoryDirectives {
  let prompt = rawPrompt.trim();
  const textOnly = /\btext\s+only\b/i.test(prompt);
  const noImages = /\bno\s+images?\b/i.test(prompt);
  const noVideo = /\bno\s+videos?\b/i.test(prompt);
  const segmentMatch = prompt.match(/\b([2-6])\s*(?:scene|scenes|segment|segments)\b/i);

  prompt = prompt
    .replace(/\btext\s+only\b[\s.!,-]*/gi, " ")
    .replace(/\bno\s+images?\b[\s.!,-]*/gi, " ")
    .replace(/\bno\s+videos?\b[\s.!,-]*/gi, " ")
    .replace(/\b[2-6]\s*(?:scene|scenes|segment|segments)\b[\s.!,-]*/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, "")
    .trim();

  return {
    prompt: prompt.length > 0 ? prompt : rawPrompt.trim(),
    includeImages: textOnly ? false : noImages ? false : undefined,
    includeVideo: textOnly ? false : noVideo ? false : undefined,
    segmentCount: segmentMatch ? Number.parseInt(segmentMatch[1] ?? "", 10) : undefined,
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
    const directives = parseDelegatedStoryDirectives(storyMatch[1]);
    return {
      intent: "story",
      input: {
        prompt: directives.prompt,
        ...(typeof directives.includeImages === "boolean" ? { includeImages: directives.includeImages } : {}),
        ...(typeof directives.includeVideo === "boolean" ? { includeVideo: directives.includeVideo } : {}),
        ...(typeof directives.segmentCount === "number" ? { segmentCount: directives.segmentCount } : {}),
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
    const readyText = "Translation mode is ready. Provide text or voice input.";
    return {
      text: readyText,
      message: readyText,
      mode: "translation",
      translation: {
        sourceLanguage,
        targetLanguage,
      },
    };
  }

  /* Translation cascade: LLM providers → Google Translate → dictionary fallback */
  const llmResult = await translateWithConfiguredProvider({
    text: input.text,
    sourceLanguage,
    targetLanguage,
    config: params.config,
    capabilities: params.capabilities,
    skillsPrompt: params.skillsPrompt,
  });

  const translation =
    llmResult ??
    (await fetchGoogleTranslate({ text: input.text, sourceLanguage, targetLanguage })) ??
    fallbackTranslate(input.text, sourceLanguage, targetLanguage);

  return {
    text: translation.translatedText,
    message: `Translation (${translation.sourceLanguage} -> ${translation.targetLanguage}): ${translation.translatedText}`,
    mode: "translation",
    translation,
  };
}

async function handleResearch(params: {
  input: NormalizedLiveInput;
  capabilities: LiveAgentCapabilitySet;
  skillsPrompt: string | null;
}): Promise<Record<string, unknown>> {
  const query = params.input.query.trim();
  if (query.length === 0) {
    const readyText = "Research mode is ready. Provide a query to return answer and citations.";
    return {
      text: readyText,
      message: readyText,
      mode: "research",
      research: {
        query: "",
        answer: readyText,
        displayText: readyText,
        debugSummary: buildResearchDebugSummary({
          provider: params.capabilities.research.descriptor.provider,
          model: params.capabilities.research.descriptor.model,
          citationCount: 0,
          sourceUrlCount: 0,
        }),
        provider: params.capabilities.research.descriptor.provider,
        model: params.capabilities.research.descriptor.model,
        selectionReason: params.capabilities.research.descriptor.selection?.selectionReason ?? null,
        citations: [],
        citationCount: 0,
        sourceUrls: [],
        sourceUrlCount: 0,
      },
    };
  }

  if (isAmbiguousKeyResearchQuery(query)) {
    const clarification = buildResearchClarificationPrompt(query);
    return {
      text: clarification,
      message: clarification,
      mode: "research",
      research: {
        query,
        answer: clarification,
        displayText: clarification,
        debugSummary: buildResearchDebugSummary({
          provider: params.capabilities.research.descriptor.provider,
          model: params.capabilities.research.descriptor.model,
          citationCount: 0,
          sourceUrlCount: 0,
          clarificationRequired: true,
        }),
        clarificationRequired: true,
        provider: params.capabilities.research.descriptor.provider,
        model: params.capabilities.research.descriptor.model,
        selectionReason: params.capabilities.research.descriptor.selection?.selectionReason ?? null,
        citations: [],
        citationCount: 0,
        sourceUrls: [],
        sourceUrlCount: 0,
      },
    };
  }

  const researchQuery = [
    params.skillsPrompt ? `Skill directives:\n${params.skillsPrompt}` : null,
    query,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n\n");

  const result = await params.capabilities.research.query({
    query: researchQuery,
    contextPrompt: params.skillsPrompt,
    maxCitations: params.input.maxCitations,
  });
  const answer = result?.answer ?? `Research adapter returned no grounded answer for query: ${query}`;
  const displayText = buildResearchDisplayText(answer);
  const citations = Array.isArray(result?.citations) ? result.citations : [];
  const sourceUrls = Array.isArray(result?.sourceUrls) ? result.sourceUrls : [];
  const debugSummary = buildResearchDebugSummary({
    provider: params.capabilities.research.descriptor.provider,
    model: params.capabilities.research.descriptor.model,
    citationCount: citations.length,
    sourceUrlCount: sourceUrls.length,
  });

  return {
    text: displayText,
    message: answer,
    mode: "research",
    research: {
      query,
      answer,
      displayText,
      debugSummary,
      provider: params.capabilities.research.descriptor.provider,
      model: params.capabilities.research.descriptor.model,
      selectionReason: params.capabilities.research.descriptor.selection?.selectionReason ?? null,
      citations,
      citationCount: citations.length,
      sourceUrls,
      sourceUrlCount: sourceUrls.length,
    },
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

  /* Evaluate the RAW client offer against constraints (not the adjusted one) */
  const rawEvaluation = evaluateOffer(sourceOffer, input.constraints);

  const messageParts = [
    `Client offer: price ${formatNumber(sourceOffer.price)}, delivery ${formatNumber(sourceOffer.deliveryDays)} days, sla ${formatNumber(sourceOffer.sla)}.`,
  ];

  if (!rawEvaluation.allSatisfied) {
    const violations: string[] = [];
    if (!rawEvaluation.priceOk) violations.push(`price ${formatNumber(sourceOffer.price)} > max ${formatNumber(input.constraints.maxPrice)}`);
    if (!rawEvaluation.deliveryOk) violations.push(`delivery ${formatNumber(sourceOffer.deliveryDays)}d > max ${formatNumber(input.constraints.maxDeliveryDays)}d`);
    if (!rawEvaluation.slaOk) violations.push(`sla ${formatNumber(sourceOffer.sla)}% < min ${formatNumber(input.constraints.minSla)}%`);
    messageParts.push(`❌ Constraints violated: ${violations.join("; ")}.`);
    messageParts.push(`Counter-offer: price ${formatNumber(proposedOffer.price)}, delivery ${formatNumber(proposedOffer.deliveryDays)} days, sla ${formatNumber(proposedOffer.sla)}.`);
  } else {
    messageParts.push("✅ All constraints satisfied.");
    messageParts.push(
      requiresUserConfirmation
        ? "Final agreement detected. Explicit user confirmation is required before commit."
        : "Continue negotiation until both sides confirm.",
    );
  }

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
    case "research":
      return handleResearch({
        input,
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
  const usageTotals = createAgentUsageTotals();
  const capabilities = createLiveAgentCapabilitySet(config, usageTotals);

  console.info("[live-agent] runLiveAgent env check", {
    intent: request.payload.intent,
    textProvider: config.textProvider,
    hasMoonshotKey: Boolean(config.moonshotApiKey),
    moonshotKeyPrefix: config.moonshotApiKey ? `${config.moonshotApiKey.slice(0, 8)}...` : "MISSING",
    hasGeminiKey: Boolean(config.apiKey),
    reasoningProvider: capabilities.reasoning.descriptor.provider,
    reasoningModel: capabilities.reasoning.descriptor.model,
  });
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
          usage: buildAgentUsagePayload(usageTotals),
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
          usage: buildAgentUsagePayload(usageTotals),
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
