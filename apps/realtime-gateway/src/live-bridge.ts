import WebSocket from "ws";
import { createEnvelope, type EventEnvelope } from "@mla/contracts";
import type { GatewayConfig, LiveApiProtocol } from "./config.js";

type SendFn = (event: EventEnvelope) => void;
type LiveModality = "audio" | "video" | "text";

function isInterruptedMessage(parsed: unknown, raw: string): boolean {
  if (raw.includes('"interrupted":true')) {
    return true;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return false;
  }
  const maybe = parsed as {
    interrupted?: unknown;
    type?: unknown;
    serverContent?: { interrupted?: unknown };
  };
  if (maybe.interrupted === true) {
    return true;
  }
  if (maybe.serverContent?.interrupted === true) {
    return true;
  }
  if (typeof maybe.type === "string" && maybe.type.toLowerCase().includes("interrupt")) {
    return true;
  }
  return false;
}

function toRawUpstreamPayload(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  if (typeof payload === "object" && payload !== null && "upstream" in payload) {
    const upstream = (payload as { upstream: unknown }).upstream;
    return typeof upstream === "string" ? upstream : JSON.stringify(upstream);
  }
  return JSON.stringify(payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTextPayload(payload: unknown): string | null {
  if (typeof payload === "string") {
    return payload;
  }
  if (!isRecord(payload)) {
    return null;
  }
  if (typeof payload.text === "string") {
    return payload.text;
  }
  if (typeof payload.message === "string") {
    return payload.message;
  }
  if (isRecord(payload.input) && typeof payload.input.text === "string") {
    return payload.input.text;
  }
  return null;
}

function extractChunkBase64(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }
  if (typeof payload.chunkBase64 === "string") {
    return payload.chunkBase64;
  }
  if (typeof payload.audioBase64 === "string") {
    return payload.audioBase64;
  }
  if (typeof payload.base64 === "string") {
    return payload.base64;
  }
  if (typeof payload.data === "string") {
    return payload.data;
  }
  if (isRecord(payload.upstream)) {
    return extractChunkBase64(payload.upstream);
  }
  return null;
}

function extractMimeType(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) {
    return fallback;
  }
  if (typeof payload.mimeType === "string" && payload.mimeType.length > 0) {
    return payload.mimeType;
  }
  return fallback;
}

function parseTimestampMs(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.floor(raw);
  }
  if (typeof raw === "string" && raw.length > 0) {
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber)) {
      return Math.floor(asNumber);
    }
    const asDate = Date.parse(raw);
    if (!Number.isNaN(asDate)) {
      return asDate;
    }
  }
  return null;
}

function extractClientTimestampMs(payload: unknown): number | null {
  if (!isRecord(payload)) {
    return null;
  }
  const direct =
    parseTimestampMs(payload.sentAtMs) ?? parseTimestampMs(payload.timestampMs) ?? parseTimestampMs(payload.sentAt);
  if (direct !== null) {
    return direct;
  }
  if (isRecord(payload.meta)) {
    return (
      parseTimestampMs(payload.meta.sentAtMs) ??
      parseTimestampMs(payload.meta.timestampMs) ??
      parseTimestampMs(payload.meta.sentAt)
    );
  }
  return null;
}

type NormalizedLiveOutput = {
  text?: string;
  audioBase64?: string;
  interrupted?: boolean;
  turnComplete?: boolean;
};

