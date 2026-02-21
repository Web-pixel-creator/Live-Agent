import { createHash } from "node:crypto";
import type { OrchestratorRequest } from "@mla/contracts";

function isObject(value: unknown): value is Record<string, unknown> {
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

export function extractGatewayRequestIdempotencyKey(request: OrchestratorRequest): string {
  const payload = request.payload as unknown;
  if (!isObject(payload)) {
    return sanitizeIdempotencyToken(request.runId ?? request.id);
  }
  const fromPayload =
    toNonEmptyString(payload.idempotencyKey) ??
    (isObject(payload.meta) ? toNonEmptyString(payload.meta.idempotencyKey) : null) ??
    (isObject(payload.input) ? toNonEmptyString(payload.input.idempotencyKey) : null);
  const fallback = fromPayload ?? toNonEmptyString(request.runId) ?? request.id;
  return sanitizeIdempotencyToken(fallback);
}

export function buildReplayKey(request: OrchestratorRequest): string {
  const runId = toNonEmptyString(request.runId) ?? request.id;
  const intent = isObject(request.payload) ? toNonEmptyString(request.payload.intent) ?? "unknown" : "unknown";
  const idempotencyKey = extractGatewayRequestIdempotencyKey(request);
  return `${request.sessionId}:${runId}:${intent}:${idempotencyKey}`;
}

export function buildReplayFingerprint(request: OrchestratorRequest): string {
  const payload: Record<string, unknown> = isObject(request.payload) ? request.payload : {};
  const canonical = {
    sessionId: request.sessionId,
    userId: toNonEmptyString(request.userId),
    runId: toNonEmptyString(request.runId) ?? request.id,
    intent: toNonEmptyString(payload.intent),
    input: isObject(payload.input) || Array.isArray(payload.input) ? payload.input : payload.input ?? null,
  };
  return createHash("sha256").update(stableSerialize(canonical)).digest("hex");
}
