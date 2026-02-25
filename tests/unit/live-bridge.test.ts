import test from "node:test";
import assert from "node:assert/strict";
import { WebSocketServer } from "ws";
import { createServer as createNetServer, type AddressInfo, type Server as NetServer, type Socket } from "node:net";
import { createEnvelope, type EventEnvelope } from "../../shared/contracts/src/index.js";
import { LiveApiBridge } from "../../apps/realtime-gateway/src/live-bridge.js";
import type { GatewayConfig } from "../../apps/realtime-gateway/src/config.js";

function createGatewayConfig(overrides: Partial<GatewayConfig>): GatewayConfig {
  return {
    port: 8080,
    gatewayTransportMode: "websocket",
    orchestratorUrl: "http://localhost:8082/orchestrate",
    orchestratorTimeoutMs: 15_000,
    orchestratorMaxRetries: 1,
    orchestratorRetryBackoffMs: 300,
    liveApiEnabled: true,
    liveApiWsUrl: "ws://127.0.0.1:65534/realtime",
    liveApiApiKey: undefined,
    liveApiAuthHeader: undefined,
    liveAuthProfiles: [],
    liveApiProtocol: "gemini",
    liveModelId: "model-primary",
    liveModelFallbackIds: [],
    liveAudioMimeType: "audio/pcm;rate=16000",
    liveVideoMimeType: "image/jpeg",
    liveAutoSetup: true,
    liveSetupVoiceName: "Aoede",
    liveSystemInstruction: "Test instruction",
    liveSetupPatch: undefined,
    liveRealtimeActivityHandling: "INTERRUPT_AND_RESUME",
    liveEnableInputAudioTranscription: true,
    liveEnableOutputAudioTranscription: true,
    liveConnectAttemptTimeoutMs: 300,
    liveConnectRetryMs: 40,
    liveConnectMaxAttempts: 2,
    liveFailoverCooldownMs: 5_000,
    liveFailoverRateLimitCooldownMs: 7_000,
    liveFailoverAuthDisableMs: 30_000,
    liveFailoverBillingDisableMs: 60_000,
    liveHealthCheckIntervalMs: 100,
    liveHealthSilenceMs: 250,
    liveHealthPingEnabled: true,
    liveHealthProbeGraceMs: 250,
    liveMaxStaleChunkMs: 2500,
    ...overrides,
  };
}

function createClientEvent(params: { type: string; payload: unknown }): EventEnvelope {
  return createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session",
    runId: "unit-run",
    type: params.type,
    source: "frontend",
    payload: params.payload,
  });
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`condition not satisfied within ${timeoutMs}ms`);
}

