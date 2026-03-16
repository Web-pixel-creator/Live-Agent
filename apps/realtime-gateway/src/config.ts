import {
  parseLiveGatewayAuthProfileConfigs,
  resolveCredentialValueWithProfile,
} from "@mla/skills";

export type LiveApiProtocol = "gemini" | "passthrough";
export type GatewayTransportMode = "websocket" | "webrtc";
export type GatewayWebrtcRolloutStage = "disabled" | "spike" | "shadow" | "canary";

export type LiveAuthProfile = {
  name: string;
  apiKey?: string;
  authHeader?: string;
};

export type TranscriptReplacementRule = {
  source: string;
  target: string;
};

export type GatewayConfig = {
  port: number;
  gatewayTransportMode: GatewayTransportMode;
  gatewayWebrtcRolloutStage: GatewayWebrtcRolloutStage;
  gatewayWebrtcCanaryPercent: number;
  gatewayWebrtcRollbackReady: boolean;
  orchestratorUrl: string;
  orchestratorTimeoutMs: number;
  orchestratorStoryTimeoutMs: number;
  orchestratorMaxRetries: number;
  orchestratorRetryBackoffMs: number;
  liveApiEnabled: boolean;
  liveApiWsUrl?: string;
  liveApiApiKey?: string;
  liveApiAuthHeader?: string;
  liveAuthProfiles: LiveAuthProfile[];
  liveApiProtocol: LiveApiProtocol;
  liveModelId: string;
  liveModelFallbackIds: string[];
  liveTranscriptReplacements: TranscriptReplacementRule[];
  liveAudioMimeType: string;
  liveVideoMimeType: string;
  liveAutoSetup: boolean;
  liveSetupVoiceName: string;
  liveSystemInstruction?: string;
  liveSetupPatch?: Record<string, unknown>;
  liveRealtimeActivityHandling: string;
  liveEnableInputAudioTranscription: boolean;
  liveEnableOutputAudioTranscription: boolean;
  liveConnectAttemptTimeoutMs: number;
  liveConnectRetryMs: number;
  liveConnectMaxAttempts: number;
  liveFailoverCooldownMs: number;
  liveFailoverRateLimitCooldownMs: number;
  liveFailoverAuthDisableMs: number;
  liveFailoverBillingDisableMs: number;
  liveHealthCheckIntervalMs: number;
  liveHealthSilenceMs: number;
  liveHealthPingEnabled: boolean;
  liveHealthProbeGraceMs: number;
  liveMaxStaleChunkMs: number;
};

const DEFAULT_GEMINI_LIVE_API_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

function parseLiveApiProtocol(value: string | undefined): LiveApiProtocol {
  if (value === "passthrough") {
    return "passthrough";
  }
  return "gemini";
}

function parseGatewayTransportMode(value: string | undefined): GatewayTransportMode {
  if (!value) {
    return "websocket";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "webrtc") {
    return "webrtc";
  }
  return "websocket";
}

function parseGatewayWebrtcRolloutStage(value: string | undefined): GatewayWebrtcRolloutStage {
  if (!value) {
    return "spike";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "disabled") {
    return "disabled";
  }
  if (normalized === "shadow") {
    return "shadow";
  }
  if (normalized === "canary") {
    return "canary";
  }
  return "spike";
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

function parsePercentInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed <= 0) {
    return 0;
  }
  if (parsed >= 100) {
    return 100;
  }
  return Math.floor(parsed);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
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

function parseCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseOptionalString(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parseOptionalJsonObject(value: string | undefined): Record<string, unknown> | undefined {
  const normalized = parseOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function resolveLiveApiApiKey(env: NodeJS.ProcessEnv): string | undefined {
  return (
    parseOptionalString(env.LIVE_API_API_KEY) ??
    parseOptionalString(env.LIVE_AGENT_GEMINI_API_KEY) ??
    parseOptionalString(env.GEMINI_API_KEY)
  );
}

function resolveLiveApiWsUrl(env: NodeJS.ProcessEnv, protocol: LiveApiProtocol): string | undefined {
  const explicit = parseOptionalString(env.LIVE_API_WS_URL);
  if (explicit) {
    return explicit;
  }
  if (protocol === "gemini") {
    return DEFAULT_GEMINI_LIVE_API_WS_URL;
  }
  return undefined;
}

function parseTranscriptReplacements(value: string | undefined): TranscriptReplacementRule[] {
  const normalized = parseOptionalString(value);
  if (!normalized) {
    return [];
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    const rules: TranscriptReplacementRule[] = [];

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item !== "object" || item === null) {
          continue;
        }
        const typed = item as { source?: unknown; target?: unknown };
        if (typeof typed.source !== "string" || typeof typed.target !== "string") {
          continue;
        }
        const source = typed.source.trim();
        const target = typed.target.trim();
        if (source.length === 0 || target.length === 0) {
          continue;
        }
        rules.push({ source, target });
      }
    } else if (typeof parsed === "object" && parsed !== null) {
      for (const [sourceRaw, targetRaw] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof targetRaw !== "string") {
          continue;
        }
        const source = sourceRaw.trim();
        const target = targetRaw.trim();
        if (source.length === 0 || target.length === 0) {
          continue;
        }
        rules.push({ source, target });
      }
    }

    const deduped = new Map<string, TranscriptReplacementRule>();
    for (const rule of rules) {
      const dedupeKey = rule.source.toLowerCase();
      if (!deduped.has(dedupeKey)) {
        deduped.set(dedupeKey, rule);
      }
    }

    return Array.from(deduped.values()).sort((left, right) => right.source.length - left.source.length);
  } catch {
    return [];
  }
}

