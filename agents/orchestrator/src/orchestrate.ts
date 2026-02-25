import { createHash, randomUUID } from "node:crypto";
import {
  createEnvelope,
  createNormalizedError,
  type OrchestratorIntent,
  type OrchestratorRequest,
  type OrchestratorResponse,
} from "@mla/contracts";
import { runLiveAgent } from "@mla/live-agent";
import { runStorytellerAgent } from "@mla/storyteller-agent";
import { runUiNavigatorAgent } from "@mla/ui-navigator-agent";
import { resolveAssistiveRoute, type AssistiveRoutingDecision } from "./assistive-router.js";
import { routeIntent } from "./router.js";
import { persistEvent } from "./services/firestore.js";

type CachedOrchestrationResult = {
  response: OrchestratorResponse;
  fingerprint: string;
  expiresAtMs: number;
};

type InFlightOrchestrationEntry = {
  fingerprint: string;
  execution: Promise<OrchestratorResponse>;
};

const inFlightOrchestration = new Map<string, InFlightOrchestrationEntry>();
const completedOrchestration = new Map<string, CachedOrchestrationResult>();
const ORCHESTRATOR_IDEMPOTENCY_TTL_MS = parsePositiveInt(process.env.ORCHESTRATOR_IDEMPOTENCY_TTL_MS, 120_000);

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function ensureRunId(request: OrchestratorRequest): OrchestratorRequest {
  if (request.runId) {
    return request;
  }
  return {
    ...request,
    runId: request.id,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function sanitizeIdempotencyToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 128);
}

function extractRequestIdempotencyKey(request: OrchestratorRequest): string {
  const payloadCandidate = request.payload as unknown;
  const payload = isRecord(payloadCandidate) ? payloadCandidate : null;
  const keyFromPayload = payload
    ? toNonEmptyString(payload.idempotencyKey) ??
      (isRecord(payload.meta) ? toNonEmptyString(payload.meta.idempotencyKey) : null) ??
      (isRecord(payload.input) ? toNonEmptyString(payload.input.idempotencyKey) : null)
    : null;
  const fallback =
    keyFromPayload ?? toNonEmptyString(request.runId) ?? toNonEmptyString(request.id) ?? randomUUID();
  return sanitizeIdempotencyToken(fallback);
}

