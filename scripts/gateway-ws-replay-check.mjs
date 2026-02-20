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
const sessionId = args.sessionId ?? `ws-replay-${randomUUID()}`;
const runId = args.runId ?? `ws-replay-run-${randomUUID()}`;
const userId = args.userId ?? "demo-user";
const timeoutMs = Number(args.timeoutMs ?? 16000);

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  fail("Invalid timeoutMs argument", { timeoutMs: args.timeoutMs });
}

const idempotencyKey = args.idempotencyKey ?? `idem-${runId}`;

function buildRequestEnvelope() {
  return {
    id: randomUUID(),
    userId,
    sessionId,
    runId,
    type: "orchestrator.request",
    source: "frontend",
    ts: new Date().toISOString(),
    payload: {
      intent: "translation",
      idempotencyKey,
      input: {
        text: "Replay dedupe websocket check.",
        targetLanguage: "ru",
      },
    },
  };
}

const receivedEventTypes = [];
let connectedEnvelope = null;
const responses = [];
const replayEvents = [];
let taskStartedCount = 0;
let secondRequestSent = false;
let finalized = false;

const ws = new WebSocket(wsUrl);

const timeout = setTimeout(() => {
  fail("WebSocket replay check timed out", {
    wsUrl,
    sessionId,
    runId,
    idempotencyKey,
    receivedEventTypes,
    responseCount: responses.length,
    replayEventCount: replayEvents.length,
    taskStartedCount,
  });
}, timeoutMs);

function finish() {
  if (finalized) {
    return;
  }
  finalized = true;
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
  if (responses.length < 2) {
    fail("Did not receive two orchestrator responses", {
      runId,
      sessionId,
      responseCount: responses.length,
      receivedEventTypes,
    });
  }

  const first = responses[0];
  const second = responses[1];
  const firstPayload = isObject(first.payload) ? first.payload : null;
  const secondPayload = isObject(second.payload) ? second.payload : null;

  const firstStatus = firstPayload && typeof firstPayload.status === "string" ? firstPayload.status : null;
  const secondStatus = secondPayload && typeof secondPayload.status === "string" ? secondPayload.status : null;
  const firstRoute = firstPayload && typeof firstPayload.route === "string" ? firstPayload.route : null;
  const secondRoute = secondPayload && typeof secondPayload.route === "string" ? secondPayload.route : null;

  if (firstStatus !== "completed" || secondStatus !== "completed") {
    fail("Replay scenario response status is not completed", {
      firstStatus,
      secondStatus,
      runId,
      receivedEventTypes,
    });
  }
  if (firstRoute !== "live-agent" || secondRoute !== "live-agent") {
    fail("Replay scenario response route is not live-agent", {
      firstRoute,
      secondRoute,
      runId,
      receivedEventTypes,
    });
  }

  if (taskStartedCount !== 1) {
    fail("Replay scenario should produce exactly one task.started event", {
      taskStartedCount,
      runId,
      sessionId,
      receivedEventTypes,
    });
  }

  if (replayEvents.length < 1) {
    fail("Replay scenario did not receive gateway.request_replayed event", {
      runId,
      sessionId,
      receivedEventTypes,
    });
  }

  const replayEvent = replayEvents[0];
  const replayPayload = isObject(replayEvent.payload) ? replayEvent.payload : {};
  const responseIdReused = first.id === second.id;
  if (!responseIdReused) {
    fail("Replay scenario expected second response to reuse cached response envelope id", {
      firstResponseId: first.id,
      secondResponseId: second.id,
      runId,
      receivedEventTypes,
    });
  }

  const result = {
    ok: true,
    wsUrl,
    sessionId,
    runId,
    userId,
    idempotencyKey,
    responseIds: [first.id, second.id],
    responseIdReused,
    replayEventCount: replayEvents.length,
    replayEventType: replayEvent.type,
    replayAgeMs: typeof replayPayload.ageMs === "number" ? replayPayload.ageMs : null,
    taskStartedCount,
    eventTypes: receivedEventTypes,
  };

  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(0);
}

ws.on("open", () => {
  ws.send(JSON.stringify(buildRequestEnvelope()));
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

  if (parsed.type === "task.started" && parsed.runId === runId && parsed.sessionId === sessionId) {
    taskStartedCount += 1;
  }

  if (parsed.type === "gateway.request_replayed" && parsed.runId === runId && parsed.sessionId === sessionId) {
    replayEvents.push(parsed);
  }

  if (parsed.type === "gateway.error" && parsed.runId === runId) {
    fail("Received gateway.error for replay scenario", {
      payload: parsed.payload ?? null,
      runId,
      receivedEventTypes,
    });
  }

  if (parsed.type === "orchestrator.response" && parsed.runId === runId && parsed.sessionId === sessionId) {
    responses.push(parsed);
    if (!secondRequestSent && responses.length === 1) {
      secondRequestSent = true;
      ws.send(JSON.stringify(buildRequestEnvelope()));
      return;
    }
  }

  if (responses.length >= 2 && replayEvents.length >= 1) {
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
  if (!finalized) {
    fail("WebSocket closed before replay checks completed", {
      wsUrl,
      code,
      reason: String(reason),
      runId,
      sessionId,
      receivedEventTypes,
    });
  }
});
