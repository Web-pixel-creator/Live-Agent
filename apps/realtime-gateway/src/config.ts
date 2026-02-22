export type LiveApiProtocol = "gemini" | "passthrough";
export type GatewayTransportMode = "websocket" | "webrtc";

export type LiveAuthProfile = {
  name: string;
  apiKey?: string;
  authHeader?: string;
};

export type GatewayConfig = {
  port: number;
  gatewayTransportMode: GatewayTransportMode;
  orchestratorUrl: string;
  orchestratorTimeoutMs: number;
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
  liveAudioMimeType: string;
  liveVideoMimeType: string;
  liveAutoSetup: boolean;
  liveSetupVoiceName: string;
  liveSystemInstruction?: string;
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

function parseAuthProfilesJson(value: string | undefined): LiveAuthProfile[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const profiles: LiveAuthProfile[] = [];
    for (let index = 0; index < parsed.length; index += 1) {
      const item = parsed[index];
      if (typeof item !== "object" || item === null) {
        continue;
      }
      const typed = item as {
        name?: unknown;
        apiKey?: unknown;
        authHeader?: unknown;
      };
      const apiKey = typeof typed.apiKey === "string" && typed.apiKey.trim().length > 0 ? typed.apiKey.trim() : undefined;
      const authHeader =
        typeof typed.authHeader === "string" && typed.authHeader.trim().length > 0
          ? typed.authHeader.trim()
          : undefined;
      if (!apiKey && !authHeader) {
        continue;
      }
      const name =
        typeof typed.name === "string" && typed.name.trim().length > 0
          ? typed.name.trim()
          : `json-${index + 1}`;
      profiles.push({
        name,
        apiKey,
        authHeader,
      });
    }
    return profiles;
  } catch {
    return [];
  }
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
    combined.push({
      name: "primary",
      apiKey: params.primaryApiKey,
      authHeader: params.primaryAuthHeader,
    });
  }

  for (let index = 0; index < params.fallbackApiKeys.length; index += 1) {
    const apiKey = params.fallbackApiKeys[index];
    if (!apiKey) {
      continue;
    }
    combined.push({
      name: `fallback-${index + 1}`,
      apiKey,
      authHeader: params.fallbackAuthHeaders[index],
    });
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

export function loadGatewayConfig(): GatewayConfig {
  const liveApiApiKey = parseOptionalString(process.env.LIVE_API_API_KEY);
  const liveApiAuthHeader = parseOptionalString(process.env.LIVE_API_AUTH_HEADER);
  const liveAuthProfiles = buildAuthProfiles({
    primaryApiKey: liveApiApiKey,
    primaryAuthHeader: liveApiAuthHeader,
    fallbackApiKeys: parseCsv(process.env.LIVE_API_FALLBACK_KEYS),
    fallbackAuthHeaders: parseCsv(process.env.LIVE_API_FALLBACK_HEADERS),
    jsonProfiles: parseAuthProfilesJson(process.env.LIVE_API_AUTH_PROFILES_JSON),
  });

  return {
    port: Number(process.env.GATEWAY_PORT ?? 8080),
    gatewayTransportMode: parseGatewayTransportMode(process.env.GATEWAY_TRANSPORT_MODE),
    orchestratorUrl: process.env.ORCHESTRATOR_URL ?? "http://localhost:8082/orchestrate",
    orchestratorTimeoutMs: parsePositiveInt(process.env.GATEWAY_ORCHESTRATOR_TIMEOUT_MS, 15000),
    orchestratorMaxRetries: parsePositiveInt(process.env.GATEWAY_ORCHESTRATOR_MAX_RETRIES, 1),
    orchestratorRetryBackoffMs: parsePositiveInt(process.env.GATEWAY_ORCHESTRATOR_RETRY_BACKOFF_MS, 300),
    liveApiEnabled: process.env.LIVE_API_ENABLED === "true",
    liveApiWsUrl: process.env.LIVE_API_WS_URL,
    liveApiApiKey,
    liveApiAuthHeader,
    liveAuthProfiles,
    liveApiProtocol: parseLiveApiProtocol(process.env.LIVE_API_PROTOCOL),
    liveModelId: process.env.LIVE_MODEL_ID ?? "gemini-live-2.5-flash-native-audio",
    liveModelFallbackIds: parseCsv(process.env.LIVE_MODEL_FALLBACK_IDS),
    liveAudioMimeType: process.env.LIVE_AUDIO_MIME_TYPE ?? "audio/pcm;rate=16000",
    liveVideoMimeType: process.env.LIVE_VIDEO_MIME_TYPE ?? "image/jpeg",
    liveAutoSetup: process.env.LIVE_AUTO_SETUP !== "false",
    liveSetupVoiceName: process.env.LIVE_SETUP_VOICE_NAME ?? "Aoede",
    liveSystemInstruction: parseOptionalString(process.env.LIVE_SYSTEM_INSTRUCTION),
    liveRealtimeActivityHandling: process.env.LIVE_REALTIME_ACTIVITY_HANDLING ?? "INTERRUPT_AND_RESUME",
    liveEnableInputAudioTranscription: parseBoolean(process.env.LIVE_ENABLE_INPUT_AUDIO_TRANSCRIPTION, true),
    liveEnableOutputAudioTranscription: parseBoolean(process.env.LIVE_ENABLE_OUTPUT_AUDIO_TRANSCRIPTION, true),
    liveConnectAttemptTimeoutMs: parsePositiveInt(process.env.LIVE_CONNECT_ATTEMPT_TIMEOUT_MS, 5000),
    liveConnectRetryMs: parsePositiveInt(process.env.LIVE_CONNECT_RETRY_MS, 500),
    liveConnectMaxAttempts: parsePositiveInt(process.env.LIVE_CONNECT_MAX_ATTEMPTS, 2),
    liveFailoverCooldownMs: parsePositiveInt(process.env.LIVE_FAILOVER_COOLDOWN_MS, 15000),
    liveFailoverRateLimitCooldownMs: parsePositiveInt(process.env.LIVE_FAILOVER_RATE_LIMIT_COOLDOWN_MS, 30000),
    liveFailoverAuthDisableMs: parsePositiveInt(process.env.LIVE_FAILOVER_AUTH_DISABLE_MS, 120000),
    liveFailoverBillingDisableMs: parsePositiveInt(process.env.LIVE_FAILOVER_BILLING_DISABLE_MS, 300000),
    liveHealthCheckIntervalMs: parsePositiveInt(process.env.LIVE_HEALTH_CHECK_INTERVAL_MS, 2000),
    liveHealthSilenceMs: parsePositiveInt(process.env.LIVE_HEALTH_SILENCE_MS, 12000),
    liveHealthPingEnabled: parseBoolean(process.env.LIVE_HEALTH_PING_ENABLED, true),
    liveHealthProbeGraceMs: parsePositiveInt(process.env.LIVE_HEALTH_PROBE_GRACE_MS, 1500),
    liveMaxStaleChunkMs: parsePositiveInt(process.env.LIVE_MAX_STALE_CHUNK_MS, 2500),
  };
}
