import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("orchestrator exposes workflow config and control-plane override endpoints", () => {
  const source = readFileSync(resolve(process.cwd(), "agents", "orchestrator", "src", "index.ts"), "utf8");
  const orchestrate = readFileSync(resolve(process.cwd(), "agents", "orchestrator", "src", "orchestrate.ts"), "utf8");
  const workflowStore = readFileSync(resolve(process.cwd(), "agents", "orchestrator", "src", "workflow-store.ts"), "utf8");

  const requiredTokens = [
    "/workflow/config",
    "/workflow/control-plane-override",
    "getOrchestratorWorkflowConfig",
    "getOrchestratorWorkflowStoreStatus",
    "setOrchestratorWorkflowControlPlaneOverride",
    "clearOrchestratorWorkflowControlPlaneOverride",
    "ORCHESTRATOR_WORKFLOW_OVERRIDE_INVALID",
    "action: \"set\"",
    "action: \"clear\"",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `orchestrator workflow API contract missing token: ${token}`);
  }

  const requiredOrchestrateTokens = [
    "workflow.stage",
    "persistWorkflowStageTransition",
    "buildWorkflowTaskMetadata",
    "stageReason(",
  ];

  for (const token of requiredOrchestrateTokens) {
    assert.ok(orchestrate.includes(token), `orchestrator workflow role-graph contract missing token: ${token}`);
  }

  const requiredWorkflowStoreTokens = [
    "workflowState",
    "currentStage",
    "activeRole",
    "setOrchestratorWorkflowExecutionState",
    "clearOrchestratorWorkflowExecutionState",
  ];

  for (const token of requiredWorkflowStoreTokens) {
    assert.ok(workflowStore.includes(token), `orchestrator workflow store contract missing token: ${token}`);
  }
});

test("assistive router docs describe workflow control-plane override contract", () => {
  const docs = readFileSync(resolve(process.cwd(), "docs", "assistive-router.md"), "utf8");

  assert.match(docs, /GET \/workflow\/config/);
  assert.match(docs, /POST \/workflow\/control-plane-override/);
  assert.match(docs, /control-plane override/i);
  assert.match(docs, /last-known-good/i);
});
