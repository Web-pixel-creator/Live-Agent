import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCapabilityProfile,
  generateGoogleGenAiImage,
  generateGoogleGenAiSpeech,
  generateGoogleGenAiText,
  pollGoogleGenAiVideoOperation,
  startGoogleGenAiVideoOperation,
  type CapabilityProfile,
  type ImageCapabilityAdapter,
  type ImageEditCapabilityAdapter,
  type ReasoningCapabilityAdapter,
  type ReasoningTextResult,
  type ReasoningTextUsage,
  type TtsCapabilityAdapter,
  type VideoCapabilityAdapter,
} from "@mla/capabilities";
import {
  getSkillsRuntimeSnapshot,
  renderSkillsPrompt,
  toSkillsRuntimeSummary,
} from "@mla/skills";
import {
  createEnvelope,
  type NormalizedError,
  type OrchestratorRequest,
  type OrchestratorResponse,
} from "@mla/contracts";
import {
  createVideoMediaJob,
  getMediaJobQueueSnapshot,
  type StoryMediaJob,
  type StoryMediaWorkerSnapshot,
} from "./media-jobs.js";
import {
  buildStoryCacheKey,
  ensureStoryCachePolicy,
  getFromStoryCache,
  getStoryCacheSnapshot,
  purgeStoryCache,
  setInStoryCache,
  type StoryCacheSnapshot,
} from "./story-cache.js";

export { getMediaJobQueueSnapshot } from "./media-jobs.js";
export { getStoryCacheSnapshot, purgeStoryCache } from "./story-cache.js";

type StoryMediaMode = "default" | "fallback" | "simulated";
type StorySimulationTrack = "simulation_lab";
type StorySimulationMode =
  | "sales_rehearsal"
  | "support_rehearsal"
  | "onboarding_simulation"
  | "negotiation_drills";

type StoryInput = {
  prompt: string;
  audience: string;
  style: string;
  language: string;
  voiceStyle: string;
  simulationMode: StorySimulationMode | null;
  branchChoice: string | null;
  includeImages: boolean;
  includeVideo: boolean;
  imageEditRequested: boolean;
  imageEditPrompt: string | null;
  imageEditReferenceRef: string | null;
  segmentCount: number;
  mediaMode: StoryMediaMode | null;
  videoFailureRate: number;
};

type StoryPlan = {
  title: string;
  logline: string;
  segments: string[];
  decisionPoints: string[];
  plannerProvider: "gemini" | "fallback";
  plannerModel: string;
};

type StorySimulationContext = {
  track: StorySimulationTrack;
  mode: StorySimulationMode;
  label: string;
  role: string;
  businessUseCase: string;
  objective: string;
  audienceHint: string;
  promptHint: string;
  scenes: string[];
  decisionPoints: string[];
  source: "explicit" | "inferred";
};

type StoryAsset = {
  id: string;
  kind: "image" | "video" | "audio";
  ref: string;
  provider: string;
  model: string;
  status: "ready" | "pending" | "failed";
  fallbackAsset: boolean;
  segmentIndex: number;
  mimeType: string;
  jobId: string | null;
  sourceRef: string | null;
  sourceProvider: string | null;
  sourceModel: string | null;
  meta: Record<string, unknown>;
};

type StoryTimelineSegment = {
  index: number;
  text: string;
  imageRef: string | null;
  videoRef: string | null;
  videoStatus: StoryAsset["status"] | null;
  audioRef: string | null;
};

type FallbackScenario = {
  id: string;
  title: string;
  logline: string;
  keywords: string[];
  segments: string[];
  decisionPoints: string[];
  images: string[];
  videos: string[];
  narrations: string[];
};

type FallbackPack = {
  version: string;
  generatedAt: string;
  scenarios: FallbackScenario[];
};

type GeminiConfig = {
  apiKey: string | null;
  baseUrl: string;
  plannerModel: string;
  branchModel: string;
  timeoutMs: number;
  plannerEnabled: boolean;
  mediaMode: StoryMediaMode;
  imageModel: string;
  imageEditEnabled: boolean;
  imageEditModel: string;
  videoModel: string;
  videoPollMs: number;
  videoMaxWaitMs: number;
  ttsModel: string;
  ttsProviderOverride: StorytellerTtsProvider | null;
  ttsSecondaryEnabled: boolean;
  ttsSecondaryModel: string;
  ttsSecondaryLocales: string[];
  cacheVersion: string;
  cachePurgeToken: string | null;
  deepgramApiKey: string | null;
  deepgramBaseUrl: string;
  deepgramTimeoutMs: number;
  falApiKey: string | null;
  falBaseUrl: string;
  falTimeoutMs: number;
};

type StorytellerTtsProvider = "gemini_api" | "deepgram";

type StorytellerTtsSelectionReason = "default_primary" | "locale_fallback" | "provider_override";

type StorytellerTtsSelection = {
  provider: StorytellerTtsProvider;
  model: string;
  adapterId: string;
  mode: StoryMediaMode;
  selectionReason: StorytellerTtsSelectionReason;
  defaultProvider: StorytellerTtsProvider;
  defaultModel: string;
  secondaryProvider: StorytellerTtsProvider | null;
  secondaryModel: string | null;
  language: string;
};

type StorytellerImageEditSelectionReason = "config_enabled" | "request_input" | "config_and_request";

type StorytellerImageEditSelection = {
  provider: "fal";
  model: string;
  adapterId: string;
  mode: "disabled" | StoryMediaMode;
  requested: boolean;
  applied: boolean;
  selectionReason: StorytellerImageEditSelectionReason | null;
  defaultProvider: "fal";
  defaultModel: string;
};

type StorytellerRuntimeConfigSourceKind = "env" | "control_plane_json";

type StorytellerRuntimeConfigOverride = {
  mediaMode?: StoryMediaMode;
  ttsProvider?: StorytellerTtsProvider;
  imageEditEnabled?: boolean;
};

type StorytellerRuntimeControlPlaneOverrideState = {
  rawJson: string;
  updatedAt: string;
  reason: string | null;
};

export type StorytellerRuntimeConfigSnapshot = {
  sourceKind: StorytellerRuntimeConfigSourceKind;
  mediaMode: GeminiConfig["mediaMode"];
  imageEdit: {
    enabled: boolean;
    provider: "fal";
    model: string;
    effectiveMode: "disabled" | StoryMediaMode;
  };
  tts: {
    defaultProvider: StorytellerTtsProvider;
    defaultModel: string;
    providerOverride: StorytellerTtsProvider | null;
    secondaryEnabled: boolean;
    secondaryProvider: StorytellerTtsProvider | null;
    secondaryModel: string | null;
    secondaryLocales: string[];
    effectiveProvider: StorytellerTtsProvider;
    effectiveModel: string;
  };
  controlPlaneOverride: {
    active: boolean;
    updatedAt: string | null;
    reason: string | null;
  };
};

type StorytellerCapabilitySet = {
  reasoning: ReasoningCapabilityAdapter;
  image: ImageCapabilityAdapter;
  imageEdit: ImageEditCapabilityAdapter;
  video: VideoCapabilityAdapter;
  tts: TtsCapabilityAdapter;
  imageEditSelection: StorytellerImageEditSelection;
  ttsSelection: StorytellerTtsSelection;
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

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const FALLBACK_PACK_PATH = join(CURRENT_DIR, "..", "fallback", "story-fallback-pack.json");
let cachedFallbackPack: FallbackPack | null = null;
let storytellerRuntimeControlPlaneOverride: StorytellerRuntimeControlPlaneOverrideState | null = null;

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

function toBoolean(value: unknown, fallback: boolean): boolean {
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

function toIntInRange(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function toNumberInRange(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
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

function normalizeMediaMode(value: unknown): StoryMediaMode | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "default" || normalized === "live") {
    return "default";
  }
  if (normalized === "fallback") {
    return "fallback";
  }
  if (normalized === "simulated") {
    return "simulated";
  }
  return null;
}

function normalizeStorySimulationMode(value: unknown): StorySimulationMode | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "sales" ||
    normalized === "sales_rehearsal" ||
    normalized === "sales-rehearsal" ||
    normalized === "sales_rehearsals"
  ) {
    return "sales_rehearsal";
  }
  if (
    normalized === "support" ||
    normalized === "support_rehearsal" ||
    normalized === "support-rehearsal" ||
    normalized === "support_rehearsals"
  ) {
    return "support_rehearsal";
  }
  if (
    normalized === "onboarding" ||
    normalized === "onboarding_simulation" ||
    normalized === "onboarding-simulation" ||
    normalized === "onboarding_simulations"
  ) {
    return "onboarding_simulation";
  }
  if (
    normalized === "negotiation" ||
    normalized === "negotiation_drills" ||
    normalized === "negotiation-drills" ||
    normalized === "negotiation_drill" ||
    normalized === "negotiation-drill"
  ) {
    return "negotiation_drills";
  }
  return null;
}

function normalizeStorytellerTtsProvider(value: unknown): StorytellerTtsProvider | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "gemini" || normalized === "gemini_api" || normalized === "default") {
    return "gemini_api";
  }
  if (normalized === "deepgram") {
    return "deepgram";
  }
  return null;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
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

function parseStringList(value: string | undefined): string[] {
  if (typeof value !== "string") {
    return [];
  }
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0),
    ),
  );
}

function normalizeLanguageTag(language: string): string {
  const normalized = toNonEmptyString(language, "").trim().toLowerCase();
  if (normalized.length === 0) {
    return "en";
  }
  const [baseLanguage] = normalized.split(/[-_]/, 1);
  return baseLanguage.length > 0 ? baseLanguage : normalized;
}

function inferSimulationModeFromPrompt(prompt: string): StorySimulationMode | null {
  const normalized = prompt.toLowerCase();
  if (/(support|ticket|issue|bug|escalat|helpdesk|customer care)/i.test(normalized)) {
    return "support_rehearsal";
  }
  if (/(onboard|onboarding|activation|welcome flow|first run|new user)/i.test(normalized)) {
    return "onboarding_simulation";
  }
  if (/(negotiat|deal|offer|counteroffer|counter-offer|pricing|contract)/i.test(normalized)) {
    return "negotiation_drills";
  }
  if (/(sales|pitch|lead|objection|close|quota|revenue)/i.test(normalized)) {
    return "sales_rehearsal";
  }
  return null;
}

