import { randomUUID } from "node:crypto";
import type { RuntimeCaseWikiNoteRequest, RuntimeCaseWikiNoteResponse } from "@mla/contracts";
import { recordRuntimeSessionEvent } from "./firestore.js";

export type RuntimeCaseWikiNoteRecordInput = {
  eventId: string;
  userId?: string;
  sessionId: string;
  runId?: string;
  title?: string;
  note: string;
  priority: "low" | "medium" | "high";
  blocking: boolean;
  owner?: string;
  suggestedNextStep?: string;
  createdAt: string;
};

type NormalizeRuntimeCaseWikiNoteRequestResult =
  | {
      ok: true;
      value: RuntimeCaseWikiNoteRecordInput;
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

function normalizePriority(value: unknown): "low" | "medium" | "high" | null {
  const normalized = toNonEmptyString(value)?.toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return null;
}

export function normalizeRuntimeCaseWikiNoteRequest(
  raw: unknown,
): NormalizeRuntimeCaseWikiNoteRequestResult {
  if (!isRecord(raw)) {
    return {
      ok: false,
      code: "API_RUNTIME_CASE_WIKI_NOTE_INVALID_REQUEST",
      message: "runtime case wiki note body must be a JSON object",
    };
  }

  const sessionId = toNonEmptyString(raw.sessionId);
  if (!sessionId) {
    return {
      ok: false,
      code: "API_RUNTIME_CASE_WIKI_NOTE_INVALID_REQUEST",
      message: "sessionId is required for runtime case wiki note append",
      details: { field: "sessionId" },
    };
  }

  const note = toNonEmptyString(raw.note);
  if (!note) {
    return {
      ok: false,
      code: "API_RUNTIME_CASE_WIKI_NOTE_INVALID_REQUEST",
      message: "note is required for runtime case wiki note append",
      details: { field: "note" },
    };
  }

  const priority = raw.priority === undefined ? "medium" : normalizePriority(raw.priority);
  if (!priority) {
    return {
      ok: false,
      code: "API_RUNTIME_CASE_WIKI_NOTE_INVALID_REQUEST",
      message: "priority must be one of low|medium|high when provided",
      details: { field: "priority", priority: raw.priority },
    };
  }

  if (raw.blocking !== undefined && typeof raw.blocking !== "boolean") {
    return {
      ok: false,
      code: "API_RUNTIME_CASE_WIKI_NOTE_INVALID_REQUEST",
      message: "blocking must be a boolean when provided",
      details: { field: "blocking", blocking: raw.blocking },
    };
  }

  return {
    ok: true,
    value: {
      eventId: toNonEmptyString(raw.id) ?? randomUUID(),
      userId: toNonEmptyString(raw.userId) ?? undefined,
      sessionId,
      runId: toNonEmptyString(raw.runId) ?? undefined,
      title: toNonEmptyString(raw.title) ?? undefined,
      note,
      priority,
      blocking: raw.blocking === true,
      owner: toNonEmptyString(raw.owner) ?? undefined,
      suggestedNextStep: toNonEmptyString(raw.suggestedNextStep) ?? undefined,
      createdAt: toNonEmptyString(raw.ts) ?? new Date().toISOString(),
    },
  };
}

export async function appendRuntimeCaseWikiNote(params: {
  tenantId?: string;
  request: RuntimeCaseWikiNoteRecordInput;
}): Promise<RuntimeCaseWikiNoteResponse> {
  const stored = await recordRuntimeSessionEvent({
    tenantId: params.tenantId,
    eventId: params.request.eventId,
    userId: params.request.userId,
    sessionId: params.request.sessionId,
    runId: params.request.runId,
    type: "operator.note",
    source: "operator",
    createdAt: params.request.createdAt,
    payload: {
      route: "case-wiki",
      status: "captured",
      kind: "case_wiki_note",
      title: params.request.title ?? null,
      note: params.request.note,
      priority: params.request.priority,
      blocking: params.request.blocking,
      owner: params.request.owner ?? null,
      suggestedNextStep: params.request.suggestedNextStep ?? null,
    },
    metadata: {
      kind: "case_wiki_note",
    },
  });

  return {
    accepted: true,
    eventId: stored.eventId,
    sessionId: stored.sessionId,
    runId: stored.runId ?? null,
    source: "operator",
    kind: "operator_note",
    createdAt: stored.createdAt,
  };
}