async function closeWss(wss: WebSocketServer): Promise<void> {
  for (const client of wss.clients) {
    try {
      client.terminate();
    } catch {
      // best-effort test teardown
    }
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("websocket server close timed out"));
    }, 2000);
    wss.close(() => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function closeNetServer(server: NetServer, sockets: Set<Socket>): Promise<void> {
  for (const socket of sockets) {
    try {
      socket.destroy();
    } catch {
      // best-effort test teardown
    }
  }
  sockets.clear();

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("net server close timed out"));
    }, 2000);
    server.close((error) => {
      clearTimeout(timeout);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

test("live bridge sends rich Gemini setup payload", async () => {
  const inboundFrames: Array<Record<string, unknown>> = [];
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      inboundFrames.push(parsed);
    });
  });

  const port = (wss.address() as AddressInfo).port;
  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveModelId: "gemini-live-primary",
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(createClientEvent({ type: "live.text", payload: { text: "hello" } }));
    await waitFor(() => inboundFrames.length >= 2, 2000);

    const setupFrame = inboundFrames.find((frame) => typeof frame.setup === "object");
    assert.ok(setupFrame, "setup frame should be sent before live.text turn");
    const setup = setupFrame?.setup as Record<string, unknown>;
    assert.equal(setup.model, "gemini-live-primary");
    const generationConfig = setup.generationConfig as Record<string, unknown>;
    assert.ok(Array.isArray(generationConfig.responseModalities));
    assert.ok(typeof generationConfig.speechConfig === "object");
    assert.ok(typeof generationConfig.realtimeInputConfig === "object");
    assert.ok(typeof setup.systemInstruction === "object");
    assert.ok(emitted.some((event) => event.type === "live.bridge.setup_sent"));
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge applies env setup patch for tools while preserving base generation config", async () => {
  const inboundFrames: Array<Record<string, unknown>> = [];
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      inboundFrames.push(parsed);
    });
  });

  const port = (wss.address() as AddressInfo).port;
  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveModelId: "gemini-live-primary",
      liveSetupPatch: {
        tools: [
          {
            functionDeclarations: [
              {
                name: "lookup_price",
                description: "Lookup product price",
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT"],
        },
      },
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(createClientEvent({ type: "live.text", payload: { text: "hello tools" } }));
    await waitFor(() => inboundFrames.length >= 2, 2000);

    const setupFrame = inboundFrames.find((frame) => typeof frame.setup === "object");
    assert.ok(setupFrame, "setup frame should be sent");
    const setup = setupFrame?.setup as Record<string, unknown>;
    const tools = Array.isArray(setup.tools) ? setup.tools : [];
    assert.equal(tools.length, 1);

    const generationConfig = setup.generationConfig as Record<string, unknown>;
    assert.deepEqual(generationConfig.responseModalities, ["TEXT"]);
    assert.ok(typeof generationConfig.speechConfig === "object");
    assert.ok(typeof generationConfig.realtimeInputConfig === "object");

    const setupSentEvent = emitted.find((event) => event.type === "live.bridge.setup_sent");
    assert.ok(setupSentEvent, "expected setup diagnostics event");
    const setupSentPayload = setupSentEvent?.payload as {
      hasSetupPatch?: boolean;
      toolsCount?: number;
    };
    assert.equal(setupSentPayload.hasSetupPatch, true);
    assert.equal(setupSentPayload.toolsCount, 1);
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge emits connect timeout when websocket handshake stalls", async () => {
  const sockets = new Set<Socket>();
  const stalledServer = createNetServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => {
      sockets.delete(socket);
    });
    // Intentionally keep the connection open without WS handshake response.
  });
  await new Promise<void>((resolve) => stalledServer.listen(0, "127.0.0.1", () => resolve()));
  const port = (stalledServer.address() as AddressInfo).port;

  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveConnectAttemptTimeoutMs: 200,
      liveConnectMaxAttempts: 1,
      liveConnectRetryMs: 20,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await assert.rejects(
      async () => {
        await bridge.forwardFromClient(createClientEvent({ type: "live.text", payload: { text: "timeout please" } }));
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        return message.toLowerCase().includes("timed out");
      },
    );

    await waitFor(() => emitted.some((event) => event.type === "live.bridge.connect_timeout"), 2000);
    const timeoutEvent = emitted.find((event) => event.type === "live.bridge.connect_timeout");
    assert.ok(timeoutEvent, "expected live.bridge.connect_timeout diagnostic event");
    const timeoutPayload = timeoutEvent.payload as Record<string, unknown>;
    assert.ok(typeof timeoutPayload.timeoutMs === "number");
    assert.ok(Number(timeoutPayload.timeoutMs) >= 200);
  } finally {
    bridge.close();
    await closeNetServer(stalledServer, sockets);
  }
});

test("live bridge emits failover event when upstream connection fails", async () => {
  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: "ws://127.0.0.1:65534/realtime",
      liveModelId: "model-a",
      liveModelFallbackIds: ["model-b"],
      liveConnectMaxAttempts: 2,
      liveConnectRetryMs: 20,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await assert.rejects(async () => {
      await bridge.forwardFromClient(createClientEvent({ type: "live.text", payload: { text: "trigger failover" } }));
    });

    const failoverEvents = emitted.filter((event) => event.type === "live.bridge.failover");
    assert.ok(failoverEvents.length >= 1, "expected at least one failover event");
    const switchedToFallback = failoverEvents.some((event) => {
      const payload = event.payload as Record<string, unknown>;
      const to = payload.to as Record<string, unknown>;
      return to.model === "model-b";
    });
    assert.equal(switchedToFallback, true, "failover chain should include fallback model");
    const hasSelectionStrategy = failoverEvents.some((event) => {
      const payload = event.payload as Record<string, unknown>;
      return payload.selectionStrategy === "ready_lru" || payload.selectionStrategy === "earliest_ready";
    });
    assert.equal(hasSelectionStrategy, true, "failover diagnostics should include selectionStrategy");
  } finally {
    bridge.close();
  }
});

