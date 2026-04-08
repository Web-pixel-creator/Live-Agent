import { randomUUID } from "node:crypto";
import type {
  RuntimeLiveSessionEventIngestResponse,
} from "@mla/contracts";
import { recordRuntimeSessionEvent } from "./firestore.js";

export type RuntimeLiveSessionEventRecordInput = {
  eventId: string;
  userId?: string;
  sessionId: string;
  runId?: string;
  conversation?: "default" | "none";
  source: "direct_live";
  type: string;
  createdAt: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

type NormalizeRuntimeLiveSessionEventIngestRequestResult =
  | {
      ok: true;
      value: RuntimeLiveSessionEventRecordInput;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeRuntimeLiveSessionEventIngestRequest(
  raw: unknown,
): NormalizeRuntimeLiveSessionEventIngestRequestResult {
  if (!isRecord(raw)) {
    return {
      ok: false,
      code: "API_RUNTIME_LIVE_SESSION_EVENT_INVALID_REQUEST",
      message: "runtime live session event body must be a JSON object",
    };
  }

  const sessionId = toNonEmptyString(raw.sessionId);
  if (!sessionId) {
    return {
      ok: false,
      code: "API_RUNTIME_LIVE_SESSION_EVENT_INVALID_REQUEST",
      message: "sessionId is required for runtime live session event ingest",
      details: { field: "sessionId" },
    };
  }

  const type = toNonEmptyString(raw.type);
  if (!type) {
    return {
      ok: false,
      code: "API_RUNTIME_LIVE_SESSION_EVENT_INVALID_REQUEST",
      message: "type is required for runtime live session event ingest",
      details: { field: "type" },
    };
  }

  const source = toNonEmptyString(raw.source);
  if (source && source !== "direct_live") {
    return {
      ok: false,
      code: "API_RUNTIME_LIVE_SESSION_EVENT_INVALID_REQUEST",
      message: "runtime live session event ingest only accepts direct_live source",
      details: { field: "source", source },
    };
  }

  const conversation = toNonEmptyString(raw.conversation);
  if (conversation && conversation !== "default" && conversation !== "none") {
    return {
      ok: false,
      code: "API_RUNTIME_LIVE_SESSION_EVENT_INVALID_REQUEST",
      message: "conversation must be default or none when provided",
      details: { field: "conversation", conversation },
    };
  }

  const payload = raw.payload === undefined ? {} : raw.payload;
  if (!isRecord(payload)) {
    return {
      ok: false,
      code: "API_RUNTIME_LIVE_SESSION_EVENT_INVALID_REQUEST",
      message: "payload must be a JSON object when provided",
      details: { field: "payload" },
    };
  }

  const metadata = raw.metadata === undefined ? {} : raw.metadata;
  if (!isRecord(metadata)) {
    return {
      ok: false,
      code: "API_RUNTIME_LIVE_SESSION_EVENT_INVALID_REQUEST",
      message: "metadata must be a JSON object when provided",
      details: { field: "metadata" },
    };
  }

  return {
    ok: true,
    value: {
      eventId: toNonEmptyString(raw.id) ?? randomUUID(),
      userId: toNonEmptyString(raw.userId) ?? undefined,
      sessionId,
      runId: toNonEmptyString(raw.runId) ?? undefined,
      conversation: conversation === "default" || conversation === "none" ? conversation : undefined,
      source: "direct_live",
      type,
      createdAt: toNonEmptyString(raw.ts) ?? new Date().toISOString(),
      payload,
      metadata,
    },
  };
}

export async function ingestRuntimeLiveSessionEvent(params: {
  tenantId?: string;
  request: RuntimeLiveSessionEventRecordInput;
}): Promise<RuntimeLiveSessionEventIngestResponse> {
  const stored = await recordRuntimeSessionEvent({
    tenantId: params.tenantId,
    eventId: params.request.eventId,
    userId: params.request.userId,
    sessionId: params.request.sessionId,
    runId: params.request.runId,
    conversation: params.request.conversation,
    type: params.request.type,
    source: params.request.source,
    createdAt: params.request.createdAt,
    payload: params.request.payload,
    metadata: params.request.metadata,
  });

  return {
    accepted: true,
    eventId: stored.eventId,
    sessionId: stored.sessionId,
    runId: stored.runId,
    source: "direct_live",
    createdAt: stored.createdAt,
  };
}
