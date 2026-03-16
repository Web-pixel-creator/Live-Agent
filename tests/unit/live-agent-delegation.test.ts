import assert from "node:assert/strict";
import test from "node:test";
import { createEnvelope, type OrchestratorRequest } from "@mla/contracts";
import { runLiveAgent } from "../../agents/live-agent/src/index.js";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected object payload");
  }
  return value as Record<string, unknown>;
}

test("live-agent parses lightweight storyteller delegation directives from conversation text", async () => {
  const request = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session-delegation",
    runId: "unit-run-delegation-directives",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "delegate story: write a short branch about a final contract handshake. text only. no images. no video. 2 scenes.",
      },
    },
  }) as OrchestratorRequest;

  const response = await runLiveAgent(request);
  const output = asObject(response.payload.output);
  const delegationRequest = asObject(output.delegationRequest);
  const storyInput = asObject(delegationRequest.input);

  assert.equal(delegationRequest.intent, "story");
  assert.equal(storyInput.prompt, "write a short branch about a final contract handshake");
  assert.equal(storyInput.includeImages, false);
  assert.equal(storyInput.includeVideo, false);
  assert.equal(storyInput.segmentCount, 2);
});
