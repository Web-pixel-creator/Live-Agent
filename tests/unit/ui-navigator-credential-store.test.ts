import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createEnvelope, type OrchestratorRequest } from "../../shared/contracts/src/index.js";
import { rotateAuthProfile, upsertCredentialStoreEntry } from "../../shared/skills/src/index.js";
import { runUiNavigatorAgent } from "../../agents/ui-navigator-agent/src/index.js";

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return value as Record<string, unknown>;
}

function withEnv(overrides: Record<string, string | null>, runner: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(overrides)) {
    previous.set(name, process.env[name]);
    if (value === null) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  return runner().finally(() => {
    for (const [name, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });
}

test("ui navigator can resolve device-node index auth token from credential store", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-ui-nav-credential-"));
  const storePath = join(rootDir, "credentials", "store.json");
  let observedAuthorization = "";

  const executorServer = createServer((_req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        trace: [
          {
            index: 1,
            actionId: "remote-step-1",
            actionType: "verify",
            target: "credential-routed",
            status: "ok",
            screenshotRef: "ui://credential-routed/step-1.png",
            notes: "credential routed",
          },
        ],
        finalStatus: "completed",
        retries: 0,
        deviceNode: {
          nodeId: "desktop-a",
          displayName: "Desktop A",
          kind: "desktop",
          platform: "windows",
          status: "online",
        },
      }),
      "utf8",
    );
  });

  await new Promise<void>((resolve) => {
    executorServer.listen(0, "127.0.0.1", () => resolve());
  });
  const executorAddress = executorServer.address();
  assert.ok(executorAddress && typeof executorAddress === "object");
  const executorUrl = `http://127.0.0.1:${executorAddress.port}`;

  const indexServer = createServer((_req, res) => {
    observedAuthorization =
      typeof _req.headers.authorization === "string" ? _req.headers.authorization : "";
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        data: [
          {
            nodeId: "desktop-a",
            displayName: "Desktop A",
            kind: "desktop",
            platform: "windows",
            status: "online",
            executorUrl,
            capabilities: ["screen", "keyboard"],
            trustLevel: "trusted",
            version: 2,
          },
        ],
      }),
      "utf8",
    );
  });

  await new Promise<void>((resolve) => {
    indexServer.listen(0, "127.0.0.1", () => resolve());
  });
  const indexAddress = indexServer.address();
  assert.ok(indexAddress && typeof indexAddress === "object");
  const indexUrl = `http://127.0.0.1:${indexAddress.port}/v1/device-nodes`;

  try {
    const env: NodeJS.ProcessEnv = {
      CREDENTIAL_STORE_FILE: storePath,
      CREDENTIAL_STORE_MASTER_KEY: "ui-navigator-master",
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
      UI_NAVIGATOR_EXECUTOR_URL: "http://127.0.0.1:65530",
      UI_NAVIGATOR_DEVICE_NODE_INDEX_URL: indexUrl,
      UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_CREDENTIAL: "device-index-token",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
    };

    upsertCredentialStoreEntry(
      {
        namespace: "ui_navigator.device_node_index.auth_token",
        name: "device-index-token",
        secretValue: "device-index-secret",
        metadata: {
          service: "ui-navigator",
          audience: "device-index",
        },
      },
      {
        env,
        cwd: rootDir,
      },
    );

    await withEnv(env, async () => {
      const request = createEnvelope({
        userId: "credential-user",
        sessionId: "credential-session",
        runId: "credential-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Open page and verify content",
            url: "https://example.com",
            deviceNodeId: "desktop-a",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const execution = asObject(output.execution);
      const node = asObject(execution.deviceNode);
      assert.equal(node.nodeId, "desktop-a");
      assert.equal(observedAuthorization, "Bearer device-index-secret");
    });
  } finally {
    await new Promise<void>((resolve) => {
      indexServer.close(() => resolve());
    });
    await new Promise<void>((resolve) => {
      executorServer.close(() => resolve());
    });
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("ui navigator can resolve device-node index auth token from auth profile rotation", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mla-ui-nav-auth-profile-"));
  const storePath = join(rootDir, "credentials", "store.json");
  let observedAuthorization = "";

  const executorServer = createServer((_req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        trace: [
          {
            index: 1,
            actionId: "remote-step-1",
            actionType: "verify",
            target: "credential-routed",
            status: "ok",
            screenshotRef: "ui://credential-routed/step-1.png",
            notes: "credential routed",
          },
        ],
        finalStatus: "completed",
        retries: 0,
        deviceNode: {
          nodeId: "desktop-a",
          displayName: "Desktop A",
          kind: "desktop",
          platform: "windows",
          status: "online",
        },
      }),
      "utf8",
    );
  });

  await new Promise<void>((resolve) => {
    executorServer.listen(0, "127.0.0.1", () => resolve());
  });
  const executorAddress = executorServer.address();
  assert.ok(executorAddress && typeof executorAddress === "object");
  const executorUrl = `http://127.0.0.1:${executorAddress.port}`;

  const indexServer = createServer((_req, res) => {
    observedAuthorization =
      typeof _req.headers.authorization === "string" ? _req.headers.authorization : "";
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        data: [
          {
            nodeId: "desktop-a",
            displayName: "Desktop A",
            kind: "desktop",
            platform: "windows",
            status: "online",
            executorUrl,
            capabilities: ["screen", "keyboard"],
            trustLevel: "trusted",
            version: 2,
          },
        ],
      }),
      "utf8",
    );
  });

  await new Promise<void>((resolve) => {
    indexServer.listen(0, "127.0.0.1", () => resolve());
  });
  const indexAddress = indexServer.address();
  assert.ok(indexAddress && typeof indexAddress === "object");
  const indexUrl = `http://127.0.0.1:${indexAddress.port}/v1/device-nodes`;

  try {
    const env: NodeJS.ProcessEnv = {
      CREDENTIAL_STORE_FILE: storePath,
      CREDENTIAL_STORE_MASTER_KEY: "ui-navigator-master",
      AUTH_PROFILE_STORE_FILE: join(rootDir, "credentials", "auth-profiles.json"),
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
      UI_NAVIGATOR_EXECUTOR_URL: "http://127.0.0.1:65530",
      UI_NAVIGATOR_DEVICE_NODE_INDEX_URL: indexUrl,
      UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_PROFILE: "ui-navigator-device-index",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
    };

    upsertCredentialStoreEntry(
      {
        namespace: "ui_navigator.device_node_index.auth_token",
        name: "device-index-profile-token",
        secretValue: "device-index-profile-secret",
        metadata: {
          service: "ui-navigator",
          audience: "device-index",
        },
      },
      {
        env,
        cwd: rootDir,
      },
    );
    rotateAuthProfile(
      {
        profileId: "ui-navigator-device-index",
      },
      {
        env,
        cwd: rootDir,
      },
    );

    await withEnv(env, async () => {
      const request = createEnvelope({
        userId: "credential-user",
        sessionId: "credential-session",
        runId: "credential-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Open page and verify content",
            url: "https://example.com",
            deviceNodeId: "desktop-a",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const execution = asObject(output.execution);
      const node = asObject(execution.deviceNode);
      assert.equal(node.nodeId, "desktop-a");
      assert.equal(observedAuthorization, "Bearer device-index-profile-secret");
    });
  } finally {
    await new Promise<void>((resolve) => {
      indexServer.close(() => resolve());
    });
    await new Promise<void>((resolve) => {
      executorServer.close(() => resolve());
    });
    rmSync(rootDir, { recursive: true, force: true });
  }
});
