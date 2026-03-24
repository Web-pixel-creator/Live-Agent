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
    'id="operatorEvidenceDrawerContextSignalItem"',
    'id="operatorEvidenceDrawerContextSignalValue"',
    'id="operatorEvidenceDrawerContextSignalSource"',
    'class="operator-evidence-drawer-context-label">Workspace<',
    'class="operator-evidence-drawer-context-label">View<',
    'class="operator-evidence-drawer-context-label">Next<',
    'class="operator-evidence-drawer-context-label">Signal<',
    'class="operator-evidence-drawer-context-source">Source: waiting for refresh</span>',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing focused evidence workspace-context token: ${token}`);
  }

  for (const token of [
    'operatorEvidenceDrawerContext: document.getElementById("operatorEvidenceDrawerContext")',
    'operatorEvidenceDrawerContextWorkspaceValue: document.getElementById("operatorEvidenceDrawerContextWorkspaceValue")',
    'operatorEvidenceDrawerContextViewValue: document.getElementById("operatorEvidenceDrawerContextViewValue")',
    'operatorEvidenceDrawerContextNextValue: document.getElementById("operatorEvidenceDrawerContextNextValue")',
    'operatorEvidenceDrawerContextSignalItem: document.getElementById("operatorEvidenceDrawerContextSignalItem")',
    'operatorEvidenceDrawerContextSignalValue: document.getElementById("operatorEvidenceDrawerContextSignalValue")',
    'operatorEvidenceDrawerContextSignalSource: document.getElementById("operatorEvidenceDrawerContextSignalSource")',
    "function resolveOperatorEvidenceDrawerWorkspaceNextValue(activeView, presentation) {",
    "function syncOperatorEvidenceDrawerContext(model, activeView) {",
    "function resolveOperatorWorkspaceLeadSignalPresentation(presentation) {",
    'el.operatorEvidenceDrawerContext.dataset.workspace =',
    'el.operatorEvidenceDrawerContext.dataset.workspaceState = workspaceState;',
    'el.operatorEvidenceDrawerContextWorkspaceValue.textContent = workspaceLabel;',
    'el.operatorEvidenceDrawerContextViewValue.textContent = activeView?.label ?? "Latest event";',
    'el.operatorEvidenceDrawerContextNextValue.textContent = nextValue;',
    'const leadSignalSource =',
    'el.operatorEvidenceDrawerContextSignalItem.dataset.signalState = leadSignal.state;',
    'el.operatorEvidenceDrawerContextSignalValue.textContent = leadSignal.value;',
    'el.operatorEvidenceDrawerContextSignalSource.textContent = `Source: ${leadSignalSource}`;',
    'syncOperatorEvidenceDrawerContext(model, activeView);',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing focused evidence workspace-context token: ${token}`);
  }

  for (const token of [
    ".panel-operator-console .operator-evidence-drawer-context {",
    ".panel-operator-console .operator-evidence-drawer-context-item {",
    ".panel-operator-console .operator-evidence-drawer-context-label {",
    ".panel-operator-console .operator-evidence-drawer-context-value {",
    ".panel-operator-console .operator-evidence-drawer-context-source {",
    '.panel-operator-console .operator-evidence-drawer-context[data-workspace-state="fail"] .operator-evidence-drawer-context-value {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="dormant"] .operator-evidence-drawer-context-value {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="steady"] .operator-evidence-drawer-context-value {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="neutral"] .operator-evidence-drawer-context-value {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="fail"] .operator-evidence-drawer-context-value {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="dormant"] .operator-evidence-drawer-context-source {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="steady"] .operator-evidence-drawer-context-source {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="neutral"] .operator-evidence-drawer-context-source {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="fail"] .operator-evidence-drawer-context-source {',
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing focused evidence workspace-context style token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Focused Evidence` context row now also carries a read-only workspace signal"),
    "README should document the focused evidence workspace signal",
  );
  assert.ok(
    operatorGuideSource.includes("`Focused Evidence` context row now also carries a read-only workspace signal"),
    "operator guide should document the focused evidence workspace signal",
  );
  assert.ok(
    readmeSource.includes("`Focused Evidence` Signal context item now also shows a read-only `Source` subline"),
    "README should document the focused evidence signal source subline",
  );
  assert.ok(
    operatorGuideSource.includes("`Focused Evidence` Signal context item now also shows a read-only `Source` subline"),
    "operator guide should document the focused evidence signal source subline",
  );
});