function normalizeGeminiUpstreamMessage(parsed: unknown): NormalizedLiveOutput | null {
  if (!isRecord(parsed)) {
    return null;
  }

  const normalized: NormalizedLiveOutput = {};
  const serverContent = isRecord(parsed.serverContent) ? parsed.serverContent : null;

  if (serverContent && typeof serverContent.interrupted === "boolean") {
    normalized.interrupted = serverContent.interrupted;
  }
  if (typeof parsed.interrupted === "boolean") {
    normalized.interrupted = parsed.interrupted;
  }
  if (serverContent && typeof serverContent.turnComplete === "boolean") {
    normalized.turnComplete = serverContent.turnComplete;
  }

  const modelTurn = serverContent && isRecord(serverContent.modelTurn) ? serverContent.modelTurn : null;
  const parts = modelTurn && Array.isArray(modelTurn.parts) ? modelTurn.parts : [];
  const texts: string[] = [];
  for (const part of parts) {
    if (!isRecord(part)) {
      continue;
    }
    if (typeof part.text === "string") {
      texts.push(part.text);
    }
    if (isRecord(part.inlineData) && typeof part.inlineData.data === "string") {
      const mimeType = typeof part.inlineData.mimeType === "string" ? part.inlineData.mimeType : "";
      if (mimeType.startsWith("audio/")) {
        normalized.audioBase64 = part.inlineData.data;
      }
    }
  }

  if (texts.length > 0) {
    normalized.text = texts.join("\n");
  }
  if (!normalized.text && typeof serverContent?.outputTranscript === "string") {
    normalized.text = serverContent.outputTranscript;
  }

  if (typeof normalized.text === "string" || typeof normalized.audioBase64 === "string") {
    return normalized;
  }
  if (normalized.interrupted === true || normalized.turnComplete === true) {
    return normalized;
  }
  return null;
}

export class LiveApiBridge {
  private upstream: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private readonly config: GatewayConfig;
  private readonly sessionId: string;
  private userId: string;
  private activeRunId: string | null;
  private readonly send: SendFn;
  private setupSent = false;
  private pendingInterruptAtMs: number | null = null;
  private pendingRoundTripStartAtMs: number | null = null;
  private pendingRoundTripSource: LiveModality | null = null;
  private roundTripMeasuredForCurrentTurn = false;
  private currentTurnStartedAtMs: number | null = null;
  private currentTurnTextParts: string[] = [];

  constructor(params: {
    config: GatewayConfig;
    sessionId: string;
    userId: string;
    runId: string;
    send: SendFn;
  }) {
    this.config = params.config;
    this.sessionId = params.sessionId;
    this.userId = params.userId;
    this.activeRunId = params.runId;
    this.send = params.send;
  }

  updateContext(params: { userId?: string; runId?: string | null }): void {
    if (typeof params.userId === "string" && params.userId.trim().length > 0) {
      this.userId = params.userId.trim();
    }
    if (typeof params.runId === "string" && params.runId.trim().length > 0) {
      this.activeRunId = params.runId.trim();
    }
  }

  isConfigured(): boolean {
    return Boolean(this.config.liveApiEnabled && this.config.liveApiWsUrl);
  }

  private emit(type: string, payload: unknown): void {
    this.send(
      createEnvelope({
        userId: this.userId,
        sessionId: this.sessionId,
        runId: this.activeRunId ?? undefined,
        type,
        source: "gateway",
        payload,
      }),
    );
  }

  private sendUpstreamJson(value: unknown): void {
    if (!this.upstream || this.upstream.readyState !== WebSocket.OPEN) {
      throw new Error("Live API upstream is not connected");
    }
    this.upstream.send(JSON.stringify(value));
  }

  private resetTurnAggregation(): void {
    this.currentTurnStartedAtMs = null;
    this.currentTurnTextParts = [];
    this.roundTripMeasuredForCurrentTurn = false;
  }

  private resetLiveState(): void {
    this.resetTurnAggregation();
    this.pendingRoundTripStartAtMs = null;
    this.pendingRoundTripSource = null;
  }

  private markClientTurnStart(source: LiveModality): void {
    if (this.currentTurnStartedAtMs !== null || this.currentTurnTextParts.length > 0) {
      this.resetTurnAggregation();
    }
    this.pendingRoundTripStartAtMs = Date.now();
    this.pendingRoundTripSource = source;
    this.roundTripMeasuredForCurrentTurn = false;
  }

