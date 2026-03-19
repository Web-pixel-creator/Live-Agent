import { createHash, randomUUID } from "node:crypto";
import {
  createEnvelope,
  createNormalizedError,
  normalizeUnknownError,
  type OrchestratorIntent,
  type OrchestratorRequest,
  type OrchestratorResponse,
} from "@mla/contracts";
import { runLiveAgent } from "@mla/live-agent";
import { runStorytellerAgent } from "@mla/storyteller-agent";
import { runUiNavigatorAgent } from "@mla/ui-navigator-agent";
import { resolveAssistiveRoute, type AssistiveRoutingDecision } from "./assistive-router.js";
import {
  buildOrchestratorExecutionError,
  OrchestratorExecutionError,
} from "./retry-classification.js";
import { routeIntent } from "./router.js";
import { persistEvent } from "./services/firestore.js";
import {
  getOrchestratorWorkflowConfig,
  getOrchestratorWorkflowExecutionState,
  setOrchestratorWorkflowExecutionState,
  type OrchestratorWorkflowRole,
  type OrchestratorWorkflowStage,
} from "./workflow-store.js";

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

const WORKFLOW_STAGE_ROLES: Record<OrchestratorWorkflowStage, OrchestratorWorkflowRole> = {
  intake: "intake",
  planning: "planner",
  safety_review: "safety_reviewer",
  execution: "executor",
  verification: "verifier",
  reporting: "reporter",
};

function stageReason(stage: OrchestratorWorkflowStage, detail: string): string {
  return `${stage}:${detail}`;
}

async function persistWorkflowStageTransition(params: {
  request: OrchestratorRequest;
  taskId: string | null;
  stage: OrchestratorWorkflowStage;
  status: "running" | "pending_approval" | "completed" | "failed";
  reason: string;
  route: string | null;
}): Promise<void> {
  const activeRole = WORKFLOW_STAGE_ROLES[params.stage];
  setOrchestratorWorkflowExecutionState({
    status: params.status,
    currentStage: params.stage,
    activeRole,
    runId: params.request.runId ?? params.request.id,
    sessionId: params.request.sessionId,
    taskId: params.taskId,
    intent: params.request.payload.intent,
    route: params.route,
    reason: params.reason,
  });
  await persistEvent(
    createEnvelope({
      userId: params.request.userId,
      sessionId: params.request.sessionId,
      runId: params.request.runId,
      type: "workflow.stage",
      source: "orchestrator",
      payload: {
        taskId: params.taskId,
        runId: params.request.runId ?? null,
        sessionId: params.request.sessionId,
        intent: params.request.payload.intent,
        route: params.route,
        stage: params.stage,
        activeRole,
        status: params.status,
        reason: params.reason,
        updatedAt: new Date().toISOString(),
      },
    }),
  );
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

function buildWorkflowTaskMetadata(params: {
  taskId: string;
  status: TaskStatus;
  route: string | null;
}): NonNullable<OrchestratorResponse["payload"]["task"]> {
  const workflowState = getOrchestratorWorkflowExecutionState();
  return {
    taskId: params.taskId,
    status: params.status,
    stage: workflowState.currentStage ?? "intake",
    route: params.route,
    updatedAt: workflowState.updatedAt ?? new Date().toISOString(),
  };
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
  const activeRole =
    params.stage === "intake" ||
    params.stage === "planning" ||
    params.stage === "safety_review" ||
    params.stage === "execution" ||
    params.stage === "verification" ||
    params.stage === "reporting"
      ? WORKFLOW_STAGE_ROLES[params.stage as OrchestratorWorkflowStage]
      : null;
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
      workflowStage: params.stage,
      activeRole,
      error: params.error ?? null,
      updatedAt: new Date().toISOString(),
    },
  });
  await persistEvent(event);
}

