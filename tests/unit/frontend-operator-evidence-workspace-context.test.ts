import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence adds a workspace-aware context row above the drawer tabs", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="operatorEvidenceDrawerContext"',
    'id="operatorEvidenceDrawerContextWorkspaceValue"',
    'id="operatorEvidenceDrawerContextViewValue"',
    'id="operatorEvidenceDrawerContextNextValue"',
    'class="operator-evidence-drawer-context-label">Workspace<',
    'class="operator-evidence-drawer-context-label">View<',
    'class="operator-evidence-drawer-context-label">Next<',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing focused evidence workspace-context token: ${token}`);
  }

  for (const token of [
    'operatorEvidenceDrawerContext: document.getElementById("operatorEvidenceDrawerContext")',
    'operatorEvidenceDrawerContextWorkspaceValue: document.getElementById("operatorEvidenceDrawerContextWorkspaceValue")',
    'operatorEvidenceDrawerContextViewValue: document.getElementById("operatorEvidenceDrawerContextViewValue")',
    'operatorEvidenceDrawerContextNextValue: document.getElementById("operatorEvidenceDrawerContextNextValue")',
    "function resolveOperatorEvidenceDrawerWorkspaceNextValue(activeView, presentation) {",
    "function syncOperatorEvidenceDrawerContext(model, activeView) {",
    'el.operatorEvidenceDrawerContext.dataset.workspace =',
    'el.operatorEvidenceDrawerContext.dataset.workspaceState = workspaceState;',
    'el.operatorEvidenceDrawerContextWorkspaceValue.textContent = workspaceLabel;',
    'el.operatorEvidenceDrawerContextViewValue.textContent = activeView?.label ?? "Latest event";',
    'el.operatorEvidenceDrawerContextNextValue.textContent = nextValue;',
    'syncOperatorEvidenceDrawerContext(model, activeView);',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing focused evidence workspace-context token: ${token}`);
  }

  for (const token of [
    ".panel-operator-console .operator-evidence-drawer-context {",
    ".panel-operator-console .operator-evidence-drawer-context-item {",
    ".panel-operator-console .operator-evidence-drawer-context-label {",
    ".panel-operator-console .operator-evidence-drawer-context-value {",
    '.panel-operator-console .operator-evidence-drawer-context[data-workspace-state="fail"] .operator-evidence-drawer-context-value {',
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing focused evidence workspace-context style token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("workspace-aware `Focused Evidence` context row"),
    "README should document the focused evidence workspace-context row",
  );
  assert.ok(
    readmeSource.includes("shows `Workspace / View / Next`"),
    "README should document the focused evidence workspace-context fields",
  );
  assert.ok(
    operatorGuideSource.includes("workspace-aware `Focused Evidence` context row"),
    "operator guide should document the focused evidence workspace-context row",
  );
  assert.ok(
    operatorGuideSource.includes("shows `Workspace / View / Next`"),
    "operator guide should document the focused evidence workspace-context fields",
  );
});
