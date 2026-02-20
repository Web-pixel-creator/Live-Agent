import { randomUUID } from "node:crypto";
import type { AgentKind, EventEnvelope } from "./types.js";

export function createEnvelope<TPayload>(params: {
  userId?: string;
  sessionId: string;
  type: string;
  source: AgentKind;
  payload: TPayload;
  runId?: string;
}): EventEnvelope<TPayload> {
  return {
    id: randomUUID(),
    userId: params.userId,
    sessionId: params.sessionId,
    runId: params.runId,
    type: params.type,
    source: params.source,
    ts: new Date().toISOString(),
    payload: params.payload,
  };
}

export function safeParseEnvelope(input: string): EventEnvelope | null {
  try {
    const parsed = JSON.parse(input) as Partial<EventEnvelope>;
    const userIdValid =
      parsed.userId === undefined || (typeof parsed.userId === "string" && parsed.userId.trim().length > 0);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !userIdValid ||
      typeof parsed.sessionId !== "string" ||
      typeof parsed.type !== "string" ||
      typeof parsed.source !== "string" ||
      typeof parsed.ts !== "string"
    ) {
      return null;
    }
    return parsed as EventEnvelope;
  } catch {
    return null;
  }
}
