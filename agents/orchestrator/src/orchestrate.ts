import { randomUUID } from "node:crypto";
import { createEnvelope, type OrchestratorRequest, type OrchestratorResponse } from "@mla/contracts";
import { runLiveAgent } from "@mla/live-agent";
import { runStorytellerAgent } from "@mla/storyteller-agent";
import { runUiNavigatorAgent } from "@mla/ui-navigator-agent";
import { routeIntent } from "./router.js";
import { persistEvent } from "./services/firestore.js";

type CachedOrchestrationResult = {
  response: OrchestratorResponse;
  expiresAtMs: number;
};

const inFlightOrchestration = new Map<string, Promise<OrchestratorResponse>>();
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
  const key = extractRequestIdempotencyKey(request);
  return `${request.sessionId}:${runId}:${intent}:${key}`;
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

async function orchestrateCore(request: OrchestratorRequest): Promise<OrchestratorResponse> {
  const normalizedRequest = ensureRunId(request);

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

  const route = routeIntent(normalizedRequest.payload.intent);
  let response = await runByRoute(route, normalizedRequest);

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
  const nowMs = Date.now();
  cleanupOrchestrationCache(nowMs);

  const cached = completedOrchestration.get(key);
  if (cached && cached.expiresAtMs > nowMs) {
    return cloneResponse(cached.response);
  }

  const inFlight = inFlightOrchestration.get(key);
  if (inFlight) {
    const response = await inFlight;
    return cloneResponse(response);
  }

  const execution = orchestrateCore(normalizedRequest)
    .then((response) => {
      completedOrchestration.set(key, {
        response: cloneResponse(response),
        expiresAtMs: Date.now() + ORCHESTRATOR_IDEMPOTENCY_TTL_MS,
      });
      return response;
    })
    .finally(() => {
      inFlightOrchestration.delete(key);
    });

  inFlightOrchestration.set(key, execution);
  const response = await execution;
  return cloneResponse(response);
}