function parseAuthProfilesJson(params: {
  env: NodeJS.ProcessEnv;
  cwd: string;
}): LiveAuthProfile[] {
  const profiles: LiveAuthProfile[] = [];
  for (const profile of parseLiveGatewayAuthProfileConfigs(params.env)) {
    const apiKey = resolveCredentialValueWithProfile({
      namespace: `live.gateway.auth_profiles.${profile.name}.api_key`,
      profileId: profile.apiKeyProfileId,
      directValue: profile.apiKey,
      credentialName: profile.apiKeyCredential,
      env: params.env,
      cwd: params.cwd,
    }).value;
    const authHeader = resolveCredentialValueWithProfile({
      namespace: `live.gateway.auth_profiles.${profile.name}.auth_header`,
      profileId: profile.authHeaderProfileId,
      directValue: profile.authHeader,
      credentialName: profile.authHeaderCredential,
      env: params.env,
      cwd: params.cwd,
    }).value;
    if (!apiKey && !authHeader) {
      continue;
    }
    const normalizedProfile: LiveAuthProfile = {
      name: profile.displayName,
    };
    if (apiKey) {
      normalizedProfile.apiKey = apiKey;
    }
    if (authHeader) {
      normalizedProfile.authHeader = authHeader;
    }
    profiles.push(normalizedProfile);
  }
  return profiles;
}