test("live bridge chooses least-used ready route across model/auth profile combinations", () => {
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveModelId: "model-a",
      liveModelFallbackIds: ["model-b"],
      liveAuthProfiles: [
        { name: "primary", apiKey: "key-primary" },
        { name: "backup", apiKey: "key-backup" },
      ],
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: () => {
      // no-op in this deterministic selection test
    },
  });

  try {
    const internals = bridge as unknown as {
      modelStates: Array<{
        lastUsedAtMs: number;
        cooldownUntilMs: number;
        disabledUntilMs: number;
        failureCount: number;
      }>;
      authProfiles: Array<{
        lastUsedAtMs: number;
        cooldownUntilMs: number;
        disabledUntilMs: number;
        failureCount: number;
      }>;
      currentModelIndex: number;
      currentAuthProfileIndex: number;
      pickNextRouteIndices: () => {
        modelIndex: number;
        authProfileIndex: number | null;
        routeReadyAtMs: number;
        selectionStrategy: "ready_lru" | "earliest_ready" | "active_fallback";
      };
    };

    internals.currentModelIndex = 0;
    internals.currentAuthProfileIndex = 0;

    for (const modelState of internals.modelStates) {
      modelState.cooldownUntilMs = 0;
      modelState.disabledUntilMs = 0;
      modelState.failureCount = 0;
    }
    for (const profileState of internals.authProfiles) {
      profileState.cooldownUntilMs = 0;
      profileState.disabledUntilMs = 0;
      profileState.failureCount = 0;
    }

    // Active route is model-a + primary.
    // Make model-b + backup the least-used ready route, which should win ready_lru selection.
    internals.modelStates[0].lastUsedAtMs = 10_000;
    internals.modelStates[1].lastUsedAtMs = 100;
    internals.authProfiles[0].lastUsedAtMs = 9_500;
    internals.authProfiles[1].lastUsedAtMs = 9_000;

    const selection = internals.pickNextRouteIndices();
    assert.equal(selection.modelIndex, 1);
    assert.equal(selection.authProfileIndex, 1);
    assert.equal(selection.selectionStrategy, "ready_lru");
  } finally {
    bridge.close();
  }
});

