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

const args = parseArgs(process.argv.slice(2));

const wsUrl = args.url ?? "ws://localhost:8080/realtime";
const sessionId = args.sessionId ?? `ws-interrupt-${randomUUID()}`;
const runId = args.runId ?? `ws-interrupt-run-${randomUUID()}`;
const timeoutMs = Number(args.timeoutMs ?? 12000);
const reason = args.reason ?? "demo_interrupt_checkpoint";

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  fail("Invalid timeoutMs argument", { timeoutMs: args.timeoutMs });
}

const requestEnvelope = {
  id: randomUUID(),
  sessionId,
  runId,
  type: "live.interrupt",
  source: "frontend",
  ts: new Date().toISOString(),
  payload: {
    reason,
    sentAtMs: Date.now(),
  },
};

const receivedEventTypes = [];
let connectedEnvelope = null;
let interruptEnvelope = null;

const acceptedInterruptEvents = new Set(["live.interrupt.requested", "live.bridge.unavailable"]);

const ws = new WebSocket(wsUrl);

const timeout = setTimeout(() => {
  fail("WebSocket interrupt check timed out", {
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
  if (!interruptEnvelope) {
    fail("Did not receive interruption lifecycle event", {
      wsUrl,
      runId,
      expectedEvents: [...acceptedInterruptEvents],
      receivedEventTypes,
    });
  }

  const interruptEventType = interruptEnvelope.type;
  const interruptPayload = isObject(interruptEnvelope.payload) ? interruptEnvelope.payload : {};
  const result = {
    ok: true,
    wsUrl,
    sessionId,
    runId,
    connectedType: connectedEnvelope.type,
    liveApiEnabled:
      isObject(connectedEnvelope.payload) && typeof connectedEnvelope.payload.liveApiEnabled === "boolean"
        ? connectedEnvelope.payload.liveApiEnabled
        : null,
    interruptEventType,
    interruptReason:
      typeof interruptPayload.reason === "string"
        ? interruptPayload.reason
        : typeof interruptPayload.error === "string"
          ? interruptPayload.error
          : null,
    eventTypes: receivedEventTypes,
  };

  process.stdout.write(`${JSON.stringify(result)}\n`);
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

  if (parsed.type === "gateway.error") {
    fail("Received gateway.error during interrupt signal check", {
      payload: parsed.payload ?? null,
      runId,
      receivedEventTypes,
    });
  }

  if (acceptedInterruptEvents.has(parsed.type) && parsed.sessionId === sessionId) {
    interruptEnvelope = parsed;
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
  if (!interruptEnvelope) {
    fail("WebSocket closed before expected interrupt lifecycle event", {
      wsUrl,
      code,
      reason: String(reasonText),
      runId,
      receivedEventTypes,
    });
  }
});