function buildAuthProfiles(params: {
  primaryApiKey?: string;
  primaryAuthHeader?: string;
  fallbackApiKeys: string[];
  fallbackAuthHeaders: string[];
  jsonProfiles: LiveAuthProfile[];
}): LiveAuthProfile[] {
  const combined: LiveAuthProfile[] = [];

  if (params.primaryApiKey || params.primaryAuthHeader) {
    const primaryProfile: LiveAuthProfile = {
      name: "primary",
    };
    if (params.primaryApiKey) {
      primaryProfile.apiKey = params.primaryApiKey;
    }
    if (params.primaryAuthHeader) {
      primaryProfile.authHeader = params.primaryAuthHeader;
    }
    combined.push(primaryProfile);
  }

  for (let index = 0; index < params.fallbackApiKeys.length; index += 1) {
    const apiKey = params.fallbackApiKeys[index];
    if (!apiKey) {
      continue;
    }
    const fallbackProfile: LiveAuthProfile = {
      name: `fallback-${index + 1}`,
      apiKey,
    };
    const fallbackAuthHeader = params.fallbackAuthHeaders[index];
    if (fallbackAuthHeader) {
      fallbackProfile.authHeader = fallbackAuthHeader;
    }
    combined.push(fallbackProfile);
  }

  combined.push(...params.jsonProfiles);

  const deduped: LiveAuthProfile[] = [];
  const seen = new Set<string>();
  for (const profile of combined) {
    const key = `${profile.apiKey ?? ""}::${profile.authHeader ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(profile);
  }
  return deduped;
}

export function loadGatewayConfig(options?: {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): GatewayConfig {
  const env = options?.env ?? process.env;
  const cwd = options?.cwd ?? process.cwd();
  const liveApiProtocol = parseLiveApiProtocol(env.LIVE_API_PROTOCOL);
  const orchestratorTimeoutMs = parsePositiveInt(env.GATEWAY_ORCHESTRATOR_TIMEOUT_MS, 35000);
  const orchestratorStoryTimeoutMs = parsePositiveInt(
    env.GATEWAY_ORCHESTRATOR_STORY_TIMEOUT_MS,
    Math.max(orchestratorTimeoutMs, 90000),
  );
  const liveApiApiKey = resolveLiveApiApiKey(env);
  const liveApiAuthHeader = parseOptionalString(env.LIVE_API_AUTH_HEADER);
  const liveApiWsUrl = resolveLiveApiWsUrl(env, liveApiProtocol);
  const liveAuthProfiles = buildAuthProfiles({
    primaryApiKey: liveApiApiKey,
    primaryAuthHeader: liveApiAuthHeader,
    fallbackApiKeys: parseCsv(env.LIVE_API_FALLBACK_KEYS),
    fallbackAuthHeaders: parseCsv(env.LIVE_API_FALLBACK_HEADERS),
    jsonProfiles: parseAuthProfilesJson({ env, cwd }),
  });

  return {
    port: Number(env.GATEWAY_PORT ?? 8080),
    gatewayTransportMode: parseGatewayTransportMode(env.GATEWAY_TRANSPORT_MODE),
    gatewayWebrtcRolloutStage: parseGatewayWebrtcRolloutStage(env.GATEWAY_WEBRTC_ROLLOUT_STAGE),
    gatewayWebrtcCanaryPercent: parsePercentInt(env.GATEWAY_WEBRTC_CANARY_PERCENT, 0),
    gatewayWebrtcRollbackReady: parseBoolean(env.GATEWAY_WEBRTC_ROLLBACK_READY, true),
    orchestratorUrl: env.ORCHESTRATOR_URL ?? "http://localhost:8082/orchestrate",
    orchestratorTimeoutMs,
    orchestratorStoryTimeoutMs,
    orchestratorMaxRetries: parsePositiveInt(env.GATEWAY_ORCHESTRATOR_MAX_RETRIES, 1),
    orchestratorRetryBackoffMs: parsePositiveInt(env.GATEWAY_ORCHESTRATOR_RETRY_BACKOFF_MS, 300),
    liveApiEnabled: env.LIVE_API_ENABLED === "true",
    liveApiWsUrl,
    liveApiApiKey,
    liveApiAuthHeader,
    liveAuthProfiles,
    liveApiProtocol,
    liveModelId: env.LIVE_MODEL_ID ?? "gemini-live-2.5-flash-native-audio",
    liveModelFallbackIds: parseCsv(env.LIVE_MODEL_FALLBACK_IDS),
    liveTranscriptReplacements: parseTranscriptReplacements(env.LIVE_TRANSCRIPT_REPLACEMENTS_JSON),
    liveAudioMimeType: env.LIVE_AUDIO_MIME_TYPE ?? "audio/pcm;rate=16000",
    liveVideoMimeType: env.LIVE_VIDEO_MIME_TYPE ?? "image/jpeg",
    liveAutoSetup: env.LIVE_AUTO_SETUP !== "false",
    liveSetupVoiceName: env.LIVE_SETUP_VOICE_NAME ?? "Aoede",
    liveSystemInstruction: parseOptionalString(env.LIVE_SYSTEM_INSTRUCTION),
    liveSetupPatch: parseOptionalJsonObject(env.LIVE_SETUP_PATCH_JSON),
    liveRealtimeActivityHandling: env.LIVE_REALTIME_ACTIVITY_HANDLING ?? "INTERRUPT_AND_RESUME",
    liveEnableInputAudioTranscription: parseBoolean(env.LIVE_ENABLE_INPUT_AUDIO_TRANSCRIPTION, true),
    liveEnableOutputAudioTranscription: parseBoolean(env.LIVE_ENABLE_OUTPUT_AUDIO_TRANSCRIPTION, true),
    liveConnectAttemptTimeoutMs: parsePositiveInt(env.LIVE_CONNECT_ATTEMPT_TIMEOUT_MS, 5000),
    liveConnectRetryMs: parsePositiveInt(env.LIVE_CONNECT_RETRY_MS, 500),
    liveConnectMaxAttempts: parsePositiveInt(env.LIVE_CONNECT_MAX_ATTEMPTS, 2),
    liveFailoverCooldownMs: parsePositiveInt(env.LIVE_FAILOVER_COOLDOWN_MS, 15000),
    liveFailoverRateLimitCooldownMs: parsePositiveInt(env.LIVE_FAILOVER_RATE_LIMIT_COOLDOWN_MS, 30000),
    liveFailoverAuthDisableMs: parsePositiveInt(env.LIVE_FAILOVER_AUTH_DISABLE_MS, 120000),
    liveFailoverBillingDisableMs: parsePositiveInt(env.LIVE_FAILOVER_BILLING_DISABLE_MS, 300000),
    liveHealthCheckIntervalMs: parsePositiveInt(env.LIVE_HEALTH_CHECK_INTERVAL_MS, 2000),
    liveHealthSilenceMs: parsePositiveInt(env.LIVE_HEALTH_SILENCE_MS, 12000),
    liveHealthPingEnabled: parseBoolean(env.LIVE_HEALTH_PING_ENABLED, true),
    liveHealthProbeGraceMs: parsePositiveInt(env.LIVE_HEALTH_PROBE_GRACE_MS, 1500),
    liveMaxStaleChunkMs: parsePositiveInt(env.LIVE_MAX_STALE_CHUNK_MS, 2500),
  };
}
