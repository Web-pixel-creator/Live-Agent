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
    'class="operator-evidence-drawer-context-label">Focus<',
    'id="operatorEvidenceDrawerContextViewValue"',
    'id="operatorEvidenceDrawerContextFocusValue"',
    'id="operatorEvidenceDrawerContextNextValue"',
    'id="operatorEvidenceDrawerContextSignalItem"',
    'id="operatorEvidenceDrawerContextSignalValue"',
    'id="operatorEvidenceDrawerContextSignalSource"',
    'id="operatorEvidenceDrawerContextSignalFreshness"',
    /id="operatorEvidenceDrawerContextSignalItem"[\s\S]*?<span class="operator-evidence-drawer-context-label">Lead signal<\/span>/s,
    'Overview signal pending',
    'class="operator-evidence-drawer-context-label">Workspace<',
    'class="operator-evidence-drawer-context-label">View<',
    'class="operator-evidence-drawer-context-label">Next<',
    'class="operator-evidence-drawer-context-source">Source: Overview</span>',
    'class="operator-evidence-drawer-context-freshness">Freshness: awaiting refresh</span>',
    'Refresh Summary',
  ]) {
    if (token instanceof RegExp) {
      assert.match(htmlSource, token, `index.html missing focused evidence workspace-context token: ${token}`);
    } else {
      assert.ok(htmlSource.includes(token), `index.html missing focused evidence workspace-context token: ${token}`);
    }
  }

  for (const token of [
    'operatorEvidenceDrawerContext: document.getElementById("operatorEvidenceDrawerContext")',
    'operatorEvidenceDrawerContextWorkspaceValue: document.getElementById("operatorEvidenceDrawerContextWorkspaceValue")',
    'operatorEvidenceDrawerContextViewValue: document.getElementById("operatorEvidenceDrawerContextViewValue")',
    'operatorEvidenceDrawerContextFocusValue: document.getElementById("operatorEvidenceDrawerContextFocusValue")',
    'operatorEvidenceDrawerContextNextValue: document.getElementById("operatorEvidenceDrawerContextNextValue")',
    'operatorEvidenceDrawerContextSignalItem: document.getElementById("operatorEvidenceDrawerContextSignalItem")',
    'operatorEvidenceDrawerContextSignalValue: document.getElementById("operatorEvidenceDrawerContextSignalValue")',
    'operatorEvidenceDrawerContextSignalSource: document.getElementById("operatorEvidenceDrawerContextSignalSource")',
    'operatorEvidenceDrawerContextSignalFreshness: document.getElementById("operatorEvidenceDrawerContextSignalFreshness")',
    /function resolveOperatorEvidenceDrawerWorkspaceNextValue\(activeView,\s*presentation\)\s*\{/s,
    "function syncOperatorEvidenceDrawerContext(model, activeView) {",
    "function resolveOperatorWorkspaceLeadSignalPresentation(presentation) {",
    "function resolveOperatorWorkspaceFreshnessPresentation() {",
    "function getOperatorEvidenceDrawerRefreshLabel() {",
    "function getOperatorEvidenceDrawerRefreshStamp(refreshLabel) {",
    'const refreshLabel = getOperatorEvidenceDrawerRefreshLabel();',
    'const refreshStamp = getOperatorEvidenceDrawerRefreshStamp(refreshLabel);',
    'signal pending',
    'step: "Freshness"',
    'title: freshnessRow?.label || "Refresh state"',
    'meta: freshnessRow?.value || details.refreshLabel || "Awaiting refresh"',
    'time: freshnessTime',
    'el.operatorEvidenceDrawerContext.dataset.workspace =',
    'el.operatorEvidenceDrawerContext.dataset.workspaceState = workspaceState;',
    'el.operatorEvidenceDrawerContextWorkspaceValue.textContent = workspaceLabel;',
    'el.operatorEvidenceDrawerContextFocusValue.textContent = workspacePresentation.routeFacts.focus;',
    'el.operatorEvidenceDrawerContextViewValue.textContent = activeView?.label ?? "Latest event";',
    'el.operatorEvidenceDrawerContextNextValue.textContent = nextValue;',
    'const leadSignalSource = resolveOperatorWorkspaceLeadSignalSourcePresentation(workspacePresentation);',
    'const freshness = resolveOperatorWorkspaceFreshnessPresentation();',
    'el.operatorEvidenceDrawerContextSignalItem.dataset.signalState = leadSignal.state;',
    'el.operatorEvidenceDrawerContextSignalItem.dataset.freshnessState = freshness.state;',
    'el.operatorEvidenceDrawerContextSignalValue.textContent = leadSignal.value;',
    'el.operatorEvidenceDrawerContextSignalSource.textContent = leadSignalSource;',
    'el.operatorEvidenceDrawerContextSignalFreshness.textContent = freshness.value;',
    'syncOperatorEvidenceDrawerContext(model, activeView);',
  ]) {
    if (token instanceof RegExp) {
      assert.match(appSource, token, `app.js missing focused evidence workspace-context token: ${token}`);
    } else {
      assert.ok(appSource.includes(token), `app.js missing focused evidence workspace-context token: ${token}`);
    }
  }

  for (const token of [
    ".panel-operator-console .operator-evidence-drawer-context {",
    ".panel-operator-console .operator-evidence-drawer-context-item {",
    ".panel-operator-console .operator-evidence-drawer-context-label {",
    ".panel-operator-console .operator-evidence-drawer-context-value {",
    ".panel-operator-console .operator-evidence-drawer-context-source {",
    ".panel-operator-console .operator-evidence-drawer-context-freshness {",
    '.panel-operator-console .operator-evidence-drawer-context[data-workspace-state="fail"] .operator-evidence-drawer-context-value {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="dormant"] .operator-evidence-drawer-context-value {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="steady"] .operator-evidence-drawer-context-value {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="neutral"] .operator-evidence-drawer-context-value {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="fail"] .operator-evidence-drawer-context-value {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="dormant"] .operator-evidence-drawer-context-source {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-freshness-state="dormant"] .operator-evidence-drawer-context-freshness {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="steady"] .operator-evidence-drawer-context-source {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-freshness-state="steady"] .operator-evidence-drawer-context-freshness {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="neutral"] .operator-evidence-drawer-context-source {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-freshness-state="neutral"] .operator-evidence-drawer-context-freshness {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-state="fail"] .operator-evidence-drawer-context-source {',
    '.panel-operator-console .operator-evidence-drawer-context-item[data-freshness-state="fail"] .operator-evidence-drawer-context-freshness {',
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
  assert.ok(
    readmeSource.includes("compact freshness subline from the operator refresh state"),
    "README should document the focused evidence freshness subline",
  );
  assert.ok(
    operatorGuideSource.includes("compact freshness subline from the operator refresh state"),
    "operator guide should document the focused evidence freshness subline",
  );
});
