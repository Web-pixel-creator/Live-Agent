import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";

type ConnectionState = {
  id: string;
  connectedAtIso: string;
  setupModel: string | null;
  setupVoice: string | null;
  pendingAudioChunks: number;
  lastUserText: string | null;
  activeStreamTimers: Set<NodeJS.Timeout>;
  interruptedCount: number;
  completedTurns: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function createState(): ConnectionState {
  return {
    id: randomUUID(),
    connectedAtIso: new Date().toISOString(),
    setupModel: null,
    setupVoice: null,
    pendingAudioChunks: 0,
    lastUserText: null,
    activeStreamTimers: new Set<NodeJS.Timeout>(),
    interruptedCount: 0,
    completedTurns: 0,
  };
}

function jsonSend(ws: WebSocket, payload: unknown): void {
  ws.send(JSON.stringify(payload));
}

function clearActiveStream(state: ConnectionState): void {
  for (const timer of state.activeStreamTimers) {
    clearTimeout(timer);
  }
  state.activeStreamTimers.clear();
}

function splitSoftChunks(text: string, maxLen = 40): string[] {
  const normalized = text.trim();
  if (normalized.length <= maxLen) {
    return [normalized];
  }

  const parts: string[] = [];
  let current = "";
  for (const word of normalized.split(/\s+/)) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length > maxLen && current.length > 0) {
      parts.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) {
    parts.push(current);
  }
  return parts.length > 0 ? parts : [normalized];
}

function sendModelChunk(ws: WebSocket, text: string, options?: { turnComplete?: boolean }): void {
  jsonSend(ws, {
    serverContent: {
      modelTurn: {
        parts: [{ text }],
      },
      outputTranscript: text,
      turnComplete: options?.turnComplete === true,
    },
  });
}

function sendInterrupted(ws: WebSocket): void {
  jsonSend(ws, {
    serverContent: {
      interrupted: true,
      turnComplete: true,
    },
  });
}

function scheduleEchoStream(params: {
  ws: WebSocket;
  state: ConnectionState;
  text: string;
  prefix?: string;
}): void {
  const payloadText = params.prefix ? `${params.prefix}${params.text}` : params.text;
  const chunks = splitSoftChunks(payloadText);
  clearActiveStream(params.state);

  chunks.forEach((chunk, index) => {
    const isLast = index === chunks.length - 1;
    const timer = setTimeout(() => {
      if (params.ws.readyState !== 1) {
        return;
      }
      sendModelChunk(params.ws, chunk, { turnComplete: isLast });
      if (isLast) {
        params.state.completedTurns += 1;
        params.state.pendingAudioChunks = 0;
      }
      params.state.activeStreamTimers.delete(timer);
    }, 120 + index * 140);
    params.state.activeStreamTimers.add(timer);
  });
}

function handleSetup(ws: WebSocket, state: ConnectionState, message: Record<string, unknown>): void {
  const setup = asRecord(message.setup);
  const generationConfig = setup ? asRecord(setup.generationConfig) : null;
  const speechConfig = generationConfig ? asRecord(generationConfig.speechConfig) : null;
  const voiceConfig = speechConfig ? asRecord(speechConfig.voiceConfig) : null;
  const prebuiltVoice = voiceConfig ? asRecord(voiceConfig.prebuiltVoiceConfig) : null;

  state.setupModel = setup ? toNonEmptyString(setup.model) : null;
  state.setupVoice = prebuiltVoice ? toNonEmptyString(prebuiltVoice.voiceName) : null;

  const model = state.setupModel ?? "unknown-model";
  const voice = state.setupVoice ?? "default-voice";
  sendModelChunk(ws, `Mock setup acknowledged (${model}, voice=${voice}).`, { turnComplete: true });
}

