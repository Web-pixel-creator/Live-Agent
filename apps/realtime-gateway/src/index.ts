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

const server = createServer((req, res) => {
  if (req.url === "/healthz" && req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, service: "realtime-gateway" }));
    return;
  }
  res.statusCode = 404;
  res.end("Not found");
});

const wss = new WebSocketServer({ server, path: "/realtime" });

wss.on("connection", (ws) => {
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