  private emitRoundTripIfNeeded(nowMs: number): void {
    if (this.roundTripMeasuredForCurrentTurn) {
      return;
    }
    if (this.pendingRoundTripStartAtMs === null) {
      return;
    }
    this.roundTripMeasuredForCurrentTurn = true;
    this.emit("live.metrics.round_trip", {
      roundTripMs: nowMs - this.pendingRoundTripStartAtMs,
      source: this.pendingRoundTripSource ?? "unknown",
      measuredAt: new Date(nowMs).toISOString(),
    });
  }

  private maybeDropStaleChunk(payload: unknown, modality: Exclude<LiveModality, "text">): boolean {
    const sentAtMs = extractClientTimestampMs(payload);
    if (sentAtMs === null) {
      return false;
    }
    const ageMs = Date.now() - sentAtMs;
    if (ageMs <= this.config.liveMaxStaleChunkMs) {
      return false;
    }
    this.emit("live.bridge.chunk_dropped", {
      modality,
      reason: "stale_chunk",
      ageMs,
      maxStaleChunkMs: this.config.liveMaxStaleChunkMs,
    });
    return true;
  }

  private emitTurnCompleted(nowMs: number): void {
    const text = this.currentTurnTextParts.join("\n").trim();
    const turnDurationMs = this.currentTurnStartedAtMs === null ? null : nowMs - this.currentTurnStartedAtMs;
    this.emit("live.turn.completed", {
      text: text.length > 0 ? text : null,
      textChars: text.length,
      turnDurationMs,
      completedAt: new Date(nowMs).toISOString(),
    });
  }

  private handleUpstreamInterrupted(upstream: unknown): void {
    const nowMs = Date.now();
    const hadAssistantOutput = this.currentTurnStartedAtMs !== null || this.currentTurnTextParts.length > 0;
    const hadExplicitInterrupt = this.pendingInterruptAtMs !== null;
    let interruptLatencyMs: number | null = null;
    if (this.pendingInterruptAtMs !== null) {
      interruptLatencyMs = nowMs - this.pendingInterruptAtMs;
      this.emit("live.metrics.interrupt_latency", {
        interruptLatencyMs,
        measuredAt: new Date(nowMs).toISOString(),
      });
    }
    this.pendingInterruptAtMs = null;
    this.resetLiveState();

    if (!hadAssistantOutput && !hadExplicitInterrupt) {
      return;
    }

    this.emit("live.interrupted", {
      reason: "upstream interrupted event",
      interruptLatencyMs,
      upstream,
    });
  }

  private observeNormalizedOutput(normalized: NormalizedLiveOutput): void {
    const nowMs = Date.now();
    const hasOutput = typeof normalized.text === "string" || typeof normalized.audioBase64 === "string";
    if (hasOutput) {
      if (this.currentTurnStartedAtMs === null) {
        this.currentTurnStartedAtMs = nowMs;
      }
      if (typeof normalized.text === "string") {
        this.currentTurnTextParts.push(normalized.text);
      }
      this.emitRoundTripIfNeeded(nowMs);
    }
    if (normalized.turnComplete === true) {
      this.emitTurnCompleted(nowMs);
      this.resetLiveState();
    }
  }

  private sendGeminiSetup(payloadOverride?: Record<string, unknown>): void {
    const responseModalities = ["TEXT", "AUDIO"];
    const setupPayload: Record<string, unknown> = {
      setup: {
        model: this.config.liveModelId,
        generationConfig: {
          responseModalities,
        },
      },
    };

    if (payloadOverride && Object.keys(payloadOverride).length > 0) {
      setupPayload.setup = {
        ...(setupPayload.setup as Record<string, unknown>),
        ...payloadOverride,
      };
    }

    this.sendUpstreamJson(setupPayload);
    this.setupSent = true;
    this.emit("live.bridge.setup_sent", {
      protocol: this.config.liveApiProtocol,
      model: this.config.liveModelId,
      responseModalities,
    });
  }

