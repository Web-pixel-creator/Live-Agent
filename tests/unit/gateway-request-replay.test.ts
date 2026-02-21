import test from "node:test";
import assert from "node:assert/strict";
import { createEnvelope, type OrchestratorRequest } from "../../shared/contracts/src/index.js";
import {
  buildReplayFingerprint,
  buildReplayKey,
  extractGatewayRequestIdempotencyKey,
} from "../../apps/realtime-gateway/src/request-replay.js";

function createRequest(params: {
  runId: string;
  input: unknown;
  idempotencyKey?: string;
}): OrchestratorRequest {
  const payload: Record<string, unknown> = {
    intent: "conversation",
    input: params.input,
  };
  if (params.idempotencyKey) {
    payload.idempotencyKey = params.idempotencyKey;
  }
  return createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session",
    runId: params.runId,
    type: "orchestrator.request",
    source: "frontend",
    payload,
  }) as OrchestratorRequest;
}

test("gateway replay key uses sanitized idempotency token from request payload", () => {
  const request = createRequest({
    runId: "run-replay-key",
    input: { text: "hello" },
    idempotencyKey: "order#123/unsafe",
  });

  const extracted = extractGatewayRequestIdempotencyKey(request);
  const key = buildReplayKey(request);
  assert.equal(extracted, "order_123_unsafe");
  assert.equal(key, "unit-session:run-replay-key:conversation:order_123_unsafe");
});

test("gateway replay key falls back to runId when idempotency token absent", () => {
  const request = createRequest({
    runId: "run-replay-fallback",
    input: { text: "no explicit idempotency key" },
  });

  const key = buildReplayKey(request);
  assert.equal(key, "unit-session:run-replay-fallback:conversation:run-replay-fallback");
});

test("gateway replay fingerprint is stable for semantically identical payload order", () => {
  const first = createRequest({
    runId: "run-replay-fingerprint-stable",
    input: {
      b: 2,
      a: 1,
      nested: {
        y: "two",
        x: "one",
      },
    },
    idempotencyKey: "idem-stable",
  });
  const second = createRequest({
    runId: "run-replay-fingerprint-stable",
    input: {
      nested: {
        x: "one",
        y: "two",
      },
      a: 1,
      b: 2,
    },
    idempotencyKey: "idem-stable",
  });

  assert.equal(buildReplayFingerprint(first), buildReplayFingerprint(second));
});

test("gateway replay fingerprint changes when logical request input changes", () => {
  const first = createRequest({
    runId: "run-replay-fingerprint-diff",
    input: { text: "first input" },
    idempotencyKey: "idem-diff",
  });
  const second = createRequest({
    runId: "run-replay-fingerprint-diff",
    input: { text: "mutated input" },
    idempotencyKey: "idem-diff",
  });

  assert.notEqual(buildReplayFingerprint(first), buildReplayFingerprint(second));
});