function handleClientContent(ws: WebSocket, state: ConnectionState, message: Record<string, unknown>): void {
  const clientContent = asRecord(message.clientContent);
  const turns = clientContent && Array.isArray(clientContent.turns) ? clientContent.turns : [];
  let lastText: string | null = null;

  for (const turn of turns) {
    const turnRecord = asRecord(turn);
    const parts = turnRecord && Array.isArray(turnRecord.parts) ? turnRecord.parts : [];
    for (const part of parts) {
      const partRecord = asRecord(part);
      const text = partRecord ? toNonEmptyString(partRecord.text) : null;
      if (text) {
        lastText = text;
      }
    }
  }

  if (!lastText) {
    sendModelChunk(ws, "Mock received clientContent without text.", { turnComplete: true });
    return;
  }

  state.lastUserText = lastText;
  scheduleEchoStream({
    ws,
    state,
    text: lastText,
    prefix: "Echo: ",
  });
}

function handleRealtimeInput(ws: WebSocket, state: ConnectionState, message: Record<string, unknown>): void {
  const realtimeInput = asRecord(message.realtimeInput);
  if (!realtimeInput) {
    return;
  }

  const mediaChunks = Array.isArray(realtimeInput.mediaChunks) ? realtimeInput.mediaChunks : [];
  if (mediaChunks.length > 0) {
    state.pendingAudioChunks += mediaChunks.length;
  }

  const activityEnd = realtimeInput.activityEnd === true;
  if (!activityEnd) {
    return;
  }

  if (state.activeStreamTimers.size > 0) {
    clearActiveStream(state);
    state.interruptedCount += 1;
    sendInterrupted(ws);
    return;
  }

  if (state.pendingAudioChunks > 0) {
    const text = `Audio turn received (${state.pendingAudioChunks} chunks).`;
    scheduleEchoStream({
      ws,
      state,
      text,
      prefix: "Mock transcript: ",
    });
    return;
  }

  sendModelChunk(ws, "Activity end acknowledged.", { turnComplete: true });
}

function handleMessage(ws: WebSocket, state: ConnectionState, rawText: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    sendModelChunk(ws, "Invalid JSON frame received by mock.", { turnComplete: true });
    return;
  }

  const message = asRecord(parsed);
  if (!message) {
    sendModelChunk(ws, "Unsupported frame type received by mock.", { turnComplete: true });
    return;
  }

  if (message.setup) {
    handleSetup(ws, state, message);
    return;
  }

  if (message.clientContent) {
    handleClientContent(ws, state, message);
    return;
  }

  if (message.realtimeInput) {
    handleRealtimeInput(ws, state, message);
    return;
  }

  sendModelChunk(ws, "Frame accepted by mock (no-op).", { turnComplete: true });
}

const port = Number(process.env.LIVE_MOCK_PORT ?? 8091);
const wsPath = process.env.LIVE_MOCK_WS_PATH ?? "/live";
const serviceName = "live-api-echo-mock";
const serviceVersion = process.env.LIVE_MOCK_VERSION ?? process.env.SERVICE_VERSION ?? "0.1.0";

const activeConnections = new Map<string, ConnectionState>();

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname === "/healthz" && req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: serviceName,
        version: serviceVersion,
        wsPath,
        activeConnections: activeConnections.size,
      }),
    );
    return;
  }

  if (url.pathname === "/status" && req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: serviceName,
        version: serviceVersion,
        activeConnections: activeConnections.size,
      }),
    );
    return;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      ok: false,
      service: serviceName,
      error: "Not found",
      path: url.pathname,
    }),
  );
});

const wss = new WebSocketServer({ server, path: wsPath });

wss.on("connection", (ws) => {
  const state = createState();
  activeConnections.set(state.id, state);

  ws.on("message", (raw) => {
    handleMessage(ws, state, raw.toString("utf8"));
  });

  ws.on("close", () => {
    clearActiveStream(state);
    activeConnections.delete(state.id);
  });
});

server.listen(port, () => {
  console.log(`[${serviceName}] listening on :${port}`);
  console.log(`[${serviceName}] websocket endpoint ws://localhost:${port}${wsPath}`);
});
