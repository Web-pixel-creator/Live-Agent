import { randomUUID } from "node:crypto";
import WebSocket from "ws";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      result[key] = "true";
      continue;
    }
    result[key] = value;
    index += 1;
  }
  return result;
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}

function hasStringField(record, field) {
  return isObject(record) && typeof record[field] === "string" && record[field].trim().length > 0;
}

function assertEnvelope(event, prefix = "Invalid envelope") {
  if (!hasStringField(event, "id")) {
    throw new Error(`${prefix}: missing id`);
  }
  if (event.userId !== undefined && !hasStringField(event, "userId")) {
    throw new Error(`${prefix}: invalid userId`);
  }
  if (!hasStringField(event, "sessionId")) {
    throw new Error(`${prefix}: missing sessionId`);
  }
  if (!hasStringField(event, "type")) {
    throw new Error(`${prefix}: missing type`);
  }
  if (!hasStringField(event, "source")) {
    throw new Error(`${prefix}: missing source`);
  }
  if (!hasStringField(event, "ts")) {
    throw new Error(`${prefix}: missing ts`);
  }
}

function fail(message, details) {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: message,
      details: details ?? null,
    })}\n`,
  );
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

const wsUrl = args.url ?? "ws://localhost:8080/realtime";
const sessionId = args.sessionId ?? `ws-item-delete-${randomUUID()}`;
const runId = args.runId ?? `ws-item-delete-run-${randomUUID()}`;
const userId = args.userId ?? "demo-user";
const timeoutMs = Number(args.timeoutMs ?? 12000);
const turnId = args.turnId ?? `turn-delete-${randomUUID()}`;
const reason = args.reason ?? "demo_delete_checkpoint";

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  fail("Invalid timeoutMs argument", { timeoutMs: args.timeoutMs });
}

const requestEnvelope = {
  id: randomUUID(),
  userId,
  sessionId,
  runId,
  type: "conversation.item.delete",
  source: "frontend",
  ts: new Date().toISOString(),
  payload: {
    item_id: turnId,
    reason,
  },
};

const receivedEventTypes = [];
let connectedEnvelope = null;
let deletedEnvelope = null;

const ws = new WebSocket(wsUrl);

const timeout = setTimeout(() => {
  fail("WebSocket item-delete check timed out", {
    wsUrl,
    sessionId,
    runId,
    turnId,
    reason,
    receivedEventTypes,
  });
}, timeoutMs);

function finish() {
  clearTimeout(timeout);
  try {
    ws.close();
  } catch {
    // ignore close errors
  }

  if (!connectedEnvelope) {
    fail("Did not receive gateway.connected envelope", {
      wsUrl,
      sessionId,
      runId,
      receivedEventTypes,
    });
  }

  if (!deletedEnvelope) {
    fail("Did not receive live.turn.deleted envelope", {
      wsUrl,
      sessionId,
      runId,
      expectedType: "live.turn.deleted",
      receivedEventTypes,
    });
  }

  if (deletedEnvelope.runId !== runId) {
    fail("Delete event runId mismatch", {
      expectedRunId: runId,
      actualRunId: deletedEnvelope.runId,
      deletedEnvelope,
    });
  }

  if (deletedEnvelope.userId !== userId) {
    fail("Delete event userId mismatch", {
      expectedUserId: userId,
      actualUserId: deletedEnvelope.userId,
      deletedEnvelope,
    });
  }

  const payload = isObject(deletedEnvelope.payload) ? deletedEnvelope.payload : {};
  const deletedTurnId = typeof payload.turnId === "string" ? payload.turnId : null;
  const deletedReason = typeof payload.reason === "string" ? payload.reason : null;
  const scope = typeof payload.scope === "string" ? payload.scope : null;
  const hadActiveTurn = typeof payload.hadActiveTurn === "boolean" ? payload.hadActiveTurn : null;

  if (deletedTurnId !== turnId) {
    fail("Delete event turnId mismatch", {
      expectedTurnId: turnId,
      actualTurnId: deletedTurnId,
      payload,
    });
  }

  if (deletedReason !== reason) {
    fail("Delete event reason mismatch", {
      expectedReason: reason,
      actualReason: deletedReason,
      payload,
    });
  }

  if (scope !== "session_local") {
    fail("Delete event scope mismatch", {
      expectedScope: "session_local",
      actualScope: scope,
      payload,
    });
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      wsUrl,
      sessionId,
      runId,
      userId,
      turnId,
      reason,
      eventType: deletedEnvelope.type,
      scope,
      hadActiveTurn,
      eventTypes: receivedEventTypes,
    })}\n`,
  );
  process.exit(0);
}

ws.on("open", () => {
  ws.send(JSON.stringify(requestEnvelope));
});

ws.on("message", (raw) => {
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    fail("WebSocket received non-JSON frame", {
      frame: String(raw).slice(0, 500),
    });
  }

  try {
    assertEnvelope(parsed);
  } catch (error) {
    fail("WebSocket received malformed envelope", {
      error: error instanceof Error ? error.message : String(error),
      frame: parsed,
    });
  }

  receivedEventTypes.push(parsed.type);

  if (parsed.type === "gateway.connected") {
    connectedEnvelope = parsed;
    return;
  }

  if (parsed.type === "gateway.error" && parsed.sessionId === sessionId) {
    fail("Received gateway.error during item-delete check", {
      payload: parsed.payload ?? null,
      runId,
      receivedEventTypes,
    });
  }

  if (parsed.type === "live.turn.deleted" && parsed.sessionId === sessionId) {
    deletedEnvelope = parsed;
    finish();
  }
});

ws.on("error", (error) => {
  fail("WebSocket connection error", {
    wsUrl,
    error: error instanceof Error ? error.message : String(error),
  });
});

ws.on("close", (code, reasonText) => {
  if (!deletedEnvelope) {
    fail("WebSocket closed before item-delete checks completed", {
      wsUrl,
      code,
      reason: String(reasonText),
      sessionId,
      runId,
      receivedEventTypes,
    });
  }
});
