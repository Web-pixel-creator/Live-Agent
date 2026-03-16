import { GenerateVideosOperation, GoogleGenAI, Modality } from "@google/genai";
import type { ReasoningTextResult, ReasoningTextUsage } from "./types.js";

type GoogleGenAiBaseRequest = {
  apiKey: string;
  baseUrl?: string | null;
  apiVersion?: string | null;
  timeoutMs?: number;
};

export type GoogleGenAiTextRequest = GoogleGenAiBaseRequest & {
  model: string;
  prompt: string;
  responseMimeType?: "application/json" | "text/plain";
  temperature?: number;
};

export type GoogleGenAiSpeechRequest = GoogleGenAiBaseRequest & {
  model: string;
  text: string;
  temperature?: number;
  languageCode?: string | null;
  voiceName?: string | null;
};

export type GoogleGenAiSpeechResult = {
  audioData: string;
  mimeType: string;
  usage?: ReasoningTextUsage;
};

export type GoogleGenAiImageRequest = GoogleGenAiBaseRequest & {
  model: string;
  prompt: string;
  numberOfImages?: number;
  outputMimeType?: string;
  aspectRatio?: string;
};

export type GoogleGenAiImageResult = {
  imageRef: string;
  mimeType: string;
};

export type GoogleGenAiVideoRequest = GoogleGenAiBaseRequest & {
  model: string;
  prompt: string;
  numberOfVideos?: number;
  aspectRatio?: string;
  durationSeconds?: number;
  fps?: number;
  resolution?: string;
  negativePrompt?: string | null;
  seed?: number;
  generateAudio?: boolean;
};

export type GoogleGenAiVideoOperationResult = {
  operationName: string;
  done: boolean;
  videoRef: string | null;
  mimeType: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  raw: Record<string, unknown>;
};

type InlineDataCarrier = {
  mimeType?: unknown;
  data?: unknown;
};

const clientCache = new Map<string, GoogleGenAI>();
const DEFAULT_API_VERSION = "v1beta";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function trimToNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeModelName(value: string): string {
  return value.trim().replace(/^models\//i, "");
}

function isImagenModel(value: string): boolean {
  return normalizeModelName(value).startsWith("imagen-");
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const trimmed = trimToNull(value);
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/(v1(?:alpha|beta)?)\/?$/i, "").replace(/\/+$/g, "");
}

function extractApiVersionFromBaseUrl(value: string | null | undefined): string | null {
  const trimmed = trimToNull(value);
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/\/(v1(?:alpha|beta)?)\/?$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function resolveApiVersion(params: { apiVersion?: string | null; baseUrl?: string | null }): string {
  return (
    trimToNull(params.apiVersion)?.toLowerCase() ??
    extractApiVersionFromBaseUrl(params.baseUrl) ??
    DEFAULT_API_VERSION
  );
}

function getClient(params: GoogleGenAiBaseRequest): GoogleGenAI {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  const apiVersion = resolveApiVersion(params);
  const timeoutMs = typeof params.timeoutMs === "number" && Number.isFinite(params.timeoutMs)
    ? Math.max(1, Math.floor(params.timeoutMs))
    : undefined;
  const cacheKey = [params.apiKey, baseUrl ?? "default", apiVersion, timeoutMs ?? "default"].join("|");
  const cached = clientCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const client = new GoogleGenAI({
    apiKey: params.apiKey,
    httpOptions: {
      ...(baseUrl ? { baseUrl } : {}),
      apiVersion,
      ...(timeoutMs ? { timeout: timeoutMs } : {}),
    },
  });
  clientCache.set(cacheKey, client);
  return client;
}

function toNonNegativeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : null;
}

