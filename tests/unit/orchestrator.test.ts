import test from "node:test";
import assert from "node:assert/strict";
import { createEnvelope, type OrchestratorRequest } from "../../shared/contracts/src/index.js";
import { orchestrate } from "../../agents/orchestrator/src/orchestrate.js";

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return value as Record<string, unknown>;
}

test("orchestrator keeps live-agent primary route and returns delegation payload", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";

  const request = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session",
    runId: "unit-run-delegation",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "delegate story: create a short scene about a rover on Mars",
      },
    },
  }) as OrchestratorRequest;

  const response = await orchestrate(request);
  assert.equal(response.payload.route, "live-agent");
  assert.equal(response.payload.status, "completed");

  const output = asObject(response.payload.output);
  const delegation = asObject(output.delegation);
  assert.equal(delegation.requestedIntent, "story");
  assert.equal(delegation.requestedRoute, "storyteller-agent");
});

test("orchestrator returns approval-required flow for sensitive ui_task", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";

  const request = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session",
    runId: "unit-run-ui-approval",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "ui_task",
      input: {
        goal: "Open payment page and submit card details",
        url: "https://example.com/checkout",
      },
    },
  }) as OrchestratorRequest;

  const response = await orchestrate(request);
  assert.equal(response.payload.route, "ui-navigator-agent");
  assert.equal(response.payload.status, "accepted");

  const output = asObject(response.payload.output);
  assert.equal(output.approvalRequired, true);
  assert.ok(typeof output.approvalId === "string");
});

test("orchestrator replays cached response for duplicate request", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.ORCHESTRATOR_IDEMPOTENCY_TTL_MS = "120000";

  const runId = `unit-run-idempotent-${Date.now()}`;
  const request = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session-idempotent",
    runId,
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "hello idempotency",
      },
      idempotencyKey: `idem-${runId}`,
    },
  }) as OrchestratorRequest;

  const first = await orchestrate(request);
  const second = await orchestrate(request);

  assert.equal(second.id, first.id);
  const firstOutput = asObject(first.payload.output);
  const secondOutput = asObject(second.payload.output);
  assert.equal(secondOutput.traceId, firstOutput.traceId);
});

test("orchestrator deduplicates in-flight duplicates by request key", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.ORCHESTRATOR_IDEMPOTENCY_TTL_MS = "120000";

  const runId = `unit-run-idempotent-inflight-${Date.now()}`;
  const request = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session-idempotent-inflight",
    runId,
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "hello inflight idempotency",
      },
      idempotencyKey: `idem-${runId}`,
    },
  }) as OrchestratorRequest;

  const [first, second] = await Promise.all([orchestrate(request), orchestrate(request)]);
  assert.equal(second.id, first.id);
  const firstOutput = asObject(first.payload.output);
  const secondOutput = asObject(second.payload.output);
  assert.equal(secondOutput.traceId, firstOutput.traceId);
});

test("orchestrator returns idempotency conflict for same key with different payload", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.ORCHESTRATOR_IDEMPOTENCY_TTL_MS = "120000";

  const runId = `unit-run-idempotent-conflict-${Date.now()}`;
  const idempotencyKey = `idem-${runId}`;

  const firstRequest = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session-idempotent-conflict",
    runId,
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "first payload",
      },
      idempotencyKey,
    },
  }) as OrchestratorRequest;

  const secondRequest = createEnvelope({
    ...firstRequest,
    payload: {
      ...firstRequest.payload,
      input: {
        text: "mutated payload",
      },
    },
  }) as OrchestratorRequest;

  const first = await orchestrate(firstRequest);
  const second = await orchestrate(secondRequest);

  assert.equal(first.payload.status, "completed");
  assert.equal(second.payload.status, "failed");

  const error = asObject(second.payload.error);
  assert.equal(error.code, "ORCHESTRATOR_IDEMPOTENCY_CONFLICT");
});

test("orchestrator returns idempotency conflict for in-flight request with same key and mutated payload", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.ORCHESTRATOR_IDEMPOTENCY_TTL_MS = "120000";

  const runId = `unit-run-idempotent-conflict-inflight-${Date.now()}`;
  const idempotencyKey = `idem-${runId}`;

  const firstRequest = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session-idempotent-conflict-inflight",
    runId,
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "first payload inflight",
      },
      idempotencyKey,
    },
  }) as OrchestratorRequest;

  const secondRequest = createEnvelope({
    ...firstRequest,
    payload: {
      ...firstRequest.payload,
      input: {
        text: "mutated payload inflight",
      },
    },
  }) as OrchestratorRequest;

  const [first, second] = await Promise.all([orchestrate(firstRequest), orchestrate(secondRequest)]);
  const statuses = [first.payload.status, second.payload.status];

  assert.equal(statuses.includes("completed"), true);
  assert.equal(statuses.includes("failed"), true);

  const failedResponse = first.payload.status === "failed" ? first : second;
  const error = asObject(failedResponse.payload.error);
  assert.equal(error.code, "ORCHESTRATOR_IDEMPOTENCY_CONFLICT");
});
