import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace stage 2 exposes a guided flow with staged CTA wiring", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  const flowShellIndex = htmlSource.indexOf('class="case-workspace-flow-shell"');
  const summaryGridIndex = htmlSource.indexOf('class="case-workspace-summary-grid"');
  const flowActionIndex = htmlSource.indexOf('id="caseWorkspaceFlowActionBtn"');
  const stepperIndex = htmlSource.indexOf('class="case-workspace-stepper"');

  assert.ok(flowShellIndex !== -1, "guided flow shell should exist in the case workspace");
  assert.ok(stepperIndex !== -1, "case workspace should expose a stepper");
  assert.ok(flowActionIndex !== -1, "guided flow should expose a recommended CTA");
  assert.ok(summaryGridIndex !== -1, "case workspace should keep the summary grid");
  assert.ok(flowShellIndex < summaryGridIndex, "guided flow should sit ahead of the summary grid");
  assert.ok(stepperIndex < flowActionIndex, "the stepper should lead into the guided CTA");

  for (const token of [
    'data-case-workspace-step="case"',
    'data-case-workspace-step="documents"',
    'data-case-workspace-step="consultation"',
    'data-case-workspace-step="crm"',
    'data-case-workspace-step="handoff"',
    'data-case-workspace-step-status="case"',
    'id="caseWorkspaceFlowBadge"',
    'id="caseWorkspaceFlowPill"',
    'id="caseWorkspaceFlowTitle"',
    'id="caseWorkspaceFlowDescription"',
    'id="caseWorkspaceFlowHint"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing guided flow token: ${token}`);
  }

  for (const token of [
    'caseWorkspaceFlowBadge: document.getElementById("caseWorkspaceFlowBadge")',
    'caseWorkspaceFlowPill: document.getElementById("caseWorkspaceFlowPill")',
    'caseWorkspaceFlowActionBtn: document.getElementById("caseWorkspaceFlowActionBtn")',
    "const CASE_WORKSPACE_FLOW_STEPS = [\"case\", \"documents\", \"consultation\", \"crm\", \"handoff\"]",
    "const CASE_WORKSPACE_ACTION_SEQUENCE = [",
    "function getCaseWorkspaceActionIndex(",
    "function getCaseWorkspaceShortcutButtonState(",
    "function syncCaseWorkspaceActionButtons(",
    "function getCaseWorkspaceFlowState(",
    "function renderCaseWorkspaceFlow(",
    'bindDashboardActionButton(el.caseWorkspaceFlowActionBtn);',
    'button.dataset.caseWorkspaceActionState = uiState.state;',
    'caseDrawer.dataset.caseWorkspaceDrawerState = "recommended";',
    'resultDrawer.dataset.caseWorkspaceDrawerState = isReset ? "ready" : "review";',
    'setCaseWorkspaceDrawerPill(caseChip',
    'setCaseWorkspaceDrawerPill(resultChip',
    'run_visa_follow_up_demo',
    'review_visa_follow_up_result',
    'run_visa_reminder_demo',
    'review_visa_reminder_result',
    'run_visa_handoff_demo',
    'review_visa_handoff_result',
    'run_visa_escalation_demo',
    'review_visa_escalation_result',
    'reset_visa_demo',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing guided flow token: ${token}`);
  }

  for (const token of [
    ".case-workspace-flow-shell",
    ".case-workspace-stepper",
    ".case-workspace-step",
    ".case-workspace-step.is-current",
    ".case-workspace-step.is-complete",
    ".case-workspace-flow-card",
    ".case-workspace-flow-title",
    ".case-workspace-flow-actions",
    ".case-workspace-flow-hint",
    '.live-compose-preset-btn[data-case-workspace-action-state="recommended"]',
    '.live-compose-preset-btn[data-case-workspace-action-state="jump"]',
    '.case-workspace-action-shell[data-case-workspace-drawer-state="recommended"] .case-workspace-action-shell-pill',
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing guided flow style token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("guided flow"),
    "README should mention the guided flow layer in the live first fold",
  );
  assert.ok(
    readmeSource.includes("recommended shortcut") || readmeSource.includes("required protected review action"),
    "README should mention that the drawers mirror the guided flow",
  );
  assert.ok(
    operatorGuideSource.includes("guided flow"),
    "operator guide should mention the guided flow layer in the live first fold",
  );
  assert.ok(
    operatorGuideSource.includes("required protected review action"),
    "operator guide should mention that drawers mirror the guided flow",
  );
});
