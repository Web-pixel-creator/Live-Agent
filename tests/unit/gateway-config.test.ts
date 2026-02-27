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
      GATEWAY_WEBRTC_ROLLOUT_STAGE: undefined,
      GATEWAY_WEBRTC_CANARY_PERCENT: undefined,
      GATEWAY_WEBRTC_ROLLBACK_READY: undefined,
    },
    () => {
      const config = loadGatewayConfig();
      assert.equal(config.gatewayTransportMode, "websocket");
      assert.equal(config.gatewayWebrtcRolloutStage, "spike");
      assert.equal(config.gatewayWebrtcCanaryPercent, 0);
      assert.equal(config.gatewayWebrtcRollbackReady, true);
    },
  );
});

test("gateway config accepts webrtc transport mode via feature flag", { concurrency: false }, async () => {
  await withEnv(
    {
      GATEWAY_TRANSPORT_MODE: "webrtc",
      GATEWAY_WEBRTC_ROLLOUT_STAGE: "canary",
      GATEWAY_WEBRTC_CANARY_PERCENT: "25",
      GATEWAY_WEBRTC_ROLLBACK_READY: "false",
    },
    () => {
      const config = loadGatewayConfig();
      assert.equal(config.gatewayTransportMode, "webrtc");
      assert.equal(config.gatewayWebrtcRolloutStage, "canary");
      assert.equal(config.gatewayWebrtcCanaryPercent, 25);
      assert.equal(config.gatewayWebrtcRollbackReady, false);
    },
  );
});

test("gateway config normalizes invalid transport mode to websocket", { concurrency: false }, async () => {
  await withEnv(
    {
      GATEWAY_TRANSPORT_MODE: "udp",
      GATEWAY_WEBRTC_ROLLOUT_STAGE: "beta",
      GATEWAY_WEBRTC_CANARY_PERCENT: "250",
      GATEWAY_WEBRTC_ROLLBACK_READY: "not-bool",
    },
    () => {
      const config = loadGatewayConfig();
      assert.equal(config.gatewayTransportMode, "websocket");
      assert.equal(config.gatewayWebrtcRolloutStage, "spike");
      assert.equal(config.gatewayWebrtcCanaryPercent, 100);
      assert.equal(config.gatewayWebrtcRollbackReady, true);
    },
  );
});

test("gateway config clamps invalid webrtc canary percent values to safe bounds", { concurrency: false }, async () => {
  await withEnv(
    {
      GATEWAY_WEBRTC_CANARY_PERCENT: "-10",
    },
    () => {
      const config = loadGatewayConfig();
      assert.equal(config.gatewayWebrtcCanaryPercent, 0);
    },
  );
});