test("live bridge classifies 402 failures as billing and applies disable windows", async () => {
  const wss = new WebSocketServer({
    port: 0,
    verifyClient: (_info, done) => done(false, 402, "billing required"),
  });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
  const port = (wss.address() as AddressInfo).port;

  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveModelId: "model-a",
      liveModelFallbackIds: ["model-b"],
      liveAuthProfiles: [
        { name: "primary", apiKey: "key-primary" },
        { name: "backup", apiKey: "key-backup" },
      ],
      liveConnectMaxAttempts: 2,
      liveConnectRetryMs: 20,
      liveFailoverBillingDisableMs: 90_000,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await assert.rejects(async () => {
      await bridge.forwardFromClient(createClientEvent({ type: "live.text", payload: { text: "billing failover" } }));
    });

    const failoverEvent = emitted.find((event) => event.type === "live.bridge.failover");
    assert.ok(failoverEvent, "expected failover event for billing failure");
    const failoverPayload = failoverEvent?.payload as Record<string, unknown>;
    assert.equal(failoverPayload.reasonClass, "billing");

    const authFailureEvent = emitted.find((event) => event.type === "live.bridge.auth_profile_failed");
    assert.ok(authFailureEvent, "expected auth profile failure diagnostics");
    const authFailurePayload = authFailureEvent?.payload as Record<string, unknown>;
    assert.equal(authFailurePayload.reasonClass, "billing");
    assert.ok(typeof authFailurePayload.disabledUntil === "string" && authFailurePayload.disabledUntil.length > 0);
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge classifies 429 failures as rate_limit", async () => {
  const wss = new WebSocketServer({
    port: 0,
    verifyClient: (_info, done) => done(false, 429, "rate limit"),
  });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
  const port = (wss.address() as AddressInfo).port;

  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveAuthProfiles: [{ name: "primary", apiKey: "key-primary" }],
      liveConnectMaxAttempts: 1,
      liveConnectRetryMs: 20,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await assert.rejects(async () => {
      await bridge.forwardFromClient(createClientEvent({ type: "live.text", payload: { text: "rate limit failover" } }));
    });

    const reconnectEvent = emitted.find((event) => event.type === "live.bridge.reconnect_attempt");
    assert.ok(reconnectEvent, "expected reconnect attempt event for 429");
    const reconnectPayload = reconnectEvent?.payload as Record<string, unknown>;
    assert.equal(reconnectPayload.reasonClass, "rate_limit");

    const authFailureEvent = emitted.find((event) => event.type === "live.bridge.auth_profile_failed");
    assert.ok(authFailureEvent, "expected auth profile failure event");
    const authFailurePayload = authFailureEvent?.payload as Record<string, unknown>;
    assert.equal(authFailurePayload.reasonClass, "rate_limit");
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge emits health degradation when upstream stays silent during pending turn", async () => {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
  const port = (wss.address() as AddressInfo).port;

  wss.on("connection", (ws) => {
    ws.on("message", () => {
      // intentionally silent: no upstream model output frames
    });
  });

  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveHealthCheckIntervalMs: 40,
      liveHealthSilenceMs: 120,
      liveConnectRetryMs: 20,
      liveConnectMaxAttempts: 1,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(createClientEvent({ type: "live.text", payload: { text: "no response expected" } }));
    await waitFor(() => emitted.some((event) => event.type === "live.bridge.health_degraded"), 3000);
    await waitFor(() => emitted.some((event) => event.type === "live.bridge.health_watchdog_reconnect"), 3000);

    assert.ok(emitted.some((event) => event.type === "live.bridge.health_degraded"));
    assert.ok(emitted.some((event) => event.type === "live.bridge.health_probe_started"));
    assert.ok(emitted.some((event) => event.type === "live.bridge.health_watchdog_reconnect"));
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge emits health recovered after watchdog-triggered reconnect", async () => {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
  const port = (wss.address() as AddressInfo).port;

  let connectionCount = 0;
  wss.on("connection", (ws) => {
    connectionCount += 1;
    ws.on("message", (raw) => {
      if (connectionCount === 1) {
        return;
      }
      const parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      if (parsed.clientContent) {
        ws.send(
          JSON.stringify({
            serverContent: {
              modelTurn: {
                parts: [{ text: "recovered response" }],
              },
              turnComplete: true,
            },
          }),
        );
      }
    });
  });

  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveHealthCheckIntervalMs: 40,
      liveHealthSilenceMs: 120,
      liveConnectRetryMs: 20,
      liveConnectMaxAttempts: 2,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(createClientEvent({ type: "live.text", payload: { text: "first silent turn" } }));
    await waitFor(() => emitted.some((event) => event.type === "live.bridge.health_degraded"), 3000);
    await waitFor(() => emitted.some((event) => event.type === "live.bridge.health_watchdog_reconnect"), 3000);

    await bridge.forwardFromClient(createClientEvent({ type: "live.text", payload: { text: "second turn" } }));
    await waitFor(() => emitted.some((event) => event.type === "live.bridge.health_recovered"), 5000);

    assert.ok(connectionCount >= 2, "watchdog should force reconnect");
    assert.ok(emitted.some((event) => event.type === "live.bridge.health_recovered"));
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge emits text deltas when upstream transcript frames are cumulative", async () => {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
  const port = (wss.address() as AddressInfo).port;

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      if (!parsed.clientContent) {
        return;
      }
      ws.send(
        JSON.stringify({
          serverContent: {
            modelTurn: {
              parts: [{ text: "Hello" }],
            },
          },
        }),
      );
      ws.send(
        JSON.stringify({
          serverContent: {
            outputTranscript: "Hello there",
          },
        }),
      );
      ws.send(
        JSON.stringify({
          serverContent: {
            outputTranscript: "Hello there",
          },
        }),
      );
      ws.send(
        JSON.stringify({
          serverContent: {
            outputTranscript: "Hello there!",
            turnComplete: true,
          },
        }),
      );
    });
  });

  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveConnectMaxAttempts: 1,
      liveConnectRetryMs: 20,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(createClientEvent({ type: "live.text", payload: { text: "delta test" } }));
    await waitFor(() => emitted.some((event) => event.type === "live.turn.completed"), 3000);

    const normalizedTextChunks = emitted
      .filter((event) => event.type === "live.output")
      .map((event) => {
        const payload = event.payload as {
          normalized?: { text?: string; turnId?: string; granular?: boolean };
        };
        return {
          text: payload.normalized?.text,
          turnId: payload.normalized?.turnId,
          granular: payload.normalized?.granular,
        };
      })
      .filter(
        (value): value is { text: string; turnId?: string; granular?: boolean } =>
          typeof value.text === "string" && value.text.length > 0,
      );

    assert.deepEqual(
      normalizedTextChunks.map((item) => item.text),
      ["Hello", " there", "!"],
    );
    assert.equal(
      normalizedTextChunks.every((item) => item.granular === true),
      true,
      "normalized output should mark granular delta emission",
    );
    const turnIdSet = new Set(
      normalizedTextChunks
        .map((item) => item.turnId)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    );
    assert.equal(turnIdSet.size, 1, "all streaming deltas should belong to one generated turnId");

    const turnCompletedEvent = emitted.find((event) => event.type === "live.turn.completed");
    assert.ok(turnCompletedEvent, "expected live.turn.completed event");
    const turnCompletedPayload = turnCompletedEvent?.payload as {
      turnId?: string | null;
      text?: string | null;
      textChars?: number;
    };
    assert.equal(turnCompletedPayload.text, "Hello there!");
    assert.equal(turnCompletedPayload.textChars, "Hello there!".length);
    assert.equal(typeof turnCompletedPayload.turnId, "string");
    if (typeof turnCompletedPayload.turnId === "string") {
      assert.ok(turnIdSet.has(turnCompletedPayload.turnId));
    }

    const transcriptDeltaEvents = emitted
      .filter((event) => event.type === "live.output.transcript.delta")
      .map((event) => event.payload as { text?: string; turnId?: string });
    assert.deepEqual(
      transcriptDeltaEvents.map((item) => item.text),
      ["Hello", " there", "!"],
    );
    assert.equal(
      transcriptDeltaEvents.every((item) => typeof item.turnId === "string" && item.turnId.length > 0),
      true,
    );
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge emits live.output.audio.delta for upstream audio chunks", async () => {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
  const port = (wss.address() as AddressInfo).port;

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      if (!parsed.clientContent) {
        return;
      }
      ws.send(
        JSON.stringify({
          serverContent: {
            modelTurn: {
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/pcm",
                    data: "AQID",
                  },
                },
              ],
            },
            turnComplete: true,
          },
        }),
      );
    });
  });

  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveConnectMaxAttempts: 1,
      liveConnectRetryMs: 20,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(createClientEvent({ type: "live.text", payload: { text: "audio delta test" } }));
    await waitFor(() => emitted.some((event) => event.type === "live.output.audio.delta"), 3000);

    const audioDeltaEvent = emitted.find((event) => event.type === "live.output.audio.delta");
    assert.ok(audioDeltaEvent, "expected live.output.audio.delta event");
    const audioDeltaPayload = audioDeltaEvent?.payload as {
      audioBase64?: string;
      mimeType?: string | null;
      turnId?: string | null;
    };
    assert.equal(audioDeltaPayload.audioBase64, "AQID");
    assert.equal(audioDeltaPayload.mimeType, "audio/pcm");
    assert.equal(typeof audioDeltaPayload.turnId, "string");
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge emits reconnect wait diagnostics when route is cooling down", async () => {
  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: "ws://127.0.0.1:65534/realtime",
      liveModelId: "model-only",
      liveModelFallbackIds: [],
      liveConnectMaxAttempts: 2,
      liveConnectRetryMs: 25,
      liveFailoverCooldownMs: 5_000,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await assert.rejects(async () => {
      await bridge.forwardFromClient(createClientEvent({ type: "live.text", payload: { text: "cooldown wait" } }));
    });

    const waitEvent = emitted.find((event) => event.type === "live.bridge.reconnect_wait");
    assert.ok(waitEvent, "expected reconnect wait diagnostic event");
    const waitPayload = waitEvent?.payload as Record<string, unknown>;
    assert.ok(typeof waitPayload.waitMs === "number" && Number(waitPayload.waitMs) >= 25);
    assert.ok(typeof waitPayload.routeWaitMs === "number");
  } finally {
    bridge.close();
  }
});