function getSimulationTrackDetails(mode: StorySimulationMode, isRu: boolean): {
  label: string;
  role?: string;
  businessUseCase?: string;
  objective: string;
  audienceHint: string;
  promptHint: string;
  scenes: string[];
  decisionPoints: string[];
} {
  if (mode === "sales_rehearsal") {
    return isRu
      ? {
          label: "Sales Rehearsal",
          objective: "отрепетировать продажу, обработку возражений и следующий шаг",
          audienceHint: "продажная команда",
          promptHint: "Сделай сценарий как реалистичную тренировку продажи: короткий питч, возражения, подтверждение следующего шага.",
          scenes: [
            "{{hero}} открывает разговор с боли клиента и связывает {{subject}} с понятной пользой.",
            "Когда клиент спорит о цене, {{hero}} отвечает одним сильным доказательством и держит {{tone}} тон.",
            "Разговор смещается к срокам, и {{hero}} тренирует закрытие на следующий звонок вместо преждевременной продажи.",
            "Финальный кадр показывает разбор после разговора: что сработало, где клиент сомневался и какой шаг нужен дальше.",
          ],
          decisionPoints: [
            "Начать с боли клиента или сразу с продукта",
            "Ответить на возражение по цене или потерять контроль",
            "Попросить следующий шаг или остановиться слишком рано",
          ],
        }
      : {
          label: "Sales Rehearsal",
          role: "sales representative",
          businessUseCase: "sales coaching",
          objective: "practice a sales conversation, objection handling, and the next-step close",
          audienceHint: "sales team",
          promptHint: "Frame this as a realistic sales drill: short pitch, objections, proof points, and a clear next step.",
          scenes: [
            "{{hero}} opens by naming the buyer's pain and connecting {{subject}} to a practical win.",
            "When the customer pushes back on price, {{hero}} answers with one proof point and keeps the {{tone}} tone.",
            "The conversation turns to timing, and {{hero}} rehearses a next-meeting close instead of forcing the deal.",
            "The final beat is the team's debrief: what landed, what stalled, and what the next drill should stress.",
          ],
          decisionPoints: [
            "Lead with pain or lead with product",
            "Handle the price objection or give up margin",
            "Ask for the next step or end too early",
          ],
        };
  }

  if (mode === "support_rehearsal") {
    return isRu
      ? {
          label: "Support Rehearsal",
          objective: "отрепетировать разбор обращения, уточнение проблемы и эскалацию",
          audienceHint: "служба поддержки",
          promptHint: "Сделай сценарий как тренировку поддержки: уточнение, диагностика, решение или эскалация.",
          scenes: [
            "{{hero}} встречает обращение и спокойно уточняет проблему, не споря с клиентом.",
            "После первых деталей {{hero}} отсекает шум и строит короткую диагностику вокруг {{subject}}.",
            "Когда решение неочевидно, {{hero}} объясняет границы и мягко подводит к эскалации или обходному пути.",
            "Финал показывает, как команда фиксирует выводы и превращает разговор в более сильный support playbook.",
          ],
          decisionPoints: [
            "Уточнить симптом или сразу предложить решение",
            "Решить на первом уровне или эскалировать",
            "Сохранить спокойный тон или потерять доверие",
          ],
        }
      : {
          label: "Support Rehearsal",
          role: "support agent",
          businessUseCase: "support triage",
          objective: "practice ticket triage, diagnosis, and escalation control",
          audienceHint: "support team",
          promptHint: "Frame this as a support drill: clarify the issue, diagnose quickly, and decide when to escalate.",
          scenes: [
            "{{hero}} receives the issue and calmly clarifies the problem without fighting the customer.",
            "After the first details, {{hero}} narrows the diagnosis around {{subject}} and keeps the conversation structured.",
            "When the solution is not obvious, {{hero}} explains the boundary and walks toward escalation or a workaround.",
            "The final beat shows the team turning the conversation into a stronger support playbook.",
          ],
          decisionPoints: [
            "Clarify the symptom or jump to a fix",
            "Resolve on the first line or escalate",
            "Keep the tone steady or lose trust",
          ],
        };
  }

  if (mode === "onboarding_simulation") {
    return isRu
      ? {
          label: "Onboarding Simulation",
          objective: "отрепетировать вход нового пользователя, первую победу и снижение трения",
          audienceHint: "команда онбординга",
          promptHint: "Сделай сценарий как onboarding simulation: приветствие, первый успех, снятие трения и подсказки.",
          scenes: [
            "{{hero}} приветствует нового пользователя и объясняет, что именно он сейчас научится делать.",
            "Затем команда проводит пользователя через первый маленький успех вокруг {{subject}}.",
            "Когда появляется трение, {{hero}} упрощает шаги и убирает лишнюю неопределенность.",
            "Финальный кадр показывает, что пользователь уже увереннее двигается дальше и понимает следующий шаг.",
          ],
          decisionPoints: [
            "Показывать все сразу или вести через первый успех",
            "Оставить сложный шаг или упростить путь",
            "Дать больше контекста или меньше отвлекать",
          ],
        }
      : {
          label: "Onboarding Simulation",
          role: "onboarding specialist",
          businessUseCase: "customer onboarding",
          objective: "practice a first-run flow, early win, and friction reduction",
          audienceHint: "onboarding team",
          promptHint: "Frame this as an onboarding simulation: welcome, first success, friction removal, and guidance.",
          scenes: [
            "{{hero}} welcomes the new user and explains the one thing they are going to learn now.",
            "The team guides the user to a first small win around {{subject}}.",
            "When friction appears, {{hero}} simplifies the path and removes unnecessary uncertainty.",
            "The final beat shows the user moving forward with more confidence and a clear next step.",
          ],
          decisionPoints: [
            "Show everything at once or lead with one success",
            "Keep the harder step or simplify the path",
            "Give more context or stay out of the way",
          ],
        };
  }

  return isRu
    ? {
        label: "Negotiation Drills",
        objective: "отрепетировать якорь, контрпредложение и мягкое закрытие сделки",
        audienceHint: "переговорная команда",
        promptHint: "Сделай сценарий как negotiation drills: якорь, контрпредложение, компромисс и финальное подтверждение.",
        scenes: [
          "{{hero}} начинает с четкого якоря и объясняет, почему {{subject}} стоит именно так.",
          "Когда появляется контрпредложение, {{hero}} ищет баланс между уступкой и сохранением позиции.",
          "Дальше переговоры переходят в проверку trade-offs, и команда репетирует спокойный ответ на давление.",
          "Финальный кадр закрепляет либо согласие, либо паузу для подтверждения, но уже без тумана.",
        ],
        decisionPoints: [
          "Давить на цену или удержать позицию",
          "Согласиться на контрпредложение или попросить паузу",
          "Закрыть сделку сейчас или оставить пространство для подтверждения",
        ],
      }
    : {
        label: "Negotiation Drills",
        role: "deal negotiator",
        businessUseCase: "deal negotiation",
        objective: "practice anchoring, counteroffers, and a clean deal close",
        audienceHint: "negotiation team",
        promptHint: "Frame this as negotiation drills: anchor, counteroffer, tradeoffs, and a clear closing move.",
        scenes: [
          "{{hero}} opens with a clear anchor and explains why {{subject}} is worth that position.",
          "When the counteroffer lands, {{hero}} balances concession against keeping the deal intact.",
          "The conversation shifts to tradeoffs, and the team rehearses a calm answer under pressure.",
          "The final beat locks in either agreement or a pause for approval, but not uncertainty.",
        ],
        decisionPoints: [
          "Push on price or protect the position",
          "Accept the counteroffer or ask for a pause",
          "Close now or leave room for confirmation",
        ],
    };
}

function renderSimulationTemplate(template: string, params: { hero: string; subject: string; tone: string }): string {
  return template
    .replaceAll("{{hero}}", params.hero)
    .replaceAll("{{subject}}", params.subject)
    .replaceAll("{{tone}}", params.tone);
}

function buildStorySimulationContext(input: StoryInput): StorySimulationContext | null {
  const explicitMode = input.simulationMode;
  const inferredMode = explicitMode ?? inferSimulationModeFromPrompt(input.prompt);
  if (!inferredMode) {
    return null;
  }
  const isRu = input.language.trim().toLowerCase().startsWith("ru");
  const details = getSimulationTrackDetails(inferredMode, isRu);
  return {
    track: "simulation_lab",
    mode: inferredMode,
    label: details.label,
    role: details.role ?? details.audienceHint,
    businessUseCase: details.businessUseCase ?? details.objective,
    objective: details.objective,
    audienceHint: details.audienceHint,
    promptHint: details.promptHint,
    scenes: details.scenes,
    decisionPoints: details.decisionPoints,
    source: explicitMode ? "explicit" : "inferred",
  };
}

function buildStorySimulationPromptBlock(simulation: StorySimulationContext, isRu: boolean): string {
  if (isRu) {
    return [
      `Simulation lab track: ${simulation.track}`,
      `Simulation mode: ${simulation.label}`,
      `Role: ${simulation.role}`,
      `Business use case: ${simulation.businessUseCase}`,
      `Objective: ${simulation.objective}`,
      `Audience: ${simulation.audienceHint}`,
      `Key decisions: ${simulation.decisionPoints.join(" | ")}`,
      simulation.promptHint,
      "Keep the output grounded in a realistic training or rehearsal flow, not a fantasy story.",
    ].join("\n");
  }
  return [
    `Simulation lab track: ${simulation.track}`,
    `Simulation mode: ${simulation.label}`,
    `Role: ${simulation.role}`,
    `Business use case: ${simulation.businessUseCase}`,
    `Objective: ${simulation.objective}`,
    `Audience: ${simulation.audienceHint}`,
    `Key decisions: ${simulation.decisionPoints.join(" | ")}`,
    simulation.promptHint,
    "Keep the output grounded in a realistic training or rehearsal flow, not a fantasy story.",
  ].join("\n");
}

function buildStorytellerTtsSelection(params: {
  config: GeminiConfig;
  inputLanguage: string;
  mediaModeOverride: StoryMediaMode;
}): StorytellerTtsSelection {
  const defaultProvider: StorytellerTtsProvider = "gemini_api";
  const defaultModel = params.config.ttsModel;
  const language = normalizeLanguageTag(params.inputLanguage);
  const secondaryProvider: StorytellerTtsProvider | null = params.config.ttsSecondaryEnabled ? "deepgram" : null;
  const secondaryModel =
    params.config.ttsSecondaryEnabled && params.config.ttsSecondaryModel.length > 0
      ? params.config.ttsSecondaryModel
      : null;
  const localeMatchedFallback =
    secondaryProvider === "deepgram" &&
    secondaryModel !== null &&
    params.config.ttsSecondaryLocales.includes(language);

  let provider: StorytellerTtsProvider = defaultProvider;
  let model = defaultModel;
  let selectionReason: StorytellerTtsSelectionReason = "default_primary";

  if (params.config.ttsProviderOverride === "deepgram" && secondaryProvider === "deepgram" && secondaryModel !== null) {
    provider = "deepgram";
    model = secondaryModel;
    selectionReason = "provider_override";
  } else if (params.config.ttsProviderOverride === "gemini_api") {
    selectionReason = "provider_override";
  } else if (localeMatchedFallback) {
    provider = "deepgram";
    model = secondaryModel!;
    selectionReason = "locale_fallback";
  }

  const liveProviderReady =
    params.mediaModeOverride === "default" &&
    ((provider === "gemini_api" && Boolean(params.config.apiKey)) ||
      (provider === "deepgram" && Boolean(params.config.deepgramApiKey)));
  const mode: StoryMediaMode =
    params.mediaModeOverride === "simulated" ? "simulated" : liveProviderReady ? "default" : "fallback";
  const adapterId =
    provider === "deepgram"
      ? mode === "default"
        ? "deepgram-aura-2-live"
        : mode === "simulated"
        ? "deepgram-aura-2-simulated"
        : "deepgram-aura-2-fallback-pack"
      : mode === "default"
        ? "google-genai-sdk-tts"
        : mode === "simulated"
        ? "gemini-tts-simulated"
        : "gemini-tts-fallback-pack";

  return {
    provider,
    model,
    adapterId,
    mode,
    selectionReason,
    defaultProvider,
    defaultModel,
    secondaryProvider,
    secondaryModel,
    language,
  };
}

function buildStorytellerImageEditSelection(params: {
  config: GeminiConfig;
  mediaModeOverride: StoryMediaMode;
  includeImages: boolean;
  imageEditRequested: boolean;
}): StorytellerImageEditSelection {
  const defaultProvider: "fal" = "fal";
  const defaultModel = params.config.imageEditModel;
  const requested = params.config.imageEditEnabled || params.imageEditRequested;
  const applied = requested && params.includeImages;
  let selectionReason: StorytellerImageEditSelectionReason | null = null;

  if (params.config.imageEditEnabled && params.imageEditRequested) {
    selectionReason = "config_and_request";
  } else if (params.imageEditRequested) {
    selectionReason = "request_input";
  } else if (params.config.imageEditEnabled) {
    selectionReason = "config_enabled";
  }

  const mode: StorytellerImageEditSelection["mode"] = !applied
    ? "disabled"
    : params.mediaModeOverride === "simulated"
      ? "simulated"
      : params.mediaModeOverride === "default" && Boolean(params.config.falApiKey)
        ? "default"
      : "fallback";
  const adapterId =
    mode === "default"
      ? "fal-nano-banana-2-edit-live"
      : mode === "simulated"
      ? "fal-nano-banana-2-edit-simulated"
      : mode === "fallback"
        ? "fal-nano-banana-2-edit-fallback-pack"
        : "fal-nano-banana-2-edit-disabled";

  return {
    provider: defaultProvider,
    model: defaultModel,
    adapterId,
    mode,
    requested,
    applied,
    selectionReason,
    defaultProvider,
    defaultModel,
  };
}

function sliceToCount<T>(values: T[], count: number): T[] {
  if (values.length <= count) {
    return values;
  }
  return values.slice(0, count);
}

function buildFallbackContinuationSegment(params: {
  input: StoryInput;
  fallback: FallbackScenario;
  sceneNumber: number;
  existingSegments: string[];
}): string {
  const { input, fallback, sceneNumber, existingSegments } = params;
  const isRu = input.language.trim().toLowerCase().startsWith("ru");
  const decisionPoints = Array.isArray(fallback.decisionPoints) ? fallback.decisionPoints : [];
  const focus = decisionPoints.length > 0
    ? decisionPoints[(sceneNumber - 1) % decisionPoints.length]
    : fallback.logline;
  const previousBeat = existingSegments.length > 0 ? existingSegments[existingSegments.length - 1] : fallback.logline;

  if (isRu) {
    return `Сцена ${sceneNumber}: после "${compactStoryContinuationCue(previousBeat)}" напряжение смещается к выбору "${focus}", и герой делает следующий необратимый шаг к развязке.`;
  }

  return `Scene ${sceneNumber}: after "${compactStoryContinuationCue(previousBeat)}", the pressure shifts toward "${focus}", and the protagonist commits to the next irreversible move.`;
}

function compactStoryContinuationCue(value: string, maxLength = 88): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function fitStorySegmentsToCount(params: {
  segments: string[];
  count: number;
  input: StoryInput;
  fallback: FallbackScenario;
}): string[] {
  const trimmed = params.segments.map((segment) => toNonEmptyString(segment, "")).filter(Boolean);
  const limited = sliceToCount(trimmed, params.count);
  if (limited.length === 0) {
    return limited;
  }
  const padded = [...limited];
  while (padded.length < params.count) {
    padded.push(
      buildFallbackContinuationSegment({
        input: params.input,
        fallback: params.fallback,
        sceneNumber: padded.length + 1,
        existingSegments: padded,
      }),
    );
  }
  return padded;
}