async function persistRouteExecutionError(params: {
  request: OrchestratorRequest;
  route: string;
  phase: "primary_route" | "delegated_route";
  executionError: OrchestratorExecutionError;
}): Promise<void> {
  const event = createEnvelope({
    userId: params.request.userId,
    sessionId: params.request.sessionId,
    runId: params.request.runId,
    type: "orchestrator.error",
    source: "orchestrator",
    payload: {
      route: params.route,
      phase: params.phase,
      status: "failed",
      error: params.executionError.normalizedError,
    },
  });
  await persistEvent(event);
}

type DelegationRequest = {
  intent: "story" | "ui_task";
  input: unknown;
  reason: string;
};

type BookingFlowSnapshot = {
  status: "offered" | "confirmed";
  topic: string;
  selectedSlotId: string | null;
  selectedSlotLabel: string | null;
  shortSummary: string | null;
};

type FollowUpFlowSnapshot = {
  scenario: string;
  status: string;
  followUpIntent: string;
  caseId: string | null;
  clientName: string | null;
  destinationCountry: string | null;
  missingItems: string[];
  missingItemsCount: number;
  operatorSummary: string | null;
  nextStep: string | null;
  readyForSubmission: boolean;
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

function extractBookingSnapshot(response: OrchestratorResponse): BookingFlowSnapshot | null {
  if (response.payload.route !== "live-agent") {
    return null;
  }
  if (!isRecord(response.payload.output) || !isRecord(response.payload.output.booking)) {
    return null;
  }
  const booking = response.payload.output.booking;
  const status = booking.status;
  if (status !== "offered" && status !== "confirmed") {
    return null;
  }
  return {
    status,
    topic: typeof booking.topic === "string" ? booking.topic : "consultation",
    selectedSlotId: typeof booking.selectedSlotId === "string" ? booking.selectedSlotId : null,
    selectedSlotLabel: typeof booking.selectedSlotLabel === "string" ? booking.selectedSlotLabel : null,
    shortSummary:
      isRecord(booking.confirmedSummary) && typeof booking.confirmedSummary.shortSummary === "string"
        ? booking.confirmedSummary.shortSummary
        : null,
  };
}

function extractFollowUpSnapshot(response: OrchestratorResponse): FollowUpFlowSnapshot | null {
  if (response.payload.route !== "live-agent") {
    return null;
  }
  if (!isRecord(response.payload.output) || !isRecord(response.payload.output.followUp)) {
    return null;
  }
  const followUp = response.payload.output.followUp;
  if (!isRecord(followUp.summary) || !isRecord(followUp.leadProfile)) {
    return null;
  }
  const missingItems = Array.isArray(followUp.missingItems)
    ? followUp.missingItems
        .map((item) => {
          if (typeof item === "string") {
            return item.trim();
          }
          if (isRecord(item)) {
            const label = toNonEmptyString(item.label);
            if (label) {
              return label;
            }
            const sourceField = toNonEmptyString(item.sourceField);
            if (sourceField) {
              return sourceField;
            }
          }
          return null;
        })
        .filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  const missingItemLabels =
    missingItems.length > 0
      ? missingItems
      : isRecord(followUp.summary) && Array.isArray(followUp.summary.missingItemLabels)
        ? followUp.summary.missingItemLabels
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter((item): item is string => item.length > 0)
        : [];
  const readyForSubmission = followUp.readyForSubmission === true;
  return {
    scenario: typeof followUp.scenario === "string" ? followUp.scenario : "missing_documents_follow_up",
    status: typeof followUp.status === "string" ? followUp.status : "needs_documents",
    followUpIntent:
      typeof followUp.followUpIntent === "string" ? followUp.followUpIntent : "document_collection_follow_up",
    caseId: typeof followUp.leadProfile.caseId === "string" ? followUp.leadProfile.caseId : null,
    clientName: typeof followUp.leadProfile.clientName === "string" ? followUp.leadProfile.clientName : null,
    destinationCountry:
      typeof followUp.leadProfile.destinationCountry === "string" ? followUp.leadProfile.destinationCountry : null,
    missingItems: missingItemLabels,
    missingItemsCount: missingItemLabels.length,
    operatorSummary: typeof followUp.operatorSummary === "string" ? followUp.operatorSummary : null,
    nextStep: typeof followUp.nextStep === "string" ? followUp.nextStep : null,
    readyForSubmission,
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

async function executeRoute(params: {
  route: "live-agent" | "storyteller-agent" | "ui-navigator-agent";
  request: OrchestratorRequest;
  phase: "primary_route" | "delegated_route";
  taskId: string | null;
}): Promise<OrchestratorResponse> {
  const workflow = getOrchestratorWorkflowConfig();
  try {
    return await runByRoute(params.route, params.request);
  } catch (error) {
    const executionError = buildOrchestratorExecutionError({
      error,
      route: params.route,
      phase: params.phase,
      runId: params.request.runId,
      sessionId: params.request.sessionId,
      taskId: params.taskId,
      retryPolicy: workflow.retryPolicy,
    });
    await persistRouteExecutionError({
      request: params.request,
      route: params.route,
      phase: params.phase,
      executionError,
    });
    throw executionError;
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
          provider: routing.provider,
          defaultProvider: routing.defaultProvider,
          model: routing.model,
          defaultModel: routing.defaultModel,
          selectionReason: routing.selectionReason,
          budgetPolicy: routing.budgetPolicy,
          promptCaching: routing.promptCaching,
          watchlistEnabled: routing.watchlistEnabled,
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
  const workflow = getOrchestratorWorkflowConfig();
  const routing = await resolveAssistiveRoute(baseRequest, workflow.assistiveRouter);
  const normalizedRequest = withRoutedIntent(baseRequest, routing.routedIntent);
  const taskContext = extractTaskContext(normalizedRequest);
  const taskId = taskContext?.taskId ?? null;

  await persistEvent(normalizedRequest);
  if (taskContext) {
    await persistTaskStatus({
      request: normalizedRequest,
      taskId: taskContext.taskId,
      status: "running",
      stage: "intake",
    });
  }

  await persistWorkflowStageTransition({
    request: normalizedRequest,
    taskId,
    stage: "intake",
    status: "running",
    reason: stageReason("intake", "request received"),
    route: null,
  });
  await persistWorkflowStageTransition({
    request: normalizedRequest,
    taskId,
    stage: "planning",
    status: "running",
    reason: stageReason("planning", routing.reason),
    route: routing.route,
  });

  const route = routing.route;
  let response: OrchestratorResponse;
  try {
    await persistWorkflowStageTransition({
      request: normalizedRequest,
      taskId,
      stage: "safety_review",
      status: "running",
      reason: stageReason("safety_review", `preparing ${route}`),
      route,
    });
    await persistWorkflowStageTransition({
      request: normalizedRequest,
      taskId,
      stage: "execution",
      status: "running",
      reason: stageReason("execution", `dispatching ${route}`),
      route,
    });
    response = await executeRoute({
      route,
      request: normalizedRequest,
      phase: "primary_route",
      taskId,
    });
  } catch (error) {
    if (taskContext) {
      const normalized =
        error instanceof OrchestratorExecutionError
          ? error.normalizedError
          : normalizeUnknownError(error, {
              defaultCode: "ORCHESTRATOR_ROUTE_FAILURE",
              defaultMessage: "route execution failed",
            });
      const stage = "execution";
      setOrchestratorWorkflowExecutionState({
        status: "failed",
        currentStage: "execution",
        activeRole: "executor",
        runId: normalizedRequest.runId ?? normalizedRequest.id,
        sessionId: normalizedRequest.sessionId,
        taskId,
        intent: normalizedRequest.payload.intent,
        route,
        reason:
          error instanceof OrchestratorExecutionError &&
          error.retryDecision.classification === "continuation"
            ? "route awaiting retry"
            : "route failed",
      });
      await persistTaskStatus({
        request: normalizedRequest,
        taskId: taskContext.taskId,
        status: "failed",
        stage,
        error: normalized,
      });
    }
    throw error;
  }
  response = withRoutingMetadata(response, routing);

  const delegation = extractDelegationRequest(response);
  if (delegation) {
    const delegatedRoute = routeIntent(delegation.intent);
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

    await persistWorkflowStageTransition({
      request: delegatedRequest,
      taskId,
      stage: "safety_review",
      status: "running",
      reason: stageReason("safety_review", `delegated ${delegatedRequest.payload.intent}`),
      route: delegatedRoute,
    });
    await persistWorkflowStageTransition({
      request: delegatedRequest,
      taskId,
      stage: "execution",
      status: "running",
      reason: stageReason("execution", `dispatching delegated ${delegatedRoute}`),
      route: delegatedRoute,
    });
    let delegatedResponse: OrchestratorResponse;
    try {
      delegatedResponse = await executeRoute({
        route: delegatedRoute,
        request: delegatedRequest,
        phase: "delegated_route",
        taskId,
      });
    } catch (error) {
      if (taskContext) {
        const normalized =
          error instanceof OrchestratorExecutionError
            ? error.normalizedError
            : normalizeUnknownError(error, {
              defaultCode: "ORCHESTRATOR_ROUTE_FAILURE",
              defaultMessage: "delegated route execution failed",
            });
        const stage = "execution";
        setOrchestratorWorkflowExecutionState({
          status: "failed",
          currentStage: "execution",
          activeRole: "executor",
          runId: normalizedRequest.runId ?? normalizedRequest.id,
          sessionId: normalizedRequest.sessionId,
          taskId,
          intent: normalizedRequest.payload.intent,
          route: delegatedRoute,
          reason:
            error instanceof OrchestratorExecutionError &&
            error.retryDecision.classification === "continuation"
              ? "delegated route awaiting retry"
              : "delegated route failed",
        });
        await persistTaskStatus({
          request: normalizedRequest,
          taskId: taskContext.taskId,
          status: "failed",
          stage,
          error: normalized,
        });
      }
      throw error;
    }
    await persistEvent(delegatedResponse);

    response = mergeDelegationResult(response, delegatedResponse, delegation, delegatedRoute);
    response = withRoutingMetadata(response, routing);
  }

  const bookingSnapshot = extractBookingSnapshot(response);
  if (bookingSnapshot) {
    setOrchestratorWorkflowExecutionState({
      bookingState: bookingSnapshot,
    });
  }

  const followUpSnapshot = extractFollowUpSnapshot(response);
  if (followUpSnapshot) {
    setOrchestratorWorkflowExecutionState({
      followUpState: followUpSnapshot,
    });
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
    const finalStage: OrchestratorWorkflowStage =
      mappedStatus === "pending_approval" ? "safety_review" : mappedStatus === "completed" ? "reporting" : "verification";
    await persistWorkflowStageTransition({
      request: normalizedRequest,
      taskId,
      stage: finalStage,
      status: mappedStatus,
      reason:
        mappedStatus === "pending_approval"
          ? stageReason(finalStage, "awaiting operator approval")
          : mappedStatus === "completed"
            ? stageReason(finalStage, "response verified and ready to report")
            : stageReason(finalStage, "response reported with errors"),
      route,
    });
    await persistTaskStatus({
      request: normalizedRequest,
      response,
      taskId: taskContext.taskId,
      status: mappedStatus,
      stage: finalStage,
      error: response.payload.error ?? null,
    });
    response = {
      ...response,
      payload: {
        ...response.payload,
        task: buildWorkflowTaskMetadata({
          taskId: taskContext.taskId,
          status: mappedStatus,
          route,
        }),
      },
    };
  }

  await persistEvent(response);
  return response;
}

export async function orchestrate(request: OrchestratorRequest): Promise<OrchestratorResponse> {
  const normalizedRequest = ensureRunId(request);
  const workflow = getOrchestratorWorkflowConfig();
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
        expiresAtMs: Date.now() + workflow.idempotencyTtlMs,
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
