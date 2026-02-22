import test from "node:test";
import assert from "node:assert/strict";
import { loadGatewayConfig } from "../../apps/realtime-gateway/src/config.js";

async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => T | Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("gateway config defaults to websocket transport mode", { concurrency: false }, async () => {
  await withEnv(
    {
      GATEWAY_TRANSPORT_MODE: undefined,
    },
    () => {
      const config = loadGatewayConfig();
      assert.equal(config.gatewayTransportMode, "websocket");
    },
  );
});

test("gateway config accepts webrtc transport mode via feature flag", { concurrency: false }, async () => {
  await withEnv(
    {
      GATEWAY_TRANSPORT_MODE: "webrtc",
    },
    () => {
      const config = loadGatewayConfig();
      assert.equal(config.gatewayTransportMode, "webrtc");
    },
  );
});

test("gateway config normalizes invalid transport mode to websocket", { concurrency: false }, async () => {
  await withEnv(
    {
      GATEWAY_TRANSPORT_MODE: "udp",
    },
    () => {
      const config = loadGatewayConfig();
      assert.equal(config.gatewayTransportMode, "websocket");
    },
  );
});

