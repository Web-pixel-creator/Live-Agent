import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRuntimeLiveCapabilitiesSnapshot,
  buildRuntimeLiveStatusSnapshot,
  issueRuntimeLiveSessionToken,
  normalizeRuntimeLiveSessionTokenRequest,
} from "../../apps/api-backend/src/runtime-live-session-token.js";

test("runtime live capabilities report relay-only posture when direct live is disabled", () => {
  const capabilities = buildRuntimeLiveCapabilitiesSnapshot({
    env: {
      LIVE_API_ENABLED: "true",
      GEMINI_API_KEY: "gemini-live-secret",
    },
  });

  assert.deepEqual(capabilities, {
    audioInput: true,
    audioOutput: true,
    videoInput: false,
    screenInput: false,
    toolCalls: true,
    interruptions: true,
    translation: true,
    reconnectSupported: true,
  });
});

test("runtime live status reports direct live readiness when token bootstrap is configured", () => {
  const status = buildRuntimeLiveStatusSnapshot({
    env: {
      LIVE_API_ENABLED: "true",
      LIVE_API_PROTOCOL: "gemini",
      LIVE_DIRECT_MODE_ENABLED: "true",
      LIVE_EPHEMERAL_TOKENS_ENABLED: "true",
      LIVE_DIRECT_MODE_DEFAULT: "direct_live",
      LIVE_MODEL_ID: "gemini-live-2.5-flash-native-audio",
      GEMINI_API_KEY: "gemini-live-secret",
    },
  });

  assert.equal(status.preferredMode, "direct_live");
  assert.equal(status.activeMode, "direct_live");
  assert.equal(status.ephemeralTokensSupported, true);
  assert.equal(status.fallbackAvailable, true);
  assert.equal(status.provider, "gemini_live_api");
  assert.equal(status.model, "gemini-live-2.5-flash-native-audio");
});

test("runtime live session token falls back to relay when live bridge is disabled", async () => {
  const response = await issueRuntimeLiveSessionToken({
    env: {
      LIVE_API_ENABLED: "false",
      LIVE_DIRECT_MODE_ENABLED: "true",
      LIVE_EPHEMERAL_TOKENS_ENABLED: "true",
      LIVE_DIRECT_MODE_DEFAULT: "direct_live",
    },
    request: {
      preferredMode: "direct_live",
      audio: true,
    },
  });

  assert.equal(response.connectionMode, "relay");
  assert.equal(response.sessionToken, null);
  assert.equal(response.fallbackMode, "relay");
  assert.match(response.warnings.join(" "), /live api bridge is disabled/i);
});

test("runtime live session token issues direct live ephemeral token when configured", async () => {
  const response = await issueRuntimeLiveSessionToken({
    env: {
      LIVE_API_ENABLED: "true",
      LIVE_API_PROTOCOL: "gemini",
      LIVE_DIRECT_MODE_ENABLED: "true",
      LIVE_EPHEMERAL_TOKENS_ENABLED: "true",
      LIVE_DIRECT_MODE_DEFAULT: "direct_live",
      LIVE_MODEL_ID: "gemini-live-2.5-flash-native-audio",
      GEMINI_API_KEY: "gemini-live-secret",
      LIVE_DIRECT_TOKEN_TTL_SECONDS: "120",
    },
    request: {
      preferredMode: "direct_live",
      audio: true,
      toolsRequired: true,
    },
    now: new Date("2026-04-08T10:00:00.000Z"),
    createEphemeralToken: async () => ({
      name: "auth_tokens/test-token",
    }),
  });

  assert.equal(response.connectionMode, "direct_live");
  assert.equal(response.sessionToken, "auth_tokens/test-token");
  assert.equal(response.fallbackMode, null);
  assert.equal(response.expiresAt, "2026-04-08T10:02:00.000Z");
  assert.deepEqual(response.warnings, []);
});

test("runtime live session token request validator rejects unsupported preferred mode", () => {
  const normalized = normalizeRuntimeLiveSessionTokenRequest({
    preferredMode: "browser_native",
  });

  assert.equal(normalized.ok, false);
  if (normalized.ok) {
    assert.fail("expected invalid preferred mode to be rejected");
  }
  assert.equal(normalized.code, "API_RUNTIME_LIVE_SESSION_TOKEN_INVALID_REQUEST");
  assert.match(normalized.message, /preferredMode/i);
});