function toUsageMetadata(value: unknown): ReasoningTextUsage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const inputTokens = toNonNegativeInt(value.promptTokenCount);
  const outputTokens = toNonNegativeInt(value.candidatesTokenCount);
  const totalTokens = toNonNegativeInt(value.totalTokenCount);
  if (inputTokens === null && outputTokens === null && totalTokens === null) {
    return undefined;
  }
  return {
    inputTokens: inputTokens ?? undefined,
    outputTokens: outputTokens ?? undefined,
    totalTokens: totalTokens ?? undefined,
    raw: value,
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function extractInlineDataParts(value: unknown): InlineDataCarrier[] {
  if (!isRecord(value) || !Array.isArray(value.candidates)) {
    return [];
  }
  const parts: InlineDataCarrier[] = [];
  for (const candidate of value.candidates) {
    if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
      continue;
    }
    for (const part of candidate.content.parts) {
      if (!isRecord(part) || !isRecord(part.inlineData)) {
        continue;
      }
      parts.push(part.inlineData);
    }
  }
  return parts;
}

function toGoogleGenAiVideoOperationResult(
  operation: unknown,
): GoogleGenAiVideoOperationResult | null {
  if (!isRecord(operation)) {
    return null;
  }

  const operationName = trimToNull(typeof operation.name === "string" ? operation.name : null);
  if (!operationName) {
    return null;
  }

  const response = isRecord(operation.response) ? operation.response : null;
  const generatedVideos = response && Array.isArray(response.generatedVideos) ? response.generatedVideos : [];
  let videoRef: string | null = null;
  let mimeType: string | null = null;

  for (const candidate of generatedVideos) {
    if (!isRecord(candidate) || !isRecord(candidate.video)) {
      continue;
    }
    const video = candidate.video;
    mimeType = trimToNull(typeof video.mimeType === "string" ? video.mimeType : null) ?? "video/mp4";
    const uri = trimToNull(typeof video.uri === "string" ? video.uri : null);
    if (uri) {
      videoRef = uri;
      break;
    }
    const videoBytes = trimToNull(typeof video.videoBytes === "string" ? video.videoBytes : null);
    if (videoBytes) {
      videoRef = `data:${mimeType};base64,${videoBytes}`;
      break;
    }
  }

  const error = isRecord(operation.error) ? operation.error : null;
  return {
    operationName,
    done: operation.done === true,
    videoRef,
    mimeType,
    errorCode: trimToNull(typeof error?.code === "string" ? error.code : typeof error?.status === "string" ? error.status : null),
    errorMessage: trimToNull(typeof error?.message === "string" ? error.message : null),
    raw: toRecord(operation),
  };
}

