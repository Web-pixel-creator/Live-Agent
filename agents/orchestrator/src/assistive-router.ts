import type { OrchestratorIntent, OrchestratorRequest } from "@mla/contracts";
import { routeIntent, type AgentRoute } from "./router.js";

type AssistiveRouterMode =
  | "deterministic"
  | "assistive_override"
  | "assistive_match"
  | "assistive_fallback";

export type AssistiveRoutingDecision = {
  requestedIntent: OrchestratorIntent;
  routedIntent: OrchestratorIntent;
  route: AgentRoute;
  mode: AssistiveRouterMode;
  reason: string;
  confidence: number | null;
  model: string | null;
};

type AssistiveRouterConfig = {
  enabled: boolean;
  model: string;
  apiKey: string | null;
  baseUrl: string;
  timeoutMs: number;
  minConfidence: number;
  allowIntents: Set<OrchestratorIntent>;
};

type AssistiveRouterCandidate = {
  intent: OrchestratorIntent;
  confidence: number;
  reason: string;
};

const ALL_INTENTS: readonly OrchestratorIntent[] = [
  "conversation",
  "translation",
  "negotiation",
  "story",
  "ui_task",
];
const DEFAULT_ASSISTIVE_INTENTS: readonly OrchestratorIntent[] = ["conversation", "translation", "negotiation"];

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
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

function parseConfidence(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, parsed));
}

function parseIntentSet(value: string | undefined, fallback: readonly OrchestratorIntent[]): Set<OrchestratorIntent> {
  if (!value || value.trim().length === 0) {
    return new Set(fallback);
  }
  const intents = new Set<OrchestratorIntent>();
  for (const raw of value.split(",")) {
    const normalized = raw.trim();
    if ((ALL_INTENTS as readonly string[]).includes(normalized)) {
      intents.add(normalized as OrchestratorIntent);
    }
  }
  if (intents.size === 0) {
    return new Set(fallback);
  }
  return intents;
}

function loadConfig(): AssistiveRouterConfig {
  const baseUrlRaw = process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL ?? process.env.GEMINI_API_BASE_URL;
  const baseUrl = (baseUrlRaw && baseUrlRaw.trim().length > 0 ? baseUrlRaw : "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const apiKey = process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY ?? process.env.GEMINI_API_KEY ?? null;
  return {
    enabled: parseBool(process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED, false),
    model: process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL ?? "gemini-3-flash",
    apiKey: typeof apiKey === "string" && apiKey.trim().length > 0 ? apiKey.trim() : null,
    baseUrl,
    timeoutMs: parsePositiveInt(process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_TIMEOUT_MS, 2500),
    minConfidence: parseConfidence(process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE, 0.75),
    allowIntents: parseIntentSet(
      process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ALLOW_INTENTS,
      DEFAULT_ASSISTIVE_INTENTS,
    ),
  };
}

function extractText(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const candidateKeys = ["text", "prompt", "goal", "message", "query", "utterance"];
  for (const key of candidateKeys) {
    if (typeof record[key] !== "string") {
      continue;
    }
    const normalized = (record[key] as string).trim();
    if (normalized.length > 0) {
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

function deterministicDecision(request: OrchestratorRequest, reason: string): AssistiveRoutingDecision {
  return {
    requestedIntent: request.payload.intent,
    routedIntent: request.payload.intent,
    route: routeIntent(request.payload.intent),
    mode: "deterministic",
    reason,
    confidence: null,
    model: null,
  };
}

async function classifyWithGemini(params: {
  config: AssistiveRouterConfig;
  request: OrchestratorRequest;
  text: string;
}): Promise<AssistiveRouterCandidate | null> {
  const prompt = [
    "You classify intent for an orchestrator router.",
    `Current intent: ${params.request.payload.intent}`,
    `User input: ${params.text}`,
    "Return strict JSON with keys: intent, confidence, reason.",
    "intent must be one of: conversation, translation, negotiation, story, ui_task.",
    "confidence is a number from 0 to 1.",
  ].join("\n");

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

export async function resolveAssistiveRoute(request: OrchestratorRequest): Promise<AssistiveRoutingDecision> {
  const config = loadConfig();
  if (!config.enabled) {
    return deterministicDecision(request, "assistive_router_disabled");
  }
  if (!config.apiKey) {
    return deterministicDecision(request, "assistive_router_missing_api_key");
  }
  if (!config.allowIntents.has(request.payload.intent)) {
    return deterministicDecision(request, "assistive_router_intent_not_eligible");
  }

  const text = extractText(request.payload.input);
  if (!text) {
    return deterministicDecision(request, "assistive_router_missing_text_input");
  }

  const candidate = await classifyWithGemini({
    config,
    request,
    text,
  });
  if (!candidate) {
    return deterministicDecision(request, "assistive_router_no_candidate");
  }

  if (candidate.confidence < config.minConfidence) {
    return {
      requestedIntent: request.payload.intent,
      routedIntent: request.payload.intent,
      route: routeIntent(request.payload.intent),
      mode: "assistive_fallback",
      reason: `assistive_low_confidence:${candidate.confidence.toFixed(3)}`,
      confidence: candidate.confidence,
      model: config.model,
    };
  }

  const suggestedRoute = routeIntent(candidate.intent);
  if (candidate.intent === request.payload.intent) {
    return {
      requestedIntent: request.payload.intent,
      routedIntent: request.payload.intent,
      route: suggestedRoute,
      mode: "assistive_match",
      reason: candidate.reason,
      confidence: candidate.confidence,
      model: config.model,
    };
  }

  return {
    requestedIntent: request.payload.intent,
    routedIntent: candidate.intent,
    route: suggestedRoute,
    mode: "assistive_override",
    reason: candidate.reason,
    confidence: candidate.confidence,
    model: config.model,
  };
}
