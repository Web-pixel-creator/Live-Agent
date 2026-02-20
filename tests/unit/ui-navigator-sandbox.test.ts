import test from "node:test";
import assert from "node:assert/strict";
import { createEnvelope, type OrchestratorRequest } from "../../shared/contracts/src/index.js";
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

test("ui navigator blocks destructive flow when sandbox mode=all", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
      UI_NAVIGATOR_SANDBOX_BLOCKED_CATEGORIES: "destructive_operation",
      UI_NAVIGATOR_SANDBOX_FORCE_EXECUTOR_MODE: "simulated",
    },
    async () => {
      const request = createEnvelope({
        userId: "sandbox-user",
        sessionId: "sandbox-session",
        runId: "sandbox-run-all",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Delete account and remove billing profile permanently",
            url: "https://example.com/settings",
            approvalConfirmed: true,
            approvalDecision: "approved",
            sandboxPolicyMode: "all",
            sessionRole: "secondary",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "failed");

      const output = asObject(response.payload.output);
      const sandbox = asObject(output.sandboxPolicy);
      const execution = asObject(output.execution);
      const blockedCategories = Array.isArray(sandbox.blockedCategories) ? sandbox.blockedCategories : [];

      assert.equal(sandbox.active, true);
      assert.equal(sandbox.effectiveMode, "all");
      assert.equal(sandbox.reason, "all_sessions");
      assert.equal(execution.finalStatus, "failed_sandbox_policy");
      assert.ok(blockedCategories.includes("destructive_operation"));
    },
  );
});

test("ui navigator enforces simulated executor for non-main session sandbox mode", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
      UI_NAVIGATOR_EXECUTOR_URL: "http://127.0.0.1:65530",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "non-main",
      UI_NAVIGATOR_SANDBOX_MAIN_SESSION_IDS: "main",
      UI_NAVIGATOR_SANDBOX_FORCE_EXECUTOR_MODE: "simulated",
      UI_NAVIGATOR_SANDBOX_ALLOWED_ACTIONS: "navigate,click,type,scroll,wait,verify",
    },
    async () => {
      const request = createEnvelope({
        userId: "sandbox-user",
        sessionId: "secondary-session",
        runId: "sandbox-run-non-main",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Open page and verify content",
            url: "https://example.com",
            maxSteps: 7,
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const sandbox = asObject(output.sandboxPolicy);
      const execution = asObject(output.execution);
      const executionSandbox = asObject(execution.sandbox);

      assert.equal(sandbox.active, true);
      assert.equal(sandbox.effectiveMode, "non-main");
      assert.equal(sandbox.sessionClass, "non_main");
      assert.equal(sandbox.baseExecutorMode, "remote_http");
      assert.equal(sandbox.enforcedExecutorMode, "simulated");
      assert.equal(execution.adapterMode, "simulated");
      assert.equal(executionSandbox.enforcedExecutorMode, "simulated");
    },
  );
});

