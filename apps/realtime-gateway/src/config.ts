export type LiveApiProtocol = "gemini" | "passthrough";

export type GatewayConfig = {
  port: number;
  orchestratorUrl: string;
  orchestratorTimeoutMs: number;
  orchestratorMaxRetries: number;
  orchestratorRetryBackoffMs: number;
  liveApiEnabled: boolean;
  liveApiWsUrl?: string;
  liveApiApiKey?: string;
  liveApiAuthHeader?: string;
  liveApiProtocol: LiveApiProtocol;
  liveModelId: string;
  liveAudioMimeType: string;
  liveVideoMimeType: string;
  liveAutoSetup: boolean;
  liveConnectRetryMs: number;
  liveConnectMaxAttempts: number;
  liveMaxStaleChunkMs: number;
};

function parseLiveApiProtocol(value: string | undefined): LiveApiProtocol {
  if (value === "passthrough") {
    return "passthrough";
  }
  return "gemini";
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

export function loadGatewayConfig(): GatewayConfig {
  return {
    port: Number(process.env.GATEWAY_PORT ?? 8080),
    orchestratorUrl: process.env.ORCHESTRATOR_URL ?? "http://localhost:8082/orchestrate",
    orchestratorTimeoutMs: parsePositiveInt(process.env.GATEWAY_ORCHESTRATOR_TIMEOUT_MS, 15000),
    orchestratorMaxRetries: parsePositiveInt(process.env.GATEWAY_ORCHESTRATOR_MAX_RETRIES, 1),
    orchestratorRetryBackoffMs: parsePositiveInt(process.env.GATEWAY_ORCHESTRATOR_RETRY_BACKOFF_MS, 300),
    liveApiEnabled: process.env.LIVE_API_ENABLED === "true",
    liveApiWsUrl: process.env.LIVE_API_WS_URL,
    liveApiApiKey: process.env.LIVE_API_API_KEY,
    liveApiAuthHeader: process.env.LIVE_API_AUTH_HEADER,
    liveApiProtocol: parseLiveApiProtocol(process.env.LIVE_API_PROTOCOL),
    liveModelId: process.env.LIVE_MODEL_ID ?? "gemini-live-2.5-flash-native-audio",
    liveAudioMimeType: process.env.LIVE_AUDIO_MIME_TYPE ?? "audio/pcm;rate=16000",
    liveVideoMimeType: process.env.LIVE_VIDEO_MIME_TYPE ?? "image/jpeg",
    liveAutoSetup: process.env.LIVE_AUTO_SETUP !== "false",
    liveConnectRetryMs: parsePositiveInt(process.env.LIVE_CONNECT_RETRY_MS, 500),
    liveConnectMaxAttempts: parsePositiveInt(process.env.LIVE_CONNECT_MAX_ATTEMPTS, 2),
    liveMaxStaleChunkMs: parsePositiveInt(process.env.LIVE_MAX_STALE_CHUNK_MS, 2500),
  };
}
