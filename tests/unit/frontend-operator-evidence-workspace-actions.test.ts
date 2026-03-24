import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence prioritizes compact ctas by active workspace posture", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function prioritizeOperatorEvidenceDrawerActionsForWorkspace(actions, details = {}, viewId = \"latest\") {",
    "function buildOperatorEvidenceDrawerWorkspaceActionRail(actions, details = {}, viewId = \"latest\", limit = 3) {",
    "const workspaceSavedViewAction = activeSavedViewId && activeSavedViewId !== \"incidents\" && activeSavedViewId !== relatedSavedViewId",
    "const latestActions = buildOperatorEvidenceDrawerWorkspaceActionRail(",
    "const traceActions = buildOperatorEvidenceDrawerWorkspaceActionRail(",
    "const recoveryActions = buildOperatorEvidenceDrawerWorkspaceActionRail([",
    "const auditActions = buildOperatorEvidenceDrawerWorkspaceActionRail([",
    "preferredActionIds.push(\"open_workflow_control\", \"run_runtime_guardrail_path\", \"saved_view_runtime\");",
    "preferredActionIds.push(\"saved_view_approvals\", \"open_playbook\", \"open_quick_start\");",
    "preferredActionIds.push(\"saved_view_audit\", \"full_ops_view\");",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace-prioritized action token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("prioritizes the first visible `Focused Evidence` CTAs by the active workspace"),
    "README should document workspace-prioritized focused evidence CTAs",
  );
  assert.ok(
    operatorGuideSource.includes("prioritizes the first visible `Focused Evidence` CTAs by the active workspace"),
    "operator guide should document workspace-prioritized focused evidence CTAs",
  );
});
