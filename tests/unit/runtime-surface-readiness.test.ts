import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  rotateAuthProfile,
  upsertCredentialStoreEntry,
} from "../../shared/skills/src/index.js";
import type { DeviceNodeRecord } from "../../apps/api-backend/src/firestore.js";
import { buildRuntimeSurfaceReadinessSnapshot } from "../../apps/api-backend/src/runtime-surface-readiness.js";

const readyDeviceNode: DeviceNodeRecord = {
  nodeId: "desktop-main",
  displayName: "Desktop Main",
  kind: "desktop",
  platform: "windows",
  executorUrl: "http://127.0.0.1:8090",
  status: "online",
  trustLevel: "trusted",
  capabilities: ["screen", "click", "type"],
  version: 1,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:10.000Z",
  lastSeenAt: "2026-04-01T00:00:10.000Z",
  metadata: {},
};

test("runtime surface readiness reports ready posture when bootstrap and diagnostics are nominal", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-runtime-surface-ready-"));
  try {
    const env: NodeJS.ProcessEnv = {
      GEMINI_API_KEY: "gemini-live-secret",
      CREDENTIAL_STORE_FILE: join(rootDir, "credentials", "store.json"),
      CREDENTIAL_STORE_MASTER_KEY: "bootstrap-master",
      AUTH_PROFILE_STORE_FILE: join(rootDir, "credentials", "auth-profiles.json"),
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
        cwd: process.cwd(),
        nowIso: "2026-04-01T00:00:00.000Z",
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
        cwd: process.cwd(),
        nowIso: "2026-04-01T00:00:10.000Z",
      },
    );
    rotateAuthProfile(
      {
        profileId: "skills-managed-index",
      },
      {
        env,
        cwd: process.cwd(),
        nowIso: "2026-04-01T00:00:20.000Z",
      },
    );
    rotateAuthProfile(
      {
        profileId: "ui-navigator-device-index",
      },
      {
        env,
        cwd: process.cwd(),
        nowIso: "2026-04-01T00:00:30.000Z",
      },
    );

    const snapshot = await buildRuntimeSurfaceReadinessSnapshot({
      env,
      cwd: process.cwd(),
      services: [
        {
          name: "realtime-gateway",
          healthy: true,
          ready: true,
          draining: false,
          startupFailureCount: 0,
          startupBlockingFailure: false,
          profile: {},
          metrics: {},
          transport: {
            requestedMode: "websocket",
            activeMode: "websocket",
            fallbackActive: false,
          },
          turnTruncation: { validated: true },
          turnDelete: { validated: true },
          damageControl: { validated: true },
          agentUsage: { validated: true },
        },
        {
          name: "orchestrator",
          healthy: true,
          ready: true,
          draining: false,
          startupFailureCount: 0,
          startupBlockingFailure: false,
          profile: {},
          metrics: {},
          workflow: {
            sourceKind: "file",
            sourcePath: "configs/orchestrator.workflow.json",
            usingLastKnownGood: false,
            workflowState: {
              status: "running",
              currentStage: "planning",
              activeRole: "planner",
              route: "live-agent",
            },
            controlPlaneOverride: {
              active: false,
              updatedAt: null,
              reason: null,
            },
            assistiveRouter: {
              enabled: false,
              provider: "gemini_api",
              apiKeyConfigured: false,
              model: "gemini-3.1-flash-lite-preview",
              allowIntents: ["conversation", "translation"],
              timeoutMs: 2000,
              minConfidence: 0.7,
              budgetPolicy: "judged_default",
              promptCaching: "none",
              watchlistEnabled: false,
            },
          },
        },
        {
          name: "ui-executor",
          healthy: true,
          ready: true,
          draining: false,
          startupFailureCount: 0,
          startupBlockingFailure: false,
          profile: {},
          metrics: {},
          forceSimulation: false,
          strictPlaywright: true,
          simulateIfUnavailable: false,
          sandbox: {
            mode: "enforce",
            networkPolicy: "same_origin",
            allowedOriginsCount: 1,
            allowedReadRootsCount: 1,
            allowedWriteRootsCount: 1,
            blockFileUrls: true,
            allowLoopbackHosts: false,
            setupMarker: {
              status: "current",
            },
            warnings: [],
          },
          browserWorkers: {
            runtime: {
              enabled: true,
            },
            queue: {
              failed: 0,
              paused: 0,
            },
          },
        },
        {
          name: "api-backend",
          healthy: true,
          ready: true,
          draining: false,
          startupFailureCount: 0,
          startupBlockingFailure: false,
          profile: {},
          metrics: {},
        },
      ],
      deviceNodes: [readyDeviceNode],
    });

    assert.equal(snapshot.source, "repo_owned_runtime_surface_readiness");
    assert.equal(snapshot.status, "ready");
    assert.equal(snapshot.safeToRun, true);
    assert.equal(snapshot.bootstrapStatus, "healthy");
    assert.equal(snapshot.diagnosticsStatus, "healthy");
    assert.equal(snapshot.summary.deviceNodes.ready, 1);
    assert.equal(snapshot.summary.services.ready, 4);
    assert.equal(snapshot.summary.evidence.fullyValidated, true);
    assert.ok(snapshot.summary.skills.personaCount >= 1);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("runtime surface readiness reports critical posture when primary provider and device readiness are missing", async () => {
  const snapshot = await buildRuntimeSurfaceReadinessSnapshot({
    env: {
      APP_ENV: "production",
      STORYTELLER_MEDIA_MODE: "fallback",
      UI_NAVIGATOR_EXECUTOR_MODE: "failed",
    },
    cwd: process.cwd(),
    services: [],
    deviceNodes: [],
  });

  assert.equal(snapshot.status, "critical");
  assert.equal(snapshot.safeToRun, false);
  assert.equal(snapshot.summary.deviceNodes.ready, 0);
  assert.ok(Array.isArray(snapshot.degradedReasons));
  assert.ok(snapshot.degradedReasons.length >= 1);
});

test("runtime surface readiness reports degraded posture when fallback runtime stays operable with warnings", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-runtime-surface-degraded-"));
  try {
    const env: NodeJS.ProcessEnv = {
      GEMINI_API_KEY: "gemini-live-secret",
      CREDENTIAL_STORE_FILE: join(rootDir, "credentials", "store.json"),
      CREDENTIAL_STORE_MASTER_KEY: "bootstrap-master",
      AUTH_PROFILE_STORE_FILE: join(rootDir, "credentials", "auth-profiles.json"),
      STORYTELLER_MEDIA_MODE: "fallback",
      UI_NAVIGATOR_EXECUTOR_MODE: "simulated",
    };

    upsertCredentialStoreEntry(
      {
        namespace: "skills.managed_index.auth_token",
        name: "skills-index-token",
        secretValue: "skills-secret",
      },
      {
        env,
        cwd: process.cwd(),
        nowIso: "2026-04-01T01:00:00.000Z",
      },
    );
    rotateAuthProfile(
      {
        profileId: "skills-managed-index",
      },
      {
        env,
        cwd: process.cwd(),
        nowIso: "2026-04-01T01:00:10.000Z",
      },
    );

    const snapshot = await buildRuntimeSurfaceReadinessSnapshot({
      env,
      cwd: process.cwd(),
      services: [
        {
          name: "api-backend",
          healthy: true,
          ready: true,
          draining: false,
          startupFailureCount: 0,
          startupBlockingFailure: false,
          profile: {},
          metrics: {},
        },
        {
          name: "realtime-gateway",
          healthy: true,
          ready: true,
          draining: false,
          startupFailureCount: 0,
          startupBlockingFailure: false,
          profile: {},
          metrics: {},
          transport: {
            requestedMode: "websocket",
            activeMode: "websocket",
            fallbackActive: false,
          },
          turnTruncation: { validated: true },
          turnDelete: { validated: true },
          damageControl: { validated: true },
          agentUsage: { validated: true },
        },
        {
          name: "orchestrator",
          healthy: true,
          ready: true,
          draining: false,
          startupFailureCount: 0,
          startupBlockingFailure: false,
          profile: {},
          metrics: {},
          workflow: {
            sourceKind: "file",
            sourcePath: "configs/orchestrator.workflow.json",
            usingLastKnownGood: false,
            workflowState: {
              status: "running",
              currentStage: "routing",
              activeRole: "router",
              route: "live-agent",
            },
            controlPlaneOverride: {
              active: false,
              updatedAt: null,
              reason: null,
            },
            assistiveRouter: {
              enabled: false,
              provider: "gemini_api",
              apiKeyConfigured: false,
              model: "gemini-3.1-flash-lite-preview",
              allowIntents: ["conversation"],
              timeoutMs: 2000,
              minConfidence: 0.7,
              budgetPolicy: "judged_default",
              promptCaching: "none",
              watchlistEnabled: false,
            },
          },
        },
        {
          name: "ui-executor",
          healthy: true,
          ready: true,
          draining: false,
          startupFailureCount: 0,
          startupBlockingFailure: false,
          profile: {},
          metrics: {},
          forceSimulation: true,
          strictPlaywright: true,
          simulateIfUnavailable: true,
          sandbox: {
            mode: "enforce",
            networkPolicy: "same_origin",
            allowedOriginsCount: 1,
            allowedReadRootsCount: 1,
            allowedWriteRootsCount: 1,
            blockFileUrls: true,
            allowLoopbackHosts: false,
            setupMarker: {
              status: "current",
            },
            warnings: [],
          },
          browserWorkers: {
            runtime: {
              enabled: true,
            },
            queue: {
              failed: 0,
              paused: 1,
            },
          },
        },
      ],
      deviceNodes: [readyDeviceNode],
    });

    assert.equal(snapshot.status, "degraded");
    assert.equal(snapshot.bootstrapStatus, "degraded");
    assert.equal(snapshot.safeToRun, true);
    assert.ok(snapshot.degradedReasons.length >= 1);
    assert.equal(snapshot.topIssue, snapshot.degradedReasons[0]);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
