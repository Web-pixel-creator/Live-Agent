import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  clearUiExecutorRuntimeControlPlaneOverride,
  getUiExecutorRuntimeConfig,
  getUiExecutorRuntimeConfigStoreStatus,
  resetUiExecutorRuntimeConfigStoreForTests,
  setUiExecutorRuntimeControlPlaneOverride,
} from "../../apps/ui-executor/src/runtime-config-store.ts";

function createTempRuntimeDir(): string {
  return mkdtempSync(join(tmpdir(), "ui-executor-runtime-config-"));
}

function createEnv(tempDir: string): NodeJS.ProcessEnv {
  const markerPath = join(tempDir, "sandbox.marker");
  writeFileSync(markerPath, "v1\n", "utf8");
  return {
    UI_EXECUTOR_SANDBOX_MODE: "enforce",
    UI_EXECUTOR_SANDBOX_NETWORK_POLICY: "same_origin",
    UI_EXECUTOR_SANDBOX_SETUP_MARKER_PATH: markerPath,
    UI_EXECUTOR_SANDBOX_SETUP_MARKER_VERSION: "v1",
    UI_EXECUTOR_DEFAULT_URL: "https://example.com/app",
    UI_EXECUTOR_FORCE_SIMULATION: "false",
    UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE: "true",
    UI_EXECUTOR_STRICT_PLAYWRIGHT: "false",
    UI_EXECUTOR_PERSISTENT_BROWSER_SESSIONS: "true",
    UI_EXECUTOR_BROWSER_SESSION_TTL_MS: "90000",
  };
}

test("ui-executor runtime config control-plane override applies force simulation and sandbox mode", () => {
  const tempDir = createTempRuntimeDir();
  try {
    const env = createEnv(tempDir);
    resetUiExecutorRuntimeConfigStoreForTests();

    const baseline = getUiExecutorRuntimeConfig({ env, cwd: tempDir });
    assert.equal(baseline.sourceKind, "env");
    assert.equal(baseline.forceSimulation, false);
    assert.equal(baseline.sandboxPolicy.mode, "enforce");
    assert.equal(baseline.persistentBrowserSessions, true);
    assert.equal(baseline.browserSessionTtlMs, 90000);

    setUiExecutorRuntimeControlPlaneOverride({
      rawJson: JSON.stringify({
        forceSimulation: true,
        persistentBrowserSessions: false,
        browserSessionTtlMs: 15000,
        sandboxPolicy: {
          mode: "audit",
        },
      }),
      reason: "test:ui-executor-runtime-config",
      env,
      cwd: tempDir,
    });

    const overridden = getUiExecutorRuntimeConfig({ env, cwd: tempDir });
    const status = getUiExecutorRuntimeConfigStoreStatus({ env, cwd: tempDir });
    assert.equal(overridden.sourceKind, "control_plane_json");
    assert.equal(overridden.forceSimulation, true);
    assert.equal(overridden.sandboxPolicy.mode, "audit");
    assert.equal(overridden.persistentBrowserSessions, false);
    assert.equal(overridden.browserSessionTtlMs, 15000);
    assert.equal(status.controlPlaneOverride.active, true);
    assert.equal(status.controlPlaneOverride.reason, "test:ui-executor-runtime-config");

    clearUiExecutorRuntimeControlPlaneOverride();

    const restored = getUiExecutorRuntimeConfig({ env, cwd: tempDir });
    const restoredStatus = getUiExecutorRuntimeConfigStoreStatus({ env, cwd: tempDir });
    assert.equal(restored.sourceKind, "env");
    assert.equal(restored.forceSimulation, false);
    assert.equal(restored.sandboxPolicy.mode, "enforce");
    assert.equal(restored.persistentBrowserSessions, true);
    assert.equal(restored.browserSessionTtlMs, 90000);
    assert.equal(restoredStatus.controlPlaneOverride.active, false);
  } finally {
    resetUiExecutorRuntimeConfigStoreForTests();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ui-executor runtime config control-plane override rejects invalid sandbox mode", () => {
  const tempDir = createTempRuntimeDir();
  try {
    const env = createEnv(tempDir);
    resetUiExecutorRuntimeConfigStoreForTests();

    assert.throws(
      () =>
        setUiExecutorRuntimeControlPlaneOverride({
          rawJson: JSON.stringify({
            sandboxPolicy: {
              mode: "broken",
            },
          }),
          env,
          cwd: tempDir,
        }),
      /invalid/i,
    );

    const status = getUiExecutorRuntimeConfigStoreStatus({ env, cwd: tempDir });
    assert.equal(status.controlPlaneOverride.active, false);
  } finally {
    resetUiExecutorRuntimeConfigStoreForTests();
    rmSync(tempDir, { recursive: true, force: true });
  }
});