function buildOrchestrationKey(request: OrchestratorRequest): string {
  const runId = toNonEmptyString(request.runId) ?? request.id;
  const intent = request.payload.intent;
  const conversation = request.conversation === "none" ? "none" : "default";
  const key = extractRequestIdempotencyKey(request);
  return `${request.sessionId}:${runId}:${intent}:${conversation}:${key}`;
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function buildOrchestrationFingerprint(request: OrchestratorRequest): string {
  const payload: Record<string, unknown> = isRecord(request.payload) ? request.payload : {};
  const canonical = {
    sessionId: request.sessionId,
    userId: toNonEmptyString(request.userId),
    runId: toNonEmptyString(request.runId) ?? request.id,
    conversation: request.conversation === "none" ? "none" : "default",
    intent: toNonEmptyString(payload.intent),
    input: isRecord(payload.input) || Array.isArray(payload.input) ? payload.input : payload.input ?? null,
  };
  return createHash("sha256").update(stableSerialize(canonical)).digest("hex");
}

function cleanupOrchestrationCache(nowMs = Date.now()): void {
  for (const [key, entry] of completedOrchestration.entries()) {
    if (entry.expiresAtMs <= nowMs) {
      completedOrchestration.delete(key);
    }
  }
}

function cloneResponse(response: OrchestratorResponse): OrchestratorResponse {
  return JSON.parse(JSON.stringify(response)) as OrchestratorResponse;
}

function buildIdempotencyConflictResponse(params: {
  request: OrchestratorRequest;
  key: string;
  cachedFingerprint: string;
  receivedFingerprint: string;
}): OrchestratorResponse {
  const normalizedError = createNormalizedError({
    code: "ORCHESTRATOR_IDEMPOTENCY_CONFLICT",
    message: "request identity conflict for idempotency key",
    details: {
      key: params.key,
      cachedFingerprint: params.cachedFingerprint,
      receivedFingerprint: params.receivedFingerprint,
    },
  });

  return createEnvelope({
    userId: params.request.userId,
    sessionId: params.request.sessionId,
    runId: params.request.runId ?? params.request.id,
    type: "orchestrator.response",
    source: "orchestrator",
    payload: {
      route: routeIntent(params.request.payload.intent),
      status: "failed",
      output: {
        idempotencyConflict: true,
        key: params.key,
      },
      traceId: normalizedError.traceId,
      error: normalizedError,
    },
  }) as OrchestratorResponse;
}

type TaskContext = {
  taskId: string;
};

type TaskStatus = "running" | "pending_approval" | "completed" | "failed";

function extractTaskContext(request: OrchestratorRequest): TaskContext | null {
  if (!isRecord(request.payload) || !isRecord(request.payload.task)) {
    return null;
  }
  if (typeof request.payload.task.taskId !== "string") {
    return null;
  }
  const taskId = request.payload.task.taskId.trim();
  if (taskId.length === 0) {
    return null;
  }
  return { taskId };
}

function extractApprovalRequired(response: OrchestratorResponse): boolean {
  if (!isRecord(response.payload) || !isRecord(response.payload.output)) {
    return false;
  }
  return response.payload.output.approvalRequired === true;
}

async function persistTaskStatus(params: {
  request: OrchestratorRequest;
  response?: OrchestratorResponse;
  taskId: string;
  status: TaskStatus;
  stage: string;
  error?: unknown;
}): Promise<void> {
  const route = params.response?.payload.route ?? null;
  const event = createEnvelope({
    userId: params.request.userId,
    sessionId: params.request.sessionId,
    runId: params.request.runId,
    type: "task.status",
    source: "orchestrator",
    payload: {
      taskId: params.taskId,
      runId: params.request.runId ?? null,
      intent: params.request.payload.intent,
      route,
      status: params.status,
      stage: params.stage,
      error: params.error ?? null,
      updatedAt: new Date().toISOString(),
    },
  });
  await persistEvent(event);
}

type DelegationRequest = {
  intent: "story" | "ui_task";
  input: unknown;
  reason: string;
};

function extractDelegationRequest(response: OrchestratorResponse): DelegationRequest | null {
  if (response.payload.route !== "live-agent") {
    return null;
  }
  if (response.payload.status !== "completed") {
    return null;
  }
  const output = response.payload.output;
  if (!isRecord(output) || !isRecord(output.delegationRequest)) {
    return null;
  }

  const intent = output.delegationRequest.intent;
  if (intent !== "story" && intent !== "ui_task") {
    return null;
  }

  return {
    intent,
    input: output.delegationRequest.input,
    reason:
      typeof output.delegationRequest.reason === "string"
        ? output.delegationRequest.reason
        : "Delegated by live-agent",
  };
}

async function runByRoute(
  route: "live-agent" | "storyteller-agent" | "ui-navigator-agent",
  request: OrchestratorRequest,
): Promise<OrchestratorResponse> {
  switch (route) {
    case "live-agent":
      return runLiveAgent(request);
    case "storyteller-agent":
      return runStorytellerAgent(request);
    case "ui-navigator-agent":
      return runUiNavigatorAgent(request);
    default:
      return runLiveAgent(request);
  }
}

function mergeDelegationResult(
  primary: OrchestratorResponse,
  delegated: OrchestratorResponse,
  delegation: DelegationRequest,
  delegatedRoute: "live-agent" | "storyteller-agent" | "ui-navigator-agent",
): OrchestratorResponse {
  const primaryOutput = isRecord(primary.payload.output) ? primary.payload.output : {};
  const mergedStatus = delegated.payload.status === "failed" ? "failed" : primary.payload.status;

  const merged: OrchestratorResponse = {
    ...primary,
    payload: {
      ...primary.payload,
      status: mergedStatus,
      output: {
        ...primaryOutput,
        delegation: {
          requestedIntent: delegation.intent,
          requestedRoute: delegatedRoute,
          reason: delegation.reason,
          delegatedRunId: delegated.runId ?? null,
          delegatedStatus: delegated.payload.status,
          delegatedRoute: delegated.payload.route,
          delegatedOutput: delegated.payload.output ?? null,
          delegatedError: delegated.payload.error ?? null,
        },
      },
    },
  };

  if (mergedStatus === "failed" && !merged.payload.error && delegated.payload.error) {
    merged.payload.error = delegated.payload.error;
  }

  return merged;
}

function withRoutingMetadata(
  response: OrchestratorResponse,
  routing: AssistiveRoutingDecision,
): OrchestratorResponse {
  const output = isRecord(response.payload.output)
    ? response.payload.output
    : {
        value: response.payload.output ?? null,
      };

  return {
    ...response,
    payload: {
      ...response.payload,
      output: {
        ...output,
        routing: {
          requestedIntent: routing.requestedIntent,
          routedIntent: routing.routedIntent,
          route: routing.route,
          mode: routing.mode,
          reason: routing.reason,
          confidence: routing.confidence,
          model: routing.model,
        },
      },
    },
  };
}

function withRoutedIntent(
  request: OrchestratorRequest,
  routedIntent: OrchestratorIntent,
): OrchestratorRequest {
  if (request.payload.intent === routedIntent) {
    return request;
  }
  return {
    ...request,
    payload: {
      ...request.payload,
      intent: routedIntent,
    },
  };
}

async function orchestrateCore(request: OrchestratorRequest): Promise<OrchestratorResponse> {
  const baseRequest = ensureRunId(request);
  const routing = await resolveAssistiveRoute(baseRequest);
  const normalizedRequest = withRoutedIntent(baseRequest, routing.routedIntent);

  await persistEvent(normalizedRequest);
  const taskContext = extractTaskContext(normalizedRequest);
  if (taskContext) {
    await persistTaskStatus({
      request: normalizedRequest,
      taskId: taskContext.taskId,
      status: "running",
      stage: "orchestrator.received",
    });
  }

  const route = routing.route;
  let response = await runByRoute(route, normalizedRequest);
  response = withRoutingMetadata(response, routing);

  const delegation = extractDelegationRequest(response);
  if (delegation) {
    const delegatedRequest: OrchestratorRequest = {
      ...normalizedRequest,
      id: randomUUID(),
      userId: normalizedRequest.userId,
      runId: normalizedRequest.runId,
      source: "orchestrator",
      ts: new Date().toISOString(),
      payload: {
        intent: delegation.intent,
        input: delegation.input ?? {},
      },
    };
    await persistEvent(delegatedRequest);

    const delegatedRoute = routeIntent(delegatedRequest.payload.intent);
    const delegatedResponse = await runByRoute(delegatedRoute, delegatedRequest);
    await persistEvent(delegatedResponse);

    response = mergeDelegationResult(response, delegatedResponse, delegation, delegatedRoute);
    response = withRoutingMetadata(response, routing);
  }

  if (taskContext) {
    const responseStatus = response.payload.status;
    const mappedStatus: TaskStatus =
      responseStatus === "completed"
        ? "completed"
        : responseStatus === "failed"
          ? "failed"
          : extractApprovalRequired(response)
            ? "pending_approval"
            : "running";
    await persistTaskStatus({
      request: normalizedRequest,
      response,
      taskId: taskContext.taskId,
      status: mappedStatus,
      stage: mappedStatus === "pending_approval" ? "awaiting_approval" : "orchestrator.responded",
      error: response.payload.error ?? null,
    });
  }

  await persistEvent(response);
  return response;
}

export async function orchestrate(request: OrchestratorRequest): Promise<OrchestratorResponse> {
  const normalizedRequest = ensureRunId(request);
  const key = buildOrchestrationKey(normalizedRequest);
  const fingerprint = buildOrchestrationFingerprint(normalizedRequest);
  const nowMs = Date.now();
  cleanupOrchestrationCache(nowMs);

  const cached = completedOrchestration.get(key);
  if (cached && cached.expiresAtMs > nowMs) {
    if (cached.fingerprint !== fingerprint) {
      return buildIdempotencyConflictResponse({
        request: normalizedRequest,
        key,
        cachedFingerprint: cached.fingerprint,
        receivedFingerprint: fingerprint,
      });
    }
    return cloneResponse(cached.response);
  }

  const inFlight = inFlightOrchestration.get(key);
  if (inFlight) {
    if (inFlight.fingerprint !== fingerprint) {
      return buildIdempotencyConflictResponse({
        request: normalizedRequest,
        key,
        cachedFingerprint: inFlight.fingerprint,
        receivedFingerprint: fingerprint,
      });
    }
    const response = await inFlight.execution;
    return cloneResponse(response);
  }

  const execution = orchestrateCore(normalizedRequest)
    .then((response) => {
      completedOrchestration.set(key, {
        response: cloneResponse(response),
        fingerprint,
        expiresAtMs: Date.now() + ORCHESTRATOR_IDEMPOTENCY_TTL_MS,
      });
      return response;
    })
    .finally(() => {
      inFlightOrchestration.delete(key);
    });

  inFlightOrchestration.set(key, {
    fingerprint,
    execution,
  });
  const response = await execution;
  return cloneResponse(response);
}
