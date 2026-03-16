import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { loadGatewayConfig } from "../../apps/realtime-gateway/src/config.js";
import { rotateAuthProfile, upsertCredentialStoreEntry } from "../../shared/skills/src/index.js";

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
      GATEWAY_ORCHESTRATOR_TIMEOUT_MS: undefined,
      GATEWAY_ORCHESTRATOR_STORY_TIMEOUT_MS: undefined,
      GATEWAY_ORCHESTRATOR_MAX_RETRIES: undefined,
      GATEWAY_ORCHESTRATOR_RETRY_BACKOFF_MS: undefined,
    },
    () => {
      const config = loadGatewayConfig();
      assert.equal(config.gatewayTransportMode, "websocket");
      assert.equal(config.gatewayWebrtcRolloutStage, "spike");
      assert.equal(config.gatewayWebrtcCanaryPercent, 0);
      assert.equal(config.gatewayWebrtcRollbackReady, true);
      assert.equal(config.orchestratorTimeoutMs, 35_000);
      assert.equal(config.orchestratorStoryTimeoutMs, 90_000);
      assert.equal(config.orchestratorMaxRetries, 1);
      assert.equal(config.orchestratorRetryBackoffMs, 300);
    },
  );
});

test("gateway config accepts orchestrator timeout overrides for slower live and story providers", { concurrency: false }, async () => {
  await withEnv(
    {
      GATEWAY_ORCHESTRATOR_TIMEOUT_MS: "45000",
      GATEWAY_ORCHESTRATOR_STORY_TIMEOUT_MS: "95000",
      GATEWAY_ORCHESTRATOR_MAX_RETRIES: "2",
      GATEWAY_ORCHESTRATOR_RETRY_BACKOFF_MS: "750",
    },
    () => {
      const config = loadGatewayConfig();
      assert.equal(config.orchestratorTimeoutMs, 45_000);
      assert.equal(config.orchestratorStoryTimeoutMs, 95_000);
      assert.equal(config.orchestratorMaxRetries, 2);
      assert.equal(config.orchestratorRetryBackoffMs, 750);
    },
  );
});

