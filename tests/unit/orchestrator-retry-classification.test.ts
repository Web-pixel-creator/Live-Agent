import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOrchestratorExecutionError,
  classifyOrchestratorError,
} from "../../agents/orchestrator/src/retry-classification.js";
import {
  getOrchestratorWorkflowConfig,
  resetOrchestratorWorkflowStoreForTests,
} from "../../agents/orchestrator/src/workflow-store.js";

test.afterEach(() => {
  resetOrchestratorWorkflowStoreForTests();
});

test("retry classification marks timeout-like failures as continuation", () => {
  const workflow = getOrchestratorWorkflowConfig();
  const decision = classifyOrchestratorError(
    new Error("remote executor request timed out after 15000ms"),
    workflow.retryPolicy,
  );

  assert.equal(decision.classification, "continuation");
  assert.equal(decision.retryable, true);
  assert.equal(decision.httpStatusCode, 503);
  assert.equal(decision.retryAfterMs, workflow.retryPolicy.continuationBackoffMs);
});

test("retry classification marks invalid payload diagnostics as failure", () => {
  const workflow = getOrchestratorWorkflowConfig();
  const decision = classifyOrchestratorError(
    new Error("remote executor returned invalid payload"),
    workflow.retryPolicy,
  );

  assert.equal(decision.classification, "failure");
  assert.equal(decision.retryable, false);
  assert.equal(decision.httpStatusCode, 500);
});

test("execution error embeds retry metadata in normalized details", () => {
  const workflow = getOrchestratorWorkflowConfig();
  const executionError = buildOrchestratorExecutionError({
    error: new Error("service unavailable from upstream executor"),
    route: "ui-navigator-agent",
    phase: "delegated_route",
    runId: "run-1",
    sessionId: "session-1",
    taskId: "task-1",
    retryPolicy: workflow.retryPolicy,
  });

  assert.equal(executionError.statusCode, 503);
  assert.equal(executionError.normalizedError.code, "ORCHESTRATOR_CONTINUATION_RETRY");
  assert.deepEqual(executionError.normalizedError.details, {
    route: "ui-navigator-agent",
    phase: "delegated_route",
    runId: "run-1",
    sessionId: "session-1",
    taskId: "task-1",
    retry: {
      classification: "continuation",
      retryable: true,
      retryAfterMs: workflow.retryPolicy.continuationBackoffMs,
      reason: "message:service unavailable",
    },
  });
});