export async function generateGoogleGenAiText(
  params: GoogleGenAiTextRequest,
): Promise<ReasoningTextResult | null> {
  try {
    const client = getClient(params);
    const response = await client.models.generateContent({
      model: params.model,
      contents: params.prompt,
      config: {
        ...(params.responseMimeType ? { responseMimeType: params.responseMimeType } : {}),
        ...(typeof params.temperature === "number" ? { temperature: params.temperature } : {}),
      },
    });
    const text = typeof response.text === "string" ? response.text.trim() : "";
    if (!text) {
      return null;
    }
    return {
      text,
      usage: toUsageMetadata(response.usageMetadata),
    };
  } catch (error) {
    console.error(
      `[google-genai] generateContent failed for model ${params.model}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

export async function generateGoogleGenAiSpeech(
  params: GoogleGenAiSpeechRequest,
): Promise<GoogleGenAiSpeechResult | null> {
  try {
    const client = getClient(params);
    const response = await client.models.generateContent({
      model: params.model,
      contents: params.text,
      config: {
        responseModalities: [Modality.AUDIO],
        ...(typeof params.temperature === "number" ? { temperature: params.temperature } : {}),
        ...((trimToNull(params.languageCode) || trimToNull(params.voiceName))
          ? {
              speechConfig: {
                ...(trimToNull(params.languageCode) ? { languageCode: trimToNull(params.languageCode)! } : {}),
                ...(trimToNull(params.voiceName)
                  ? {
                      voiceConfig: {
                        prebuiltVoiceConfig: {
                          voiceName: trimToNull(params.voiceName)!,
                        },
                      },
                    }
                  : {}),
              },
            }
          : {}),
      },
    });
    const audioData = typeof response.data === "string" ? response.data.trim() : "";
    if (!audioData) {
      return null;
    }
    const mimeType = extractInlineDataParts(response).find(
      (part) => typeof part.mimeType === "string" && part.mimeType.trim().length > 0,
    )?.mimeType as string | undefined;
    return {
      audioData,
      mimeType: mimeType ?? "audio/wav",
      usage: toUsageMetadata(response.usageMetadata),
    };
  } catch {
    return null;
  }
}

export async function generateGoogleGenAiImage(
  params: GoogleGenAiImageRequest,
): Promise<GoogleGenAiImageResult | null> {
  try {
    const client = getClient(params);
    if (isImagenModel(params.model)) {
      const response = await client.models.generateImages({
        model: params.model,
        prompt: params.prompt,
        config: {
          numberOfImages: Math.max(1, Math.min(4, params.numberOfImages ?? 1)),
          ...(trimToNull(params.outputMimeType) ? { outputMimeType: trimToNull(params.outputMimeType)! } : {}),
          ...(trimToNull(params.aspectRatio) ? { aspectRatio: trimToNull(params.aspectRatio)! } : {}),
        },
      });
      const generated = response.generatedImages?.find((item) => item.image);
      const image = generated?.image;
      if (!image) {
        return null;
      }
      const mimeType = trimToNull(image.mimeType) ?? "image/png";
      if (trimToNull(image.gcsUri)) {
        return {
          imageRef: trimToNull(image.gcsUri)!,
          mimeType,
        };
      }
      if (trimToNull(image.imageBytes)) {
        return {
          imageRef: `data:${mimeType};base64,${trimToNull(image.imageBytes)!}`,
          mimeType,
        };
      }
      return null;
    }

    const response = await client.models.generateContent({
      model: params.model,
      contents: params.prompt,
    });
    const imagePart = extractInlineDataParts(response).find(
      (part) => typeof part.mimeType === "string" && part.mimeType.startsWith("image/") && typeof part.data === "string",
    );
    if (!imagePart || typeof imagePart.data !== "string") {
      return null;
    }
    const mimeType = typeof imagePart.mimeType === "string" ? imagePart.mimeType : "image/png";
    return {
      imageRef: `data:${mimeType};base64,${imagePart.data}`,
      mimeType,
    };
  } catch {
    return null;
  }
}

export async function startGoogleGenAiVideoOperation(
  params: GoogleGenAiVideoRequest,
): Promise<GoogleGenAiVideoOperationResult | null> {
  try {
    const client = getClient(params);
    const operation = await client.models.generateVideos({
      model: params.model,
      prompt: params.prompt,
      config: {
        numberOfVideos: Math.max(1, Math.min(4, params.numberOfVideos ?? 1)),
        ...(trimToNull(params.aspectRatio) ? { aspectRatio: trimToNull(params.aspectRatio)! } : {}),
        ...(typeof params.durationSeconds === "number" && Number.isFinite(params.durationSeconds)
          ? { durationSeconds: Math.max(1, Math.floor(params.durationSeconds)) }
          : {}),
        ...(typeof params.fps === "number" && Number.isFinite(params.fps)
          ? { fps: Math.max(1, Math.floor(params.fps)) }
          : {}),
        ...(trimToNull(params.resolution) ? { resolution: trimToNull(params.resolution)! } : {}),
        ...(trimToNull(params.negativePrompt) ? { negativePrompt: trimToNull(params.negativePrompt)! } : {}),
        ...(typeof params.seed === "number" && Number.isFinite(params.seed) ? { seed: Math.floor(params.seed) } : {}),
        ...(typeof params.generateAudio === "boolean" ? { generateAudio: params.generateAudio } : {}),
      },
    });
    return toGoogleGenAiVideoOperationResult(operation);
  } catch {
    return null;
  }
}

export async function pollGoogleGenAiVideoOperation(
  params: GoogleGenAiBaseRequest & {
    operationName: string;
  },
): Promise<GoogleGenAiVideoOperationResult | null> {
  try {
    const client = getClient(params);
    const operation = new GenerateVideosOperation();
    operation.name = params.operationName;
    const updated = await client.operations.getVideosOperation({ operation });
    return toGoogleGenAiVideoOperationResult(updated);
  } catch {
    return null;
  }
}

export function resetGoogleGenAiClientCacheForTests(): void {
  clientCache.clear();
}