test("live bridge maps live.input.commit to activityEnd and emits commit diagnostics", async () => {
  const inboundFrames: Array<Record<string, unknown>> = [];
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      inboundFrames.push(parsed);
    });
  });

  const port = (wss.address() as AddressInfo).port;
  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveConnectMaxAttempts: 1,
      liveConnectRetryMs: 20,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(createClientEvent({ type: "live.input.commit", payload: { reason: "ptt_release" } }));
    await waitFor(() => inboundFrames.length >= 2, 2000);

    const activityEndFrame = inboundFrames.find(
      (frame) =>
        typeof frame.realtimeInput === "object" &&
        frame.realtimeInput !== null &&
        (frame.realtimeInput as { activityEnd?: unknown }).activityEnd === true,
    );
    assert.ok(activityEndFrame, "expected realtimeInput.activityEnd frame from live.input.commit");
    assert.ok(emitted.some((event) => event.type === "live.input.committed"));
    assert.ok(emitted.some((event) => event.type === "live.turn.end_sent"));
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge maps live.image data URL payload to Gemini media chunk", async () => {
  const inboundFrames: Array<Record<string, unknown>> = [];
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      inboundFrames.push(parsed);
    });
  });

  const port = (wss.address() as AddressInfo).port;
  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveConnectMaxAttempts: 1,
      liveConnectRetryMs: 20,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(
      createClientEvent({
        type: "live.image",
        payload: {
          dataUrl: "data:image/png;base64,aGVsbG8=",
          sentAtMs: Date.now(),
        },
      }),
    );
    await waitFor(() => inboundFrames.length >= 2, 2000);

    const imageFrame = inboundFrames.find(
      (frame) =>
        typeof frame.realtimeInput === "object" &&
        frame.realtimeInput !== null &&
        Array.isArray((frame.realtimeInput as { mediaChunks?: unknown[] }).mediaChunks),
    );
    assert.ok(imageFrame, "expected realtimeInput media chunk for live.image");
    const mediaChunks = (imageFrame?.realtimeInput as { mediaChunks?: unknown[] }).mediaChunks as Array<{
      mimeType?: string;
      data?: string;
    }>;
    assert.equal(mediaChunks.length, 1);
    assert.equal(mediaChunks[0]?.mimeType, "image/png");
    assert.equal(mediaChunks[0]?.data, "aGVsbG8=");
    assert.equal(emitted.some((event) => event.type === "live.bridge.error"), false);
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge maps conversation.item.create text payload to Gemini clientContent turn", async () => {
  const inboundFrames: Array<Record<string, unknown>> = [];
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      inboundFrames.push(parsed);
    });
  });

  const port = (wss.address() as AddressInfo).port;
  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveConnectMaxAttempts: 1,
      liveConnectRetryMs: 20,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(
      createClientEvent({
        type: "conversation.item.create",
        payload: {
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: "hello from item.create",
              },
            ],
          },
          turnComplete: true,
        },
      }),
    );
    await waitFor(() => inboundFrames.length >= 2, 2000);

    const clientContentFrame = inboundFrames.find(
      (frame) =>
        typeof frame.clientContent === "object" &&
        frame.clientContent !== null &&
        Array.isArray((frame.clientContent as { turns?: unknown[] }).turns),
    );
    assert.ok(clientContentFrame, "expected clientContent frame for conversation.item.create");
    const clientContent = clientContentFrame?.clientContent as {
      turns?: Array<{ role?: string; parts?: Array<Record<string, unknown>> }>;
      turnComplete?: boolean;
    };
    assert.equal(clientContent.turnComplete, true);
    assert.equal(clientContent.turns?.[0]?.role, "user");
    assert.equal(clientContent.turns?.[0]?.parts?.length, 1);
    assert.equal(clientContent.turns?.[0]?.parts?.[0]?.text, "hello from item.create");
    assert.equal(emitted.some((event) => event.type === "live.bridge.error"), false);
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge maps conversation.item.create text+image payload to Gemini multimodal turn", async () => {
  const inboundFrames: Array<Record<string, unknown>> = [];
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      inboundFrames.push(parsed);
    });
  });

  const port = (wss.address() as AddressInfo).port;
  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveConnectMaxAttempts: 1,
      liveConnectRetryMs: 20,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(
      createClientEvent({
        type: "conversation.item.create",
        payload: {
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: "describe this",
              },
              {
                type: "input_image",
                image_url: "data:image/png;base64,aGVsbG8=",
              },
            ],
          },
          turnComplete: true,
        },
      }),
    );
    await waitFor(() => inboundFrames.length >= 2, 2000);

    const clientContentFrame = inboundFrames.find(
      (frame) =>
        typeof frame.clientContent === "object" &&
        frame.clientContent !== null &&
        Array.isArray((frame.clientContent as { turns?: unknown[] }).turns),
    );
    assert.ok(clientContentFrame, "expected multimodal clientContent frame");
    const clientContent = clientContentFrame?.clientContent as {
      turns?: Array<{ parts?: Array<Record<string, unknown>> }>;
    };
    const parts = clientContent.turns?.[0]?.parts ?? [];
    assert.equal(parts.length, 2);
    assert.equal(parts[0]?.text, "describe this");

    const imagePart = parts[1] as {
      inlineData?: {
        mimeType?: string;
        data?: string;
      };
    };
    assert.equal(imagePart.inlineData?.mimeType, "image/png");
    assert.equal(imagePart.inlineData?.data, "aGVsbG8=");
    assert.equal(emitted.some((event) => event.type === "live.bridge.error"), false);
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge maps conversation.item.create text+audio payload to Gemini multimodal turn", async () => {
  const inboundFrames: Array<Record<string, unknown>> = [];
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      inboundFrames.push(parsed);
    });
  });

  const port = (wss.address() as AddressInfo).port;
  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveConnectMaxAttempts: 1,
      liveConnectRetryMs: 20,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(
      createClientEvent({
        type: "conversation.item.create",
        payload: {
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: "listen and summarize",
              },
              {
                type: "input_audio",
                audio: "UklGRg==",
                mimeType: "audio/wav",
              },
            ],
          },
          turnComplete: true,
        },
      }),
    );
    await waitFor(() => inboundFrames.length >= 2, 2000);

    const clientContentFrame = inboundFrames.find(
      (frame) =>
        typeof frame.clientContent === "object" &&
        frame.clientContent !== null &&
        Array.isArray((frame.clientContent as { turns?: unknown[] }).turns),
    );
    assert.ok(clientContentFrame, "expected multimodal clientContent frame");
    const clientContent = clientContentFrame?.clientContent as {
      turns?: Array<{ parts?: Array<Record<string, unknown>> }>;
    };
    const parts = clientContent.turns?.[0]?.parts ?? [];
    assert.equal(parts.length, 2);
    assert.equal(parts[0]?.text, "listen and summarize");

    const audioPart = parts[1] as {
      inlineData?: {
        mimeType?: string;
        data?: string;
      };
    };
    assert.equal(audioPart.inlineData?.mimeType, "audio/wav");
    assert.equal(audioPart.inlineData?.data, "UklGRg==");
    assert.equal(emitted.some((event) => event.type === "live.bridge.error"), false);
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge emits local truncation diagnostics for conversation.item.truncate", async () => {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
  const port = (wss.address() as AddressInfo).port;

  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveConnectMaxAttempts: 1,
      liveConnectRetryMs: 20,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(
      createClientEvent({
        type: "conversation.item.truncate",
        payload: {
          item_id: "turn-demo",
          content_index: 0,
          audio_end_ms: 1200,
          reason: "user_interrupt",
        },
      }),
    );
    await waitFor(() => emitted.some((event) => event.type === "live.turn.truncated"), 2000);

    const truncatedEvent = emitted.find((event) => event.type === "live.turn.truncated");
    assert.ok(truncatedEvent, "expected live.turn.truncated event");
    const payload = truncatedEvent?.payload as {
      turnId?: string | null;
      audioEndMs?: number | null;
      reason?: string | null;
      scope?: string | null;
    };
    assert.equal(payload.turnId, "turn-demo");
    assert.equal(payload.audioEndMs, 1200);
    assert.equal(payload.reason, "user_interrupt");
    assert.equal(payload.scope, "session_local");
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge emits local delete diagnostics for conversation.item.delete", async () => {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
  const port = (wss.address() as AddressInfo).port;

  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveConnectMaxAttempts: 1,
      liveConnectRetryMs: 20,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(
      createClientEvent({
        type: "conversation.item.delete",
        payload: {
          item_id: "turn-delete-demo",
          reason: "operator_cleanup",
        },
      }),
    );
    await waitFor(() => emitted.some((event) => event.type === "live.turn.deleted"), 2000);

    const deletedEvent = emitted.find((event) => event.type === "live.turn.deleted");
    assert.ok(deletedEvent, "expected live.turn.deleted event");
    const payload = deletedEvent?.payload as {
      turnId?: string | null;
      reason?: string | null;
      scope?: string | null;
    };
    assert.equal(payload.turnId, "turn-delete-demo");
    assert.equal(payload.reason, "operator_cleanup");
    assert.equal(payload.scope, "session_local");
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge keeps conversation.item.delete session-local when live bridge is unavailable", async () => {
  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiEnabled: false,
      liveApiWsUrl: undefined,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(
      createClientEvent({
        type: "conversation.item.delete",
        payload: {
          item_id: "turn-local-delete",
          reason: "local_cleanup",
        },
      }),
    );

    const deletedEvent = emitted.find((event) => event.type === "live.turn.deleted");
    assert.ok(deletedEvent, "expected live.turn.deleted event");
    const payload = deletedEvent?.payload as {
      turnId?: string | null;
      reason?: string | null;
      scope?: string | null;
    };
    assert.equal(payload.turnId, "turn-local-delete");
    assert.equal(payload.reason, "local_cleanup");
    assert.equal(payload.scope, "session_local");
    assert.equal(
      emitted.some((event) => event.type === "live.bridge.unavailable"),
      false,
      "conversation.item.delete should not emit live.bridge.unavailable",
    );
  } finally {
    bridge.close();
  }
});

