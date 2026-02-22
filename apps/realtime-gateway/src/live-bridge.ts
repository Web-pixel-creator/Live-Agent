import WebSocket from "ws";
import { createEnvelope, type EventEnvelope } from "@mla/contracts";
import type { GatewayConfig, LiveApiProtocol, LiveAuthProfile } from "./config.js";

type SendFn = (event: EventEnvelope) => void;
type LiveModality = "audio" | "video" | "text";

type AuthProfileState = {
  name: string;
  apiKey?: string;
  authHeader?: string;
  lastUsedAtMs: number;
  cooldownUntilMs: number;
  disabledUntilMs: number;
  failureCount: number;
};

type ModelState = {
  modelId: string;
  lastUsedAtMs: number;
  cooldownUntilMs: number;
  disabledUntilMs: number;
  failureCount: number;
};

type FailoverReasonClass = "transient" | "rate_limit" | "auth" | "billing";

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

function parseHeaderSpec(value: string | undefined): { name: string; value: string } | null {
  if (!value) {
    return null;
  }
  const [headerName, ...rest] = value.split(":");
  if (!headerName || rest.length === 0) {
    return null;
  }
  const name = headerName.trim();
  const headerValue = rest.join(":").trim();
  if (name.length === 0 || headerValue.length === 0) {
    return null;
  }
  return {
    name,
    value: headerValue,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyFailoverReason(reason: string): FailoverReasonClass {
  const normalized = reason.trim().toLowerCase();

  if (
    normalized.includes("billing") ||
    normalized.includes("payment") ||
    normalized.includes("insufficient_quota") ||
    normalized.includes("credit") ||
    /\b402\b/.test(normalized)
  ) {
    return "billing";
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("ratelimit") ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("quota exceeded") ||
    /\b429\b/.test(normalized)
  ) {
    return "rate_limit";
  }

  if (
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("invalid api key") ||
    normalized.includes("permission denied") ||
    /\b401\b/.test(normalized) ||
    /\b403\b/.test(normalized)
  ) {
    return "auth";
  }

  return "transient";
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

function buildModelCandidates(config: GatewayConfig): string[] {
  const candidates = [config.liveModelId, ...config.liveModelFallbackIds];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const normalized = candidate.trim();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped.length > 0 ? deduped : [config.liveModelId];
}

function buildModelState(config: GatewayConfig): ModelState[] {
  return buildModelCandidates(config).map((modelId) => ({
    modelId,
    lastUsedAtMs: 0,
    cooldownUntilMs: 0,
    disabledUntilMs: 0,
    failureCount: 0,
  }));
}

function buildAuthProfileState(config: GatewayConfig): AuthProfileState[] {
  const sourceProfiles: LiveAuthProfile[] = config.liveAuthProfiles.length > 0 ? config.liveAuthProfiles : [];
  return sourceProfiles.map((profile, index) => ({
    name: profile.name.length > 0 ? profile.name : `profile-${index + 1}`,
    apiKey: profile.apiKey,
    authHeader: profile.authHeader,
    lastUsedAtMs: 0,
    cooldownUntilMs: 0,
    disabledUntilMs: 0,
    failureCount: 0,
  }));
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
  private readonly modelStates: ModelState[];
  private currentModelIndex = 0;
  private readonly authProfiles: AuthProfileState[];
  private currentAuthProfileIndex = 0;
  private healthTimer: NodeJS.Timeout | null = null;
  private lastUpstreamMessageAtMs = Date.now();
  private healthDegraded = false;
  private healthProbeStartedAtMs: number | null = null;
  private healthProbePongAtMs: number | null = null;

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
    this.modelStates = buildModelState(params.config);
    this.authProfiles = buildAuthProfileState(params.config);
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

  private getModelCandidates(): string[] {
    return this.modelStates.map((state) => state.modelId);
  }

  private getActiveModelState(): ModelState | null {
    return this.modelStates[this.currentModelIndex] ?? null;
  }

  private getActiveModelId(): string {
    return this.getActiveModelState()?.modelId ?? this.config.liveModelId;
  }

  private getActiveAuthProfile(): AuthProfileState | null {
    if (this.authProfiles.length === 0) {
      return null;
    }
    return this.authProfiles[this.currentAuthProfileIndex] ?? this.authProfiles[0];
  }

  private getAuthProfileByIndex(index: number | null): AuthProfileState | null {
    if (this.authProfiles.length === 0 || index === null) {
      return null;
    }
    return this.authProfiles[index] ?? null;
  }

  private getModelReadyAtMs(state: ModelState): number {
    return Math.max(state.cooldownUntilMs, state.disabledUntilMs);
  }

  private getAuthProfileReadyAtMs(state: AuthProfileState | null): number {
    if (!state) {
      return 0;
    }
    return Math.max(state.cooldownUntilMs, state.disabledUntilMs);
  }

  private buildUpstreamHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const profile = this.getActiveAuthProfile();
    const apiKey = profile?.apiKey ?? this.config.liveApiApiKey;
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const authHeader = profile?.authHeader ?? this.config.liveApiAuthHeader;
    const parsedHeader = parseHeaderSpec(authHeader);
    if (parsedHeader) {
      headers[parsedHeader.name] = parsedHeader.value;
    }
    return headers;
  }

  private markActiveRouteSuccess(): void {
    const nowMs = Date.now();
    const model = this.getActiveModelState();
    if (model) {
      model.lastUsedAtMs = nowMs;
      model.failureCount = 0;
      model.cooldownUntilMs = 0;
      model.disabledUntilMs = 0;
    }

    const profile = this.getActiveAuthProfile();
    if (!profile) {
      return;
    }
    profile.lastUsedAtMs = nowMs;
    profile.failureCount = 0;
    profile.cooldownUntilMs = 0;
    profile.disabledUntilMs = 0;
  }

  private markActiveRouteFailure(reason: string): FailoverReasonClass {
    const reasonClass = classifyFailoverReason(reason);
    const nowMs = Date.now();
    const baseCooldownMs = this.config.liveFailoverCooldownMs;
    const rateLimitCooldownMs = Math.max(baseCooldownMs, this.config.liveFailoverRateLimitCooldownMs);
    const profileDisableMs =
      reasonClass === "billing"
        ? this.config.liveFailoverBillingDisableMs
        : reasonClass === "auth"
          ? this.config.liveFailoverAuthDisableMs
          : 0;
    const modelDisableMs = reasonClass === "billing" ? this.config.liveFailoverBillingDisableMs : 0;
    const cooldownMs = reasonClass === "rate_limit" || reasonClass === "billing" ? rateLimitCooldownMs : baseCooldownMs;

    const model = this.getActiveModelState();
    if (model) {
      model.lastUsedAtMs = nowMs;
      model.failureCount += 1;
      model.cooldownUntilMs = Math.max(model.cooldownUntilMs, nowMs + cooldownMs);
      if (modelDisableMs > 0) {
        model.disabledUntilMs = Math.max(model.disabledUntilMs, nowMs + modelDisableMs);
      }
    }

    const profile = this.getActiveAuthProfile();
    if (profile) {
      profile.lastUsedAtMs = nowMs;
      profile.failureCount += 1;
      profile.cooldownUntilMs = Math.max(profile.cooldownUntilMs, nowMs + cooldownMs);
      if (profileDisableMs > 0) {
        profile.disabledUntilMs = Math.max(profile.disabledUntilMs, nowMs + profileDisableMs);
      }

      this.emit("live.bridge.auth_profile_failed", {
        profile: profile.name,
        failureCount: profile.failureCount,
        reasonClass,
        cooldownUntil: new Date(profile.cooldownUntilMs).toISOString(),
        disabledUntil: profile.disabledUntilMs > 0 ? new Date(profile.disabledUntilMs).toISOString() : null,
        reason,
      });
    }

    return reasonClass;
  }

  private decodeRouteIndex(routeIndex: number): { modelIndex: number; authProfileIndex: number | null } {
    const profileSlots = Math.max(1, this.authProfiles.length);
    const modelIndex = Math.floor(routeIndex / profileSlots) % this.modelStates.length;
    const authProfileIndex = this.authProfiles.length > 0 ? routeIndex % profileSlots : null;
    return { modelIndex, authProfileIndex };
  }

  private encodeRouteIndex(modelIndex: number, authProfileIndex: number | null): number {
    const profileSlots = Math.max(1, this.authProfiles.length);
    if (this.authProfiles.length === 0 || authProfileIndex === null) {
      return modelIndex * profileSlots;
    }
    return modelIndex * profileSlots + authProfileIndex;
  }

  private getRouteLastUsedAtMs(modelIndex: number, authProfileIndex: number | null): number {
    const model = this.modelStates[modelIndex];
    if (!model) {
      return 0;
    }
    const profile = this.getAuthProfileByIndex(authProfileIndex);
    return Math.max(model.lastUsedAtMs, profile?.lastUsedAtMs ?? 0);
  }

  private getRouteFailureCount(modelIndex: number, authProfileIndex: number | null): number {
    const model = this.modelStates[modelIndex];
    if (!model) {
      return 0;
    }
    const profile = this.getAuthProfileByIndex(authProfileIndex);
    return model.failureCount + (profile?.failureCount ?? 0);
  }

  private pickNextRouteIndices(): {
    modelIndex: number;
    authProfileIndex: number | null;
    routeReadyAtMs: number;
    selectionStrategy: "ready_lru" | "earliest_ready" | "active_fallback";
  } {
    const profileSlots = Math.max(1, this.authProfiles.length);
    const totalRoutes = Math.max(1, this.modelStates.length * profileSlots);
    const nowMs = Date.now();
    const activeRouteIndex = this.encodeRouteIndex(
      this.currentModelIndex,
      this.authProfiles.length > 0 ? this.currentAuthProfileIndex : null,
    );

    const readyCandidates: Array<{
      routeIndex: number;
      modelIndex: number;
      authProfileIndex: number | null;
      routeReadyAtMs: number;
      routeLastUsedAtMs: number;
      routeFailureCount: number;
    }> = [];
    const pendingCandidates: Array<{
      routeIndex: number;
      modelIndex: number;
      authProfileIndex: number | null;
      routeReadyAtMs: number;
      routeLastUsedAtMs: number;
      routeFailureCount: number;
    }> = [];

    for (let routeIndex = 0; routeIndex < totalRoutes; routeIndex += 1) {
      if (routeIndex === activeRouteIndex) {
        continue;
      }
      const decoded = this.decodeRouteIndex(routeIndex);
      const model = this.modelStates[decoded.modelIndex];
      if (!model) {
        continue;
      }
      const profile = this.getAuthProfileByIndex(decoded.authProfileIndex);
      const routeReadyAtMs = Math.max(this.getModelReadyAtMs(model), this.getAuthProfileReadyAtMs(profile));
      const routeLastUsedAtMs = this.getRouteLastUsedAtMs(decoded.modelIndex, decoded.authProfileIndex);
      const routeFailureCount = this.getRouteFailureCount(decoded.modelIndex, decoded.authProfileIndex);

      if (routeReadyAtMs <= nowMs) {
        readyCandidates.push({
          routeIndex,
          modelIndex: decoded.modelIndex,
          authProfileIndex: decoded.authProfileIndex,
          routeReadyAtMs,
          routeLastUsedAtMs,
          routeFailureCount,
        });
      } else {
        pendingCandidates.push({
          routeIndex,
          modelIndex: decoded.modelIndex,
          authProfileIndex: decoded.authProfileIndex,
          routeReadyAtMs,
          routeLastUsedAtMs,
          routeFailureCount,
        });
      }
    }

    if (readyCandidates.length > 0) {
      readyCandidates.sort((left, right) => {
        if (left.routeFailureCount !== right.routeFailureCount) {
          return left.routeFailureCount - right.routeFailureCount;
        }
        if (left.routeLastUsedAtMs !== right.routeLastUsedAtMs) {
          return left.routeLastUsedAtMs - right.routeLastUsedAtMs;
        }
        return left.routeIndex - right.routeIndex;
      });
      const selected = readyCandidates[0];
      return {
        modelIndex: selected.modelIndex,
        authProfileIndex: selected.authProfileIndex,
        routeReadyAtMs: selected.routeReadyAtMs,
        selectionStrategy: "ready_lru",
      };
    }

    if (pendingCandidates.length > 0) {
      pendingCandidates.sort((left, right) => {
        if (left.routeReadyAtMs !== right.routeReadyAtMs) {
          return left.routeReadyAtMs - right.routeReadyAtMs;
        }
        if (left.routeFailureCount !== right.routeFailureCount) {
          return left.routeFailureCount - right.routeFailureCount;
        }
        if (left.routeLastUsedAtMs !== right.routeLastUsedAtMs) {
          return left.routeLastUsedAtMs - right.routeLastUsedAtMs;
        }
        return left.routeIndex - right.routeIndex;
      });
      const selected = pendingCandidates[0];
      return {
        modelIndex: selected.modelIndex,
        authProfileIndex: selected.authProfileIndex,
        routeReadyAtMs: selected.routeReadyAtMs,
        selectionStrategy: "earliest_ready",
      };
    }

    return {
      modelIndex: this.currentModelIndex,
      authProfileIndex: this.authProfiles.length > 0 ? this.currentAuthProfileIndex : null,
      routeReadyAtMs: nowMs,
      selectionStrategy: "active_fallback",
    };
  }

  private rotateFailover(reason: string, reasonClass: FailoverReasonClass): void {
    const fromModel = this.getActiveModelId();
    const fromProfile = this.getActiveAuthProfile()?.name ?? null;
    const selection = this.pickNextRouteIndices();
    const nextModelState = this.modelStates[selection.modelIndex] ?? null;
    const nextProfile = this.getAuthProfileByIndex(selection.authProfileIndex);
    const previousModelIndex = this.currentModelIndex;
    const previousProfileIndex = this.currentAuthProfileIndex;

    this.currentModelIndex = selection.modelIndex;
    if (this.authProfiles.length > 0 && selection.authProfileIndex !== null) {
      this.currentAuthProfileIndex = selection.authProfileIndex;
    }
    const moved =
      this.currentModelIndex !== previousModelIndex ||
      (this.authProfiles.length > 0 && this.currentAuthProfileIndex !== previousProfileIndex);

    this.emit("live.bridge.failover", {
      reason,
      reasonClass,
      moved,
      from: {
        model: fromModel,
        authProfile: fromProfile,
      },
      to: {
        model: this.getActiveModelId(),
        authProfile: this.getActiveAuthProfile()?.name ?? null,
      },
      selectionStrategy: selection.selectionStrategy,
      routeReadyAt: new Date(selection.routeReadyAtMs).toISOString(),
      routeAvailableNow: selection.routeReadyAtMs <= Date.now(),
      modelCandidates: this.getModelCandidates(),
      modelState: nextModelState
        ? {
            id: nextModelState.modelId,
            cooldownUntil: nextModelState.cooldownUntilMs > 0 ? new Date(nextModelState.cooldownUntilMs).toISOString() : null,
            disabledUntil: nextModelState.disabledUntilMs > 0 ? new Date(nextModelState.disabledUntilMs).toISOString() : null,
            failureCount: nextModelState.failureCount,
          }
        : null,
      authProfileState: nextProfile
        ? {
            name: nextProfile.name,
            cooldownUntil: nextProfile.cooldownUntilMs > 0 ? new Date(nextProfile.cooldownUntilMs).toISOString() : null,
            disabledUntil: nextProfile.disabledUntilMs > 0 ? new Date(nextProfile.disabledUntilMs).toISOString() : null,
            failureCount: nextProfile.failureCount,
          }
        : null,
    });
  }

  private startHealthMonitor(): void {
    this.stopHealthMonitor({ resetDegraded: false });
    this.resetHealthProbeState();
    const intervalMs = Math.max(500, this.config.liveHealthCheckIntervalMs);
    this.healthTimer = setInterval(() => {
      this.evaluateUpstreamHealth();
    }, intervalMs);
  }

  private stopHealthMonitor(params?: { resetDegraded?: boolean }): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    this.resetHealthProbeState();
    if (params?.resetDegraded === true) {
      this.healthDegraded = false;
    }
  }

  private resetHealthProbeState(): void {
    this.healthProbeStartedAtMs = null;
    this.healthProbePongAtMs = null;
  }

  private markUpstreamMessageActivity(): void {
    this.lastUpstreamMessageAtMs = Date.now();
    this.resetHealthProbeState();
    if (this.healthDegraded) {
      this.healthDegraded = false;
      this.emit("live.bridge.health_recovered", {
        at: new Date(this.lastUpstreamMessageAtMs).toISOString(),
      });
    }
  }

  private hasPendingLiveFlow(): boolean {
    return this.pendingRoundTripStartAtMs !== null || this.pendingInterruptAtMs !== null || this.currentTurnStartedAtMs !== null;
  }

  private markUpstreamPongActivity(): void {
    if (this.healthProbeStartedAtMs === null) {
      return;
    }

    const nowMs = Date.now();
    this.healthProbePongAtMs = nowMs;
    this.emit("live.bridge.health_pong", {
      at: new Date(nowMs).toISOString(),
      probeStartedAt: new Date(this.healthProbeStartedAtMs).toISOString(),
      probeLatencyMs: nowMs - this.healthProbeStartedAtMs,
      model: this.getActiveModelId(),
      authProfile: this.getActiveAuthProfile()?.name ?? null,
    });
  }

  private beginHealthProbe(silenceMs: number): void {
    this.healthProbeStartedAtMs = Date.now();
    let pingSent = false;
    let pingError: string | null = null;
    if (this.config.liveHealthPingEnabled && this.upstream && this.upstream.readyState === WebSocket.OPEN) {
      try {
        this.upstream.ping();
        pingSent = true;
        this.emit("live.bridge.health_ping_sent", {
          at: new Date(this.healthProbeStartedAtMs).toISOString(),
          silenceMs,
          thresholdMs: this.config.liveHealthSilenceMs,
          graceMs: this.config.liveHealthProbeGraceMs,
          model: this.getActiveModelId(),
          authProfile: this.getActiveAuthProfile()?.name ?? null,
        });
      } catch (error) {
        pingError = error instanceof Error ? error.message : String(error);
        this.emit("live.bridge.health_ping_error", {
          at: new Date(this.healthProbeStartedAtMs).toISOString(),
          silenceMs,
          thresholdMs: this.config.liveHealthSilenceMs,
          error: pingError,
          model: this.getActiveModelId(),
          authProfile: this.getActiveAuthProfile()?.name ?? null,
        });
      }
    }

    this.emit("live.bridge.health_probe_started", {
      at: new Date(this.healthProbeStartedAtMs).toISOString(),
      reason: "upstream_silence",
      silenceMs,
      thresholdMs: this.config.liveHealthSilenceMs,
      graceMs: this.config.liveHealthProbeGraceMs,
      pingEnabled: this.config.liveHealthPingEnabled,
      pingSent,
      pingError,
      model: this.getActiveModelId(),
      authProfile: this.getActiveAuthProfile()?.name ?? null,
    });
  }

  private evaluateUpstreamHealth(): void {
    if (!this.upstream || this.upstream.readyState !== WebSocket.OPEN) {
      this.resetHealthProbeState();
      return;
    }
    if (!this.hasPendingLiveFlow()) {
      this.resetHealthProbeState();
      return;
    }
    const nowMs = Date.now();
    const silenceMs = nowMs - this.lastUpstreamMessageAtMs;
    if (silenceMs <= this.config.liveHealthSilenceMs) {
      this.resetHealthProbeState();
      return;
    }
    if (!this.healthDegraded) {
      this.healthDegraded = true;
      this.emit("live.bridge.health_degraded", {
        reason: "upstream_silence",
        silenceMs,
        thresholdMs: this.config.liveHealthSilenceMs,
        model: this.getActiveModelId(),
        authProfile: this.getActiveAuthProfile()?.name ?? null,
      });
    }

    if (this.config.liveHealthPingEnabled) {
      if (this.healthProbeStartedAtMs === null) {
        this.beginHealthProbe(silenceMs);
        return;
      }
      const probeElapsedMs = nowMs - this.healthProbeStartedAtMs;
      if (probeElapsedMs < this.config.liveHealthProbeGraceMs) {
        return;
      }
    }

    this.emit("live.bridge.health_watchdog_reconnect", {
      reason: "upstream_silence",
      silenceMs,
      thresholdMs: this.config.liveHealthSilenceMs,
      graceMs: this.config.liveHealthPingEnabled ? this.config.liveHealthProbeGraceMs : 0,
      probeElapsedMs: this.healthProbeStartedAtMs === null ? null : nowMs - this.healthProbeStartedAtMs,
      probeStartedAt:
        this.healthProbeStartedAtMs === null ? null : new Date(this.healthProbeStartedAtMs).toISOString(),
      probePongAt: this.healthProbePongAtMs === null ? null : new Date(this.healthProbePongAtMs).toISOString(),
      model: this.getActiveModelId(),
      authProfile: this.getActiveAuthProfile()?.name ?? null,
    });

    const staleSocket = this.upstream;
    this.upstream = null;
    this.setupSent = false;
    this.connectPromise = null;
    this.resetLiveState();
    this.resetHealthProbeState();
    try {
      staleSocket.close(1011, "health watchdog reconnect");
    } catch {
      // best-effort close for watchdog-triggered reconnect
    }
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
    this.lastUpstreamMessageAtMs = Date.now();
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

  private buildGeminiSetupPayload(payloadOverride?: Record<string, unknown>): Record<string, unknown> {
    const responseModalities = ["TEXT", "AUDIO"];
    const generationConfig: Record<string, unknown> = {
      responseModalities,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: this.config.liveSetupVoiceName,
          },
        },
      },
      realtimeInputConfig: {
        activityHandling: this.config.liveRealtimeActivityHandling,
      },
    };

    if (this.config.liveEnableInputAudioTranscription) {
      generationConfig.inputAudioTranscription = {};
    }
    if (this.config.liveEnableOutputAudioTranscription) {
      generationConfig.outputAudioTranscription = {};
    }

    const baseSetup: Record<string, unknown> = {
      model: this.getActiveModelId(),
      generationConfig,
    };

    if (this.config.liveSystemInstruction) {
      baseSetup.systemInstruction = {
        parts: [{ text: this.config.liveSystemInstruction }],
      };
    }

    const setup = payloadOverride && Object.keys(payloadOverride).length > 0
      ? {
          ...baseSetup,
          ...payloadOverride,
        }
      : baseSetup;

    return { setup };
  }

  private sendGeminiSetup(payloadOverride?: Record<string, unknown>): void {
    const setupPayload = this.buildGeminiSetupPayload(payloadOverride);
    this.sendUpstreamJson(setupPayload);
    this.setupSent = true;
    const responseModalities =
      isRecord(setupPayload.setup) &&
      isRecord(setupPayload.setup.generationConfig) &&
      Array.isArray(setupPayload.setup.generationConfig.responseModalities)
        ? setupPayload.setup.generationConfig.responseModalities
        : ["TEXT", "AUDIO"];
    this.emit("live.bridge.setup_sent", {
      protocol: this.config.liveApiProtocol,
      model: this.getActiveModelId(),
      authProfile: this.getActiveAuthProfile()?.name ?? null,
      responseModalities,
      hasSystemInstruction: Boolean(this.config.liveSystemInstruction),
      activityHandling: this.config.liveRealtimeActivityHandling,
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
      const headers = this.buildUpstreamHeaders();

      const upstream = new WebSocket(wsUrl, { headers });
      this.upstream = upstream;
      this.setupSent = false;
      this.lastUpstreamMessageAtMs = Date.now();
      const isActiveSocket = (): boolean => this.upstream === upstream;
      const connectTimeoutMs = Math.max(250, this.config.liveConnectAttemptTimeoutMs);
      const connectTimeout = setTimeout(() => {
        if (settled) {
          return;
        }
        const timeoutError = new Error(`Live API connect timed out after ${connectTimeoutMs}ms`);
        this.emit("live.bridge.connect_timeout", {
          wsUrl,
          timeoutMs: connectTimeoutMs,
          model: this.getActiveModelId(),
          authProfile: this.getActiveAuthProfile()?.name ?? null,
        });
        try {
          upstream.terminate();
        } catch {
          // best-effort terminate on connect timeout
        }
        this.upstream = null;
        this.connectPromise = null;
        rejectOnce(timeoutError);
      }, connectTimeoutMs);

      let settled = false;
      const resolveOnce = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(connectTimeout);
        resolve();
      };
      const rejectOnce = (error: Error): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(connectTimeout);
        reject(error);
      };

      upstream.on("open", () => {
        if (!isActiveSocket()) {
          try {
            upstream.close(1000, "stale upstream open");
          } catch {
            // best-effort close for stale open event
          }
          rejectOnce(new Error("Live API upstream opened after route was replaced"));
          return;
        }
        this.markActiveRouteSuccess();
        this.markUpstreamMessageActivity();
        this.startHealthMonitor();
        this.emit("live.bridge.connected", {
          wsUrl,
          model: this.getActiveModelId(),
          authProfile: this.getActiveAuthProfile()?.name ?? null,
        });
        if (this.config.liveApiProtocol === "gemini" && this.config.liveAutoSetup) {
          this.sendGeminiSetup();
        }
        resolveOnce();
      });

      upstream.on("message", (raw) => {
        if (!isActiveSocket()) {
          return;
        }
        this.markUpstreamMessageActivity();
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

      upstream.on("pong", () => {
        if (!isActiveSocket()) {
          return;
        }
        this.markUpstreamPongActivity();
      });

      upstream.on("close", (code, reason) => {
        const activeSocket = isActiveSocket();
        const reasonText = reason.toString();
        if (activeSocket) {
          this.stopHealthMonitor({ resetDegraded: false });
          this.emit("live.bridge.closed", {
            code,
            reason: reasonText,
          });
          this.upstream = null;
          this.connectPromise = null;
        }
        if (!settled) {
          rejectOnce(new Error(`Live API upstream closed before ready: ${code} ${reasonText}`));
        }
      });

      upstream.on("error", (error) => {
        if (isActiveSocket()) {
          this.stopHealthMonitor({ resetDegraded: false });
          this.emit("live.bridge.error", {
            error: error.message,
          });
          this.upstream = null;
          this.connectPromise = null;
        }
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
        const reason = error instanceof Error ? error.message : String(error);
        const reasonClass = this.markActiveRouteFailure(reason);
        this.rotateFailover(reason, reasonClass);
        const routeReadyAtMs = Math.max(
          this.getModelReadyAtMs(this.getActiveModelState() ?? this.modelStates[0]),
          this.getAuthProfileReadyAtMs(this.getActiveAuthProfile()),
        );
        const routeWaitMs = Math.max(0, routeReadyAtMs - Date.now());
        const reconnectWaitMs = Math.max(
          this.config.liveConnectRetryMs,
          Math.min(routeWaitMs, this.config.liveConnectRetryMs * 4),
        );
        this.emit("live.bridge.reconnect_attempt", {
          attempt,
          maxAttempts,
          retryMs: reconnectWaitMs,
          error: reason,
          reasonClass,
          model: this.getActiveModelId(),
          authProfile: this.getActiveAuthProfile()?.name ?? null,
          routeReadyAt: new Date(routeReadyAtMs).toISOString(),
          routeWaitMs,
        });

        if (attempt < maxAttempts) {
          if (routeWaitMs > 0) {
            this.emit("live.bridge.reconnect_wait", {
              waitMs: reconnectWaitMs,
              routeWaitMs,
              routeReadyAt: new Date(routeReadyAtMs).toISOString(),
              reasonClass,
              model: this.getActiveModelId(),
              authProfile: this.getActiveAuthProfile()?.name ?? null,
            });
          }
          await sleep(reconnectWaitMs);
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
      const reason = error instanceof Error ? error.message : String(error);
      const classifiedReason = `forward_failure:${reason}`;
      const reasonClass = this.markActiveRouteFailure(classifiedReason);
      this.rotateFailover(classifiedReason, reasonClass);
      this.emit("live.bridge.forward_retry", {
        error: reason,
        reasonClass,
        model: this.getActiveModelId(),
        authProfile: this.getActiveAuthProfile()?.name ?? null,
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
    this.stopHealthMonitor({ resetDegraded: true });
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
