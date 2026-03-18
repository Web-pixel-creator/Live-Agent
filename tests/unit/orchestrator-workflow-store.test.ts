import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearOrchestratorWorkflowControlPlaneOverride,
  clearOrchestratorWorkflowExecutionState,
  getOrchestratorWorkflowConfig,
  getOrchestratorWorkflowExecutionState,
  getOrchestratorWorkflowStoreStatus,
  resetOrchestratorWorkflowStoreForTests,
  setOrchestratorWorkflowControlPlaneOverride,
  setOrchestratorWorkflowExecutionState,
} from "../../agents/orchestrator/src/workflow-store.js";

function withEnv(
  entries: Record<string, string | undefined>,
  run: () => void | Promise<void>,
): Promise<void> | void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(entries)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const restore = () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    resetOrchestratorWorkflowStoreForTests();
  };

  try {
    const result = run();
    if (result && typeof (result as Promise<void>).then === "function") {
      return (result as Promise<void>).finally(restore);
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

test("workflow store loads repo/file config and applies env overrides", () =>
  withEnv(
    {
      ORCHESTRATOR_WORKFLOW_CONFIG_PATH: undefined,
      ORCHESTRATOR_WORKFLOW_CONFIG_JSON: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED: "true",
      ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY: undefined,
      ORCHESTRATOR_IDEMPOTENCY_TTL_MS: "60000",
      GEMINI_API_KEY: "unit-key",
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      DEEPSEEK_API_KEY: undefined,
      MOONSHOT_API_KEY: undefined,
    },
    () => {
      const config = getOrchestratorWorkflowConfig();
      assert.equal(config.sourceKind, "file");
      assert.equal(config.assistiveRouter.enabled, true);
      assert.equal(config.assistiveRouter.provider, "gemini_api");
      assert.equal(config.assistiveRouter.budgetPolicy, "judged_default");
      assert.equal(config.assistiveRouter.promptCaching, "none");
      assert.equal(config.assistiveRouter.watchlistEnabled, false);
      assert.equal(config.idempotencyTtlMs, 60000);
      assert.equal(config.assistiveRouter.apiKey, "unit-key");
      assert.deepEqual(config.assistiveRouter.allowIntents, ["conversation", "translation", "negotiation", "research"]);
    },
  ));

test("workflow store tracks workflow execution stage and active role", () =>
  withEnv(
    {
      ORCHESTRATOR_WORKFLOW_CONFIG_PATH: undefined,
      ORCHESTRATOR_WORKFLOW_CONFIG_JSON: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY: undefined,
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      DEEPSEEK_API_KEY: undefined,
      MOONSHOT_API_KEY: undefined,
    },
    () => {
      const initial = getOrchestratorWorkflowExecutionState();
      assert.equal(initial.status, "idle");
      assert.equal(initial.currentStage, null);
      assert.equal(initial.activeRole, null);

      setOrchestratorWorkflowExecutionState({
        status: "running",
        currentStage: "planning",
        activeRole: "planner",
        runId: "run-workflow-1",
        sessionId: "session-workflow-1",
        taskId: "task-workflow-1",
        intent: "conversation",
        route: "live-agent",
        reason: "planning request",
      });

      const status = getOrchestratorWorkflowStoreStatus();
      assert.equal(status.workflowState.status, "running");
      assert.equal(status.workflowState.currentStage, "planning");
      assert.equal(status.workflowState.activeRole, "planner");
      assert.equal(status.workflowState.runId, "run-workflow-1");
      assert.equal(status.workflowState.route, "live-agent");
      assert.equal(status.workflowState.reason, "planning request");

      clearOrchestratorWorkflowExecutionState();
      const cleared = getOrchestratorWorkflowExecutionState();
      assert.equal(cleared.status, "idle");
      assert.equal(cleared.currentStage, null);
      assert.equal(cleared.activeRole, null);
    },
  ));

test("workflow store applies provider-aware assistive router defaults from env override", () =>
  withEnv(
    {
      ORCHESTRATOR_WORKFLOW_CONFIG_PATH: undefined,
      ORCHESTRATOR_WORKFLOW_CONFIG_JSON: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER: "openai",
      ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY: undefined,
      OPENAI_API_KEY: "openai-unit-key",
      OPENAI_BASE_URL: "https://openai.example.test/v1",
      GEMINI_API_KEY: "gemini-unit-key",
      ANTHROPIC_API_KEY: undefined,
      DEEPSEEK_API_KEY: undefined,
      MOONSHOT_API_KEY: undefined,
    },
    () => {
      const config = getOrchestratorWorkflowConfig();
      const status = getOrchestratorWorkflowStoreStatus();
      assert.equal(config.assistiveRouter.provider, "openai");
      assert.equal(config.assistiveRouter.model, "gpt-5.4");
      assert.equal(config.assistiveRouter.baseUrl, "https://openai.example.test/v1");
      assert.equal(config.assistiveRouter.apiKey, "openai-unit-key");
      assert.equal(config.assistiveRouter.budgetPolicy, "long_context_operator");
      assert.equal(config.assistiveRouter.promptCaching, "provider_default");
      assert.equal(config.assistiveRouter.watchlistEnabled, false);
      assert.equal(status.assistiveRouter?.provider, "openai");
      assert.equal(status.assistiveRouter?.budgetPolicy, "long_context_operator");
      assert.equal(status.assistiveRouter?.promptCaching, "provider_default");
      assert.equal(status.assistiveRouter?.watchlistEnabled, false);
    },
  ));

test("workflow store keeps last-known-good snapshot when file becomes invalid", () =>
  withEnv(
    {
      ORCHESTRATOR_WORKFLOW_CONFIG_JSON: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY: undefined,
      ORCHESTRATOR_IDEMPOTENCY_TTL_MS: undefined,
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      DEEPSEEK_API_KEY: undefined,
      MOONSHOT_API_KEY: undefined,
    },
    () => {
      const tempDir = mkdtempSync(join(tmpdir(), "orchestrator-workflow-"));
      const workflowPath = join(tempDir, "workflow.json");
      try {
        writeFileSync(
          workflowPath,
          JSON.stringify({
            schemaVersion: 1,
            assistiveRouter: {
              enabled: true,
              timeoutMs: 3100,
            },
          }),
          "utf8",
        );
        process.env.ORCHESTRATOR_WORKFLOW_CONFIG_PATH = workflowPath;
        const first = getOrchestratorWorkflowConfig();
        assert.equal(first.assistiveRouter.enabled, true);
        assert.equal(first.assistiveRouter.timeoutMs, 3100);

        writeFileSync(workflowPath, "{ invalid-json", "utf8");
        process.env.ORCHESTRATOR_WORKFLOW_REFRESH_MS = "1";
        const second = getOrchestratorWorkflowConfig();
        const status = getOrchestratorWorkflowStoreStatus();
        assert.equal(second.assistiveRouter.enabled, true);
        assert.equal(second.assistiveRouter.timeoutMs, 3100);
        assert.equal(status.usingLastKnownGood, true);
        assert.match(status.lastError ?? "", /json/i);
      } finally {
        delete process.env.ORCHESTRATOR_WORKFLOW_CONFIG_PATH;
        delete process.env.ORCHESTRATOR_WORKFLOW_REFRESH_MS;
        rmSync(tempDir, { recursive: true, force: true });
      }
    },
  ));

test("workflow store control-plane override can supersede env and clear api key", () =>
  withEnv(
    {
      ORCHESTRATOR_WORKFLOW_CONFIG_PATH: undefined,
      ORCHESTRATOR_WORKFLOW_CONFIG_JSON: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY: undefined,
      GEMINI_API_KEY: "env-key",
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      DEEPSEEK_API_KEY: undefined,
      MOONSHOT_API_KEY: undefined,
    },
    () => {
      const baseline = getOrchestratorWorkflowConfig();
      assert.equal(baseline.assistiveRouter.apiKey, "env-key");
      assert.equal(getOrchestratorWorkflowStoreStatus().controlPlaneOverride.active, false);

      setOrchestratorWorkflowControlPlaneOverride({
        rawJson: JSON.stringify({
          assistiveRouter: {
            enabled: true,
            apiKey: null,
          },
        }),
        reason: "unit-test-override",
      });

      const overridden = getOrchestratorWorkflowConfig();
      const status = getOrchestratorWorkflowStoreStatus();
      assert.equal(overridden.sourceKind, "control_plane_json");
      assert.equal(overridden.assistiveRouter.enabled, true);
      assert.equal(overridden.assistiveRouter.apiKey, null);
      assert.equal(status.controlPlaneOverride.active, true);
      assert.equal(status.controlPlaneOverride.reason, "unit-test-override");

      clearOrchestratorWorkflowControlPlaneOverride();
      const restored = getOrchestratorWorkflowConfig();
      const restoredStatus = getOrchestratorWorkflowStoreStatus();
      assert.equal(restored.sourceKind, "file");
      assert.equal(restored.assistiveRouter.apiKey, "env-key");
      assert.equal(restoredStatus.controlPlaneOverride.active, false);
    },
  ));

test("workflow store keeps last-known-good snapshot when control-plane override is invalid", () =>
  withEnv(
    {
      ORCHESTRATOR_WORKFLOW_CONFIG_PATH: undefined,
      ORCHESTRATOR_WORKFLOW_CONFIG_JSON: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED: undefined,
      ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY: undefined,
      GEMINI_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      DEEPSEEK_API_KEY: undefined,
      MOONSHOT_API_KEY: undefined,
    },
    () => {
      const baseline = getOrchestratorWorkflowConfig();
      assert.equal(baseline.sourceKind, "file");

      setOrchestratorWorkflowControlPlaneOverride({
        rawJson: "{ invalid-json",
        reason: "fault_profile:orchestrator-last-known-good",
      });

      const fallback = getOrchestratorWorkflowConfig();
      const status = getOrchestratorWorkflowStoreStatus();
      assert.equal(fallback.sourceKind, "file");
      assert.equal(status.usingLastKnownGood, true);
      assert.equal(status.controlPlaneOverride.active, true);
      assert.equal(status.controlPlaneOverride.reason, "fault_profile:orchestrator-last-known-good");
      assert.match(status.lastError ?? "", /control-plane override|json/i);
    },
  ));