  private ensureSetupSent(): void {
    if (this.config.liveApiProtocol !== "gemini") {
      return;
    }
    if (!this.setupSent && this.config.liveAutoSetup) {
      this.sendGeminiSetup();
    }
  }

  private sendGeminiMediaChunk(payload: unknown, modality: Exclude<LiveModality, "text">): void {
    if (this.maybeDropStaleChunk(payload, modality)) {
      return;
    }

    const base64 = extractChunkBase64(payload);
    if (!base64) {
      this.emit("live.bridge.error", {
        error: `Missing base64 chunk for live.${modality}`,
      });
      return;
    }

    const mimeType =
      modality === "audio"
        ? extractMimeType(payload, this.config.liveAudioMimeType)
        : extractMimeType(payload, this.config.liveVideoMimeType);

    this.markClientTurnStart(modality);
    this.sendUpstreamJson({
      realtimeInput: {
        mediaChunks: [{ mimeType, data: base64 }],
      },
    });
  }

  private sendGeminiText(payload: unknown): void {
    const text = extractTextPayload(payload);
    if (!text) {
      this.emit("live.bridge.error", {
        error: "Missing text payload for live.text",
      });
      return;
    }
    this.markClientTurnStart("text");
    this.sendUpstreamJson({
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    });
  }

  private sendGeminiTurnEnd(payload: unknown): void {
    const reason = isRecord(payload) && typeof payload.reason === "string" ? payload.reason : "client_turn_end";
    this.sendUpstreamJson({
      realtimeInput: {
        activityEnd: true,
      },
    });
    this.emit("live.turn.end_sent", {
      reason,
    });
  }

  private sendGeminiInterrupt(payload: unknown): void {
    const reason = isRecord(payload) && typeof payload.reason === "string" ? payload.reason : "user_interrupt";
    this.pendingInterruptAtMs = Date.now();
    this.sendUpstreamJson({
      realtimeInput: {
        activityEnd: true,
      },
    });
    this.emit("live.interrupt.requested", {
      reason,
      requestedAt: new Date().toISOString(),
    });
  }

  private forwardGemini(event: EventEnvelope): void {
    this.ensureSetupSent();

    switch (event.type) {
      case "live.setup": {
        const override = isRecord(event.payload) ? event.payload : undefined;
        this.sendGeminiSetup(override);
        return;
      }
      case "live.audio": {
        this.sendGeminiMediaChunk(event.payload, "audio");
        return;
      }
      case "live.video": {
        this.sendGeminiMediaChunk(event.payload, "video");
        return;
      }
      case "live.text": {
        this.sendGeminiText(event.payload);
        return;
      }
      case "live.turn.end": {
        this.sendGeminiTurnEnd(event.payload);
        return;
      }
      case "live.interrupt": {
        this.sendGeminiInterrupt(event.payload);
        return;
      }
      default: {
        const raw = toRawUpstreamPayload(event.payload);
        this.upstream?.send(raw);
      }
    }
  }

  private forwardPassthrough(event: EventEnvelope): void {
    const raw = toRawUpstreamPayload(event.payload);
    this.upstream?.send(raw);
  }

  private forwardByProtocol(protocol: LiveApiProtocol, event: EventEnvelope): void {
    if (protocol === "passthrough") {
      this.forwardPassthrough(event);
      return;
    }
    this.forwardGemini(event);
  }

