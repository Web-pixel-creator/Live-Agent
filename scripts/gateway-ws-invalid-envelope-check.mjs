import { randomUUID } from "node:crypto";
import WebSocket from "ws";

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}

function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertEnvelope(event, prefix = "Invalid envelope") {
  if (!isObject(event)) {
    throw new Error(`${prefix}: payload is not object`);
  }
  if (!hasNonEmptyString(event.id)) {
    throw new Error(`${prefix}: missing id`);
  }
  if (!hasNonEmptyString(event.sessionId)) {
    throw new Error(`${prefix}: missing sessionId`);
  }
  if (!hasNonEmptyString(event.type)) {
    throw new Error(`${prefix}: missing type`);
  }
  if (!hasNonEmptyString(event.source)) {
    throw new Error(`${prefix}: missing source`);
  }
  if (!hasNonEmptyString(event.ts)) {
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
const timeoutMsRaw = Number(args.timeoutMs ?? 9000);
const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 9000;

const ws = new WebSocket(wsUrl);
const eventTypes = [];
let connected = false;
let invalidSent = false;
let gatewayErrorEvent = null;

const timeout = setTimeout(() => {
  fail("Invalid-envelope websocket check timed out", {
    wsUrl,
    eventTypes,
    connected,
    invalidSent,
  });
}, timeoutMs);

function finish() {
  clearTimeout(timeout);
  try {
    ws.close();
  } catch {
    // ignore close failures
  }

  if (!gatewayErrorEvent) {
    fail("Did not receive gateway.error event", {
      wsUrl,
      eventTypes,
      connected,
      invalidSent,
    });
  }

  const payload = isObject(gatewayErrorEvent.payload) ? gatewayErrorEvent.payload : null;
  const code = payload && hasNonEmptyString(payload.code) ? payload.code : null;
  const traceId = payload && hasNonEmptyString(payload.traceId) ? payload.traceId : null;

  if (code !== "GATEWAY_INVALID_ENVELOPE") {
    fail("gateway.error code mismatch for invalid envelope", {
      expectedCode: "GATEWAY_INVALID_ENVELOPE",
      actualCode: code,
      payload,
      eventTypes,
    });
  }

  if (!traceId) {
    fail("gateway.error missing traceId for invalid envelope", {
      payload,
      eventTypes,
    });
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      wsUrl,
      code,
      traceId,
      eventTypes,
      connected,
      invalidSent,
    })}\n`,
  );
  process.exit(0);
}

ws.on("open", () => {
  // wait for gateway.connected first, then send malformed payload.
});

ws.on("message", (raw) => {
  let event;
  try {
    event = JSON.parse(String(raw));
  } catch {
    fail("Received non-JSON frame from gateway", {
      frame: String(raw).slice(0, 500),
      eventTypes,
    });
  }

  try {
    assertEnvelope(event);
  } catch (error) {
    fail("Received malformed envelope from gateway", {
      error: error instanceof Error ? error.message : String(error),
      event,
    });
  }

  eventTypes.push(event.type);

  if (event.type === "gateway.connected") {
    connected = true;
    if (!invalidSent) {
      ws.send(`this-is-not-json-${randomUUID()}`);
      invalidSent = true;
    }
    return;
  }

  if (event.type === "gateway.error") {
    gatewayErrorEvent = event;
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
  if (!gatewayErrorEvent) {
    fail("WebSocket closed before gateway.error received", {
      wsUrl,
      code,
      reason: String(reason),
      eventTypes,
      connected,
      invalidSent,
    });
  }
});
