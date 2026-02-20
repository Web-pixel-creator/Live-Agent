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
    liveConnectRetryMs: 40,
    liveConnectMaxAttempts: 2,
    liveFailoverCooldownMs: 5_000,
    liveHealthCheckIntervalMs: 100,
    liveHealthSilenceMs: 250,
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
  await new Promise<void>((resolve) => {
    wss.close(() => resolve());
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

  bridge.close();
  await closeWss(wss);
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
  bridge.close();
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

  await bridge.forwardFromClient(createClientEvent({ type: "live.text", payload: { text: "no response expected" } }));
  await waitFor(() => emitted.some((event) => event.type === "live.bridge.health_degraded"), 3000);

  assert.ok(emitted.some((event) => event.type === "live.bridge.health_degraded"));
  bridge.close();
  await closeWss(wss);
});
