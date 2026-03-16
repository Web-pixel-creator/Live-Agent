import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildRuntimeBootstrapDoctorSnapshot } from "../../apps/api-backend/src/runtime-bootstrap-doctor.js";
import { rotateAuthProfile, upsertCredentialStoreEntry } from "../../shared/skills/src/index.js";

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

test("bootstrap doctor reports healthy posture when primary provider, auth profiles, devices, and fallback paths are ready", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-bootstrap-doctor-healthy-"));
  try {
    const env: NodeJS.ProcessEnv = {
      GEMINI_API_KEY: "gemini-live-secret",
      CREDENTIAL_STORE_FILE: "credentials/store.json",
      CREDENTIAL_STORE_MASTER_KEY: "bootstrap-master",
      AUTH_PROFILE_STORE_FILE: "credentials/auth-profiles.json",
      STORYTELLER_MEDIA_MODE: "fallback",
      UI_NAVIGATOR_EXECUTOR_MODE: "simulated",
      FIRESTORE_ENABLED: "true",
      GOOGLE_CLOUD_PROJECT: "mla-demo",
      LIVE_API_ENABLED: "true",
    };

    upsertCredentialStoreEntry(
      {
        namespace: "skills.managed_index.auth_token",
        name: "skills-index-token",
        secretValue: "skills-secret",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T02:00:00.000Z",
      },
    );
    upsertCredentialStoreEntry(
      {
        namespace: "ui_navigator.device_node_index.auth_token",
        name: "device-index-token",
        secretValue: "device-secret",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T02:00:10.000Z",
      },
    );

    rotateAuthProfile(
      {
        profileId: "skills-managed-index",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T02:00:20.000Z",
      },
    );
    rotateAuthProfile(
      {
        profileId: "ui-navigator-device-index",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T02:00:30.000Z",
      },
    );

    const snapshot = buildRuntimeBootstrapDoctorSnapshot({
      env,
      cwd: rootDir,
      services: [],
      deviceNodes: [
        {
          nodeId: "desktop-main",
          displayName: "Desktop Main",
          kind: "desktop",
          platform: "windows",
          executorUrl: "http://127.0.0.1:8090",
          status: "online",
          trustLevel: "trusted",
          capabilities: ["screen", "click", "type"],
          version: 1,
          createdAt: "2026-03-07T02:01:00.000Z",
          updatedAt: "2026-03-07T02:01:10.000Z",
          lastSeenAt: "2026-03-07T02:01:10.000Z",
          metadata: {},
        },
      ],
    });

    const summary = asObject(snapshot.summary);
    assert.equal(snapshot.status, "healthy");
    assert.equal(asObject(summary.checks).fail, 0);
    assert.equal(asObject(summary.authProfiles).ready, 2);
    assert.equal(asObject(summary.deviceNodes).ready, 1);
    assert.equal(asObject(summary.fallbackPaths).readyCount, 3);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("bootstrap doctor reports critical posture when primary provider and device readiness are missing", () => {
  const snapshot = buildRuntimeBootstrapDoctorSnapshot({
    env: {
      APP_ENV: "production",
      STORYTELLER_MEDIA_MODE: "fallback",
      UI_NAVIGATOR_EXECUTOR_MODE: "failed",
    },
    cwd: process.cwd(),
    services: [],
    deviceNodes: [],
  });

  const summary = asObject(snapshot.summary);
  assert.equal(snapshot.status, "critical");
  assert.equal(Number(asObject(summary.checks).fail ?? 0) >= 1, true);
  assert.equal(asObject(summary.topCheck).id, "provider_gemini_primary");
});

test("bootstrap doctor counts live gateway auth-profile bindings as primary Gemini readiness", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-bootstrap-doctor-live-gateway-"));
  try {
    const env: NodeJS.ProcessEnv = {
      CREDENTIAL_STORE_FILE: "credentials/store.json",
      CREDENTIAL_STORE_MASTER_KEY: "bootstrap-master",
      AUTH_PROFILE_STORE_FILE: "credentials/auth-profiles.json",
      LIVE_API_AUTH_PROFILES_JSON: JSON.stringify([
        {
          name: "primary",
          apiKeyProfileId: "live-gateway-primary-api-key",
        },
      ]),
      STORYTELLER_MEDIA_MODE: "fallback",
      UI_NAVIGATOR_EXECUTOR_MODE: "simulated",
      LIVE_API_ENABLED: "true",
    };

    upsertCredentialStoreEntry(
      {
        namespace: "live.gateway.auth_profiles.primary.api_key",
        name: "live-primary-key",
        secretValue: "gateway-secret",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T02:10:00.000Z",
      },
    );

    rotateAuthProfile(
      {
        profileId: "live-gateway-primary-api-key",
      },
      {
        env,
        cwd: rootDir,
        nowIso: "2026-03-07T02:10:10.000Z",
      },
    );

    const snapshot = buildRuntimeBootstrapDoctorSnapshot({
      env,
      cwd: rootDir,
      services: [],
      deviceNodes: [
        {
          nodeId: "desktop-main",
          displayName: "Desktop Main",
          kind: "desktop",
          platform: "windows",
          executorUrl: "http://127.0.0.1:8090",
          status: "online",
          trustLevel: "trusted",
          capabilities: ["screen", "click", "type"],
          version: 1,
          createdAt: "2026-03-07T02:11:00.000Z",
          updatedAt: "2026-03-07T02:11:10.000Z",
          lastSeenAt: "2026-03-07T02:11:10.000Z",
          metadata: {},
        },
      ],
    });

    const summary = asObject(snapshot.summary);
    const providers = Array.isArray(snapshot.providers) ? snapshot.providers : [];
    const providerCheck =
      (Array.isArray(snapshot.checks) ? snapshot.checks : []).find(
        (item) => asObject(item).id === "provider_gemini_primary",
      ) ?? null;
    const primaryProvider = providers.find((item) => asObject(item).id === "gemini-primary") ?? null;
    const authProfiles = Array.isArray(snapshot.authProfiles) ? snapshot.authProfiles : [];
    const liveGatewayProfile =
      authProfiles.find((item) => asObject(item).profileId === "live-gateway-primary-api-key") ?? null;

    assert.equal(snapshot.status, "degraded");
    assert.equal(asObject(summary.providers).primaryReady, 1);
    assert.equal(asObject(summary.providers).primaryMissing, 0);
    assert.equal(asObject(primaryProvider).configured, true);
    assert.equal(asObject(primaryProvider).activeEnvKey, "LIVE_API_AUTH_PROFILES_JSON");
    assert.equal(asObject(providerCheck).status, "ok");
    assert.equal(asObject(liveGatewayProfile).category, "live_gateway");
    assert.equal(asObject(liveGatewayProfile).effectiveSource, "auth_profile");
    assert.deepEqual(asObject(liveGatewayProfile).rotation, {
      rotationCount: 1,
      lastRotatedAt: "2026-03-07T02:10:10.000Z",
      previousCredentialName: null,
      currentCredentialName: "live-primary-key",
      lastCredentialUpdatedAt: "2026-03-07T02:10:00.000Z",
    });
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("bootstrap doctor surfaces ui-executor hardening gaps when sandbox posture is weak", () => {
  const snapshot = buildRuntimeBootstrapDoctorSnapshot({
    env: {
      GEMINI_API_KEY: "gemini-live-secret",
      CREDENTIAL_STORE_MASTER_KEY: "bootstrap-master",
      STORYTELLER_MEDIA_MODE: "fallback",
      UI_NAVIGATOR_EXECUTOR_MODE: "simulated",
    },
    cwd: process.cwd(),
    services: [
      {
        name: "ui-executor",
        sandbox: {
          mode: "audit",
          networkPolicy: "allow_all",
          allowedWriteRootsCount: 0,
          blockFileUrls: false,
          allowLoopbackHosts: true,
          setupMarker: {
            status: "stale",
          },
        },
      },
    ],
    deviceNodes: [
      {
        nodeId: "desktop-main",
        displayName: "Desktop Main",
        kind: "desktop",
        platform: "windows",
        executorUrl: "http://127.0.0.1:8090",
        status: "online",
        trustLevel: "trusted",
        capabilities: ["screen", "click", "type"],
        version: 1,
        createdAt: "2026-03-07T02:01:00.000Z",
        updatedAt: "2026-03-07T02:01:10.000Z",
        lastSeenAt: "2026-03-07T02:01:10.000Z",
        metadata: {},
      },
    ],
  });

  const checks = Array.isArray(snapshot.checks) ? snapshot.checks : [];
  const hardeningCheck =
    checks.find((item) => asObject(item).id === "ui_executor_hardening") ??
    asObject(snapshot.summary).topCheck;

  assert.equal(snapshot.status, "critical");
  assert.equal(asObject(hardeningCheck).id, "ui_executor_hardening");
  assert.equal(asObject(hardeningCheck).status, "fail");
  assert.match(String(asObject(hardeningCheck).message ?? ""), /network=allow_all/i);
});
