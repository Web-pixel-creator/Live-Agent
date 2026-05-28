import { randomUUID } from "node:crypto";
import { GoogleGenAI, Modality } from "@google/genai";
import {
  LIVE_CONNECTION_MODES,
  type LiveCapabilitiesSnapshot,
  type LiveConnectionMode,
  type LiveRuntimeStatus,
  type LiveSessionTokenRequest,
  type LiveSessionTokenResponse,
} from "@mla/contracts";

const DEFAULT_LIVE_PROVIDER = "gemini_live_api";
const DEFAULT_LIVE_MODEL_ID = "gemini-3.1-flash-live-preview";
const DEFAULT_LIVE_DIRECT_TOKEN_TTL_SECONDS = 300;
const DEFAULT_LIVE_DIRECT_TOKEN_USES = 1;

const GEMINI_LIVE_API_KEY_ENV_KEYS = [
  "LIVE_API_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENAI_API_KEY",
  "LIVE_AGENT_GEMINI_API_KEY",
  "STORYTELLER_GEMINI_API_KEY",
  "UI_NAVIGATOR_GEMINI_API_KEY",
] as const;

const GEMINI_BASE_URL_ENV_KEYS = [
  "GOOGLE_GENAI_BASE_URL",
  "GEMINI_API_BASE_URL",
] as const;

const ORCHESTRATOR_INTENTS = [
  "conversation",
  "translation",
  "negotiation",
  "research",
  "story",
  "ui_task",
] as const;

type RuntimeLiveEphemeralToken = {
  name?: string | null;
};

type RuntimeLiveEphemeralTokenCreator = (params: {
  apiKey: string;
  apiVersion: string;
  baseUrl: string | null;
  request: LiveSessionTokenRequest;
  model: string;
  expireTime: string;
  uses: number;
  inputAudioTranscriptionEnabled: boolean;
  outputAudioTranscriptionEnabled: boolean;
}) => Promise<RuntimeLiveEphemeralToken>;

type RuntimeLiveStatusContext = {
  env: NodeJS.ProcessEnv;
  provider: string;
  model: string;
  liveProtocol: string;
  liveApiEnabled: boolean;
  relayAvailable: boolean;
  directModeEnabled: boolean;
  ephemeralTokensEnabled: boolean;
  directSupported: boolean;
  preferredMode: LiveConnectionMode;
};

type NormalizeLiveSessionTokenRequestResult =
  | {
      ok: true;
      value: LiveSessionTokenRequest;
    }
  | {
      ok: false;
      code: string;
      message: string;
      details?: unknown;
    };

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return null;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.max(1, Math.floor(parsed));
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const trimmed = toNonEmptyString(value);
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/(v1(?:alpha|beta)?)\/?$/i, "").replace(/\/+$/g, "");
}

