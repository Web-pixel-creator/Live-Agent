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

function gatewayHttpBaseFromWs(wsUrl) {
  if (typeof wsUrl !== "string") {
    return "http://localhost:8080";
  }
  if (wsUrl.startsWith("wss://")) {
    return wsUrl.replace(/^wss:\/\//, "https://").replace(/\/realtime\/?$/, "");
  }
  if (wsUrl.startsWith("ws://")) {
    return wsUrl.replace(/^ws:\/\//, "http://").replace(/\/realtime\/?$/, "");
  }
  return "http://localhost:8080";
}

async function postJson(url, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function buildRequestEnvelope(params) {
  return {
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
}

const args = parseArgs(process.argv.slice(2));
const wsUrl = args.url ?? "ws://localhost:8080/realtime";
const gatewayHttpBase = args.gatewayHttpBase ?? gatewayHttpBaseFromWs(wsUrl);
const sessionId = args.sessionId ?? `ws-drain-${randomUUID()}`;
const runIdBase = args.runId ?? `ws-drain-run-${randomUUID()}`;
const userId = args.userId ?? "demo-user";
const timeoutMs = Number(args.timeoutMs ?? 18000);

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  fail("Invalid timeoutMs argument", { timeoutMs: args.timeoutMs });
}

const drainRunId = `${runIdBase}-drain`;
const recoveryRunId = `${runIdBase}-recovery`;
const controlTimeoutMs = Math.max(3000, Math.min(timeoutMs, 10000));

const drainRequestEnvelope = buildRequestEnvelope({
  userId,
  sessionId,
  runId: drainRunId,
  text: "Draining check request should be rejected.",
});
const recoveryRequestEnvelope = buildRequestEnvelope({
  userId,
  sessionId,
  runId: recoveryRunId,
  text: "Warmup recovery request should succeed.",
});

const receivedEventTypes = [];
let connectedEnvelope = null;
let drainState = null;
let warmupState = null;
let drainingErrorEnvelope = null;
let recoveryResponseEnvelope = null;
let finished = false;
let drainingRequestSent = false;
let recoveryRequestSent = false;

const ws = new WebSocket(wsUrl);

const timeout = setTimeout(() => {
  fail("WebSocket draining check timed out", {
    wsUrl,
    gatewayHttpBase,
    sessionId,
    runIdBase,
    eventTypes: receivedEventTypes,
    drainState,
    warmupState,
    drainingRequestSent,
    recoveryRequestSent,
    drainingErrorSeen: Boolean(drainingErrorEnvelope),
    recoveryResponseSeen: Boolean(recoveryResponseEnvelope),
  });
}, timeoutMs);

function drainingErrorSummary() {
  if (!isObject(drainingErrorEnvelope)) {
    return null;
  }
  const payload = isObject(drainingErrorEnvelope.payload) ? drainingErrorEnvelope.payload : null;
  return {
    code: payload && hasStringField(payload, "code") ? payload.code : null,
    traceId: payload && hasStringField(payload, "traceId") ? payload.traceId : null,
  };
}

function recoveryResponseSummary() {
  if (!isObject(recoveryResponseEnvelope)) {
    return null;
  }
  const payload = isObject(recoveryResponseEnvelope.payload) ? recoveryResponseEnvelope.payload : null;
  return {
    status: payload && hasStringField(payload, "status") ? payload.status : null,
    route: payload && hasStringField(payload, "route") ? payload.route : null,
  };
}

function maybeFinish() {
  if (finished) {
    return;
  }
  if (!connectedEnvelope || !drainingErrorEnvelope || !recoveryResponseEnvelope) {
    return;
  }
  const draining = drainingErrorSummary();
  const recovery = recoveryResponseSummary();
  if (draining?.code !== "GATEWAY_DRAINING") {
    fail("Expected GATEWAY_DRAINING during drain mode", {
      draining,
      eventTypes: receivedEventTypes,
    });
  }
  if (!draining?.traceId) {
    fail("GATEWAY_DRAINING error is missing traceId", {
      draining,
      eventTypes: receivedEventTypes,
    });
  }
  if (recovery?.status !== "completed") {
    fail("Recovery websocket request did not complete after warmup", {
      recovery,
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
      gatewayHttpBase,
      sessionId,
      userId,
      runIdBase,
      drainingRunId: drainRunId,
      recoveryRunId,
      drainState,
      warmupState,
      drainingCode: draining.code,
      drainingTraceId: draining.traceId,
      recoveryStatus: recovery.status,
      recoveryRoute: recovery.route,
      eventTypes: receivedEventTypes,
    })}\n`,
  );
  process.exit(0);
}

ws.on("open", () => {
  // Wait for gateway.connected to apply drain before sending the request.
});

ws.on("message", async (raw) => {
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

  if (parsed.type === "gateway.connected" && !connectedEnvelope) {
    connectedEnvelope = parsed;
    try {
      const drainResponse = await postJson(`${gatewayHttpBase}/drain`, {}, controlTimeoutMs);
      const runtime = isObject(drainResponse?.runtime) ? drainResponse.runtime : null;
      drainState = runtime && hasStringField(runtime, "state") ? runtime.state : null;
    } catch (error) {
      fail("Failed to switch gateway into drain mode", {
        gatewayHttpBase,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    ws.send(JSON.stringify(drainRequestEnvelope));
    drainingRequestSent = true;
    return;
  }

  if (parsed.type === "gateway.error" && parsed.runId === drainRunId) {
    drainingErrorEnvelope = parsed;
    try {
      const warmupResponse = await postJson(`${gatewayHttpBase}/warmup`, {}, controlTimeoutMs);
      const runtime = isObject(warmupResponse?.runtime) ? warmupResponse.runtime : null;
      warmupState = runtime && hasStringField(runtime, "state") ? runtime.state : null;
    } catch (error) {
      fail("Failed to warmup gateway after drain rejection", {
        gatewayHttpBase,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    ws.send(JSON.stringify(recoveryRequestEnvelope));
    recoveryRequestSent = true;
    maybeFinish();
    return;
  }

  if (parsed.type === "gateway.error" && parsed.runId === recoveryRunId) {
    fail("Recovery websocket request returned gateway.error after warmup", {
      payload: parsed.payload ?? null,
      eventTypes: receivedEventTypes,
      warmupState,
    });
  }

  if (
    parsed.type === "orchestrator.response" &&
    parsed.runId === recoveryRunId &&
    parsed.sessionId === sessionId
  ) {
    recoveryResponseEnvelope = parsed;
    maybeFinish();
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
    fail("WebSocket closed before draining checks completed", {
      wsUrl,
      code,
      reason: String(reason),
      eventTypes: receivedEventTypes,
      drainState,
      warmupState,
      drainingRequestSent,
      recoveryRequestSent,
    });
  }
});
