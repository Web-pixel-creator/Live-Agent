import test from "node:test";
import assert from "node:assert/strict";
import { createEnvelope, createNormalizedError, safeParseEnvelope } from "../../shared/contracts/src/index.js";

test("createEnvelope + safeParseEnvelope roundtrip", () => {
  const envelope = createEnvelope({
    userId: "user-1",
    sessionId: "session-1",
    runId: "run-1",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: { text: "hello" },
    },
  });

  const parsed = safeParseEnvelope(JSON.stringify(envelope));
  assert.ok(parsed, "safeParseEnvelope should parse valid envelope");
  assert.equal(parsed?.sessionId, "session-1");
  assert.equal(parsed?.type, "orchestrator.request");
});

test("safeParseEnvelope rejects malformed payload", () => {
  const invalid = JSON.stringify({
    id: "x",
    source: "frontend",
    ts: new Date().toISOString(),
    payload: {},
  });
  const parsed = safeParseEnvelope(invalid);
  assert.equal(parsed, null);
});

test("createNormalizedError always emits traceId", () => {
  const normalized = createNormalizedError({
    code: "TEST_ERROR",
    message: "failure",
  });
  assert.equal(normalized.code, "TEST_ERROR");
  assert.equal(normalized.message, "failure");
  assert.ok(typeof normalized.traceId === "string" && normalized.traceId.length > 10);
});