test("live bridge emits deduplicated live.function_call events from upstream", async () => {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
  const port = (wss.address() as AddressInfo).port;

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      if (!parsed.clientContent) {
        return;
      }
      const functionCallPayload = {
        serverContent: {
          modelTurn: {
            parts: [
              {
                functionCall: {
                  name: "lookup_price",
                  callId: "call-lookup-1",
                  arguments: {
                    sku: "SKU-001",
                  },
                },
              },
            ],
          },
        },
      };
      ws.send(JSON.stringify(functionCallPayload));
      ws.send(JSON.stringify(functionCallPayload));
      ws.send(
        JSON.stringify({
          serverContent: {
            turnComplete: true,
          },
        }),
      );
    });
  });

  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveConnectMaxAttempts: 1,
      liveConnectRetryMs: 20,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(createClientEvent({ type: "live.text", payload: { text: "function call test" } }));
    await waitFor(() => emitted.some((event) => event.type === "live.function_call"), 3000);

    const functionCallEvents = emitted.filter((event) => event.type === "live.function_call");
    assert.equal(functionCallEvents.length, 1, "function call events should be deduplicated by call fingerprint");
    const payload = functionCallEvents[0].payload as {
      name?: string;
      callId?: string;
      argumentsJson?: string;
      turnId?: string;
    };
    assert.equal(payload.name, "lookup_price");
    assert.equal(payload.callId, "call-lookup-1");
    assert.equal(typeof payload.argumentsJson, "string");
    assert.equal(typeof payload.turnId, "string");
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});

