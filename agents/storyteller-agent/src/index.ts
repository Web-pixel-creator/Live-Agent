import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCapabilityProfile,
  type CapabilityProfile,
  type ImageCapabilityAdapter,
  type ReasoningCapabilityAdapter,
  type TtsCapabilityAdapter,
  type VideoCapabilityAdapter,
} from "@mla/capabilities";
import {
  createEnvelope,
  type NormalizedError,
  type OrchestratorRequest,
  type OrchestratorResponse,
} from "@mla/contracts";

type StoryInput = {
  prompt: string;
  audience: string;
  style: string;
  language: string;
  voiceStyle: string;
  branchChoice: string | null;
  includeImages: boolean;
  includeVideo: boolean;
  segmentCount: number;
};

type StoryPlan = {
  title: string;
  logline: string;
  segments: string[];
  decisionPoints: string[];
  plannerProvider: "gemini" | "fallback";
  plannerModel: string;
};

type StoryAsset = {
  id: string;
  kind: "image" | "video" | "audio";
  ref: string;
  provider: string;
  model: string;
  status: "ready" | "pending";
  fallbackAsset: boolean;
  segmentIndex: number;
  mimeType: string;
  meta: Record<string, unknown>;
};

type StoryTimelineSegment = {
  index: number;
  text: string;
  imageRef: string | null;
  videoRef: string | null;
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
  mediaMode: "fallback" | "simulated";
  imageModel: string;
  videoModel: string;
  ttsModel: string;
};

type StorytellerCapabilitySet = {
  reasoning: ReasoningCapabilityAdapter;
  image: ImageCapabilityAdapter;
  video: VideoCapabilityAdapter;
  tts: TtsCapabilityAdapter;
  profile: CapabilityProfile;
};

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const FALLBACK_PACK_PATH = join(CURRENT_DIR, "..", "fallback", "story-fallback-pack.json");
let cachedFallbackPack: FallbackPack | null = null;

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

