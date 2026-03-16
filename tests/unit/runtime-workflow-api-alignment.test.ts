import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend exposes redacted runtime workflow control-plane endpoints", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const helperPath = resolve(process.cwd(), "apps", "api-backend", "src", "runtime-workflow-control-plane.ts");
  const source = readFileSync(sourcePath, "utf8");
  const helper = readFileSync(helperPath, "utf8");

  const requiredSourceTokens = [
    "/v1/runtime/workflow-config",
    "/v1/runtime/workflow-control-plane-override",
    "buildRuntimeWorkflowControlPlaneSnapshot",
    "buildUnavailableRuntimeWorkflowControlPlaneSnapshot",
    "summarizeRuntimeWorkflowControlPlaneOverrideInput",
    'source: "repo_owned_workflow_control_plane"',
    "workflow_control_plane_override",
    "API_RUNTIME_WORKFLOW_UNAVAILABLE",
    "API_RUNTIME_WORKFLOW_OVERRIDE_INVALID",
    "API_RUNTIME_WORKFLOW_OVERRIDE_INVALID_JSON",
    "degraded: true",
  ];
  for (const token of requiredSourceTokens) {
    assert.ok(source.includes(token), `runtime workflow API contract missing token: ${token}`);
  }

  const requiredHelperTokens = [
    "assistiveRouterApiKeyConfigured",
    "assistiveRouterProvider",
    "assistiveRouterBudgetPolicy",
    "assistiveRouterPromptCaching",
    "assistiveRouterWatchlistEnabled",
    "requestedAssistiveRouterApiKeyConfigured",
    "requestedAssistiveRouterProvider",
    "requestedAssistiveRouterBudgetPolicy",
    "requestedAssistiveRouterPromptCaching",
    "requestedAssistiveRouterWatchlistEnabled",
    "workflowPreview",
    '"apiKey"',
  ];
  for (const token of requiredHelperTokens) {
    assert.ok(helper.includes(token), `runtime workflow helper missing token: ${token}`);
  }
});

test("docs describe redacted workflow control-plane proxy and operator console surface", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuide = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");
  const assistiveRouter = readFileSync(resolve(process.cwd(), "docs", "assistive-router.md"), "utf8");
  const architecture = readFileSync(resolve(process.cwd(), "docs", "architecture.md"), "utf8");

  assert.match(readme, /GET \/v1\/runtime\/workflow-config/);
  assert.match(readme, /POST \/v1\/runtime\/workflow-control-plane-override/);
  assert.match(readme, /Workflow Control Panel/);
  assert.match(readme, /apiKeyConfigured/);
  assert.match(readme, /ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER/);
  assert.match(operatorGuide, /Workflow Control Panel/);
  assert.match(operatorGuide, /redacted/i);
  assert.match(operatorGuide, /provider/i);
  assert.match(assistiveRouter, /GET \/v1\/runtime\/workflow-config/);
  assert.match(assistiveRouter, /POST \/v1\/runtime\/workflow-control-plane-override/);
  assert.match(assistiveRouter, /apiKeyConfigured/);
  assert.match(assistiveRouter, /openai|anthropic|deepseek|moonshot/i);
  assert.match(architecture, /workflow control-plane/i);
});
