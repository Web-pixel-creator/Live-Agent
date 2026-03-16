import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import {
  evaluateUiExecutorSandboxRequest,
  loadUiExecutorSandboxPolicy,
} from "../../apps/ui-executor/src/sandbox-policy.js";

function createTempSandboxDir(): string {
  return mkdtempSync(join(tmpdir(), "ui-executor-sandbox-"));
}

test("ui-executor sandbox resolves roots and current setup marker", () => {
  const tempDir = createTempSandboxDir();
  try {
    const markerPath = join(tempDir, "sandbox.marker");
    writeFileSync(markerPath, "v1\n", "utf8");

    const policy = loadUiExecutorSandboxPolicy({
      env: {
        UI_EXECUTOR_SANDBOX_MODE: "enforce",
        UI_EXECUTOR_SANDBOX_NETWORK_POLICY: "allow_list",
        UI_EXECUTOR_SANDBOX_ALLOWED_ORIGINS: "https://example.com,https://demo.example.com",
        UI_EXECUTOR_SANDBOX_ALLOWED_READ_ROOTS: `${tempDir};.\\artifacts`,
        UI_EXECUTOR_SANDBOX_ALLOWED_WRITE_ROOTS: tempDir,
        UI_EXECUTOR_SANDBOX_SETUP_MARKER_PATH: markerPath,
        UI_EXECUTOR_SANDBOX_SETUP_MARKER_VERSION: "v1",
      },
      cwd: process.cwd(),
      defaultNavigationUrl: "https://example.com/landing",
    });

    assert.equal(policy.mode, "enforce");
    assert.equal(policy.networkPolicy, "allow_list");
    assert.equal(policy.allowedOrigins.length, 2);
    assert.equal(policy.allowedReadRoots.length, 2);
    assert.equal(policy.allowedWriteRoots.length, 1);
    assert.equal(policy.setupMarker.status, "current");
    assert.equal(policy.setupMarker.observedVersion, "v1");
    assert.equal(policy.defaultNavigationOrigin, "https://example.com");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ui-executor sandbox blocks foreign origin in same_origin enforce mode", () => {
  const policy = loadUiExecutorSandboxPolicy({
    env: {
      UI_EXECUTOR_SANDBOX_MODE: "enforce",
      UI_EXECUTOR_SANDBOX_NETWORK_POLICY: "same_origin",
    },
    cwd: process.cwd(),
    defaultNavigationUrl: "https://example.com/app",
  });

  const evaluation = evaluateUiExecutorSandboxRequest({
    policy,
    defaultNavigationUrl: "https://example.com/app",
    request: {
      actions: [{ type: "navigate", target: "https://evil.example.com/login" }],
    },
  });

  assert.equal(evaluation.allowed, false);
  assert.equal(evaluation.decision, "block");
  assert.match(evaluation.violations.join(" "), /same_origin/i);
});

test("ui-executor sandbox audits file urls even when request is allowed in audit mode", () => {
  const tempDir = createTempSandboxDir();
  try {
    const markerPath = join(tempDir, "sandbox.marker");
    writeFileSync(markerPath, "v1", "utf8");

    const policy = loadUiExecutorSandboxPolicy({
      env: {
        UI_EXECUTOR_SANDBOX_MODE: "audit",
        UI_EXECUTOR_SANDBOX_BLOCK_FILE_URLS: "true",
        UI_EXECUTOR_SANDBOX_ALLOWED_READ_ROOTS: tempDir,
        UI_EXECUTOR_SANDBOX_SETUP_MARKER_PATH: markerPath,
        UI_EXECUTOR_SANDBOX_SETUP_MARKER_VERSION: "v1",
      },
      cwd: process.cwd(),
      defaultNavigationUrl: "https://example.com/app",
    });

    const evaluation = evaluateUiExecutorSandboxRequest({
      policy,
      defaultNavigationUrl: "https://example.com/app",
      request: {
        context: {
          screenshotRef: pathToFileURL(join(tempDir, "shot.png")).href,
        },
      },
    });

    assert.equal(evaluation.allowed, true);
    assert.equal(evaluation.decision, "audit");
    assert.match(evaluation.violations.join(" "), /File URL access is blocked/i);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ui-executor sandbox allows screenshot seeds within write roots even without read roots", () => {
  const tempDir = createTempSandboxDir();
  try {
    const markerPath = join(tempDir, "sandbox.marker");
    const screenshotSeed = join(tempDir, "artifacts", "session-1");
    writeFileSync(markerPath, "v1", "utf8");

    const policy = loadUiExecutorSandboxPolicy({
      env: {
        UI_EXECUTOR_SANDBOX_MODE: "enforce",
        UI_EXECUTOR_SANDBOX_ALLOWED_WRITE_ROOTS: tempDir,
        UI_EXECUTOR_SANDBOX_SETUP_MARKER_PATH: markerPath,
        UI_EXECUTOR_SANDBOX_SETUP_MARKER_VERSION: "v1",
      },
      cwd: process.cwd(),
      defaultNavigationUrl: "https://example.com/app",
    });

    const evaluation = evaluateUiExecutorSandboxRequest({
      policy,
      defaultNavigationUrl: "https://example.com/app",
      request: {
        context: {
          screenshotRef: screenshotSeed,
        },
        actions: [{ type: "navigate", target: "https://example.com/app" }],
      },
    });

    assert.equal(evaluation.allowed, true);
    assert.equal(evaluation.decision, "allow");
    assert.equal(evaluation.violations.length, 0);
    assert.ok(evaluation.inspectedPaths.includes(screenshotSeed));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ui-executor sandbox blocks screenshot seeds outside write roots even when read roots allow them", () => {
  const tempDir = createTempSandboxDir();
  const writeDir = createTempSandboxDir();
  try {
    const markerPath = join(tempDir, "sandbox.marker");
    const screenshotSeed = join(tempDir, "artifacts", "session-2");
    writeFileSync(markerPath, "v1", "utf8");

    const policy = loadUiExecutorSandboxPolicy({
      env: {
        UI_EXECUTOR_SANDBOX_MODE: "enforce",
        UI_EXECUTOR_SANDBOX_ALLOWED_READ_ROOTS: tempDir,
        UI_EXECUTOR_SANDBOX_ALLOWED_WRITE_ROOTS: writeDir,
        UI_EXECUTOR_SANDBOX_SETUP_MARKER_PATH: markerPath,
        UI_EXECUTOR_SANDBOX_SETUP_MARKER_VERSION: "v1",
      },
      cwd: process.cwd(),
      defaultNavigationUrl: "https://example.com/app",
    });

    const evaluation = evaluateUiExecutorSandboxRequest({
      policy,
      defaultNavigationUrl: "https://example.com/app",
      request: {
        context: {
          screenshotRef: screenshotSeed,
        },
        actions: [{ type: "navigate", target: "https://example.com/app" }],
      },
    });

    assert.equal(evaluation.allowed, false);
    assert.equal(evaluation.decision, "block");
    assert.match(evaluation.violations.join(" "), /allowed write roots/i);
  } finally {
    rmSync(writeDir, { recursive: true, force: true });
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ui-executor sandbox blocks stale setup marker in enforce mode", () => {
  const tempDir = createTempSandboxDir();
  try {
    const markerPath = join(tempDir, "sandbox.marker");
    writeFileSync(markerPath, "v1", "utf8");

    const policy = loadUiExecutorSandboxPolicy({
      env: {
        UI_EXECUTOR_SANDBOX_MODE: "enforce",
        UI_EXECUTOR_SANDBOX_SETUP_MARKER_PATH: markerPath,
        UI_EXECUTOR_SANDBOX_SETUP_MARKER_VERSION: "v2",
      },
      cwd: process.cwd(),
      defaultNavigationUrl: "https://example.com/app",
    });

    const evaluation = evaluateUiExecutorSandboxRequest({
      policy,
      defaultNavigationUrl: "https://example.com/app",
      request: {
        actions: [{ type: "navigate", target: "https://example.com/app" }],
      },
    });

    assert.equal(evaluation.allowed, false);
    assert.equal(evaluation.decision, "block");
    assert.match(evaluation.violations.join(" "), /setup marker/i);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