  private async ensureConnected(): Promise<void> {
    if (this.upstream && this.upstream.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    const wsUrl = this.config.liveApiWsUrl;
    if (!wsUrl) {
      throw new Error("LIVE_API_WS_URL is not configured");
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const headers: Record<string, string> = {};
      if (this.config.liveApiApiKey) {
        headers.Authorization = `Bearer ${this.config.liveApiApiKey}`;
      }
      if (this.config.liveApiAuthHeader) {
        const [headerName, ...rest] = this.config.liveApiAuthHeader.split(":");
        if (headerName && rest.length > 0) {
          headers[headerName.trim()] = rest.join(":").trim();
        }
      }

      const upstream = new WebSocket(wsUrl, { headers });
      this.upstream = upstream;
      this.setupSent = false;

      let settled = false;
      const resolveOnce = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };
      const rejectOnce = (error: Error): void => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      };

      upstream.on("open", () => {
        this.emit("live.bridge.connected", { wsUrl });
        if (this.config.liveApiProtocol === "gemini" && this.config.liveAutoSetup) {
          this.sendGeminiSetup();
        }
        resolveOnce();
      });

      upstream.on("message", (raw) => {
        const text = raw.toString("utf8");
        let parsed: unknown = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // keep raw string payload when upstream frame is not JSON
        }

        let normalized: NormalizedLiveOutput | null = null;
        if (this.config.liveApiProtocol === "gemini") {
          normalized = normalizeGeminiUpstreamMessage(parsed);
          if (normalized) {
            this.observeNormalizedOutput(normalized);
            this.emit("live.output", {
              upstream: parsed,
              normalized,
            });
          } else {
            this.emit("live.output", { upstream: parsed });
          }
        } else {
          this.emit("live.output", { upstream: parsed });
        }

        const interrupted = normalized?.interrupted === true || isInterruptedMessage(parsed, text);
        if (interrupted) {
          this.handleUpstreamInterrupted(parsed);
        }
      });

      upstream.on("close", (code, reason) => {
        const reasonText = reason.toString();
        this.emit("live.bridge.closed", {
          code,
          reason: reasonText,
        });
        this.upstream = null;
        this.connectPromise = null;
        if (!settled) {
          rejectOnce(new Error(`Live API upstream closed before ready: ${code} ${reasonText}`));
        }
      });

      upstream.on("error", (error) => {
        this.emit("live.bridge.error", {
          error: error.message,
        });
        this.upstream = null;
        this.connectPromise = null;
        rejectOnce(error);
      });
    });

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async ensureConnectedWithRetry(): Promise<void> {
    const maxAttempts = Math.max(1, this.config.liveConnectMaxAttempts);
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.ensureConnected();
        return;
      } catch (error) {
        lastError = error;
        this.emit("live.bridge.reconnect_attempt", {
          attempt,
          maxAttempts,
          retryMs: this.config.liveConnectRetryMs,
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempt < maxAttempts) {
          await sleep(this.config.liveConnectRetryMs);
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Live API connect failed");
  }

  async forwardFromClient(event: EventEnvelope): Promise<void> {
    this.updateContext({
      userId: event.userId,
      runId: event.runId ?? null,
    });

    if (!this.isConfigured()) {
      this.emit("live.bridge.unavailable", {
        error: "Live API bridge is disabled or missing LIVE_API_WS_URL",
      });
      return;
    }

    await this.ensureConnectedWithRetry();

    if (!this.upstream || this.upstream.readyState !== WebSocket.OPEN) {
      throw new Error("Live API upstream is not connected");
    }

    try {
      this.forwardByProtocol(this.config.liveApiProtocol, event);
    } catch (error) {
      this.emit("live.bridge.forward_retry", {
        error: error instanceof Error ? error.message : String(error),
      });

      this.upstream = null;
      this.connectPromise = null;
      await this.ensureConnectedWithRetry();
      this.forwardByProtocol(this.config.liveApiProtocol, event);
    }
  }

  close(): void {
    this.resetLiveState();
    this.pendingInterruptAtMs = null;
    if (!this.upstream) {
      return;
    }
    try {
      this.upstream.close(1000, "client disconnected");
    } finally {
      this.upstream = null;
      this.connectPromise = null;
    }
  }
}