test("gateway routes story requests through the longer orchestrator timeout budget", () => {
  const gatewayIndexPath = resolve(process.cwd(), "apps", "realtime-gateway", "src", "index.ts");
  const gatewayIndexSource = readFileSync(gatewayIndexPath, "utf8");

  assert.ok(
    gatewayIndexSource.includes("function resolveOrchestratorRequestTimeoutMs(config: GatewayConfig, request: OrchestratorRequest): number {"),
    "gateway runtime missing per-intent orchestrator timeout helper",
  );
  assert.ok(
    gatewayIndexSource.includes('return extractRequestIntent(request) === "story" ? config.orchestratorStoryTimeoutMs : config.orchestratorTimeoutMs;'),
    "gateway runtime should keep a longer timeout budget for story requests",
  );
  assert.ok(
    gatewayIndexSource.includes("timeoutMs: resolveOrchestratorRequestTimeoutMs(config, request),"),
    "gateway runtime should use the per-intent orchestrator timeout helper",
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

test("gateway config parses transcript replacement rules from LIVE_TRANSCRIPT_REPLACEMENTS_JSON", { concurrency: false }, async () => {
  await withEnv(
    {
      LIVE_TRANSCRIPT_REPLACEMENTS_JSON: "{\"wisper\":\"Whisper\",\"wisper ai\":\"Wisper AI\",\" \":\"skip\",\"bad\":12}",
    },
    () => {
      const config = loadGatewayConfig();
      assert.deepEqual(config.liveTranscriptReplacements, [
        { source: "wisper ai", target: "Wisper AI" },
        { source: "wisper", target: "Whisper" },
      ]);
    },
  );
});

test("gateway config falls back to empty transcript replacement rules when LIVE_TRANSCRIPT_REPLACEMENTS_JSON is invalid", {
  concurrency: false,
}, async () => {
  await withEnv(
    {
      LIVE_TRANSCRIPT_REPLACEMENTS_JSON: "{not-json}",
    },
    () => {
      const config = loadGatewayConfig();
      assert.deepEqual(config.liveTranscriptReplacements, []);
    },
  );
});

test("gateway config resolves live auth profiles from credential store references", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-gateway-config-store-"));
  try {
    const env: NodeJS.ProcessEnv = {
      CREDENTIAL_STORE_FILE: "credentials/store.json",
      CREDENTIAL_STORE_MASTER_KEY: "gateway-master",
      LIVE_API_AUTH_PROFILES_JSON: JSON.stringify([
        {
          name: "primary",
          apiKeyCredential: "live-primary-key",
          authHeaderCredential: "live-primary-header",
        },
      ]),
    };

    upsertCredentialStoreEntry(
      {
        namespace: "live.gateway.auth_profiles.primary.api_key",
        name: "live-primary-key",
        secretValue: "gateway-api-key",
      },
      {
        env,
        cwd: rootDir,
      },
    );
    upsertCredentialStoreEntry(
      {
        namespace: "live.gateway.auth_profiles.primary.auth_header",
        name: "live-primary-header",
        secretValue: "Authorization: Bearer gateway-header",
      },
      {
        env,
        cwd: rootDir,
      },
    );

    const config = loadGatewayConfig({ env, cwd: rootDir });
    assert.deepEqual(config.liveAuthProfiles, [
      {
        name: "primary",
        apiKey: "gateway-api-key",
        authHeader: "Authorization: Bearer gateway-header",
      },
    ]);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("gateway config resolves live auth profiles through repo-owned auth profile rotation", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-gateway-config-rotation-"));
  try {
    const env: NodeJS.ProcessEnv = {
      CREDENTIAL_STORE_FILE: "credentials/store.json",
      CREDENTIAL_STORE_MASTER_KEY: "gateway-master",
      AUTH_PROFILE_STORE_FILE: "credentials/auth-profiles.json",
      LIVE_API_AUTH_PROFILES_JSON: JSON.stringify([
        {
          name: "primary",
          apiKeyProfileId: "live-gateway-primary-api-key",
        },
      ]),
    };

    upsertCredentialStoreEntry(
      {
        namespace: "live.gateway.auth_profiles.primary.api_key",
        name: "live-primary-a",
        secretValue: "gateway-api-key-a",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T03:00:00.000Z",
      },
    );
    upsertCredentialStoreEntry(
      {
        namespace: "live.gateway.auth_profiles.primary.api_key",
        name: "live-primary-b",
        secretValue: "gateway-api-key-b",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T03:00:10.000Z",
      },
    );

    rotateAuthProfile(
      {
        profileId: "live-gateway-primary-api-key",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T03:00:20.000Z",
      },
    );

    const config = loadGatewayConfig({ env, cwd: rootDir });
    assert.deepEqual(config.liveAuthProfiles, [
      {
        name: "primary",
        apiKey: "gateway-api-key-b",
      },
    ]);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("gateway config omits undefined auth fields from resolved live auth profiles", { concurrency: false }, async () => {
  await withEnv(
    {
      LIVE_API_API_KEY: "primary-api-key",
      LIVE_API_AUTH_HEADER: undefined,
      LIVE_API_FALLBACK_KEYS: "fallback-key",
      LIVE_API_FALLBACK_HEADERS: undefined,
      LIVE_API_AUTH_PROFILES_JSON: undefined,
    },
    () => {
      const config = loadGatewayConfig();
      assert.deepEqual(config.liveAuthProfiles, [
        {
          name: "primary",
          apiKey: "primary-api-key",
        },
        {
          name: "fallback-1",
          apiKey: "fallback-key",
        },
      ]);
    },
  );
});

test("gateway config derives Gemini Live websocket defaults from Gemini API key", { concurrency: false }, async () => {
  await withEnv(
    {
      LIVE_API_ENABLED: "true",
      LIVE_API_PROTOCOL: "gemini",
      LIVE_API_WS_URL: undefined,
      LIVE_API_API_KEY: undefined,
      LIVE_AGENT_GEMINI_API_KEY: undefined,
      GEMINI_API_KEY: "derived-gemini-key",
      LIVE_API_AUTH_HEADER: undefined,
      LIVE_API_AUTH_PROFILES_JSON: undefined,
    },
    () => {
      const config = loadGatewayConfig();
      assert.equal(config.liveApiEnabled, true);
      assert.equal(
        config.liveApiWsUrl,
        "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent",
      );
      assert.equal(config.liveApiApiKey, "derived-gemini-key");
      assert.deepEqual(config.liveAuthProfiles, [
        {
          name: "primary",
          apiKey: "derived-gemini-key",
        },
      ]);
    },
  );
});