function sliceToCount<T>(values: T[], count: number): T[] {
  if (values.length <= count) {
    return values;
  }
  return values.slice(0, count);
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
    branchChoice: toNullableString(raw.branchChoice),
    includeImages: toBoolean(raw.includeImages, true),
    includeVideo: toBoolean(raw.includeVideo, false),
    segmentCount: toIntInRange(raw.segmentCount, 3, 2, 6),
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

function getGeminiConfig(): GeminiConfig {
  return {
    apiKey:
      toNullableString(process.env.STORYTELLER_GEMINI_API_KEY) ?? toNullableString(process.env.GEMINI_API_KEY),
    baseUrl: toNonEmptyString(process.env.GEMINI_API_BASE_URL, "https://generativelanguage.googleapis.com/v1beta"),
    plannerModel: toNonEmptyString(process.env.STORYTELLER_PLANNER_MODEL, "gemini-3-pro"),
    branchModel: toNonEmptyString(process.env.STORYTELLER_BRANCH_MODEL, "gemini-3-flash"),
    timeoutMs: parsePositiveInt(process.env.STORYTELLER_GEMINI_TIMEOUT_MS, 12000),
    plannerEnabled: process.env.STORYTELLER_USE_GEMINI_PLANNER !== "false",
    mediaMode: process.env.STORYTELLER_MEDIA_MODE === "simulated" ? "simulated" : "fallback",
    imageModel: toNonEmptyString(process.env.STORYTELLER_IMAGE_MODEL, "imagen-4"),
    videoModel: toNonEmptyString(process.env.STORYTELLER_VIDEO_MODEL, "veo-3.1"),
    ttsModel: toNonEmptyString(process.env.STORYTELLER_TTS_MODEL, "gemini-tts"),
  };
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
            "fallback://story/generic/scene-1-image.jpg",
            "fallback://story/generic/scene-2-image.jpg",
            "fallback://story/generic/scene-3-image.jpg",
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
    .split(/[^a-z0-9]+/g)
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

  return best ?? pack.scenarios[0];
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
        temperature: params.temperature ?? 0.4,
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

function createStorytellerCapabilitySet(config: GeminiConfig): StorytellerCapabilitySet {
  const reasoning: ReasoningCapabilityAdapter = {
    descriptor: {
      capability: "reasoning",
      adapterId: config.apiKey ? "gemini-story-reasoning" : "fallback-story-reasoning",
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

  const mediaMode: "default" | "fallback" | "simulated" = config.mediaMode === "simulated" ? "simulated" : "fallback";
  const mediaProvider = config.mediaMode === "simulated" ? "simulated" : "google_cloud";

  const image: ImageCapabilityAdapter = {
    descriptor: {
      capability: "image",
      adapterId: config.mediaMode === "simulated" ? "imagen-simulated" : "imagen-fallback-pack",
      provider: mediaProvider,
      model: config.imageModel,
      mode: mediaMode,
    },
  };

  const video: VideoCapabilityAdapter = {
    descriptor: {
      capability: "video",
      adapterId: config.mediaMode === "simulated" ? "veo-simulated" : "veo-fallback-pack",
      provider: mediaProvider,
      model: config.videoModel,
      mode: mediaMode,
    },
  };

  const tts: TtsCapabilityAdapter = {
    descriptor: {
      capability: "tts",
      adapterId: config.mediaMode === "simulated" ? "gemini-tts-simulated" : "gemini-tts-fallback-pack",
      provider: mediaProvider,
      model: config.ttsModel,
      mode: mediaMode,
    },
  };

  return {
    reasoning,
    image,
    video,
    tts,
    profile: buildCapabilityProfile([reasoning, image, video, tts]),
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
): Promise<StoryPlan> {
  if (!config.apiKey || !config.plannerEnabled) {
    return {
      title: fallback.title,
      logline: fallback.logline,
      segments: sliceToCount(fallback.segments, input.segmentCount),
      decisionPoints: fallback.decisionPoints,
      plannerProvider: "fallback",
      plannerModel: "fallback-pack",
    };
  }

  const prompt = [
    "You are a cinematic interactive storyteller.",
    "Create a story plan as strict JSON.",
    "Fields: title, logline, segments (array of strings), decisionPoints (array of strings).",
    `Audience: ${input.audience}`,
    `Style: ${input.style}`,
    `Language: ${input.language}`,
    `Segment count: ${input.segmentCount}`,
    `Prompt: ${input.prompt}`,
  ].join("\n");

  const raw = await capabilities.reasoning.generateText({
    model: config.plannerModel,
    prompt,
    responseMimeType: "application/json",
    temperature: 0.4,
  });

  if (!raw) {
    return {
      title: fallback.title,
      logline: fallback.logline,
      segments: sliceToCount(fallback.segments, input.segmentCount),
      decisionPoints: fallback.decisionPoints,
      plannerProvider: "fallback",
      plannerModel: "fallback-pack",
    };
  }

  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return {
      title: fallback.title,
      logline: fallback.logline,
      segments: sliceToCount(fallback.segments, input.segmentCount),
      decisionPoints: fallback.decisionPoints,
      plannerProvider: "fallback",
      plannerModel: "fallback-pack",
    };
  }

  const segments = Array.isArray(parsed.segments)
    ? parsed.segments.map((value) => toNonEmptyString(value, "")).filter(Boolean)
    : [];
  const decisionPoints = Array.isArray(parsed.decisionPoints)
    ? parsed.decisionPoints.map((value) => toNonEmptyString(value, "")).filter(Boolean)
    : [];

  if (segments.length < 2) {
    return {
      title: fallback.title,
      logline: fallback.logline,
      segments: sliceToCount(fallback.segments, input.segmentCount),
      decisionPoints: fallback.decisionPoints,
      plannerProvider: "fallback",
      plannerModel: "fallback-pack",
    };
  }

  return {
    title: toNonEmptyString(parsed.title, fallback.title),
    logline: toNonEmptyString(parsed.logline, fallback.logline),
    segments: sliceToCount(segments, input.segmentCount),
    decisionPoints: decisionPoints.length > 0 ? decisionPoints : fallback.decisionPoints,
    plannerProvider: "gemini",
    plannerModel: config.plannerModel,
  };
}

async function extendStoryBranch(params: {
  input: StoryInput;
  currentSegments: string[];
  fallback: FallbackScenario;
  config: GeminiConfig;
  capabilities: StorytellerCapabilitySet;
}): Promise<{ segments: string[]; branchProvider: "gemini" | "fallback"; branchModel: string }> {
  const { input, currentSegments, fallback, config, capabilities } = params;
  if (!input.branchChoice) {
    return {
      segments: currentSegments,
      branchProvider: "fallback",
      branchModel: "no-branch-choice",
    };
  }

  if (!config.apiKey || !config.plannerEnabled) {
    const branchLine = `Branch path selected: ${input.branchChoice}. The team adapts and continues toward the objective with higher stakes.`;
    return {
      segments: sliceToCount([...currentSegments, branchLine], input.segmentCount + 1),
      branchProvider: "fallback",
      branchModel: "fallback-branch",
    };
  }

  const prompt = [
    "Continue the interactive story in one concise segment.",
    `Language: ${input.language}`,
    `Branch choice: ${input.branchChoice}`,
    `Existing segments: ${JSON.stringify(currentSegments)}`,
    "Return plain text only, 1-2 sentences.",
  ].join("\n");

  const raw = await capabilities.reasoning.generateText({
    model: config.branchModel,
    prompt,
    responseMimeType: "text/plain",
    temperature: 0.4,
  });

  if (!raw) {
    const fallbackLine = `Branch path selected: ${input.branchChoice}. ${fallback.segments[fallback.segments.length - 1]}`;
    return {
      segments: sliceToCount([...currentSegments, fallbackLine], input.segmentCount + 1),
      branchProvider: "fallback",
      branchModel: "fallback-branch",
    };
  }

  return {
    segments: sliceToCount([...currentSegments, raw], input.segmentCount + 1),
    branchProvider: "gemini",
    branchModel: config.branchModel,
  };
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

function createImageAsset(params: {
  segmentText: string;
  segmentIndex: number;
  fallback: FallbackScenario;
  adapter: ImageCapabilityAdapter;
}): StoryAsset {
  const fallbackRef = pickFallbackRef(params.fallback.images, params.segmentIndex);
  const adapterMode = params.adapter.descriptor.mode === "simulated" ? "simulated" : "fallback";
  const fallbackAsset = adapterMode === "fallback" || !fallbackRef ? true : false;
  const ref =
    adapterMode === "fallback"
      ? fallbackRef ?? buildSimulatedRef({ kind: "image", scenarioId: params.fallback.id, segmentIndex: params.segmentIndex, extension: "jpg" })
      : buildSimulatedRef({ kind: "image", scenarioId: params.fallback.id, segmentIndex: params.segmentIndex, extension: "jpg" });

  return {
    id: buildAssetId("image", params.segmentIndex),
    kind: "image",
    ref,
    provider: params.adapter.descriptor.provider,
    model: params.adapter.descriptor.model,
    status: "ready",
    fallbackAsset,
    segmentIndex: params.segmentIndex,
    mimeType: "image/jpeg",
    meta: {
      prompt: `Illustration for segment ${params.segmentIndex + 1}: ${params.segmentText}`,
      adapterMode,
    },
  };
}

function createVideoAsset(params: {
  segmentText: string;
  segmentIndex: number;
  fallback: FallbackScenario;
  adapter: VideoCapabilityAdapter;
}): StoryAsset {
  const fallbackRef = pickFallbackRef(params.fallback.videos, params.segmentIndex);
  const adapterMode = params.adapter.descriptor.mode === "simulated" ? "simulated" : "fallback";
  const fallbackAsset = adapterMode === "fallback" || !fallbackRef ? true : false;
  const ref =
    adapterMode === "fallback"
      ? fallbackRef ?? buildSimulatedRef({ kind: "video", scenarioId: params.fallback.id, segmentIndex: params.segmentIndex, extension: "mp4" })
      : buildSimulatedRef({ kind: "video", scenarioId: params.fallback.id, segmentIndex: params.segmentIndex, extension: "mp4" });

  return {
    id: buildAssetId("video", params.segmentIndex),
    kind: "video",
    ref,
    provider: params.adapter.descriptor.provider,
    model: params.adapter.descriptor.model,
    status: adapterMode === "fallback" ? "ready" : "pending",
    fallbackAsset,
    segmentIndex: params.segmentIndex,
    mimeType: "video/mp4",
    meta: {
      prompt: `Video scene for segment ${params.segmentIndex + 1}: ${params.segmentText}`,
      adapterMode,
      notes: adapterMode === "fallback" ? "pre-generated fallback clip" : "queued for async generation",
    },
  };
}

function createNarrationAsset(params: {
  segmentText: string;
  segmentIndex: number;
  voiceStyle: string;
  fallback: FallbackScenario;
  adapter: TtsCapabilityAdapter;
}): StoryAsset {
  const fallbackRef = pickFallbackRef(params.fallback.narrations, params.segmentIndex);
  const adapterMode = params.adapter.descriptor.mode === "simulated" ? "simulated" : "fallback";
  const fallbackAsset = adapterMode === "fallback" || !fallbackRef ? true : false;
  const ref =
    adapterMode === "fallback"
      ? fallbackRef ?? buildSimulatedRef({ kind: "audio", scenarioId: params.fallback.id, segmentIndex: params.segmentIndex, extension: "wav" })
      : buildSimulatedRef({ kind: "audio", scenarioId: params.fallback.id, segmentIndex: params.segmentIndex, extension: "wav" });

  return {
    id: buildAssetId("audio", params.segmentIndex),
    kind: "audio",
    ref,
    provider: params.adapter.descriptor.provider,
    model: params.adapter.descriptor.model,
    status: "ready",
    fallbackAsset,
    segmentIndex: params.segmentIndex,
    mimeType: "audio/wav",
    meta: {
      text: params.segmentText,
      voiceStyle: params.voiceStyle,
      adapterMode,
    },
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
    timeline.push({
      index: index + 1,
      text: params.segments[index],
      imageRef: byKindRef("image", index),
      videoRef: byKindRef("video", index),
      audioRef: byKindRef("audio", index),
    });
  }
  return timeline;
}

function anyFallback(assets: StoryAsset[]): boolean {
  return assets.some((asset) => asset.fallbackAsset);
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
  const capabilities = createStorytellerCapabilitySet(config);

  try {
    const input = normalizeStoryInput(request.payload.input);
    const fallbackPack = await loadFallbackPack();
    const fallbackScenario = selectFallbackScenario(fallbackPack, input);

    const plan = await generateStoryPlan(input, fallbackScenario, config, capabilities);
    const branch = await extendStoryBranch({
      input,
      currentSegments: plan.segments,
      fallback: fallbackScenario,
      config,
      capabilities,
    });

    const finalSegments = branch.segments;
    const imageAssets = input.includeImages
      ? finalSegments.map((segmentText, segmentIndex) =>
          createImageAsset({
            segmentText,
            segmentIndex,
            fallback: fallbackScenario,
            adapter: capabilities.image,
          }),
        )
      : [];

    const videoAssets = input.includeVideo
      ? finalSegments.map((segmentText, segmentIndex) =>
          createVideoAsset({
            segmentText,
            segmentIndex,
            fallback: fallbackScenario,
            adapter: capabilities.video,
          }),
        )
      : [];

    const narrationAssets = finalSegments.map((segmentText, segmentIndex) =>
      createNarrationAsset({
        segmentText,
        segmentIndex,
        voiceStyle: input.voiceStyle,
        fallback: fallbackScenario,
        adapter: capabilities.tts,
      }),
    );

    const allAssets = [...imageAssets, ...videoAssets, ...narrationAssets];
    const timeline = buildTimeline({
      segments: finalSegments,
      images: imageAssets,
      videos: videoAssets,
      narrations: narrationAssets,
    });

    const fallbackAsset = anyFallback(allAssets);
    const message = `Story ready: "${plan.title}" with ${timeline.length} segments (${allAssets.length} media assets).`;

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
          fallbackAsset,
          story: {
            title: plan.title,
            logline: plan.logline,
            audience: input.audience,
            style: input.style,
            language: input.language,
            branchChoice: input.branchChoice,
            decisionPoints: plan.decisionPoints,
            timeline,
          },
          assets: allAssets.map((asset) => ({
            kind: asset.kind,
            ref: asset.ref,
            status: asset.status,
            provider: asset.provider,
            model: asset.model,
            fallbackAsset: asset.fallbackAsset,
          })),
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
            videoModel: input.includeVideo ? config.videoModel : null,
            ttsModel: config.ttsModel,
            mediaMode: config.mediaMode,
            capabilityProfile: capabilities.profile,
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
          generation: {
            capabilityProfile: capabilities.profile,
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