function normalizeStoryInput(input: unknown): StoryInput {
  const raw = isRecord(input) ? input : {};
  const prompt =
    toNonEmptyString(raw.prompt, "") ||
    toNonEmptyString(raw.text, "") ||
    "Create an engaging interactive story with clear decision points.";

  return {
    prompt,
    audience: toNonEmptyString(raw.audience, "general"),
    style: toNonEmptyString(raw.style, "cinematic"),
    language: toNonEmptyString(raw.language, "en"),
    voiceStyle: toNonEmptyString(raw.voiceStyle, "warm storyteller voice, podcast style"),
    simulationMode:
      normalizeStorySimulationMode(raw.simulationMode) ??
      normalizeStorySimulationMode(raw.simulationTrack) ??
      normalizeStorySimulationMode(raw.scenarioMode),
    branchChoice: toNullableString(raw.branchChoice),
    includeImages: toBoolean(raw.includeImages, true),
    includeVideo: toBoolean(raw.includeVideo, false),
    imageEditRequested: toBoolean(raw.imageEditRequested ?? raw.includeImageEdit ?? raw.imageEdit, false),
    imageEditPrompt: toNullableString(raw.imageEditPrompt),
    imageEditReferenceRef: toNullableString(raw.imageEditReferenceRef),
    segmentCount: toIntInRange(raw.segmentCount, 3, 2, 6),
    mediaMode: normalizeMediaMode(raw.mediaMode),
    videoFailureRate: toNumberInRange(raw.videoFailureRate, 0, 0, 1),
  };
}

function normalizePromptWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function capitalizeStoryText(value: string): string {
  if (!value) {
    return value;
  }
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function extractStoryDirectiveValue(prompt: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(prompt);
    const value = toNullableString(match?.[1]);
    if (value) {
      return normalizePromptWhitespace(value.replace(/^["'«»]+|["'«»]+$/g, ""));
    }
  }
  return null;
}

function extractStoryHeroFromPrompt(prompt: string): string | null {
  return extractStoryDirectiveValue(prompt, [
    /(?:главн(?:ый|ая)\s+герой|герой)\s*:\s*([^\n.!?]+)/iu,
    /(?:main\s+hero|hero|protagonist)\s*:\s*([^\n.!?]+)/iu,
  ]);
}

function extractStoryToneFromPrompt(prompt: string): string | null {
  return extractStoryDirectiveValue(prompt, [
    /(?:тон|настроение)\s*:\s*([^\n.!?]+)/iu,
    /(?:tone|mood)\s*:\s*([^\n.!?]+)/iu,
  ]);
}

function extractStorySubjectFromPrompt(prompt: string): string | null {
  const direct = extractStoryDirectiveValue(prompt, [
    /(?:истори(?:ю|я|и|й)|сюжет)\s+про\s+([^\n.!?]+)/iu,
    /(?:story|narrative)\s+about\s+([^\n.!?]+)/iu,
  ]);
  if (direct) {
    return direct;
  }

  const firstSentence = normalizePromptWhitespace(prompt.split(/[\n.!?]+/u, 1)[0] ?? "");
  const normalized = firstSentence
    .replace(/^(?:собери|создай|напиши|придумай|сделай)\s+/iu, "")
    .replace(/^\d+\s*[- ]?(?:сцен\w*|scene\w*)\s+/iu, "")
    .replace(/^(?:истори(?:ю|я|и|й)|story)\s+/iu, "")
    .replace(/^(?:про|about)\s+/iu, "");
  const subject = toNullableString(normalized);
  return subject ? capitalizeStoryText(subject) : null;
}

function isTechLaunchPrompt(prompt: string, hero: string | null, subject: string | null): boolean {
  const source = `${prompt} ${hero ?? ""} ${subject ?? ""}`.toLowerCase();
  return /(?:\bai\b|startup|start-up|product|launch|release|demo|founder|saas|platform|model|стартап|продукт|запуск|релиз|демо|основател|платформ|ии)/iu.test(
    source,
  );
}

function toFallbackSlug(value: string, fallback: string): string {
  const normalized = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return normalized.length > 0 ? normalized.slice(0, 48) : fallback;
}

function buildAdaptiveDecisionPoints(
  input: StoryInput,
  baseScenario: FallbackScenario,
  hero: string | null,
  subject: string | null,
  techLaunch: boolean,
): string[] {
  const isRu = input.language.trim().toLowerCase().startsWith("ru");
  if (techLaunch) {
    return isRu
      ? [
          "Выпустить продукт в срок или отложить ради надежности",
          "Открыть публичный доступ сразу или начать с закрытого пилота",
          "Показать амбициозное видение или зафиксировать понятную пользу для первых клиентов",
        ]
      : [
          "Ship on schedule or delay for reliability",
          "Open with a public launch or start with a private pilot",
          "Lead with bold vision or with clear proof for early customers",
        ];
  }

  if (baseScenario.decisionPoints.length > 0) {
    return baseScenario.decisionPoints;
  }

  const safeHero = hero ?? (isRu ? "герой" : "the protagonist");
  const safeSubject = subject ?? (isRu ? "главная цель истории" : "the central objective");
  return isRu
    ? [
        `Поставить ${safeSubject} выше личной безопасности ${safeHero}`,
        "Сделать ставку на рискованный ход или сохранить контроль",
        "Открыть правду окружающим сейчас или удержать ее до финала",
      ]
    : [
        `Put ${safeSubject} ahead of ${safeHero}'s personal safety`,
        "Choose the risky move or preserve control",
        "Reveal the truth now or hold it for the ending",
      ];
}

function buildAdaptiveSegments(
  input: StoryInput,
  hero: string | null,
  subject: string | null,
  tone: string | null,
  techLaunch: boolean,
): string[] {
  const isRu = input.language.trim().toLowerCase().startsWith("ru");
  const safeHero = techLaunch
    ? (hero ?? (isRu ? "основатель стартапа" : "the startup founder"))
    : (hero ?? (isRu ? "главный герой" : "the protagonist"));
  const safeSubject = techLaunch
    ? (subject ?? (isRu ? "запуск нового AI-продукта" : "the launch of a new AI product"))
    : (subject ?? (isRu ? "главную цель истории" : "the central objective"));
  const safeTone = techLaunch
    ? (tone ?? (isRu ? "кинематографичный, но понятный" : "cinematic but clear"))
    : (tone ?? input.style);

  if (techLaunch) {
    const scenes = isRu
      ? [
          `За ночь до того, как состоится ${safeSubject}, ${safeHero} остается в полутемном war room, где обратный отсчет, свечение дашбордов и лица команды сразу задают ${safeTone} ритм истории.`,
          `Во время последнего прогона демо продукт отвечает неидеально, и ${safeHero} понимает, что цена запуска измеряется не только дедлайном, но и доверием первых пользователей.`,
          `На публичной презентации ${safeHero} переводит сложную AI-идею в один ясный сценарий, а сильный визуальный образ держит кадр: один экран, на котором живая метрика впервые идет вверх.`,
          `После нажатия кнопки релиза первые регистрации и тихая реакция команды показывают, что ${safeSubject} стал реальностью, а короткая финальная озвучка фиксирует цену риска и масштаб следующего шага.`,
          `Уже после запуска ${safeHero} проходит через первые отзывы клиентов, и история показывает, как продукт превращается из обещания в работающий инструмент на глазах у команды.`,
          `В финальном послевкусии ${safeHero} выходит из офиса к рассвету, а единый визуальный образ города и экрана с живыми метриками закрывает историю уверенной, но честной нотой.`,
        ]
      : [
          `On the eve of ${safeSubject}, ${safeHero} stands alone in a dim war room where countdown clocks, glass reflections, and glowing dashboards set a ${safeTone} rhythm immediately.`,
          `During the last demo rehearsal, the product misfires in one visible way, and ${safeHero} realizes the launch is really a choice between deadline pressure and earned user trust.`,
          `At the public reveal, ${safeHero} reduces the AI idea to one clear human use case, anchored by a single strong image: one live metric climbing on the main screen for the first time.`,
          `After the launch button is pressed, the first signups and the team's silent reaction confirm that ${safeSubject} is finally real, and a short closing voiceover captures the cost of the risk.`,
          `In the first hour after release, ${safeHero} faces real customer feedback and the story shows the product shifting from pitch to living system in full view of the team.`,
          `In the epilogue, ${safeHero} steps into dawn while the city and the still-glowing metrics wall merge into one final image of scale, relief, and unfinished ambition.`,
        ];
    return scenes.slice(0, input.segmentCount);
  }

  const scenes = isRu
    ? [
        `${safeHero} впервые выходит к цели "${safeSubject}", и история открывается одним сильным визуальным образом, который сразу задает ${safeTone} настроение.`,
        `Во второй сцене давление растет: путь к "${safeSubject}" начинает требовать от ${safeHero} цены, которую уже нельзя игнорировать.`,
        `К середине истории ${safeHero} получает шанс изменить ход событий, но каждый вариант делает "${safeSubject}" либо ближе, либо опаснее.`,
        `В кульминации ${safeHero} совершает необратимый выбор, и визуальный образ сцены превращает внутреннее решение в ясное действие.`,
        `Последствия выбора сразу меняют масштаб истории, заставляя ${safeHero} увидеть настоящую цену цели "${safeSubject}".`,
        `В финале история собирает все мотивы вместе и оставляет один чистый образ, который закрепляет, кем стал ${safeHero} после пути к "${safeSubject}".`,
      ]
    : [
        `${safeHero} first steps toward "${safeSubject}", and the story opens on one strong visual image that locks in the ${safeTone} tone immediately.`,
        `The second scene raises pressure as the path toward "${safeSubject}" starts demanding a cost ${safeHero} can no longer ignore.`,
        `By the midpoint, ${safeHero} gets one chance to redirect events, but every option makes "${safeSubject}" either closer or more dangerous.`,
        `At the climax, ${safeHero} commits to an irreversible choice, and the scene's central image turns the internal decision into visible action.`,
        `The aftermath changes the scale of the story and forces ${safeHero} to see the real price of chasing "${safeSubject}".`,
        `In the ending, the story gathers every thread into one clean image that shows who ${safeHero} became on the road to "${safeSubject}".`,
      ];
  return scenes.slice(0, input.segmentCount);
}

function buildAdaptiveFallbackScenario(baseScenario: FallbackScenario, input: StoryInput, keywordScore: number): FallbackScenario {
  const normalizedPrompt = normalizePromptWhitespace(input.prompt);
  const hero = extractStoryHeroFromPrompt(normalizedPrompt);
  const tone = extractStoryToneFromPrompt(normalizedPrompt);
  const subject = extractStorySubjectFromPrompt(normalizedPrompt);
  const simulation = buildStorySimulationContext(input);
  const techLaunch = isTechLaunchPrompt(normalizedPrompt, hero, subject);
  const shouldAdapt = Boolean(simulation) || techLaunch || Boolean(hero) || Boolean(tone) || keywordScore <= 0;

  if (!shouldAdapt) {
    return baseScenario;
  }

  const isRu = input.language.trim().toLowerCase().startsWith("ru");
  if (simulation) {
    const details = getSimulationTrackDetails(simulation.mode, isRu);
    const safeHero = hero ?? (isRu ? "оператор" : "the operator");
    const safeSubject = subject ?? (isRu ? "сценарий тренировки" : "the rehearsal scenario");
    const safeTone = tone ?? (isRu ? "практичный" : "practical");
    const title = capitalizeStoryText(details.label);
    const logline = isRu
      ? `${safeHero} прогоняет ${details.label.toLowerCase()} через ${safeSubject}, чтобы отрепетировать ${details.objective}.`
      : `${safeHero} runs a ${details.label.toLowerCase()} through ${safeSubject} to rehearse ${details.objective}.`;
    const assetSlug = `simulation-${simulation.mode}`;
    const keywords = Array.from(
      new Set([
        ...baseScenario.keywords,
        simulation.mode,
        simulation.label,
        simulation.objective,
        simulation.audienceHint,
        ...tokenize(normalizedPrompt),
        ...tokenize(safeSubject),
        ...tokenize(safeHero),
        ...tokenize(tone ?? input.style),
      ]),
    );
    const sceneCount = Math.max(2, input.segmentCount);
    const segments = details.scenes.slice(0, sceneCount).map((template) =>
      renderSimulationTemplate(template, {
        hero: safeHero,
        subject: safeSubject,
        tone: safeTone,
      }),
    );

    return {
      id: assetSlug,
      title,
      logline,
      keywords,
      segments,
      decisionPoints: details.decisionPoints,
      images: Array.from(
        { length: sceneCount },
        (_, index) => `https://placehold.co/1024x1024/png?text=${encodeURIComponent(`${details.label} Scene ${index + 1}`)}`,
      ),
      videos: Array.from({ length: sceneCount }, (_, index) => `fallback://story/${assetSlug}/scene-${index + 1}.mp4`),
      narrations: Array.from({ length: sceneCount }, (_, index) => `fallback://story/${assetSlug}/scene-${index + 1}.wav`),
    };
  }

  const safeHero = techLaunch
    ? (hero ?? (isRu ? "основатель стартапа" : "the startup founder"))
    : (hero ?? (isRu ? "главный герой" : "the protagonist"));
  const safeSubject = techLaunch
    ? (subject ?? (isRu ? "запуск AI-продукта" : "AI product launch"))
    : (subject ?? (isRu ? "Новая история" : "New Story"));
  const title = capitalizeStoryText(
    techLaunch
      ? (isRu ? "Запуск AI-продукта" : "AI Product Launch")
      : safeSubject,
  );
  const logline = techLaunch
    ? (
        isRu
          ? `${safeHero} ведет ${safeSubject.toLowerCase()} через ночь сомнений, финальное демо и публичный релиз, чтобы доказать, что продукт готов к реальным пользователям.`
          : `${safeHero} guides ${safeSubject.toLowerCase()} through one night of doubt, one final demo, and one public release to prove the product is ready for real users.`
      )
    : (
        isRu
          ? `${safeHero} проходит путь к "${safeSubject}" через растущее давление, ясный выбор и один решающий визуальный образ в каждой сцене.`
          : `${safeHero} moves toward "${safeSubject}" through mounting pressure, one clear choice, and one decisive visual image in every scene.`
      );
  const assetSlug = techLaunch
    ? "ai-product-launch"
    : toFallbackSlug(`${safeSubject} ${safeHero}`, baseScenario.id);
  const assetLabel = techLaunch ? "AI Product Launch" : title;
  const keywords = Array.from(
    new Set([
      ...baseScenario.keywords,
      ...tokenize(normalizedPrompt),
      ...tokenize(safeSubject),
      ...tokenize(safeHero),
      ...tokenize(tone ?? input.style),
    ]),
  );
  const segments = buildAdaptiveSegments(input, hero, subject, tone, techLaunch);
  const decisionPoints = buildAdaptiveDecisionPoints(input, baseScenario, hero, subject, techLaunch);
  const sceneCount = Math.max(2, input.segmentCount);

  return {
    id: assetSlug,
    title,
    logline,
    keywords,
    segments,
    decisionPoints,
    images: Array.from(
      { length: sceneCount },
      (_, index) => `https://placehold.co/1024x1024/png?text=${encodeURIComponent(`${assetLabel} Scene ${index + 1}`)}`,
    ),
    videos: Array.from({ length: sceneCount }, (_, index) => `fallback://story/${assetSlug}/scene-${index + 1}.mp4`),
    narrations: Array.from({ length: sceneCount }, (_, index) => `fallback://story/${assetSlug}/scene-${index + 1}.wav`),
  };
}

function buildStorySimulationMetadata(
  simulation: StorySimulationContext | null,
  input: StoryInput,
  generatedSceneCount: number,
): Record<string, unknown> {
  if (!simulation) {
    return {
      active: false,
      track: null,
      mode: null,
      label: null,
      role: null,
      businessUseCase: null,
      objective: null,
      audienceHint: null,
      promptHint: null,
      sceneCount: 0,
      templateSceneCount: 0,
      decisionPoints: [],
      source: null,
      includeImages: input.includeImages,
      includeVideo: input.includeVideo,
      mediaFastPath: false,
    };
  }

  return {
    active: true,
    track: simulation.track,
    mode: simulation.mode,
    label: simulation.label,
    role: simulation.role,
    businessUseCase: simulation.businessUseCase,
    objective: simulation.objective,
    audienceHint: simulation.audienceHint,
    promptHint: simulation.promptHint,
    sceneCount: generatedSceneCount,
    templateSceneCount: simulation.scenes.length,
    decisionPoints: simulation.decisionPoints,
    source: simulation.source,
    includeImages: input.includeImages,
    includeVideo: input.includeVideo,
    mediaFastPath: !input.includeImages && !input.includeVideo,
  };
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

function sleepMs(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(1, Math.floor(durationMs)));
  });
}

function toNonNegativeInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const normalized = Math.trunc(parsed);
  return normalized >= 0 ? normalized : null;
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

function parseStorytellerRuntimeControlPlaneOverride(rawJson: string): StorytellerRuntimeConfigOverride {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch (error) {
    throw new Error(
      `storyteller runtime control-plane override must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!isRecord(parsed)) {
    throw new Error("storyteller runtime control-plane override must be a JSON object");
  }

  const override: StorytellerRuntimeConfigOverride = {};
  if (Object.prototype.hasOwnProperty.call(parsed, "mediaMode")) {
    const mediaMode = normalizeMediaMode(parsed.mediaMode);
    if (!mediaMode) {
      throw new Error("storyteller runtime control-plane override mediaMode must be default|fallback|simulated");
    }
    override.mediaMode = mediaMode;
  }

  if (Object.prototype.hasOwnProperty.call(parsed, "ttsProvider")) {
    const ttsProvider = normalizeStorytellerTtsProvider(parsed.ttsProvider);
    if (!ttsProvider) {
      throw new Error("storyteller runtime control-plane override ttsProvider must be gemini_api|deepgram");
    }
    override.ttsProvider = ttsProvider;
  }

  if (Object.prototype.hasOwnProperty.call(parsed, "imageEditEnabled")) {
    if (typeof parsed.imageEditEnabled !== "boolean") {
      throw new Error("storyteller runtime control-plane override imageEditEnabled must be boolean");
    }
    override.imageEditEnabled = parsed.imageEditEnabled;
  }

  if (Object.keys(override).length === 0) {
    throw new Error("storyteller runtime control-plane override must include at least one supported field");
  }

  return override;
}

export function getStorytellerRuntimeConfig(): StorytellerRuntimeConfigSnapshot {
  const config = getGeminiConfig();
  const imageEditSelection = buildStorytellerImageEditSelection({
    config,
    mediaModeOverride: config.mediaMode,
    includeImages: true,
    imageEditRequested: false,
  });
  const ttsSelection = buildStorytellerTtsSelection({
    config,
    inputLanguage: "en",
    mediaModeOverride: config.mediaMode,
  });
  return {
    sourceKind: storytellerRuntimeControlPlaneOverride ? "control_plane_json" : "env",
    mediaMode: config.mediaMode,
    imageEdit: {
      enabled: config.imageEditEnabled,
      provider: imageEditSelection.defaultProvider,
      model: imageEditSelection.defaultModel,
      effectiveMode: imageEditSelection.mode,
    },
    tts: {
      defaultProvider: ttsSelection.defaultProvider,
      defaultModel: ttsSelection.defaultModel,
      providerOverride: config.ttsProviderOverride,
      secondaryEnabled: config.ttsSecondaryEnabled,
      secondaryProvider: ttsSelection.secondaryProvider,
      secondaryModel: ttsSelection.secondaryModel,
      secondaryLocales: [...config.ttsSecondaryLocales],
      effectiveProvider: ttsSelection.provider,
      effectiveModel: ttsSelection.model,
    },
    controlPlaneOverride: {
      active: storytellerRuntimeControlPlaneOverride !== null,
      updatedAt: storytellerRuntimeControlPlaneOverride?.updatedAt ?? null,
      reason: storytellerRuntimeControlPlaneOverride?.reason ?? null,
    },
  };
}

export function setStorytellerRuntimeControlPlaneOverride(params: {
  rawJson: string;
  reason?: string | null;
}): StorytellerRuntimeConfigSnapshot {
  const rawJson = toNullableString(params.rawJson);
  if (!rawJson) {
    throw new Error("storyteller runtime control-plane override requires rawJson");
  }
  parseStorytellerRuntimeControlPlaneOverride(rawJson);
  storytellerRuntimeControlPlaneOverride = {
    rawJson,
    updatedAt: new Date().toISOString(),
    reason: params.reason ?? null,
  };
  return getStorytellerRuntimeConfig();
}

export function clearStorytellerRuntimeControlPlaneOverride(): void {
  storytellerRuntimeControlPlaneOverride = null;
}

export function resetStorytellerRuntimeControlPlaneOverrideForTests(): void {
  storytellerRuntimeControlPlaneOverride = null;
}

function getGeminiConfig(): GeminiConfig {
  const config: GeminiConfig = {
    apiKey:
      toNullableString(process.env.STORYTELLER_GEMINI_API_KEY) ?? toNullableString(process.env.GEMINI_API_KEY),
    baseUrl: toNonEmptyString(process.env.GEMINI_API_BASE_URL, "https://generativelanguage.googleapis.com/v1beta"),
    plannerModel: toNonEmptyString(process.env.STORYTELLER_PLANNER_MODEL, "gemini-3.1-pro-preview"),
    branchModel: toNonEmptyString(process.env.STORYTELLER_BRANCH_MODEL, "gemini-3.1-flash-lite-preview"),
    timeoutMs: parsePositiveInt(process.env.STORYTELLER_GEMINI_TIMEOUT_MS, 12000),
    plannerEnabled: process.env.STORYTELLER_USE_GEMINI_PLANNER !== "false",
    mediaMode:
      normalizeMediaMode(process.env.STORYTELLER_MEDIA_MODE) ??
      (toNullableString(process.env.STORYTELLER_GEMINI_API_KEY) ?? toNullableString(process.env.GEMINI_API_KEY)
        ? "default"
        : "fallback"),
    imageModel: toNonEmptyString(process.env.STORYTELLER_IMAGE_MODEL, "imagen-4"),
    imageEditEnabled: parseBooleanEnv(process.env.STORYTELLER_IMAGE_EDIT_ENABLED, false),
    imageEditModel: toNonEmptyString(process.env.STORYTELLER_IMAGE_EDIT_MODEL, "fal-ai/nano-banana-2/edit"),
    videoModel: toNonEmptyString(process.env.STORYTELLER_VIDEO_MODEL, "veo-3.1"),
    videoPollMs: parsePositiveInt(process.env.STORYTELLER_VIDEO_POLL_MS, 5000),
    videoMaxWaitMs: parsePositiveInt(process.env.STORYTELLER_VIDEO_MAX_WAIT_MS, 90000),
    ttsModel: toNonEmptyString(process.env.STORYTELLER_TTS_MODEL, "gemini-2.5-flash-preview-tts"),
    ttsProviderOverride: normalizeStorytellerTtsProvider(process.env.STORYTELLER_TTS_PROVIDER_OVERRIDE),
    ttsSecondaryEnabled: parseBooleanEnv(process.env.STORYTELLER_TTS_SECONDARY_ENABLED, true),
    ttsSecondaryModel: toNonEmptyString(process.env.STORYTELLER_TTS_SECONDARY_MODEL, "aura-2"),
    ttsSecondaryLocales: parseStringList(process.env.STORYTELLER_TTS_SECONDARY_LOCALES),
    cacheVersion: toNonEmptyString(process.env.STORYTELLER_CACHE_VERSION, "story-cache-v1"),
    cachePurgeToken: toNullableString(process.env.STORYTELLER_CACHE_PURGE_TOKEN),
    deepgramApiKey: toNullableString(process.env.DEEPGRAM_API_KEY),
    deepgramBaseUrl: toNonEmptyString(process.env.DEEPGRAM_BASE_URL, "https://api.deepgram.com"),
    deepgramTimeoutMs: parsePositiveInt(process.env.DEEPGRAM_TIMEOUT_MS, 15000),
    falApiKey: toNullableString(process.env.FAL_KEY) ?? toNullableString(process.env.FAL_API_KEY),
    falBaseUrl: toNonEmptyString(process.env.FAL_BASE_URL, "https://fal.run"),
    falTimeoutMs: parsePositiveInt(process.env.FAL_TIMEOUT_MS, 60000),
  };

  if (!storytellerRuntimeControlPlaneOverride) {
    return config;
  }

  const override = parseStorytellerRuntimeControlPlaneOverride(storytellerRuntimeControlPlaneOverride.rawJson);
  return {
    ...config,
    mediaMode: override.mediaMode ?? config.mediaMode,
    imageEditEnabled: override.imageEditEnabled ?? config.imageEditEnabled,
    ttsProviderOverride: override.ttsProvider ?? config.ttsProviderOverride,
  };
}

function buildStoryCacheFingerprint(config: GeminiConfig): string {
  return [
    `planner:${config.plannerModel}`,
    `branch:${config.branchModel}`,
    `image:${config.imageModel}`,
    `imageEdit:${config.imageEditEnabled ? "enabled" : "disabled"}`,
    `imageEditModel:${config.imageEditModel}`,
    `video:${config.videoModel}`,
    `tts:${config.ttsModel}`,
    `ttsOverride:${config.ttsProviderOverride ?? "none"}`,
    `ttsSecondary:${config.ttsSecondaryEnabled ? "deepgram" : "disabled"}`,
    `ttsSecondaryModel:${config.ttsSecondaryModel}`,
    `ttsSecondaryLocales:${config.ttsSecondaryLocales.join(",") || "none"}`,
    `version:${config.cacheVersion}`,
  ].join("|");
}

async function loadFallbackPack(): Promise<FallbackPack> {
  if (cachedFallbackPack) {
    return cachedFallbackPack;
  }
  try {
    const raw = await readFile(FALLBACK_PACK_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.scenarios)) {
      throw new Error("Invalid fallback pack schema");
    }
    const scenarios: FallbackScenario[] = [];
    for (const item of parsed.scenarios) {
      if (!isRecord(item)) {
        continue;
      }
      scenarios.push({
        id: toNonEmptyString(item.id, `scenario-${scenarios.length + 1}`),
        title: toNonEmptyString(item.title, "Fallback Story"),
        logline: toNonEmptyString(item.logline, "A resilient demo storyline."),
        keywords: Array.isArray(item.keywords)
          ? item.keywords.map((value) => toNonEmptyString(value, "")).filter(Boolean)
          : [],
        segments: Array.isArray(item.segments)
          ? item.segments.map((value) => toNonEmptyString(value, "")).filter(Boolean)
          : [],
        decisionPoints: Array.isArray(item.decisionPoints)
          ? item.decisionPoints.map((value) => toNonEmptyString(value, "")).filter(Boolean)
          : [],
        images: Array.isArray(item.images)
          ? item.images.map((value) => toNonEmptyString(value, "")).filter(Boolean)
          : [],
        videos: Array.isArray(item.videos)
          ? item.videos.map((value) => toNonEmptyString(value, "")).filter(Boolean)
          : [],
        narrations: Array.isArray(item.narrations)
          ? item.narrations.map((value) => toNonEmptyString(value, "")).filter(Boolean)
          : [],
      });
    }

    if (scenarios.length === 0) {
      throw new Error("Fallback pack has no scenarios");
    }

    cachedFallbackPack = {
      version: toNonEmptyString(parsed.version, "unknown"),
      generatedAt: toNonEmptyString(parsed.generatedAt, new Date().toISOString()),
      scenarios,
    };
    return cachedFallbackPack;
  } catch {
    cachedFallbackPack = {
      version: "built-in",
      generatedAt: new Date().toISOString(),
      scenarios: [
        {
          id: "generic",
          title: "The Echo Harbor",
          logline: "A team races to decode a city-sized signal before the tide erases the clues.",
          keywords: ["signal", "harbor", "mystery"],
          segments: [
            "At dusk, the harbor lights pulse in a pattern that no one can explain.",
            "The lead engineer discovers the pattern maps to hidden chambers below the pier.",
            "A final choice emerges: decode safely and lose time, or force the gate open and risk collapse.",
          ],
          decisionPoints: [
            "Follow the signal frequency map",
            "Interview the old lighthouse keeper",
            "Force entry into the submerged chamber",
          ],
          images: [
            "https://placehold.co/1024x1024/png?text=Echo+Harbor+Scene+1",
            "https://placehold.co/1024x1024/png?text=Echo+Harbor+Scene+2",
            "https://placehold.co/1024x1024/png?text=Echo+Harbor+Scene+3",
          ],
          videos: [
            "fallback://story/generic/scene-1-video.mp4",
            "fallback://story/generic/scene-2-video.mp4",
            "fallback://story/generic/scene-3-video.mp4",
          ],
          narrations: [
            "fallback://story/generic/scene-1-audio.wav",
            "fallback://story/generic/scene-2-audio.wav",
            "fallback://story/generic/scene-3-audio.wav",
          ],
        },
      ],
    };
    return cachedFallbackPack;
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^\p{L}\p{N}]+/gu)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function selectFallbackScenario(pack: FallbackPack, input: StoryInput): FallbackScenario {
  const tokens = tokenize(`${input.prompt} ${input.branchChoice ?? ""}`);
  let best: FallbackScenario | null = null;
  let bestScore = -1;

  for (const scenario of pack.scenarios) {
    const keywords = new Set(scenario.keywords.map((keyword) => keyword.toLowerCase()));
    let score = 0;
    for (const token of tokens) {
      if (keywords.has(token)) {
        score += 1;
      }
    }
      if (score > bestScore) {
        bestScore = score;
        best = scenario;
      }
    }

  return buildAdaptiveFallbackScenario(best ?? pack.scenarios[0], input, bestScore);
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

type DeepgramTtsResult = {
  audioRef: string;
  mimeType: string;
  provider: string;
  model: string;
  durationMs: number | null;
};

type GeminiTtsResult = {
  audioRef: string;
  mimeType: string;
  provider: string;
  model: string;
  durationMs: number | null;
};

type GeminiImageResult = {
  imageRef: string;
  mimeType: string;
  provider: string;
  model: string;
};

type GeminiVideoResult = {
  videoRef: string;
  mimeType: string;
  provider: string;
  model: string;
  operationName: string;
  polled: boolean;
};

function resolveStorytellerTtsModel(model: string): string {
  const normalized = model.trim().toLowerCase();
  return normalized === "gemini-tts" ? "gemini-2.5-flash-preview-tts" : model;
}

async function fetchGeminiTts(params: {
  config: GeminiConfig;
  text: string;
  model?: string;
  languageCode?: string | null;
}): Promise<GeminiTtsResult | null> {
  if (!params.config.apiKey) {
    return null;
  }

  const model = resolveStorytellerTtsModel(params.model ?? params.config.ttsModel);
  const result = await generateGoogleGenAiSpeech({
    apiKey: params.config.apiKey,
    baseUrl: params.config.baseUrl,
    timeoutMs: params.config.timeoutMs,
    model,
    text: params.text,
    languageCode: params.languageCode,
    temperature: 0.6,
  });
  if (!result) {
    return null;
  }
  return {
    audioRef: `data:${result.mimeType};base64,${result.audioData}`,
    mimeType: result.mimeType,
    provider: "gemini_api",
    model,
    durationMs: null,
  };
}

async function fetchGeminiImage(params: {
  config: GeminiConfig;
  prompt: string;
  model?: string;
}): Promise<GeminiImageResult | null> {
  if (!params.config.apiKey) {
    return null;
  }

  const model = params.model ?? params.config.imageModel;
  const result = await generateGoogleGenAiImage({
    apiKey: params.config.apiKey,
    baseUrl: params.config.baseUrl,
    timeoutMs: params.config.timeoutMs,
    model,
    prompt: params.prompt,
    numberOfImages: 1,
    outputMimeType: "image/png",
    aspectRatio: "1:1",
  });
  if (!result) {
    return null;
  }
  return {
    imageRef: result.imageRef,
    mimeType: result.mimeType,
    provider: "google_cloud",
    model,
  };
}

async function fetchGeminiVideo(params: {
  config: GeminiConfig;
  prompt: string;
  model?: string;
}): Promise<GeminiVideoResult | null> {
  if (!params.config.apiKey) {
    return null;
  }

  const model = params.model ?? params.config.videoModel;
  let operation = await startGoogleGenAiVideoOperation({
    apiKey: params.config.apiKey,
    baseUrl: params.config.baseUrl,
    timeoutMs: params.config.timeoutMs,
    model,
    prompt: params.prompt,
    numberOfVideos: 1,
    aspectRatio: "16:9",
    durationSeconds: 8,
  });
  if (!operation) {
    return null;
  }

  const deadlineMs = Date.now() + Math.max(params.config.videoPollMs, params.config.videoMaxWaitMs);
  let polled = false;
  while (!operation.done && Date.now() < deadlineMs) {
    polled = true;
    await sleepMs(params.config.videoPollMs);
    const updated = await pollGoogleGenAiVideoOperation({
      apiKey: params.config.apiKey,
      baseUrl: params.config.baseUrl,
      timeoutMs: params.config.timeoutMs,
      operationName: operation.operationName,
    });
    if (!updated) {
      return null;
    }
    operation = updated;
  }

  if (!operation.done || !operation.videoRef) {
    return null;
  }

  return {
    videoRef: operation.videoRef,
    mimeType: operation.mimeType ?? "video/mp4",
    provider: "google_cloud",
    model,
    operationName: operation.operationName,
    polled,
  };
}

async function fetchDeepgramTts(params: {
  config: GeminiConfig;
  text: string;
  model?: string;
}): Promise<DeepgramTtsResult | null> {
  if (!params.config.deepgramApiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.config.deepgramTimeoutMs);
  const baseUrl = params.config.deepgramBaseUrl.replace(/\/+$/, "");
  const model = params.model ?? "aura-2-thalia-en";
  const endpoint = `${baseUrl}/v1/speak?model=${encodeURIComponent(model)}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Token ${params.config.deepgramApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: params.text }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    if (audioBuffer.byteLength === 0) {
      return null;
    }

    const base64Audio = Buffer.from(audioBuffer).toString("base64");
    const contentType = response.headers.get("content-type") ?? "audio/mpeg";
    const audioRef = `data:${contentType};base64,${base64Audio}`;

    const durationHeader = response.headers.get("x-dg-duration");
    const durationMs = durationHeader ? Math.round(Number(durationHeader) * 1000) : null;

    return {
      audioRef,
      mimeType: contentType,
      provider: "deepgram",
      model,
      durationMs: Number.isFinite(durationMs) ? durationMs : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

type FalImageEditResult = {
  imageRef: string;
  mimeType: string;
  provider: string;
  model: string;
  description: string | null;
};

async function fetchFalImageEdit(params: {
  config: GeminiConfig;
  prompt: string;
  imageUrls: string[];
  model?: string;
}): Promise<FalImageEditResult | null> {
  if (!params.config.falApiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.config.falTimeoutMs);
  const baseUrl = params.config.falBaseUrl.replace(/\/+$/, "");
  const model = params.model ?? "fal-ai/nano-banana-2/edit";
  const endpoint = `${baseUrl}/${model}`;

  try {
    const body = {
      prompt: params.prompt,
      image_urls: params.imageUrls,
      num_images: 1,
      output_format: "png",
      resolution: "1K",
      limit_generations: true,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Key ${params.config.falApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }

    const parsed = (await response.json()) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.images) || parsed.images.length === 0) {
      return null;
    }

    const firstImage = parsed.images[0];
    if (!isRecord(firstImage) || typeof firstImage.url !== "string") {
      return null;
    }

    return {
      imageRef: firstImage.url as string,
      mimeType: (typeof firstImage.content_type === "string" ? firstImage.content_type : null) ?? "image/png",
      provider: "fal",
      model,
      description: typeof parsed.description === "string" ? parsed.description : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function createStorytellerCapabilitySet(
  config: GeminiConfig,
  mediaModeOverride: StoryMediaMode,
  params: {
    inputLanguage: string;
    includeImages: boolean;
    imageEditRequested: boolean;
  },
  usageTotals: AgentUsageTotals,
): StorytellerCapabilitySet {
  const reasoning: ReasoningCapabilityAdapter = {
    descriptor: {
      capability: "reasoning",
      adapterId: config.apiKey ? "google-genai-sdk-story-reasoning" : "fallback-story-reasoning",
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
      if (result?.usage) {
        recordAgentUsage(usageTotals, model, result.usage);
      }
      return result;
    },
  };

  const imageMode: StoryMediaMode =
    mediaModeOverride === "simulated" ? "simulated" : config.apiKey && mediaModeOverride === "default" ? "default" : "fallback";
  const imageProvider = imageMode === "simulated" ? "simulated" : "google_cloud";
  const videoMode: StoryMediaMode =
    mediaModeOverride === "simulated" ? "simulated" : config.apiKey && mediaModeOverride === "default" ? "default" : "fallback";
  const videoProvider = videoMode === "simulated" ? "simulated" : "google_cloud";
  const imageEditSelection = buildStorytellerImageEditSelection({
    config,
    mediaModeOverride,
    includeImages: params.includeImages,
    imageEditRequested: params.imageEditRequested,
  });
  const ttsSelection = buildStorytellerTtsSelection({
    config,
    inputLanguage: params.inputLanguage,
    mediaModeOverride,
  });

  const image: ImageCapabilityAdapter = {
    descriptor: {
      capability: "image",
      adapterId:
        imageMode === "default"
          ? config.imageModel.toLowerCase().includes("imagen")
            ? "google-genai-sdk-imagen"
            : "google-genai-sdk-image"
          : imageMode === "simulated"
            ? "imagen-simulated"
            : "imagen-fallback-pack",
      provider: imageProvider,
      model: config.imageModel,
      mode: imageMode,
      selection: {
        defaultProvider: "google_cloud",
        defaultModel: config.imageModel,
        selectionReason: imageMode === "default" ? "google_genai_sdk" : "fallback_pack",
      },
    },
  };

  const video: VideoCapabilityAdapter = {
    descriptor: {
      capability: "video",
      adapterId:
        videoMode === "default"
          ? "google-genai-sdk-veo"
          : videoMode === "simulated"
            ? "veo-simulated"
            : "veo-fallback-pack",
      provider: videoProvider,
      model: config.videoModel,
      mode: videoMode,
      selection: {
        defaultProvider: "google_cloud",
        defaultModel: config.videoModel,
        selectionReason: videoMode === "default" ? "google_genai_sdk" : videoMode === "simulated" ? "simulated" : "fallback_pack",
      },
    },
  };

  const imageEdit: ImageEditCapabilityAdapter = {
    descriptor: {
      capability: "image_edit",
      adapterId: imageEditSelection.adapterId,
      provider: imageEditSelection.provider,
      model: imageEditSelection.model,
      mode: imageEditSelection.mode,
      selection: {
        defaultProvider: imageEditSelection.defaultProvider,
        defaultModel: imageEditSelection.defaultModel,
        selectionReason: imageEditSelection.selectionReason,
      },
    },
  };

  const tts: TtsCapabilityAdapter = {
    descriptor: {
      capability: "tts",
      adapterId: ttsSelection.adapterId,
      provider: ttsSelection.provider,
      model: ttsSelection.model,
      mode: ttsSelection.mode,
      selection: {
        defaultProvider: ttsSelection.defaultProvider,
        defaultModel: ttsSelection.defaultModel,
        secondaryProvider: ttsSelection.secondaryProvider,
        secondaryModel: ttsSelection.secondaryModel,
        selectionReason: ttsSelection.selectionReason,
      },
    },
  };

  return {
    reasoning,
    image,
    imageEdit,
    video,
    tts,
    imageEditSelection,
    ttsSelection,
    profile: buildCapabilityProfile([reasoning, image, imageEdit, video, tts]),
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

async function generateStoryPlan(
  input: StoryInput,
  fallback: FallbackScenario,
  config: GeminiConfig,
  capabilities: StorytellerCapabilitySet,
  skillsPrompt: string | null,
  simulation: StorySimulationContext | null,
): Promise<StoryPlan> {
  const cacheKey = buildStoryCacheKey("story.plan", {
    prompt: input.prompt,
    audience: input.audience,
    style: input.style,
    language: input.language,
    segmentCount: input.segmentCount,
    plannerModel: config.plannerModel,
    plannerEnabled: config.plannerEnabled,
    fallbackScenarioId: fallback.id,
    simulationMode: simulation?.mode ?? null,
    simulationSource: simulation?.source ?? null,
  });

  const cachedPlan = getFromStoryCache<StoryPlan>("plan", cacheKey);
  if (cachedPlan) {
    return cachedPlan;
  }

  const fallbackPlan: StoryPlan = {
    title: fallback.title,
    logline: fallback.logline,
    segments: fitStorySegmentsToCount({
      segments: fallback.segments,
      count: input.segmentCount,
      input,
      fallback,
    }),
    decisionPoints: fallback.decisionPoints,
    plannerProvider: "fallback",
    plannerModel: "fallback-pack",
  };

  if (!config.apiKey || !config.plannerEnabled) {
    setInStoryCache("plan", cacheKey, fallbackPlan);
    return fallbackPlan;
  }

  const prompt = [
    "You are a cinematic interactive storyteller.",
    "Create a story plan as strict JSON.",
    "Fields: title, logline, segments (array of strings), decisionPoints (array of strings).",
    simulation ? buildStorySimulationPromptBlock(simulation, input.language.trim().toLowerCase().startsWith("ru")) : null,
    skillsPrompt ? `Skill directives:\n${skillsPrompt}` : null,
    `Audience: ${input.audience}`,
    `Style: ${input.style}`,
    `Language: ${input.language}`,
    `Segment count: ${input.segmentCount}`,
    `Prompt: ${input.prompt}`,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n");

  const rawResult = await capabilities.reasoning.generateText({
    model: config.plannerModel,
    prompt,
    responseMimeType: "application/json",
    temperature: 0.4,
  });

  if (!rawResult) {
    setInStoryCache("plan", cacheKey, fallbackPlan);
    return fallbackPlan;
  }

  const parsed = parseJsonObject(rawResult.text);
  if (!parsed) {
    setInStoryCache("plan", cacheKey, fallbackPlan);
    return fallbackPlan;
  }

  const segments = Array.isArray(parsed.segments)
    ? parsed.segments.map((value) => toNonEmptyString(value, "")).filter(Boolean)
    : [];
  const decisionPoints = Array.isArray(parsed.decisionPoints)
    ? parsed.decisionPoints.map((value) => toNonEmptyString(value, "")).filter(Boolean)
    : [];

  if (segments.length < 2) {
    setInStoryCache("plan", cacheKey, fallbackPlan);
    return fallbackPlan;
  }

  const planned: StoryPlan = {
    title: toNonEmptyString(parsed.title, fallback.title),
    logline: toNonEmptyString(parsed.logline, fallback.logline),
    segments: fitStorySegmentsToCount({
      segments,
      count: input.segmentCount,
      input,
      fallback,
    }),
    decisionPoints: decisionPoints.length > 0 ? decisionPoints : fallback.decisionPoints,
    plannerProvider: "gemini",
    plannerModel: config.plannerModel,
  };
  setInStoryCache("plan", cacheKey, planned);
  return planned;
}

async function extendStoryBranch(params: {
  input: StoryInput;
  currentSegments: string[];
  fallback: FallbackScenario;
  config: GeminiConfig;
  capabilities: StorytellerCapabilitySet;
  skillsPrompt: string | null;
  simulation: StorySimulationContext | null;
}): Promise<{ segments: string[]; branchProvider: "gemini" | "fallback"; branchModel: string }> {
  const { input, currentSegments, fallback, config, capabilities, skillsPrompt, simulation } = params;
  if (!input.branchChoice) {
    return {
      segments: currentSegments,
      branchProvider: "fallback",
      branchModel: "no-branch-choice",
    };
  }

  const cacheKey = buildStoryCacheKey("story.branch", {
    branchChoice: input.branchChoice,
    language: input.language,
    branchModel: config.branchModel,
    plannerEnabled: config.plannerEnabled,
    currentSegments,
    simulationMode: simulation?.mode ?? null,
  });
  const cachedBranch = getFromStoryCache<{
    segments: string[];
    branchProvider: "gemini" | "fallback";
    branchModel: string;
  }>("branch", cacheKey);
  if (cachedBranch) {
    return cachedBranch;
  }

  if (!config.apiKey || !config.plannerEnabled) {
    const branchLine = `Branch path selected: ${input.branchChoice}. The team adapts and continues toward the objective with higher stakes.`;
    const fallbackBranch: {
      segments: string[];
      branchProvider: "gemini" | "fallback";
      branchModel: string;
    } = {
      segments: sliceToCount([...currentSegments, branchLine], input.segmentCount + 1),
      branchProvider: "fallback",
      branchModel: "fallback-branch",
    };
    setInStoryCache("branch", cacheKey, fallbackBranch);
    return fallbackBranch;
  }

  const prompt = [
    "Continue the interactive story in one concise segment.",
    simulation ? buildStorySimulationPromptBlock(simulation, input.language.trim().toLowerCase().startsWith("ru")) : null,
    skillsPrompt ? `Skill directives:\n${skillsPrompt}` : null,
    `Language: ${input.language}`,
    `Branch choice: ${input.branchChoice}`,
    `Existing segments: ${JSON.stringify(currentSegments)}`,
    "Return plain text only, 1-2 sentences.",
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n");

  const rawResult = await capabilities.reasoning.generateText({
    model: config.branchModel,
    prompt,
    responseMimeType: "text/plain",
    temperature: 0.4,
  });

  if (!rawResult) {
    const fallbackLine = `Branch path selected: ${input.branchChoice}. ${fallback.segments[fallback.segments.length - 1]}`;
    const fallbackBranch: {
      segments: string[];
      branchProvider: "gemini" | "fallback";
      branchModel: string;
    } = {
      segments: sliceToCount([...currentSegments, fallbackLine], input.segmentCount + 1),
      branchProvider: "fallback",
      branchModel: "fallback-branch",
    };
    setInStoryCache("branch", cacheKey, fallbackBranch);
    return fallbackBranch;
  }

  const generated: {
    segments: string[];
    branchProvider: "gemini" | "fallback";
    branchModel: string;
  } = {
    segments: sliceToCount([...currentSegments, rawResult.text], input.segmentCount + 1),
    branchProvider: "gemini",
    branchModel: config.branchModel,
  };
  setInStoryCache("branch", cacheKey, generated);
  return generated;
}

function buildAssetId(kind: StoryAsset["kind"], segmentIndex: number): string {
  return `${kind}-${segmentIndex + 1}-${randomUUID()}`;
}

function buildSimulatedRef(params: {
  kind: StoryAsset["kind"];
  scenarioId: string;
  segmentIndex: number;
  extension: string;
}): string {
  return `simulated://story/${params.scenarioId}/segment-${params.segmentIndex + 1}.${params.extension}`;
}

function pickFallbackRef(fallbackRefs: string[], index: number): string | null {
  if (fallbackRefs.length === 0) {
    return null;
  }
  if (index < fallbackRefs.length) {
    return fallbackRefs[index];
  }
  return fallbackRefs[fallbackRefs.length - 1];
}

type CachedAssetDescriptor = {
  ref: string;
  provider: string;
  model: string;
  status: StoryAsset["status"];
  fallbackAsset: boolean;
  mimeType: string;
  meta: Record<string, unknown>;
};

function resolveCachedAssetDescriptor(params: {
  namespace: string;
  cachePayload: Record<string, unknown>;
  create: () => CachedAssetDescriptor;
}): CachedAssetDescriptor {
  const cacheKey = buildStoryCacheKey(params.namespace, params.cachePayload);
  const cached = getFromStoryCache<CachedAssetDescriptor>("asset", cacheKey);
  if (cached) {
    return cached;
  }
  const created = params.create();
  setInStoryCache("asset", cacheKey, created);
  return created;
}

async function createImageAsset(params: {
  segmentText: string;
  segmentIndex: number;
  fallback: FallbackScenario;
  adapter: ImageCapabilityAdapter;
  config: GeminiConfig;
  simulation: StorySimulationContext | null;
}): Promise<StoryAsset> {
  const prompt = `Illustration for segment ${params.segmentIndex + 1}: ${params.segmentText}`;
  const isLiveGeminiImage =
    params.adapter.descriptor.mode === "default" &&
    params.adapter.descriptor.provider === "google_cloud" &&
    Boolean(params.config.apiKey);

  if (isLiveGeminiImage) {
    const liveResult = await fetchGeminiImage({
      config: params.config,
      prompt,
      model: params.adapter.descriptor.model || undefined,
    });
    if (liveResult) {
      return {
        id: buildAssetId("image", params.segmentIndex),
        kind: "image",
        ref: liveResult.imageRef,
        provider: liveResult.provider,
        model: liveResult.model,
        status: "ready",
        fallbackAsset: false,
        segmentIndex: params.segmentIndex,
        mimeType: liveResult.mimeType,
        jobId: null,
        sourceRef: null,
        sourceProvider: null,
        sourceModel: null,
        meta: {
          prompt,
          adapterMode: "default",
          liveApi: true,
          simulationTrack: params.simulation?.track ?? null,
          simulationMode: params.simulation?.mode ?? null,
          simulationLabel: params.simulation?.label ?? null,
          simulationRole: params.simulation?.role ?? null,
          simulationBusinessUseCase: params.simulation?.businessUseCase ?? null,
          simulationSource: params.simulation?.source ?? null,
        },
      };
    }
  }

  const adapterMode = params.adapter.descriptor.mode === "simulated" ? "simulated" : "fallback";
  const fallbackRef = pickFallbackRef(params.fallback.images, params.segmentIndex);
  const cached = resolveCachedAssetDescriptor({
    namespace: "story.asset.image",
    cachePayload: {
      scenarioId: params.fallback.id,
      segmentIndex: params.segmentIndex,
      segmentText: params.segmentText,
      adapterMode,
      provider: params.adapter.descriptor.provider,
      model: params.adapter.descriptor.model,
      fallbackRef,
      simulationMode: params.simulation?.mode ?? null,
    },
    create: () => {
      const fallbackAsset = adapterMode === "fallback" || !fallbackRef ? true : false;
      const ref =
        adapterMode === "fallback"
          ? fallbackRef ??
            buildSimulatedRef({
              kind: "image",
              scenarioId: params.fallback.id,
              segmentIndex: params.segmentIndex,
              extension: "jpg",
            })
          : buildSimulatedRef({
              kind: "image",
              scenarioId: params.fallback.id,
              segmentIndex: params.segmentIndex,
              extension: "jpg",
            });
      return {
        ref,
        provider: params.adapter.descriptor.provider,
        model: params.adapter.descriptor.model,
        status: "ready",
        fallbackAsset,
        mimeType: "image/jpeg",
        meta: {
          prompt,
          adapterMode,
          simulationTrack: params.simulation?.track ?? null,
          simulationMode: params.simulation?.mode ?? null,
          simulationLabel: params.simulation?.label ?? null,
          simulationRole: params.simulation?.role ?? null,
          simulationBusinessUseCase: params.simulation?.businessUseCase ?? null,
          simulationSource: params.simulation?.source ?? null,
        },
      };
    },
  });

  return {
    id: buildAssetId("image", params.segmentIndex),
    kind: "image",
    ref: cached.ref,
    provider: cached.provider,
    model: cached.model,
    status: cached.status,
    fallbackAsset: cached.fallbackAsset,
    segmentIndex: params.segmentIndex,
    mimeType: cached.mimeType,
    jobId: null,
    sourceRef: null,
    sourceProvider: null,
    sourceModel: null,
    meta: cached.meta,
  };
}

async function applyImageEditPass(params: {
  images: StoryAsset[];
  segments: string[];
  fallback: FallbackScenario;
  adapter: ImageEditCapabilityAdapter;
  imageEditPrompt: string | null;
  imageEditReferenceRef: string | null;
  config: GeminiConfig;
}): Promise<{ images: StoryAsset[]; editedAssetCount: number; edits: Array<Record<string, unknown>> }> {
  const adapterMode = params.adapter.descriptor.mode;
  if (adapterMode === "disabled" || params.images.length === 0) {
    return {
      images: params.images,
      editedAssetCount: 0,
      edits: [],
    };
  }

  const isLiveFal = adapterMode === "default" && params.adapter.descriptor.provider === "fal" && params.config.falApiKey;

  const editedImages: StoryAsset[] = [];
  for (const asset of params.images) {
    const segmentText = params.segments[asset.segmentIndex] ?? "";
    const prompt =
      params.imageEditPrompt ??
      `Continuity edit for segment ${asset.segmentIndex + 1}: preserve scene identity and refine ${segmentText}`;

    if (isLiveFal) {
      const imageUrls = [asset.ref];
      if (params.imageEditReferenceRef) {
        imageUrls.push(params.imageEditReferenceRef);
      }
      const liveResult = await fetchFalImageEdit({
        config: params.config,
        prompt,
        imageUrls,
        model: params.adapter.descriptor.model || undefined,
      });
      if (liveResult) {
        editedImages.push({
          ...asset,
          ref: liveResult.imageRef,
          provider: liveResult.provider,
          model: liveResult.model,
          status: "ready",
          fallbackAsset: false,
          sourceRef: asset.ref,
          sourceProvider: asset.provider,
          sourceModel: asset.model,
          meta: {
            ...asset.meta,
            operation: "continuity_post_process",
            adapterMode: "default",
            prompt,
            referenceRef: params.imageEditReferenceRef,
            sourceRef: asset.ref,
            sourceProvider: asset.provider,
            sourceModel: asset.model,
            description: liveResult.description,
            liveApi: true,
          },
        });
        continue;
      }
    }

    const cached = resolveCachedAssetDescriptor({
      namespace: "story.asset.image_edit",
      cachePayload: {
        scenarioId: params.fallback.id,
        segmentIndex: asset.segmentIndex,
        segmentText,
        sourceRef: asset.ref,
        sourceProvider: asset.provider,
        sourceModel: asset.model,
        adapterMode,
        provider: params.adapter.descriptor.provider,
        model: params.adapter.descriptor.model,
        prompt,
        imageEditReferenceRef: params.imageEditReferenceRef,
        simulationMode: asset.meta.simulationMode ?? null,
      },
      create: () => ({
        ref:
          adapterMode === "fallback"
            ? `fallback://story/${params.fallback.id}/segment-${asset.segmentIndex + 1}-image-edit.jpg`
            : buildSimulatedRef({
                kind: "image",
                scenarioId: params.fallback.id,
                segmentIndex: asset.segmentIndex,
                extension: "image-edit.jpg",
              }),
        provider: params.adapter.descriptor.provider,
        model: params.adapter.descriptor.model,
        status: "ready",
        fallbackAsset: adapterMode === "fallback",
        mimeType: asset.mimeType,
        meta: {
          operation: "continuity_post_process",
          adapterMode,
          prompt,
          referenceRef: params.imageEditReferenceRef,
          sourceRef: asset.ref,
          sourceProvider: asset.provider,
          sourceModel: asset.model,
        },
      }),
    });

    editedImages.push({
      ...asset,
      ref: cached.ref,
      provider: cached.provider,
      model: cached.model,
      status: cached.status,
      fallbackAsset: asset.fallbackAsset || cached.fallbackAsset,
      sourceRef: asset.ref,
      sourceProvider: asset.provider,
      sourceModel: asset.model,
      meta: {
        ...asset.meta,
        ...cached.meta,
      },
    });
  }

  return {
    images: editedImages,
    editedAssetCount: editedImages.length,
    edits: editedImages.map((asset) => ({
      segmentIndex: asset.segmentIndex,
      sourceRef: asset.sourceRef,
      editedRef: asset.ref,
      sourceProvider: asset.sourceProvider,
      sourceModel: asset.sourceModel,
      selectedProvider: asset.provider,
      selectedModel: asset.model,
    })),
  };
}

async function createVideoAsset(params: {
  segmentText: string;
  segmentIndex: number;
  fallback: FallbackScenario;
  adapter: VideoCapabilityAdapter;
  config: GeminiConfig;
  simulation: StorySimulationContext | null;
}): Promise<StoryAsset> {
  const prompt = `Video scene for segment ${params.segmentIndex + 1}: ${params.segmentText}`;
  const isLiveGeminiVideo =
    params.adapter.descriptor.mode === "default" &&
    params.adapter.descriptor.provider === "google_cloud" &&
    Boolean(params.config.apiKey);

  if (isLiveGeminiVideo) {
    const liveResult = await fetchGeminiVideo({
      config: params.config,
      prompt,
      model: params.adapter.descriptor.model || undefined,
    });
    if (liveResult) {
      return {
        id: buildAssetId("video", params.segmentIndex),
        kind: "video",
        ref: liveResult.videoRef,
        provider: liveResult.provider,
        model: liveResult.model,
        status: "ready",
        fallbackAsset: false,
        segmentIndex: params.segmentIndex,
        mimeType: liveResult.mimeType,
        jobId: null,
        sourceRef: null,
        sourceProvider: null,
        sourceModel: null,
        meta: {
          prompt,
          adapterMode: "default",
          liveApi: true,
          simulationTrack: params.simulation?.track ?? null,
          simulationMode: params.simulation?.mode ?? null,
          simulationLabel: params.simulation?.label ?? null,
          simulationRole: params.simulation?.role ?? null,
          simulationBusinessUseCase: params.simulation?.businessUseCase ?? null,
          simulationSource: params.simulation?.source ?? null,
          operationName: liveResult.operationName,
          polled: liveResult.polled,
        },
      };
    }
  }

  const adapterMode = params.adapter.descriptor.mode === "simulated" ? "simulated" : "fallback";
  const fallbackRef = pickFallbackRef(params.fallback.videos, params.segmentIndex);
  const cached = resolveCachedAssetDescriptor({
    namespace: "story.asset.video",
    cachePayload: {
      scenarioId: params.fallback.id,
      segmentIndex: params.segmentIndex,
      segmentText: params.segmentText,
      adapterMode,
      provider: params.adapter.descriptor.provider,
      model: params.adapter.descriptor.model,
      fallbackRef,
      simulationMode: params.simulation?.mode ?? null,
    },
    create: () => {
      const fallbackAsset = adapterMode === "fallback" || !fallbackRef ? true : false;
      const ref =
        adapterMode === "fallback"
          ? fallbackRef ??
            buildSimulatedRef({
              kind: "video",
              scenarioId: params.fallback.id,
              segmentIndex: params.segmentIndex,
              extension: "mp4",
            })
          : buildSimulatedRef({
              kind: "video",
              scenarioId: params.fallback.id,
              segmentIndex: params.segmentIndex,
              extension: "mp4",
            });
      const status: StoryAsset["status"] = adapterMode === "fallback" ? "ready" : "pending";
      return {
        ref,
        provider: params.adapter.descriptor.provider,
        model: params.adapter.descriptor.model,
        status,
        fallbackAsset,
        mimeType: "video/mp4",
        meta: {
          prompt,
          adapterMode,
          simulationTrack: params.simulation?.track ?? null,
          simulationMode: params.simulation?.mode ?? null,
          simulationLabel: params.simulation?.label ?? null,
          simulationRole: params.simulation?.role ?? null,
          simulationBusinessUseCase: params.simulation?.businessUseCase ?? null,
          simulationSource: params.simulation?.source ?? null,
          notes: adapterMode === "fallback" ? "pre-generated fallback clip" : "queued for async generation",
        },
      };
    },
  });

  return {
    id: buildAssetId("video", params.segmentIndex),
    kind: "video",
    ref: cached.ref,
    provider: cached.provider,
    model: cached.model,
    status: cached.status,
    fallbackAsset: cached.fallbackAsset,
    segmentIndex: params.segmentIndex,
    mimeType: cached.mimeType,
    jobId: null,
    sourceRef: null,
    sourceProvider: null,
    sourceModel: null,
    meta: cached.meta,
  };
}

async function createNarrationAsset(params: {
  segmentText: string;
  segmentIndex: number;
  voiceStyle: string;
  language: string;
  fallback: FallbackScenario;
  adapter: TtsCapabilityAdapter;
  config: GeminiConfig;
  simulation: StorySimulationContext | null;
}): Promise<StoryAsset> {
  const isLiveGeminiTts =
    params.adapter.descriptor.mode === "default" &&
    params.adapter.descriptor.provider === "gemini_api" &&
    Boolean(params.config.apiKey);
  const isLiveDeepgram = params.adapter.descriptor.mode === "default" && params.adapter.descriptor.provider === "deepgram" && params.config.deepgramApiKey;

  if (isLiveGeminiTts) {
    const liveResult = await fetchGeminiTts({
      config: params.config,
      text: params.segmentText,
      model: params.adapter.descriptor.model || undefined,
      languageCode: normalizeLanguageTag(params.language),
    });
    if (liveResult) {
      return {
        id: buildAssetId("audio", params.segmentIndex),
        kind: "audio",
        ref: liveResult.audioRef,
        provider: liveResult.provider,
        model: liveResult.model,
        status: "ready",
        fallbackAsset: false,
        segmentIndex: params.segmentIndex,
        mimeType: liveResult.mimeType,
        jobId: null,
        sourceRef: null,
        sourceProvider: null,
        sourceModel: null,
        meta: {
          text: params.segmentText,
          voiceStyle: params.voiceStyle,
          adapterMode: "default",
          selectionReason: params.adapter.descriptor.selection?.selectionReason ?? null,
          durationMs: liveResult.durationMs,
          liveApi: true,
          simulationTrack: params.simulation?.track ?? null,
          simulationMode: params.simulation?.mode ?? null,
          simulationLabel: params.simulation?.label ?? null,
          simulationRole: params.simulation?.role ?? null,
          simulationBusinessUseCase: params.simulation?.businessUseCase ?? null,
          simulationSource: params.simulation?.source ?? null,
        },
      };
    }
  }

  if (isLiveDeepgram) {
    const ttsModel = params.adapter.descriptor.model || "aura-2-thalia-en";
    const liveResult = await fetchDeepgramTts({
      config: params.config,
      text: params.segmentText,
      model: ttsModel,
    });
    if (liveResult) {
      return {
        id: buildAssetId("audio", params.segmentIndex),
        kind: "audio",
        ref: liveResult.audioRef,
        provider: liveResult.provider,
        model: liveResult.model,
        status: "ready",
        fallbackAsset: false,
        segmentIndex: params.segmentIndex,
        mimeType: liveResult.mimeType,
        jobId: null,
        sourceRef: null,
        sourceProvider: null,
        sourceModel: null,
        meta: {
          text: params.segmentText,
          voiceStyle: params.voiceStyle,
          adapterMode: "default",
          selectionReason: params.adapter.descriptor.selection?.selectionReason ?? null,
          durationMs: liveResult.durationMs,
          liveApi: true,
          simulationMode: params.simulation?.mode ?? null,
          simulationLabel: params.simulation?.label ?? null,
          simulationSource: params.simulation?.source ?? null,
        },
      };
    }
  }

  const adapterMode = params.adapter.descriptor.mode === "simulated" ? "simulated" : "fallback";
  const fallbackRef = pickFallbackRef(params.fallback.narrations, params.segmentIndex);
  const cached = resolveCachedAssetDescriptor({
    namespace: "story.asset.audio",
    cachePayload: {
      scenarioId: params.fallback.id,
      segmentIndex: params.segmentIndex,
      segmentText: params.segmentText,
      voiceStyle: params.voiceStyle,
      adapterMode,
      provider: params.adapter.descriptor.provider,
      model: params.adapter.descriptor.model,
      fallbackRef,
      simulationMode: params.simulation?.mode ?? null,
    },
    create: () => {
      const fallbackAsset = adapterMode === "fallback" || !fallbackRef ? true : false;
      const ref =
        adapterMode === "fallback"
          ? fallbackRef ??
            buildSimulatedRef({
              kind: "audio",
              scenarioId: params.fallback.id,
              segmentIndex: params.segmentIndex,
              extension: "wav",
            })
          : buildSimulatedRef({
              kind: "audio",
              scenarioId: params.fallback.id,
              segmentIndex: params.segmentIndex,
              extension: "wav",
            });
      return {
        ref,
        provider: params.adapter.descriptor.provider,
        model: params.adapter.descriptor.model,
        status: "ready",
        fallbackAsset,
        mimeType: "audio/wav",
        meta: {
          text: params.segmentText,
          voiceStyle: params.voiceStyle,
          adapterMode,
          selectionReason: params.adapter.descriptor.selection?.selectionReason ?? null,
          simulationTrack: params.simulation?.track ?? null,
          simulationMode: params.simulation?.mode ?? null,
          simulationLabel: params.simulation?.label ?? null,
          simulationRole: params.simulation?.role ?? null,
          simulationBusinessUseCase: params.simulation?.businessUseCase ?? null,
          simulationSource: params.simulation?.source ?? null,
        },
      };
    },
  });

  return {
    id: buildAssetId("audio", params.segmentIndex),
    kind: "audio",
    ref: cached.ref,
    provider: cached.provider,
    model: cached.model,
    status: cached.status,
    fallbackAsset: cached.fallbackAsset,
    segmentIndex: params.segmentIndex,
    mimeType: cached.mimeType,
    jobId: null,
    sourceRef: null,
    sourceProvider: null,
    sourceModel: null,
    meta: cached.meta,
  };
}

function buildTimeline(params: {
  segments: string[];
  images: StoryAsset[];
  videos: StoryAsset[];
  narrations: StoryAsset[];
}): StoryTimelineSegment[] {
  const byKindRef = (kind: StoryAsset["kind"], index: number): string | null => {
    const source = kind === "image" ? params.images : kind === "video" ? params.videos : params.narrations;
    const found = source.find((asset) => asset.segmentIndex === index);
    return found ? found.ref : null;
  };

  const timeline: StoryTimelineSegment[] = [];
  for (let index = 0; index < params.segments.length; index += 1) {
    const videoAsset = params.videos.find((asset) => asset.segmentIndex === index);
    timeline.push({
      index: index + 1,
      text: params.segments[index],
      imageRef: byKindRef("image", index),
      videoRef: byKindRef("video", index),
      videoStatus: videoAsset ? videoAsset.status : null,
      audioRef: byKindRef("audio", index),
    });
  }
  return timeline;
}

function anyFallback(assets: StoryAsset[]): boolean {
  return assets.some((asset) => asset.fallbackAsset);
}

function resolveMediaMode(input: StoryInput, config: GeminiConfig): StoryMediaMode {
  return input.mediaMode ?? config.mediaMode;
}

function resolveVideoFailureRate(input: StoryInput): number {
  if (input.videoFailureRate > 0) {
    return input.videoFailureRate;
  }
  const raw = Number(process.env.STORYTELLER_VIDEO_FAILURE_RATE ?? "0");
  if (!Number.isFinite(raw)) {
    return 0;
  }
  if (raw < 0) {
    return 0;
  }
  if (raw > 1) {
    return 1;
  }
  return raw;
}

function mapJobStatusToAssetStatus(status: StoryMediaJob["status"]): StoryAsset["status"] {
  if (status === "completed") {
    return "ready";
  }
  if (status === "failed") {
    return "failed";
  }
  return "pending";
}

function createVideoMediaJobs(params: {
  request: OrchestratorRequest;
  runId: string;
  videoAssets: StoryAsset[];
  simulation: StorySimulationContext | null;
  mediaMode: "fallback" | "simulated";
  failureRate: number;
}): StoryMediaJob[] {
  const jobs: StoryMediaJob[] = [];
  for (const asset of params.videoAssets) {
    const job = createVideoMediaJob({
      sessionId: params.request.sessionId,
      runId: params.runId,
      assetId: asset.id,
      assetRef: asset.ref,
      segmentIndex: asset.segmentIndex,
      provider: asset.provider,
      model: asset.model,
      mode: params.mediaMode,
      simulationTrack: params.simulation?.track ?? null,
      simulationMode: params.simulation?.mode ?? null,
      simulationLabel: params.simulation?.label ?? null,
      simulationRole: params.simulation?.role ?? null,
      simulationBusinessUseCase: params.simulation?.businessUseCase ?? null,
      simulationSource: params.simulation?.source ?? null,
      failureRate: params.failureRate,
    });
    asset.jobId = job.jobId;
    asset.status = mapJobStatusToAssetStatus(job.status);
    asset.meta = {
      ...asset.meta,
      mediaJobId: job.jobId,
      mediaJobStatus: job.status,
      asyncGeneration: params.mediaMode === "simulated",
    };
    jobs.push(job);
  }
  return jobs;
}

function toNormalizedError(error: unknown, traceId: string): NormalizedError {
  if (error instanceof Error) {
    return {
      code: "STORYTELLER_ERROR",
      message: error.message,
      traceId,
    };
  }
  return {
    code: "STORYTELLER_ERROR",
    message: "Unknown storyteller failure",
    traceId,
  };
}

export async function runStorytellerAgent(
  request: OrchestratorRequest,
): Promise<OrchestratorResponse> {
  const traceId = randomUUID();
  const runId = request.runId ?? request.id;
  const startedAt = Date.now();
  const config = getGeminiConfig();
  const usageTotals = createAgentUsageTotals();
  let effectiveMediaMode: StoryMediaMode = config.mediaMode;
  let capabilities = createStorytellerCapabilitySet(
    config,
    effectiveMediaMode,
    {
      inputLanguage: "en",
      includeImages: true,
      imageEditRequested: false,
    },
    usageTotals,
  );
  const skillsRuntime = await getSkillsRuntimeSnapshot({
    agentId: "storyteller-agent",
  });
  const skillsPrompt = renderSkillsPrompt(skillsRuntime, {
    maxSkills: 4,
    maxChars: 1200,
  });

  try {
    const input = normalizeStoryInput(request.payload.input);
    const imageEditRequested =
      input.imageEditRequested || input.imageEditPrompt !== null || input.imageEditReferenceRef !== null;
    const simulation = buildStorySimulationContext(input);
    effectiveMediaMode = resolveMediaMode(input, config);
    capabilities = createStorytellerCapabilitySet(
      config,
      effectiveMediaMode,
      {
        inputLanguage: input.language,
        includeImages: input.includeImages,
        imageEditRequested,
      },
      usageTotals,
    );
    ensureStoryCachePolicy({
      modelFingerprint: buildStoryCacheFingerprint(config),
      purgeToken: config.cachePurgeToken,
    });
    const videoFailureRate = resolveVideoFailureRate(input);
    const fallbackPack = await loadFallbackPack();
    const fallbackScenario = selectFallbackScenario(fallbackPack, input);

    const plan = await generateStoryPlan(input, fallbackScenario, config, capabilities, skillsPrompt, simulation);
    const branch = await extendStoryBranch({
      input,
      currentSegments: plan.segments,
      fallback: fallbackScenario,
      config,
      capabilities,
      skillsPrompt,
      simulation,
    });

    const finalSegments = branch.segments;
    const baseImageAssets = input.includeImages
      ? await Promise.all(
          finalSegments.map((segmentText, segmentIndex) =>
            createImageAsset({
              segmentText,
              segmentIndex,
              fallback: fallbackScenario,
              adapter: capabilities.image,
              config,
              simulation,
            }),
          ),
        )
      : [];
    const imageEditPass = await applyImageEditPass({
      images: baseImageAssets,
      segments: finalSegments,
      fallback: fallbackScenario,
      adapter: capabilities.imageEdit,
      imageEditPrompt: input.imageEditPrompt,
      imageEditReferenceRef: input.imageEditReferenceRef,
      config,
    });
    const imageAssets = imageEditPass.images;

    const videoAssets = input.includeVideo
      ? await Promise.all(
          finalSegments.map((segmentText, segmentIndex) =>
            createVideoAsset({
              segmentText,
              segmentIndex,
              fallback: fallbackScenario,
              adapter: capabilities.video,
              config,
              simulation,
            }),
          ),
        )
      : [];
    const videoJobs = input.includeVideo && capabilities.video.descriptor.mode !== "default"
      ? createVideoMediaJobs({
          request,
          runId,
          videoAssets,
          simulation,
          mediaMode: capabilities.video.descriptor.mode === "simulated" ? "simulated" : "fallback",
          failureRate: videoFailureRate,
        })
      : [];

    const narrationAssets = await Promise.all(
      finalSegments.map((segmentText, segmentIndex) =>
        createNarrationAsset({
          segmentText,
          segmentIndex,
          voiceStyle: input.voiceStyle,
          language: input.language,
          fallback: fallbackScenario,
          adapter: capabilities.tts,
          config,
          simulation,
        }),
      ),
    );

    const allAssets = [...imageAssets, ...videoAssets, ...narrationAssets];
    const timeline = buildTimeline({
      segments: finalSegments,
      images: imageAssets,
      videos: videoAssets,
      narrations: narrationAssets,
    });

    const fallbackAsset = anyFallback(allAssets);
    const pendingVideoJobs = videoJobs.filter(
      (job) => job.status === "queued" || job.status === "running",
    ).length;
    const simulationMetadata = buildStorySimulationMetadata(simulation, input, timeline.length);
    const message = `${simulationMetadata.active ? `${String(simulationMetadata.label)} ready: ` : "Story ready: "}"${plan.title}" with ${timeline.length} segments (${allAssets.length} media assets).${input.includeVideo ? ` Video jobs pending: ${pendingVideoJobs}.` : ""}`;
    const mediaQueue: StoryMediaWorkerSnapshot = getMediaJobQueueSnapshot();
    const cacheSnapshot: StoryCacheSnapshot = getStoryCacheSnapshot();

    return createEnvelope({
      userId: request.userId,
      sessionId: request.sessionId,
      runId,
      type: "orchestrator.response",
      source: "storyteller-agent",
      payload: {
        route: "storyteller-agent",
        status: "completed",
        traceId,
        output: {
          message,
          handledIntent: request.payload.intent,
          traceId,
          latencyMs: Date.now() - startedAt,
          usage: buildAgentUsagePayload(usageTotals),
          fallbackAsset,
          story: {
            title: plan.title,
            logline: plan.logline,
            audience: input.audience,
            style: input.style,
            language: input.language,
            branchChoice: input.branchChoice,
            decisionPoints: plan.decisionPoints,
            simulation: simulationMetadata,
            timeline,
          },
          assets: allAssets.map((asset) => ({
            id: asset.id,
            segmentIndex: asset.segmentIndex,
            kind: asset.kind,
            ref: asset.ref,
            status: asset.status,
            provider: asset.provider,
            model: asset.model,
            fallbackAsset: asset.fallbackAsset,
            jobId: asset.jobId,
            sourceRef: asset.sourceRef,
            sourceProvider: asset.sourceProvider,
            sourceModel: asset.sourceModel,
          })),
            mediaJobs: {
            video: videoJobs.map((job) => ({
              jobId: job.jobId,
              status: job.status,
              assetId: job.assetId,
              assetRef: job.assetRef,
              segmentIndex: job.segmentIndex,
              provider: job.provider,
              model: job.model,
              mode: job.mode,
              simulationTrack: job.simulationTrack,
              simulationMode: job.simulationMode,
              simulationLabel: job.simulationLabel,
              simulationRole: job.simulationRole,
              simulationBusinessUseCase: job.simulationBusinessUseCase,
              simulationSource: job.simulationSource,
              attempts: job.attempts,
              requestedAt: job.requestedAt,
              startedAt: job.startedAt,
              completedAt: job.completedAt,
              nextAttemptAt: job.nextAttemptAt,
              error: job.error,
              errorCode: job.errorCode,
              maxAttempts: job.maxAttempts,
              retryBudgetRemaining: job.retryBudgetRemaining,
              deadLettered: job.deadLettered,
              lastWorkerId: job.lastWorkerId,
              executionMs: job.executionMs,
            })),
            queue: mediaQueue,
          },
          generation: {
            planner: {
              provider: plan.plannerProvider,
              model: plan.plannerModel,
            },
            branch: {
              provider: branch.branchProvider,
              model: branch.branchModel,
            },
            imageModel: config.imageModel,
            simulation: simulationMetadata,
            imageEdit: {
              requested: capabilities.imageEditSelection.requested,
              applied: capabilities.imageEditSelection.applied && imageEditPass.editedAssetCount > 0,
              defaultProvider: capabilities.imageEditSelection.defaultProvider,
              defaultModel: capabilities.imageEditSelection.defaultModel,
              provider: capabilities.imageEdit.descriptor.provider,
              model: capabilities.imageEdit.descriptor.model,
              mode: capabilities.imageEdit.descriptor.mode,
              selectionReason: capabilities.imageEditSelection.selectionReason,
              referenceRef: input.imageEditReferenceRef,
              prompt: input.imageEditPrompt,
              editedAssetCount: imageEditPass.editedAssetCount,
              edits: imageEditPass.edits,
            },
            videoModel: input.includeVideo ? config.videoModel : null,
            ttsProvider: capabilities.tts.descriptor.provider,
            ttsModel: capabilities.tts.descriptor.model,
            ttsDefaultProvider: capabilities.ttsSelection.defaultProvider,
            ttsDefaultModel: capabilities.ttsSelection.defaultModel,
            ttsSelectionReason: capabilities.ttsSelection.selectionReason,
            ttsSecondaryProvider: capabilities.ttsSelection.secondaryProvider,
            ttsSecondaryModel: capabilities.ttsSelection.secondaryModel,
            mediaMode: effectiveMediaMode,
            videoAsync: input.includeVideo && capabilities.video.descriptor.mode === "simulated",
            videoFailureRate,
            mediaWorkerRuntime: mediaQueue.runtime,
            cache: cacheSnapshot,
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
            fallbackPack: {
              version: fallbackPack.version,
              scenarioId: fallbackScenario.id,
            },
          },
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
      source: "storyteller-agent",
      payload: {
        route: "storyteller-agent",
        status: "failed",
        traceId,
        error: normalizedError,
        output: {
          handledIntent: request.payload.intent,
          usage: buildAgentUsagePayload(usageTotals),
          generation: {
            cache: getStoryCacheSnapshot(),
            capabilityProfile: capabilities.profile,
            skillsRuntime: toSkillsRuntimeSummary(skillsRuntime),
          },
          traceId,
          latencyMs: Date.now() - startedAt,
        },
      },
    });
  }
}

if (process.argv[1]?.endsWith("index.ts")) {
  console.log("[storyteller-agent] ready");
}
