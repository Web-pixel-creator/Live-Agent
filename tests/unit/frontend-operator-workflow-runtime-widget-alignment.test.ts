import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator workflow runtime widget is wired in frontend HTML and runtime", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlIds = [
    'data-operator-signal-target="operatorWorkflowRuntimeStatus"',
    'id="operatorSignalWorkflow"',
    'id="operatorWorkflowRuntimeStatus"',
    'id="operatorWorkflowRuntimeSource"',
    'id="operatorWorkflowRuntimeAssistive"',
    'id="operatorWorkflowRuntimeOverride"',
    'id="operatorWorkflowRuntimeFingerprint"',
    'id="operatorWorkflowRuntimeLastError"',
    'id="operatorWorkflowRuntimeHint"',
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(htmlSource.includes(token), `frontend html missing workflow runtime widget token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorSignalWorkflow: document.getElementById("operatorSignalWorkflow")',
    'operatorWorkflowRuntimeStatus: document.getElementById("operatorWorkflowRuntimeStatus")',
    'operatorWorkflowRuntimeStatus: "operatorSignalWorkflow"',
    "setOperatorWorkflowRuntimeHint",
    "resetOperatorWorkflowRuntimeWidget",
    "renderOperatorWorkflowRuntimeWidget",
    "const runtimeDiagnostics = summary.runtimeDiagnostics",
    '"workflow_runtime"',
    "renderOperatorWorkflowRuntimeWidget(runtimeDiagnostics);",
    "resetOperatorWorkflowRuntimeWidget(failedRefreshReason);",
    "assistiveRouterProvider",
    "assistiveRouterBudgetPolicy",
    "assistiveRouterPromptCaching",
    "assistiveRouterWatchlistEnabled",
    "workflowExecutionStatus",
    "workflowCurrentStage",
    "workflowActiveRole",
    "awaiting_${workflowCurrentStage}",
    "Workflow is waiting on",
    "Workflow is running",
    "provider posture plus apiKeyConfigured",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing workflow runtime token: ${token}`);
  }

  assert.ok(readmeSource.includes("Workflow Runtime"), "README missing workflow runtime operator card note");
  assert.ok(operatorGuideSource.includes("Workflow Runtime"), "operator guide missing workflow runtime operator card note");
});
