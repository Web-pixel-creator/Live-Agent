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

function assertEnvelope(event, messagePrefix = "Invalid envelope") {
  if (!hasStringField(event, "id")) {
    throw new Error(`${messagePrefix}: missing id`);
  }
  if (event.userId !== undefined && !hasStringField(event, "userId")) {
    throw new Error(`${messagePrefix}: invalid userId`);
  }
  if (!hasStringField(event, "sessionId")) {
    throw new Error(`${messagePrefix}: missing sessionId`);
  }
  if (!hasStringField(event, "type")) {
    throw new Error(`${messagePrefix}: missing type`);
  }
  if (!hasStringField(event, "source")) {
    throw new Error(`${messagePrefix}: missing source`);
  }
  if (!hasStringField(event, "ts")) {
    throw new Error(`${messagePrefix}: missing ts`);
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

function buildRequestEnvelope(params) {
  const envelope = {
    id: randomUUID(),
    userId: params.userId,
    sessionId: params.sessionId,
    runId: params.runId,
    type: "orchestrator.request",
    source: "frontend",
    ts: new Date().toISOString(),
    payload: {
      intent: "translation",
      input: {
        text: params.text,
        targetLanguage: "ru",
      },
    },
  };
  if (typeof params.conversation === "string" && params.conversation.trim().length > 0) {
    envelope.conversation = params.conversation.trim();
  }
  return envelope;
}

const args = parseArgs(process.argv.slice(2));
const wsUrl = args.url ?? "ws://localhost:8080/realtime";
const sessionId = args.sessionId ?? `ws-binding-${randomUUID()}`;
const userId = args.userId ?? "demo-user";
const timeoutMs = Number(args.timeoutMs ?? 15000);

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  fail("Invalid timeoutMs argument", { timeoutMs: args.timeoutMs });
}

const firstRunId = args.runId ?? `ws-binding-run-${randomUUID()}`;
const sessionMismatchRunId = `${firstRunId}-session-mismatch`;
const userMismatchRunId = `${firstRunId}-user-mismatch`;
const mismatchSessionId = `${sessionId}-mismatch`;
const mismatchUserId = `${userId}-mismatch`;

const firstRequestEnvelope = buildRequestEnvelope({
  userId,
  sessionId,
  runId: firstRunId,
  text: "Initial binding request.",
});
const sessionMismatchEnvelope = buildRequestEnvelope({
  userId,
  sessionId: mismatchSessionId,
  runId: sessionMismatchRunId,
  text: "Session mismatch request.",
  conversation: "none",
});
const userMismatchEnvelope = buildRequestEnvelope({
  userId: mismatchUserId,
  sessionId,
  runId: userMismatchRunId,
  text: "User mismatch request.",
});

const receivedEventTypes = [];
let connectedEnvelope = null;
let firstResponseEnvelope = null;
let sessionMismatchError = null;
let userMismatchError = null;
let firstRequestSent = false;
let sessionMismatchSent = false;
let userMismatchSent = false;
let sessionMismatchSentAtMs = 0;
let sessionMismatchReceivedAtMs = 0;
let finished = false;

const ws = new WebSocket(wsUrl);

const timeout = setTimeout(() => {
  fail("WebSocket binding mismatch check timed out", {
    wsUrl,
    sessionId,
    userId,
    firstRunId,
    eventTypes: receivedEventTypes,
    firstRequestSent,
    sessionMismatchSent,
    userMismatchSent,
    sessionMismatchSeen: Boolean(sessionMismatchError),
    userMismatchSeen: Boolean(userMismatchError),
  });
}, timeoutMs);

function errorSummary(errorEnvelope) {
  if (!isObject(errorEnvelope)) {
    return null;
  }
  const payload = isObject(errorEnvelope.payload) ? errorEnvelope.payload : null;
  const details = payload && isObject(payload.details) ? payload.details : null;
  return {
    code: payload && hasStringField(payload, "code") ? payload.code : null,
    traceId: payload && hasStringField(payload, "traceId") ? payload.traceId : null,
    clientEventId: details && hasStringField(details, "clientEventId") ? details.clientEventId : null,
    runId: hasStringField(errorEnvelope, "runId") ? errorEnvelope.runId : null,
    sessionId: hasStringField(errorEnvelope, "sessionId") ? errorEnvelope.sessionId : null,
  };
}

function maybeFinish() {
  if (finished) {
    return;
  }
  if (!connectedEnvelope || !firstResponseEnvelope || !sessionMismatchError || !userMismatchError) {
    return;
  }

  const firstResponseStatus =
    isObject(firstResponseEnvelope.payload) && hasStringField(firstResponseEnvelope.payload, "status")
      ? firstResponseEnvelope.payload.status
      : null;
  if (firstResponseStatus !== "completed") {
    fail("First binding response status is not completed", {
      firstResponseStatus,
      eventTypes: receivedEventTypes,
    });
  }

  const sessionMismatchSummary = errorSummary(sessionMismatchError);
  const userMismatchSummary = errorSummary(userMismatchError);
  if (sessionMismatchSummary?.code !== "GATEWAY_SESSION_MISMATCH") {
    fail("Expected GATEWAY_SESSION_MISMATCH for session mismatch", {
      sessionMismatchSummary,
      eventTypes: receivedEventTypes,
    });
  }
  if (!sessionMismatchSummary?.traceId) {
    fail("Session mismatch error is missing traceId", {
      sessionMismatchSummary,
      eventTypes: receivedEventTypes,
    });
  }
  if (userMismatchSummary?.code !== "GATEWAY_USER_MISMATCH") {
    fail("Expected GATEWAY_USER_MISMATCH for user mismatch", {
      userMismatchSummary,
      eventTypes: receivedEventTypes,
    });
  }
  if (!userMismatchSummary?.traceId) {
    fail("User mismatch error is missing traceId", {
      userMismatchSummary,
      eventTypes: receivedEventTypes,
    });
  }
  if (sessionMismatchSummary?.clientEventId !== sessionMismatchEnvelope.id) {
    fail("Session mismatch error clientEventId does not match request envelope id", {
      expectedClientEventId: sessionMismatchEnvelope.id,
      actualClientEventId: sessionMismatchSummary?.clientEventId ?? null,
      eventTypes: receivedEventTypes,
    });
  }
  if (userMismatchSummary?.clientEventId !== userMismatchEnvelope.id) {
    fail("User mismatch error clientEventId does not match request envelope id", {
      expectedClientEventId: userMismatchEnvelope.id,
      actualClientEventId: userMismatchSummary?.clientEventId ?? null,
      eventTypes: receivedEventTypes,
    });
  }

  const sessionMismatchLatencyMs =
    sessionMismatchSentAtMs > 0 && sessionMismatchReceivedAtMs >= sessionMismatchSentAtMs
      ? sessionMismatchReceivedAtMs - sessionMismatchSentAtMs
      : null;
  if (!Number.isFinite(sessionMismatchLatencyMs) || sessionMismatchLatencyMs < 0) {
    fail("Session mismatch correlation latency is invalid", {
      sessionMismatchSentAtMs,
      sessionMismatchReceivedAtMs,
      sessionMismatchLatencyMs,
      eventTypes: receivedEventTypes,
    });
  }

  finished = true;
  clearTimeout(timeout);
  try {
    ws.close();
  } catch {
    // ignore close errors
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      wsUrl,
      sessionId,
      userId,
      firstRunId,
      firstResponseStatus,
      sessionMismatchCode: sessionMismatchSummary.code,
      sessionMismatchTraceId: sessionMismatchSummary.traceId,
      sessionMismatchClientEventId: sessionMismatchSummary.clientEventId,
      sessionMismatchExpectedClientEventId: sessionMismatchEnvelope.id,
      sessionMismatchClientEventType: sessionMismatchEnvelope.type,
      sessionMismatchConversation: sessionMismatchEnvelope.conversation ?? "default",
      sessionMismatchLatencyMs,
      userMismatchCode: userMismatchSummary.code,
      userMismatchTraceId: userMismatchSummary.traceId,
      userMismatchClientEventId: userMismatchSummary.clientEventId,
      userMismatchExpectedClientEventId: userMismatchEnvelope.id,
      eventTypes: receivedEventTypes,
    })}\n`,
  );
  process.exit(0);
}

ws.on("open", () => {
  ws.send(JSON.stringify(firstRequestEnvelope));
  firstRequestSent = true;
});

ws.on("message", (raw) => {
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    fail("WebSocket received non-JSON frame", { frame: String(raw).slice(0, 500) });
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

  if (parsed.type === "orchestrator.response" && parsed.runId === firstRunId && parsed.sessionId === sessionId) {
    firstResponseEnvelope = parsed;
    if (!sessionMismatchSent) {
      ws.send(JSON.stringify(sessionMismatchEnvelope));
      sessionMismatchSent = true;
      sessionMismatchSentAtMs = Date.now();
    }
    maybeFinish();
    return;
  }

  if (parsed.type === "gateway.error") {
    const payload = isObject(parsed.payload) ? parsed.payload : null;
    const code = payload && hasStringField(payload, "code") ? payload.code : null;
    if (code === "GATEWAY_SESSION_MISMATCH" && parsed.runId === sessionMismatchRunId) {
      sessionMismatchError = parsed;
      sessionMismatchReceivedAtMs = Date.now();
      if (!userMismatchSent) {
        ws.send(JSON.stringify(userMismatchEnvelope));
        userMismatchSent = true;
      }
      maybeFinish();
      return;
    }
    if (code === "GATEWAY_USER_MISMATCH" && parsed.runId === userMismatchRunId) {
      userMismatchError = parsed;
      maybeFinish();
      return;
    }
    if (parsed.runId === firstRunId) {
      fail("Received gateway.error for first bound request", {
        payload: parsed.payload ?? null,
        eventTypes: receivedEventTypes,
      });
    }
  }
});

ws.on("error", (error) => {
  fail("WebSocket connection error", {
    wsUrl,
    error: error instanceof Error ? error.message : String(error),
  });
});

ws.on("close", (code, reason) => {
  if (!finished) {
    fail("WebSocket closed before binding mismatch checks completed", {
      wsUrl,
      code,
      reason: String(reason),
      eventTypes: receivedEventTypes,
      firstRequestSent,
      sessionMismatchSent,
      userMismatchSent,
    });
  }
});
