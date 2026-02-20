import test from "node:test";
import assert from "node:assert/strict";
import { createEnvelope, type OrchestratorRequest } from "../../shared/contracts/src/index.js";
import { runLiveAgent } from "../../agents/live-agent/src/index.js";

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return value as Record<string, unknown>;
}

test("live-agent compacts conversation context when token budget is exceeded", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.LIVE_AGENT_USE_GEMINI_CHAT = "false";
  process.env.LIVE_AGENT_CONTEXT_COMPACTION_ENABLED = "true";
  process.env.LIVE_AGENT_CONTEXT_MAX_TOKENS = "120";
  process.env.LIVE_AGENT_CONTEXT_TARGET_TOKENS = "60";
  process.env.LIVE_AGENT_CONTEXT_KEEP_RECENT_TURNS = "2";

  const sessionId = `unit-context-${Date.now()}`;
  let sawCompaction = false;

  for (let index = 0; index < 6; index += 1) {
    const text = `message-${index} ` + "x".repeat(220);
    const request = createEnvelope({
      userId: "unit-user",
      sessionId,
      runId: `unit-run-${index}`,
      type: "orchestrator.request",
      source: "frontend",
      payload: {
        intent: "conversation",
        input: {
          text,
        },
      },
    }) as OrchestratorRequest;

    const response = await runLiveAgent(request);
    assert.equal(response.payload.status, "completed");
    const output = asObject(response.payload.output);
    const context = asObject(output.context);
    const pre = asObject(context.preReplyCompaction);
    const post = asObject(context.postReplyCompaction);
    const preApplied = pre.applied === true;
    const postApplied = post.applied === true;
    if (preApplied || postApplied) {
      sawCompaction = true;
    }
  }

  assert.equal(sawCompaction, true);
});
