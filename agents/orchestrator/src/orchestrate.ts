import { randomUUID } from "node:crypto";
import type { OrchestratorRequest, OrchestratorResponse } from "@mla/contracts";
import { runLiveAgent } from "@mla/live-agent";
import { runStorytellerAgent } from "@mla/storyteller-agent";
import { runUiNavigatorAgent } from "@mla/ui-navigator-agent";
import { routeIntent } from "./router.js";
import { persistEvent } from "./services/firestore.js";

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

export async function orchestrate(request: OrchestratorRequest): Promise<OrchestratorResponse> {
  const normalizedRequest = ensureRunId(request);

  await persistEvent(normalizedRequest);

  const route = routeIntent(normalizedRequest.payload.intent);
  let response = await runByRoute(route, normalizedRequest);

  const delegation = extractDelegationRequest(response);
  if (delegation) {
    const delegatedRequest: OrchestratorRequest = {
      ...normalizedRequest,
      id: randomUUID(),
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

  await persistEvent(response);
  return response;
}
