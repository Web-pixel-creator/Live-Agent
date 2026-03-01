import test from "node:test";
import assert from "node:assert/strict";
import { createEnvelope, type OrchestratorRequest } from "../../shared/contracts/src/index.js";
import { runLiveAgent } from "../../agents/live-agent/src/index.js";
import { runStorytellerAgent } from "../../agents/storyteller-agent/src/index.js";
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

function assertFallbackUsagePayload(output: Record<string, unknown>): void {
  const usage = asObject(output.usage);
  assert.equal(usage.source, "none");
  assert.equal(usage.calls, 0);
  assert.equal(usage.inputTokens, 0);
  assert.equal(usage.outputTokens, 0);
  assert.equal(usage.totalTokens, 0);
  assert.ok(Array.isArray(usage.models));
}

test("live-agent response includes usage payload", async () => {
  await withEnv(
    {
      FIRESTORE_ENABLED: "false",
      GEMINI_API_KEY: "",
      LIVE_AGENT_GEMINI_API_KEY: "",
      LIVE_AGENT_USE_GEMINI_CHAT: "false",
    },
    async () => {
      const request = createEnvelope({
        userId: "usage-user",
        sessionId: `usage-live-${Date.now()}`,
        runId: "usage-live-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "conversation",
          input: {
            text: "Hello from usage test",
          },
        },
      }) as OrchestratorRequest;

      const response = await runLiveAgent(request);
      assert.equal(response.payload.status, "completed");
      assertFallbackUsagePayload(asObject(response.payload.output));
    },
  );
});

test("storyteller-agent response includes usage payload", async () => {
  await withEnv(
    {
      GEMINI_API_KEY: "",
      STORYTELLER_GEMINI_API_KEY: "",
      STORYTELLER_USE_GEMINI_PLANNER: "false",
    },
    async () => {
      const request = createEnvelope({
        userId: "usage-user",
        sessionId: `usage-story-${Date.now()}`,
        runId: "usage-story-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "story",
          input: {
            prompt: "A short hopeful sci-fi story.",
            includeImages: false,
            includeVideo: false,
            segmentCount: 2,
          },
        },
      }) as OrchestratorRequest;

      const response = await runStorytellerAgent(request);
      assert.equal(response.payload.status, "completed");
      assertFallbackUsagePayload(asObject(response.payload.output));
    },
  );
});

test("ui-navigator-agent response includes usage payload", async () => {
  await withEnv(
    {
      GEMINI_API_KEY: "",
      UI_NAVIGATOR_GEMINI_API_KEY: "",
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "simulated",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
    },
    async () => {
      const request = createEnvelope({
        userId: "usage-user",
        sessionId: `usage-ui-${Date.now()}`,
        runId: "usage-ui-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Open homepage and verify header",
            url: "https://example.com",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.ok(response.payload.status === "completed" || response.payload.status === "failed");
      assertFallbackUsagePayload(asObject(response.payload.output));
    },
  );
});