function resolveRuntimeLiveApiKey(env: NodeJS.ProcessEnv): string | null {
  for (const key of GEMINI_LIVE_API_KEY_ENV_KEYS) {
    const candidate = toNonEmptyString(env[key]);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function resolveRuntimeLiveBaseUrl(env: NodeJS.ProcessEnv): string | null {
  for (const key of GEMINI_BASE_URL_ENV_KEYS) {
    const candidate = normalizeBaseUrl(env[key]);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function resolveRuntimeLiveProtocol(env: NodeJS.ProcessEnv): string {
  return toNonEmptyString(env.LIVE_API_PROTOCOL)?.toLowerCase() ?? "gemini";
}

function resolveRuntimeLiveProvider(env: NodeJS.ProcessEnv): string {
  return resolveRuntimeLiveProtocol(env) === "gemini" ? DEFAULT_LIVE_PROVIDER : "live_api";
}

function resolveRuntimeLiveModel(env: NodeJS.ProcessEnv): string {
  return toNonEmptyString(env.LIVE_MODEL_ID) ?? DEFAULT_LIVE_MODEL_ID;
}

function resolveRuntimeLivePreferredMode(env: NodeJS.ProcessEnv): LiveConnectionMode {
  return toNonEmptyString(env.LIVE_DIRECT_MODE_DEFAULT)?.toLowerCase() === "direct_live"
    ? "direct_live"
    : "relay";
}

function isValidLiveConnectionMode(value: unknown): value is LiveConnectionMode {
  return typeof value === "string" && (LIVE_CONNECTION_MODES as readonly string[]).includes(value);
}

function buildRuntimeLiveStatusContext(params?: {
  env?: NodeJS.ProcessEnv;
  liveGatewayAuthConfigured?: boolean;
}): RuntimeLiveStatusContext {
  const env = params?.env ?? process.env;
  const liveGatewayAuthConfigured = params?.liveGatewayAuthConfigured === true;
  const liveProtocol = resolveRuntimeLiveProtocol(env);
  const liveApiEnabled = toBoolean(env.LIVE_API_ENABLED) === true;
  const relayAvailable = liveApiEnabled && (liveProtocol !== "gemini" || resolveRuntimeLiveApiKey(env) !== null || liveGatewayAuthConfigured);
  const directModeEnabled = toBoolean(env.LIVE_DIRECT_MODE_ENABLED) === true;
  const ephemeralTokensEnabled = toBoolean(env.LIVE_EPHEMERAL_TOKENS_ENABLED) === true;
  const directSupported =
    liveApiEnabled &&
    liveProtocol === "gemini" &&
    directModeEnabled &&
    ephemeralTokensEnabled &&
    resolveRuntimeLiveApiKey(env) !== null;

  return {
    env,
    provider: resolveRuntimeLiveProvider(env),
    model: resolveRuntimeLiveModel(env),
    liveProtocol,
    liveApiEnabled,
    relayAvailable,
    directModeEnabled,
    ephemeralTokensEnabled,
    directSupported,
    preferredMode: resolveRuntimeLivePreferredMode(env),
  };
}

function buildRuntimeLiveFallbackReason(
  context: RuntimeLiveStatusContext,
  requestedMode: LiveConnectionMode,
): string | null {
  if (requestedMode !== "direct_live") {
    return null;
  }
  if (!context.directModeEnabled) {
    return "live direct mode is disabled";
  }
  if (!context.liveApiEnabled) {
    return "live api bridge is disabled";
  }
  if (context.liveProtocol !== "gemini") {
    return `live direct mode requires gemini protocol, got ${context.liveProtocol}`;
  }
  if (!context.ephemeralTokensEnabled) {
    return "ephemeral live session tokens are disabled";
  }
  if (resolveRuntimeLiveApiKey(context.env) === null) {
    return "gemini api key is missing for direct live token issuance";
  }
  return null;
}

function buildRuntimeLiveWarnings(
  context: RuntimeLiveStatusContext,
  requestedMode: LiveConnectionMode,
): string[] {
  const fallbackReason = buildRuntimeLiveFallbackReason(context, requestedMode);
  return fallbackReason ? [fallbackReason] : [];
}

function buildRuntimeLiveResponseModalities(request: LiveSessionTokenRequest): Modality[] {
  if (request.audio === false && request.video !== true && request.screen !== true) {
    return [Modality.TEXT];
  }
  return [Modality.AUDIO];
}

function computeRuntimeLiveExpiry(now: Date, ttlSeconds: number): string {
  return new Date(now.getTime() + ttlSeconds * 1000).toISOString();
}

async function createGoogleLiveEphemeralToken(params: {
  apiKey: string;
  apiVersion: string;
  baseUrl: string | null;
  request: LiveSessionTokenRequest;
  model: string;
  expireTime: string;
  uses: number;
  inputAudioTranscriptionEnabled: boolean;
  outputAudioTranscriptionEnabled: boolean;
}): Promise<RuntimeLiveEphemeralToken> {
  const client = new GoogleGenAI({
    apiKey: params.apiKey,
    httpOptions: {
      apiVersion: params.apiVersion,
      ...(params.baseUrl ? { baseUrl: params.baseUrl } : {}),
    },
  });

  return client.authTokens.create({
    config: {
      expireTime: params.expireTime,
      newSessionExpireTime: params.expireTime,
      uses: params.uses,
      liveConnectConstraints: {
        model: params.model,
        config: {
          responseModalities: buildRuntimeLiveResponseModalities(params.request),
          ...(params.inputAudioTranscriptionEnabled ? { inputAudioTranscription: {} } : {}),
          ...(params.outputAudioTranscriptionEnabled ? { outputAudioTranscription: {} } : {}),
        },
      },
      lockAdditionalFields: [],
    },
  });
}

export function buildRuntimeLiveCapabilitiesSnapshot(params?: {
  env?: NodeJS.ProcessEnv;
  liveGatewayAuthConfigured?: boolean;
}): LiveCapabilitiesSnapshot {
  const context = buildRuntimeLiveStatusContext(params);
  return {
    audioInput: context.relayAvailable,
    audioOutput: context.relayAvailable,
    videoInput: context.directSupported,
    screenInput: context.directSupported,
    toolCalls: context.relayAvailable,
    interruptions: context.relayAvailable,
    translation: context.relayAvailable,
    reconnectSupported: context.relayAvailable,
  };
}

export function buildRuntimeLiveStatusSnapshot(params?: {
  env?: NodeJS.ProcessEnv;
  liveGatewayAuthConfigured?: boolean;
  requestedMode?: LiveConnectionMode | null;
}): LiveRuntimeStatus {
  const context = buildRuntimeLiveStatusContext(params);
  const requestedMode = params?.requestedMode ?? context.preferredMode;
  const activeMode = requestedMode === "direct_live" && context.directSupported ? "direct_live" : "relay";
  const fallbackReason = activeMode === requestedMode ? null : buildRuntimeLiveFallbackReason(context, requestedMode);
  return {
    preferredMode: context.preferredMode,
    activeMode,
    provider: context.liveApiEnabled ? context.provider : null,
    model: context.liveApiEnabled ? context.model : null,
    ephemeralTokensSupported: context.directSupported,
    fallbackAvailable: context.relayAvailable,
    lastFallbackReason: fallbackReason,
    capabilities: buildRuntimeLiveCapabilitiesSnapshot(params),
  };
}

export function normalizeRuntimeLiveSessionTokenRequest(
  value: Record<string, unknown>,
): NormalizeLiveSessionTokenRequestResult {
  const preferredModeRaw = value.preferredMode;
  if (preferredModeRaw !== undefined && preferredModeRaw !== null && !isValidLiveConnectionMode(preferredModeRaw)) {
    return {
      ok: false,
      code: "API_RUNTIME_LIVE_SESSION_TOKEN_INVALID_REQUEST",
      message: "preferredMode must be relay or direct_live",
      details: {
        field: "preferredMode",
        allowedValues: LIVE_CONNECTION_MODES,
      },
    };
  }

  const intentRaw = value.intent;
  if (
    intentRaw !== undefined &&
    intentRaw !== null &&
    (typeof intentRaw !== "string" || !(ORCHESTRATOR_INTENTS as readonly string[]).includes(intentRaw))
  ) {
    return {
      ok: false,
      code: "API_RUNTIME_LIVE_SESSION_TOKEN_INVALID_REQUEST",
      message: "intent must be a supported orchestrator intent",
      details: {
        field: "intent",
        allowedValues: ORCHESTRATOR_INTENTS,
      },
    };
  }

  for (const field of ["audio", "video", "screen", "toolsRequired"] as const) {
    const candidate = value[field];
    if (candidate !== undefined && candidate !== null && typeof candidate !== "boolean") {
      return {
        ok: false,
        code: "API_RUNTIME_LIVE_SESSION_TOKEN_INVALID_REQUEST",
        message: `${field} must be a boolean when provided`,
        details: {
          field,
        },
      };
    }
  }

  return {
    ok: true,
    value: {
      preferredMode: preferredModeRaw ?? undefined,
      intent: intentRaw as LiveSessionTokenRequest["intent"],
      audio: typeof value.audio === "boolean" ? value.audio : undefined,
      video: typeof value.video === "boolean" ? value.video : undefined,
      screen: typeof value.screen === "boolean" ? value.screen : undefined,
      toolsRequired: typeof value.toolsRequired === "boolean" ? value.toolsRequired : undefined,
    },
  };
}

export async function issueRuntimeLiveSessionToken(params: {
  env?: NodeJS.ProcessEnv;
  liveGatewayAuthConfigured?: boolean;
  request: LiveSessionTokenRequest;
  now?: Date;
  createEphemeralToken?: RuntimeLiveEphemeralTokenCreator;
}): Promise<LiveSessionTokenResponse> {
  const env = params.env ?? process.env;
  const requestedMode = params.request.preferredMode ?? resolveRuntimeLivePreferredMode(env);
  const status = buildRuntimeLiveStatusSnapshot({
    env,
    liveGatewayAuthConfigured: params.liveGatewayAuthConfigured,
    requestedMode,
  });
  const now = params.now ?? new Date();
  const sessionId = randomUUID();
  const warnings = buildRuntimeLiveWarnings(
    buildRuntimeLiveStatusContext({
      env,
      liveGatewayAuthConfigured: params.liveGatewayAuthConfigured,
    }),
    requestedMode,
  );

  if (status.activeMode !== "direct_live") {
    return {
      provider: resolveRuntimeLiveProvider(env),
      model: resolveRuntimeLiveModel(env),
      connectionMode: "relay",
      expiresAt: null,
      sessionToken: null,
      sessionId,
      capabilities: status.capabilities,
      fallbackMode: requestedMode === "direct_live" ? "relay" : null,
      warnings,
    };
  }

  const apiKey = resolveRuntimeLiveApiKey(env);
  const createEphemeralToken = params.createEphemeralToken ?? createGoogleLiveEphemeralToken;
  const expireTime = computeRuntimeLiveExpiry(
    now,
    toPositiveInt(env.LIVE_DIRECT_TOKEN_TTL_SECONDS, DEFAULT_LIVE_DIRECT_TOKEN_TTL_SECONDS),
  );

  try {
    const token = await createEphemeralToken({
      apiKey: apiKey ?? "",
      apiVersion: "v1alpha",
      baseUrl: resolveRuntimeLiveBaseUrl(env),
      request: params.request,
      model: resolveRuntimeLiveModel(env),
      expireTime,
      uses: DEFAULT_LIVE_DIRECT_TOKEN_USES,
      inputAudioTranscriptionEnabled: toBoolean(env.LIVE_ENABLE_INPUT_AUDIO_TRANSCRIPTION) !== false,
      outputAudioTranscriptionEnabled: toBoolean(env.LIVE_ENABLE_OUTPUT_AUDIO_TRANSCRIPTION) !== false,
    });
    const sessionToken = toNonEmptyString(token.name);
    if (!sessionToken) {
      return {
        provider: resolveRuntimeLiveProvider(env),
        model: resolveRuntimeLiveModel(env),
        connectionMode: "relay",
        expiresAt: null,
        sessionToken: null,
        sessionId,
        capabilities: status.capabilities,
        fallbackMode: "relay",
        warnings: [
          ...warnings,
          "direct live token issuance returned an empty token; falling back to relay",
        ],
      };
    }
    return {
      provider: resolveRuntimeLiveProvider(env),
      model: resolveRuntimeLiveModel(env),
      connectionMode: "direct_live",
      expiresAt: expireTime,
      sessionToken,
      sessionId,
      capabilities: status.capabilities,
      fallbackMode: null,
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown token issuance failure";
    return {
      provider: resolveRuntimeLiveProvider(env),
      model: resolveRuntimeLiveModel(env),
      connectionMode: "relay",
      expiresAt: null,
      sessionToken: null,
      sessionId,
      capabilities: status.capabilities,
      fallbackMode: "relay",
      warnings: [
        ...warnings,
        `direct live token issuance failed: ${message}`,
      ],
    };
  }
}
