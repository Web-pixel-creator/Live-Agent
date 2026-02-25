import test from "node:test";
import assert from "node:assert/strict";
import { createEnvelope, createNormalizedError, RollingMetrics, safeParseEnvelope } from "../../shared/contracts/src/index.js";

test("createEnvelope + safeParseEnvelope roundtrip", () => {
  const envelope = createEnvelope({
    userId: "user-1",
    sessionId: "session-1",
    runId: "run-1",
    conversation: "default",
    metadata: {
      clientEventId: "evt-123",
    },
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: { text: "hello" },
    },
  });

  const parsed = safeParseEnvelope(JSON.stringify(envelope));
  assert.ok(parsed, "safeParseEnvelope should parse valid envelope");
  assert.equal(parsed?.id, envelope.id);
  assert.equal(parsed?.sessionId, "session-1");
  assert.equal(parsed?.type, "orchestrator.request");
  assert.equal(parsed?.conversation, "default");
  assert.equal((parsed?.metadata as { clientEventId?: string })?.clientEventId, "evt-123");
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

test("rolling metrics onRecord hook receives normalized samples", () => {
  const records: Array<{ operation: string; durationMs: number; ok: boolean }> = [];
  const metrics = new RollingMetrics({
    maxSamplesPerBucket: 50,
    onRecord: (entry) => {
      records.push({
        operation: entry.operation,
        durationMs: entry.durationMs,
        ok: entry.ok,
      });
    },
  });

  metrics.record("GET /healthz", 10.9, true);
  metrics.record("GET /healthz", -5, false);

  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    operation: "GET /healthz",
    durationMs: 10,
    ok: true,
  });
  assert.deepEqual(records[1], {
    operation: "GET /healthz",
    durationMs: 0,
    ok: false,
  });
});
