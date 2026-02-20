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

async function fetchActiveTasks(params) {
  const url = new URL(`${params.gatewayHttpBase}/tasks/active`);
  url.searchParams.set("sessionId", params.sessionId);
  url.searchParams.set("limit", "50");
  const response = await fetch(url, { method: "GET" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`tasks/active failed: ${response.status}`);
  }
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return data;
}

const args = parseArgs(process.argv.slice(2));

const wsUrl = args.url ?? "ws://localhost:8080/realtime";
const gatewayHttpBase = args.gatewayHttpBase ?? gatewayHttpBaseFromWs(wsUrl);
const sessionId = args.sessionId ?? `ws-task-${randomUUID()}`;
const runId = args.runId ?? `ws-task-run-${randomUUID()}`;
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
    intent: "ui_task",
    input: {
      goal: "Open payment screen and submit card details.",
      url: "https://example.com",
      screenshotRef: "ui://ws-task-check/start",
      maxSteps: 5,
      formData: {
        email: "ws-check@example.com",
      },
    },
  },
};

const receivedEventTypes = [];
let connectedEnvelope = null;
let responseEnvelope = null;
let taskStartedEnvelope = null;
let taskProgressCount = 0;
let finalizing = false;

const ws = new WebSocket(wsUrl);

const timeout = setTimeout(() => {
  fail("WebSocket task-progress check timed out", {
    wsUrl,
    gatewayHttpBase,
    sessionId,
    runId,
    receivedEventTypes,
    taskProgressCount,
  });
}, timeoutMs);

function getTaskId(envelope) {
  if (!isObject(envelope) || !isObject(envelope.payload)) {
    return null;
  }
  return typeof envelope.payload.taskId === "string" ? envelope.payload.taskId : null;
}

async function tryFinish() {
  if (finalizing) {
    return;
  }
  if (!connectedEnvelope || !responseEnvelope || !taskStartedEnvelope || taskProgressCount < 1) {
    return;
  }
  finalizing = true;

  const taskId = getTaskId(taskStartedEnvelope);
  if (!taskId) {
    fail("task.started payload missing taskId", {
      receivedEventTypes,
      taskStartedEnvelope,
    });
  }

  let activeTasks;
  try {
    activeTasks = await fetchActiveTasks({
      gatewayHttpBase,
      sessionId,
    });
  } catch (error) {
    fail("Failed to read /tasks/active", {
      error: error instanceof Error ? error.message : String(error),
      gatewayHttpBase,
      sessionId,
      taskId,
      receivedEventTypes,
    });
  }

  const matching = activeTasks.find((task) => isObject(task) && task.taskId === taskId);
  if (!matching) {
    fail("Active task list does not include expected taskId", {
      taskId,
      activeTaskCount: activeTasks.length,
      activeTasks,
      receivedEventTypes,
    });
  }

  if (matching.status !== "running" && matching.status !== "pending_approval") {
    fail("Active task has unexpected status", {
      taskId,
      status: matching.status,
      matching,
      receivedEventTypes,
    });
  }

  const badContextEvent = [taskStartedEnvelope, responseEnvelope]
    .filter((event) => event && event.runId === runId && event.sessionId === sessionId)
    .find((event) => !hasStringField(event, "userId") || event.userId !== userId);
  if (badContextEvent) {
    fail("Task-progress events have invalid user/session/run context", {
      expectedUserId: userId,
      badContextEvent,
      runId,
      sessionId,
    });
  }

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
      runId,
      userId,
      taskId,
      responseStatus:
        isObject(responseEnvelope.payload) && typeof responseEnvelope.payload.status === "string"
          ? responseEnvelope.payload.status
          : null,
      taskStatus: matching.status,
      taskProgressCount,
      activeTaskCount: activeTasks.length,
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
    taskStartedEnvelope = parsed;
  }

  if (parsed.type === "task.progress" && parsed.runId === runId && parsed.sessionId === sessionId) {
    taskProgressCount += 1;
  }

  if (parsed.type === "gateway.error" && parsed.runId === runId) {
    fail("Received gateway.error for task-progress scenario", {
      payload: parsed.payload ?? null,
      runId,
      receivedEventTypes,
    });
  }

  if (parsed.type === "orchestrator.response" && parsed.runId === runId && parsed.sessionId === sessionId) {
    responseEnvelope = parsed;
  }

  void tryFinish();
});

ws.on("error", (error) => {
  fail("WebSocket connection error", {
    wsUrl,
    error: error instanceof Error ? error.message : String(error),
  });
});

ws.on("close", (code, reason) => {
  if (!finalizing) {
    fail("WebSocket closed before task-progress checks completed", {
      wsUrl,
      code,
      reason: String(reason),
      sessionId,
      runId,
      receivedEventTypes,
    });
  }
});
