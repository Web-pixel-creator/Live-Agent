import test from "node:test";
import assert from "node:assert/strict";
import { WebSocketServer } from "ws";
import type { AddressInfo } from "node:net";
import { createEnvelope, type EventEnvelope } from "../../shared/contracts/src/index.js";
import { LiveApiBridge } from "../../apps/realtime-gateway/src/live-bridge.js";
import type { GatewayConfig } from "../../apps/realtime-gateway/src/config.js";

function createGatewayConfig(overrides: Partial<GatewayConfig>): GatewayConfig {
  return {
    port: 8080,
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
