import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRuntimeWorkflowControlPlaneSnapshot,
  summarizeRuntimeWorkflowControlPlaneOverrideInput,
} from "../../apps/api-backend/src/runtime-workflow-control-plane.js";

test("runtime workflow control-plane snapshot redacts assistive router apiKey", () => {
  const snapshot = buildRuntimeWorkflowControlPlaneSnapshot({
    ok: true,
    service: "orchestrator",
    action: "set",
    workflow: {
      schemaVersion: 1,
      loadedAt: "2026-03-06T12:00:00.000Z",
      sourceKind: "control_plane_json",
      sourcePath: null,
      idempotencyTtlMs: 120000,
      assistiveRouter: {
        enabled: true,
        provider: "openai",
        model: "gpt-5.4",
        apiKey: "secret-key",
        baseUrl: "https://example.test",
        timeoutMs: 2500,
        minConfidence: 0.75,
        allowIntents: ["conversation", "translation"],
        budgetPolicy: "long_context_operator",
        promptCaching: "provider_default",
        watchlistEnabled: false,
      },
      retryPolicy: {
        continuationStatusCode: 202,
        continuationBackoffMs: 300,
        transientErrorCodes: ["rate_limit"],
        transientErrorPatterns: ["503"],
        terminalErrorCodes: ["forbidden"],
        terminalErrorPatterns: ["permission denied"],
      },
    },
    store: {
      loadedAt: "2026-03-06T12:00:00.000Z",
      lastAttemptAt: "2026-03-06T12:00:00.000Z",
      sourceKind: "control_plane_json",
      sourcePath: null,
      fingerprint: "abc123",
      usingLastKnownGood: false,
      lastError: null,
      assistiveRouter: {
        enabled: true,
        provider: "openai",
        model: "gpt-5.4",
        apiKeyConfigured: true,
        allowIntents: ["conversation", "translation"],
        timeoutMs: 2500,
        minConfidence: 0.75,
        budgetPolicy: "long_context_operator",
        promptCaching: "provider_default",
        watchlistEnabled: false,
      },
      idempotencyTtlMs: 120000,
      workflowState: {
        status: "running",
        currentStage: "planning",
        activeRole: "planner",
        runId: "run-workflow-1",
        sessionId: "session-workflow-1",
        taskId: "task-workflow-1",
        intent: "conversation",
        route: "live-agent",
        reason: "planning request",
        updatedAt: "2026-03-06T12:00:01.000Z",
      },
      controlPlaneOverride: {
        active: true,
        updatedAt: "2026-03-06T12:00:00.000Z",
        reason: "test override",
      },
    },
  });

  assert.equal(snapshot.service, "orchestrator");
  assert.equal(snapshot.action, "set");
  assert.equal(snapshot.workflow?.assistiveRouter?.apiKeyConfigured, true);
  assert.equal("apiKey" in (snapshot.workflow?.assistiveRouter ?? {}), false);
  assert.equal(snapshot.summary.assistiveRouterApiKeyConfigured, true);
  assert.equal(snapshot.summary.assistiveRouterProvider, "openai");
  assert.equal(snapshot.summary.controlPlaneOverrideActive, true);
  assert.equal(snapshot.summary.assistiveRouterBudgetPolicy, "long_context_operator");
  assert.equal(snapshot.summary.assistiveRouterPromptCaching, "provider_default");
  assert.equal(snapshot.summary.assistiveRouterWatchlistEnabled, false);
  assert.equal(snapshot.store?.workflowState?.currentStage, "planning");
  assert.equal(snapshot.store?.workflowState?.activeRole, "planner");
  assert.equal(snapshot.summary.workflowExecutionStatus, "running");
  assert.equal(snapshot.summary.workflowCurrentStage, "planning");
  assert.equal(snapshot.summary.workflowActiveRole, "planner");
  assert.equal(snapshot.summary.workflowRoute, "live-agent");
  assert.deepEqual(snapshot.summary.assistiveRouterAllowIntents, ["conversation", "translation"]);
  assert.deepEqual(snapshot.summary.retryTransientErrorCodes, ["rate_limit"]);
});

test("runtime workflow control-plane override input summary redacts rawJson secrets", () => {
  const summary = summarizeRuntimeWorkflowControlPlaneOverrideInput({
    reason: "force deterministic fallback",
    rawJson: JSON.stringify({
      assistiveRouter: {
        enabled: true,
        provider: "moonshot",
        apiKey: null,
        allowIntents: ["conversation"],
        budgetPolicy: "watchlist_experimental",
        promptCaching: "watchlist_only",
        watchlistEnabled: false,
      },
    }),
  });

  assert.equal(summary.inputMode, "rawJson");
  assert.equal(summary.rawJsonProvided, true);
  assert.equal(summary.rawJsonParsed, true);
  assert.equal(summary.requestedAssistiveRouterApiKeyConfigured, false);
  assert.equal(summary.requestedAssistiveRouterProvider, "moonshot");
  assert.equal(summary.requestedAssistiveRouterBudgetPolicy, "watchlist_experimental");
  assert.equal(summary.requestedAssistiveRouterPromptCaching, "watchlist_only");
  assert.equal(summary.requestedAssistiveRouterWatchlistEnabled, false);
  assert.equal("apiKey" in ((summary.workflowPreview as { assistiveRouter?: Record<string, unknown> } | null)?.assistiveRouter ?? {}), false);
});
