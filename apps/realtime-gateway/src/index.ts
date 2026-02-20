import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  createEnvelope,
  safeParseEnvelope,
  type EventEnvelope,
  type OrchestratorRequest,
} from "@mla/contracts";
import { WebSocketServer } from "ws";
import { loadGatewayConfig } from "./config.js";
import { LiveApiBridge } from "./live-bridge.js";
import { sendToOrchestrator } from "./orchestrator-client.js";

const config = loadGatewayConfig();
const serviceName = "realtime-gateway";
const serviceVersion = process.env.REALTIME_GATEWAY_VERSION ?? process.env.SERVICE_VERSION ?? "0.1.0";
const startedAtMs = Date.now();
let draining = false;
let lastWarmupAt: string | null = new Date().toISOString();
let lastDrainAt: string | null = null;

function runtimeState(): Record<string, unknown> {
  return {
    state: draining ? "draining" : "ready",
    ready: !draining,
    draining,
    startedAt: new Date(startedAtMs).toISOString(),
    uptimeSec: Math.floor((Date.now() - startedAtMs) / 1000),
    lastWarmupAt,
    lastDrainAt,
    version: serviceVersion,
  };
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/healthz" && req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: serviceName,
        runtime: runtimeState(),
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
        runtime: runtimeState(),
      }),
    );
    return;
  }

  if (url.pathname === "/version" && req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: serviceName,
        version: serviceVersion,
      }),
    );
    return;
  }

  if (url.pathname === "/warmup" && req.method === "POST") {
    draining = false;
    lastWarmupAt = new Date().toISOString();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: serviceName,
        runtime: runtimeState(),
      }),
    );
    return;
  }

  if (url.pathname === "/drain" && req.method === "POST") {
    draining = true;
    lastDrainAt = new Date().toISOString();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: serviceName,
        runtime: runtimeState(),
      }),
    );
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

const wss = new WebSocketServer({ server, path: "/realtime" });

wss.on("connection", (ws) => {
  if (draining) {
    ws.send(
      JSON.stringify(
        createEnvelope({
          sessionId: "system",
          type: "gateway.error",
          source: "gateway",
          payload: {
            code: "GATEWAY_DRAINING",
            message: "gateway is draining and does not accept new websocket sessions",
            runtime: runtimeState(),
          },
        }),
      ),
    );
    ws.close(1013, "gateway draining");
    return;
  }

  let currentSessionId = "system";
  let liveBridge: LiveApiBridge | null = null;

  const sendEvent = (event: EventEnvelope): void => {
    ws.send(JSON.stringify(event));
  };

  const ensureLiveBridge = (sessionId: string): LiveApiBridge => {
    if (!liveBridge || currentSessionId !== sessionId) {
      liveBridge?.close();
      liveBridge = new LiveApiBridge({
        config,
        sessionId,
        send: sendEvent,
      });
    }
    return liveBridge;
  };

  sendEvent(
    createEnvelope({
      sessionId: currentSessionId,
      type: "gateway.connected",
      source: "gateway",
      payload: {
        ok: true,
        liveApiEnabled: config.liveApiEnabled,
        runtime: runtimeState(),
      },
    }),
  );

  ws.on("message", async (raw) => {
    const parsedEnvelope = safeParseEnvelope(raw.toString("utf8"));
    if (!parsedEnvelope) {
      const traceId = randomUUID();
      sendEvent(
        createEnvelope({
          sessionId: "unknown",
          runId: traceId,
          type: "gateway.error",
          source: "gateway",
          payload: {
            code: "GATEWAY_INVALID_ENVELOPE",
            message: "Invalid event envelope",
            traceId,
          },
        }),
      );
      return;
    }

    const parsed: EventEnvelope = parsedEnvelope;

    currentSessionId = parsed.sessionId;

    if (draining) {
      sendEvent(
        createEnvelope({
          sessionId: parsed.sessionId,
          runId: parsed.runId,
          type: "gateway.error",
          source: "gateway",
          payload: {
            code: "GATEWAY_DRAINING",
            message: "gateway is draining and does not accept new requests",
            runtime: runtimeState(),
          },
        }),
      );
      return;
    }

    try {
      if (parsed.type.startsWith("live.")) {
        const bridge = ensureLiveBridge(parsed.sessionId);
        await bridge.forwardFromClient(parsed);
        return;
      }

      const request: OrchestratorRequest = parsed.runId
        ? (parsed as OrchestratorRequest)
        : ({ ...parsed, runId: parsed.id } as OrchestratorRequest);
      const response = await sendToOrchestrator(config.orchestratorUrl, request, {
        timeoutMs: config.orchestratorTimeoutMs,
        maxRetries: config.orchestratorMaxRetries,
        retryBackoffMs: config.orchestratorRetryBackoffMs,
      });
      sendEvent(response);
    } catch (error) {
      const traceId = randomUUID();
      sendEvent(
        createEnvelope({
          sessionId: parsed.sessionId,
          runId: parsed.runId,
          type: "gateway.error",
          source: "gateway",
          payload: {
            code: "GATEWAY_ORCHESTRATOR_FAILURE",
            message: error instanceof Error ? error.message : "Unknown gateway failure",
            traceId,
          },
        }),
      );
    }
  });

  ws.on("close", () => {
    liveBridge?.close();
    liveBridge = null;
  });
});

server.listen(config.port, () => {
  console.log(`[realtime-gateway] listening on :${config.port}`);
  console.log(`[realtime-gateway] websocket endpoint ws://localhost:${config.port}/realtime`);
});
