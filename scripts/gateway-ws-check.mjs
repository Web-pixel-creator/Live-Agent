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
  const payload = {
    ok: false,
    error: message,
    details: details ?? null,
  };
  process.stderr.write(`${JSON.stringify(payload)}\n`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

const wsUrl = args.url ?? "ws://localhost:8080/realtime";
const sessionId = args.sessionId ?? `ws-check-${randomUUID()}`;
const runId = args.runId ?? `ws-check-run-${randomUUID()}`;
const userId = args.userId ?? "demo-user";
const timeoutMs = Number(args.timeoutMs ?? 12000);

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  fail("Invalid timeoutMs argument", { timeoutMs: args.timeoutMs });
}

const requestEnvelope = {
  id: randomUUID(),
  userId,
  sessionId,
  runId,
  type: "orchestrator.request",
  source: "frontend",
  ts: new Date().toISOString(),
  payload: {
    intent: "translation",
    input: {
      text: "Hello from gateway websocket e2e check.",
      targetLanguage: "ru",
    },
  },
};

const receivedEventTypes = [];
let connectedEnvelope = null;
let responseEnvelope = null;
const sessionStateEvents = [];
let requestSentAtMs = 0;

const ws = new WebSocket(wsUrl);

const timeout = setTimeout(() => {
  fail("WebSocket check timed out", {
    wsUrl,
    sessionId,
    runId,
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
      receivedEventTypes,
    });
  }
  if (!responseEnvelope) {
    fail("Did not receive orchestrator.response envelope", {
      wsUrl,
      runId,
      receivedEventTypes,
    });
  }

  const responseStatus =
    isObject(responseEnvelope.payload) && typeof responseEnvelope.payload.status === "string"
      ? responseEnvelope.payload.status
      : null;
  const responseRoute =
    isObject(responseEnvelope.payload) && typeof responseEnvelope.payload.route === "string"
      ? responseEnvelope.payload.route
      : null;
  const responseTranslation =
    isObject(responseEnvelope.payload) &&
    isObject(responseEnvelope.payload.output) &&
    isObject(responseEnvelope.payload.output.translation)
      ? responseEnvelope.payload.output.translation
      : null;
  const responseUserId = hasStringField(responseEnvelope, "userId") ? responseEnvelope.userId : null;

  if (responseUserId !== userId) {
    fail("WebSocket response userId mismatch", {
      expectedUserId: userId,
      responseUserId,
      runId,
      sessionId,
      receivedEventTypes,
    });
  }

  if (responseStatus !== "completed") {
    fail("WebSocket response status is not completed", {
      responseStatus,
      responseRoute,
      runId,
      receivedEventTypes,
    });
  }
  if (responseRoute !== "live-agent") {
    fail("WebSocket response route is not live-agent", {
      responseStatus,
      responseRoute,
      runId,
      receivedEventTypes,
    });
  }
  if (!responseTranslation) {
    fail("WebSocket translation payload is missing", {
      responseStatus,
      responseRoute,
      runId,
      receivedEventTypes,
    });
  }

  const transitionStates = sessionStateEvents
    .filter((event) => event.runId === runId && event.sessionId === sessionId)
    .map((event) =>
      isObject(event.payload) && typeof event.payload.state === "string" ? event.payload.state : null,
    )
    .filter((state) => typeof state === "string");
  const requiredTransitions = ["session_bound", "orchestrator_dispatching", "orchestrator_completed"];
  const missingTransitions = requiredTransitions.filter((state) => !transitionStates.includes(state));
  if (missingTransitions.length > 0) {
    fail("Missing required session.state transitions", {
      requiredTransitions,
      missingTransitions,
      transitionStates,
      runId,
      sessionId,
      userId,
    });
  }

  const invalidStateContext = sessionStateEvents.find(
    (event) =>
      event.runId === runId &&
      event.sessionId === sessionId &&
      (!hasStringField(event, "userId") || event.userId !== userId),
  );
  if (invalidStateContext) {
    fail("session.state event has invalid correlation context", {
      expectedUserId: userId,
      badEvent: invalidStateContext,
      runId,
      sessionId,
    });
  }

  const roundTripMs = requestSentAtMs > 0 ? Math.max(0, Date.now() - requestSentAtMs) : null;
  const contextValidated = missingTransitions.length === 0 && !invalidStateContext;
  const result = {
    ok: true,
    wsUrl,
    sessionId,
    runId,
    userId,
    connectedType: connectedEnvelope.type,
    responseType: responseEnvelope.type,
    responseStatus,
    responseRoute,
    roundTripMs,
    eventTypes: receivedEventTypes,
    sessionStateCount: transitionStates.length,
    sessionStateTransitions: transitionStates,
    contextValidated,
    translationProvider:
      typeof responseTranslation.provider === "string" ? responseTranslation.provider : null,
    translationModel:
      typeof responseTranslation.model === "string" ? responseTranslation.model : null,
  };

  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(0);
}

ws.on("open", () => {
  requestSentAtMs = Date.now();
  ws.send(JSON.stringify(requestEnvelope));
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
  }

  if (parsed.type === "session.state") {
    sessionStateEvents.push(parsed);
  }

  if (parsed.type === "gateway.error" && parsed.runId === runId) {
    fail("Received gateway.error for websocket scenario", {
      payload: parsed.payload ?? null,
      runId,
      receivedEventTypes,
    });
  }

  if (parsed.type === "orchestrator.response" && parsed.runId === runId && parsed.sessionId === sessionId) {
    responseEnvelope = parsed;
    finish();
  }
});

ws.on("error", (error) => {
  fail("WebSocket connection error", {
    wsUrl,
    error: error instanceof Error ? error.message : String(error),
  });
});

ws.on("close", (code, reason) => {
  if (!responseEnvelope) {
    fail("WebSocket closed before expected response", {
      wsUrl,
      code,
      reason: String(reason),
      runId,
      receivedEventTypes,
    });
  }
});