test("live bridge maps live.function_call_output to Gemini functionResponse frame", async () => {
  const inboundFrames: Array<Record<string, unknown>> = [];
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      inboundFrames.push(parsed);
    });
  });

  const port = (wss.address() as AddressInfo).port;
  const emitted: EventEnvelope[] = [];
  const bridge = new LiveApiBridge({
    config: createGatewayConfig({
      liveApiWsUrl: `ws://127.0.0.1:${port}/realtime`,
      liveConnectMaxAttempts: 1,
      liveConnectRetryMs: 20,
    }),
    sessionId: "unit-session",
    userId: "unit-user",
    runId: "unit-run",
    send: (event) => emitted.push(event),
  });

  try {
    await bridge.forwardFromClient(
      createClientEvent({
        type: "live.function_call_output",
        payload: {
          callId: "call-lookup-1",
          name: "lookup_price",
          output: {
            price: 99,
            currency: "USD",
          },
        },
      }),
    );
    await waitFor(() => inboundFrames.length >= 2, 2000);

    const functionResponseFrame = inboundFrames.find(
      (frame) =>
        typeof frame.clientContent === "object" &&
        frame.clientContent !== null &&
        Array.isArray((frame.clientContent as { turns?: unknown[] }).turns),
    );
    assert.ok(functionResponseFrame, "expected functionResponse clientContent frame");

    const turns = ((functionResponseFrame?.clientContent as { turns?: unknown[] }).turns ?? []) as Array<{
      parts?: Array<{ functionResponse?: Record<string, unknown> }>;
    }>;
    const functionResponse = turns[0]?.parts?.[0]?.functionResponse;
    assert.ok(functionResponse, "expected functionResponse part");
    assert.equal(functionResponse?.name, "lookup_price");
    assert.equal(functionResponse?.id, "call-lookup-1");
    assert.deepEqual(functionResponse?.response, {
      price: 99,
      currency: "USD",
    });

    const outputSentEvent = emitted.find((event) => event.type === "live.function_call_output.sent");
    assert.ok(outputSentEvent, "expected output sent diagnostic event");
    const outputSentPayload = outputSentEvent?.payload as { outputSizeBytes?: number };
    assert.ok(typeof outputSentPayload.outputSizeBytes === "number" && outputSentPayload.outputSizeBytes > 0);
  } finally {
    bridge.close();
    await closeWss(wss);
  }
});
