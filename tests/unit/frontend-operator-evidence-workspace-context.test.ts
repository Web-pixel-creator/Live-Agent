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
    'aria-label="Focused evidence proof context"',
    'id="operatorEvidenceDrawerContextWorkspaceItem" class="operator-evidence-drawer-context-item" hidden',
    'id="operatorEvidenceDrawerContextFocusItem" class="operator-evidence-drawer-context-item" hidden',
    'id="operatorEvidenceDrawerContextModeItem" class="operator-evidence-drawer-context-item" hidden',
    'id="operatorEvidenceDrawerContextStatusItem" class="operator-evidence-drawer-context-item" hidden',
    'id="operatorEvidenceDrawerContextWorkspaceValue"',
    'class="operator-evidence-drawer-context-label">Focus<',
    'class="operator-evidence-drawer-context-label">Mode<',
    'class="operator-evidence-drawer-context-label">Status<',
    'id="operatorEvidenceDrawerContextViewValue"',
    'id="operatorEvidenceDrawerContextFocusValue"',
    'id="operatorEvidenceDrawerContextModeValue"',
    'id="operatorEvidenceDrawerContextStatusValue"',
    'id="operatorEvidenceDrawerContextNextValue"',
    'id="operatorEvidenceDrawerContextSignalItem"',
    'id="operatorEvidenceDrawerContextSignalValue"',
    'id="operatorEvidenceDrawerContextSignalSource"',
    'id="operatorEvidenceDrawerContextSignalFreshness"',
    /id="operatorEvidenceDrawerContextSignalItem"[\s\S]*?<span class="operator-evidence-drawer-context-label">Lead signal<\/span>/s,
    'Overview signal pending',
    'Select a workspace above or refresh summary to hydrate focused evidence.',
    'Recent proof facts stay here so operators can confirm what changed before opening the deeper board.',
    'Refresh Summary to hydrate focused evidence and reveal the lead signal.',
    'Recent proof path',
    'Refresh Summary to hydrate the proof path.',
    'class="operator-evidence-drawer-context-label">Workspace<',
    'class="operator-evidence-drawer-context-label">Proof view<',
    'class="operator-evidence-drawer-context-label">Next check<',
    'class="operator-evidence-drawer-context-source">Source: Overview</span>',
    'class="operator-evidence-drawer-context-freshness">Freshness: awaiting refresh</span>',
    'Use the tabs to confirm the current proof path, freshest signal, recovery path, or audit context before opening the deeper board.',
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
    'operatorEvidenceDrawerContextModeValue: document.getElementById("operatorEvidenceDrawerContextModeValue")',
    'operatorEvidenceDrawerContextStatusValue: document.getElementById("operatorEvidenceDrawerContextStatusValue")',
    'operatorEvidenceDrawerContextNextValue: document.getElementById("operatorEvidenceDrawerContextNextValue")',
    'operatorEvidenceDrawerContextSignalItem: document.getElementById("operatorEvidenceDrawerContextSignalItem")',
    'operatorEvidenceDrawerContextSignalValue: document.getElementById("operatorEvidenceDrawerContextSignalValue")',
    'operatorEvidenceDrawerContextSignalSource: document.getElementById("operatorEvidenceDrawerContextSignalSource")',
    'operatorEvidenceDrawerContextSignalFreshness: document.getElementById("operatorEvidenceDrawerContextSignalFreshness")',
    /function resolveOperatorEvidenceDrawerWorkspaceNextValue\(activeView,\s*presentation\)\s*\{/s,
    'Use the tabs to confirm the current proof path, freshest signal, recovery path, or audit context before opening the deeper board.',
    "function syncOperatorEvidenceDrawerContext(model, activeView) {",
    "function resolveOperatorWorkspaceLeadSignalPresentation(presentation) {",
    "function resolveOperatorWorkspaceFreshnessPresentation() {",
    '?? "Select a workspace above or refresh summary to hydrate focused evidence.";',
    'const fallbackMeta = activeView?.meta ?? "Recent proof facts stay here so operators can confirm what changed before opening the deeper board.";',
    'const fallbackLabel = activeView?.timelineLabel ?? "Recent proof path";',
    'const meta = normalizeOperatorUiCopy(config?.meta) || "Refresh Summary to hydrate the proof path.";',
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
    'el.operatorEvidenceDrawerContextModeValue.textContent = workspacePresentation.routeFacts.modeLabel;',
    'const workspaceStatus = !workspacePresentation.hasManualRefresh',
    'el.operatorEvidenceDrawerContextStatusValue.textContent = workspaceStatus;',
    'const contextViewId =',
    'normalizeOperatorEvidenceDrawerView(activeView?.id)',
    'normalizeOperatorEvidenceDrawerView(state.operatorEvidenceDrawerView)',
    'el.operatorEvidenceDrawerContextViewValue.textContent = resolveOperatorEvidenceDrawerWorkspaceTabLabel(',
    'el.operatorEvidenceDrawerPanelLabel,',
    'resolveOperatorEvidenceDrawerWorkspaceTabLabel(activeView?.id ?? "latest", model)',
    'el.operatorEvidenceDrawerContextNextValue.textContent = nextValue;',
    'const leadSignalSource = resolveOperatorWorkspaceLeadSignalSourcePresentation(workspacePresentation);',
    'const freshness = resolveOperatorWorkspaceFreshnessPresentation();',
    'function buildOperatorEvidenceDrawerCompactContextSignalMeta(leadSignalSource, freshnessValue) {',
    'const useCompactSignalMeta = leadSignal.state === "dormant" || freshness.state === "dormant";',
    'el.operatorEvidenceDrawerContextSignalItem.dataset.signalState = leadSignal.state;',
    'el.operatorEvidenceDrawerContextSignalItem.dataset.freshnessState = freshness.state;',
    'el.operatorEvidenceDrawerContextSignalItem.dataset.signalDensity = useCompactSignalMeta ? "compact" : "full";',
    'el.operatorEvidenceDrawerContextSignalValue.textContent = leadSignal.value;',
    'buildOperatorEvidenceDrawerCompactContextSignalMeta(leadSignalSource, freshness.value)',
    'el.operatorEvidenceDrawerContextSignalSource.textContent = useCompactSignalMeta',
    'el.operatorEvidenceDrawerContextSignalFreshness.textContent = freshness.value;',
    'el.operatorEvidenceDrawerContextSignalFreshness.hidden = useCompactSignalMeta;',
    'el.operatorEvidenceDrawerContextSignalFreshness.setAttribute("aria-hidden", useCompactSignalMeta ? "true" : "false");',
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
    '.panel-operator-console .operator-evidence-drawer-context-item[data-signal-density="compact"] .operator-evidence-drawer-context-source {',
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
    readmeSource.includes("generic `Focused Evidence` first-paint shell now also keeps workspace/proof wording"),
    "README should document the proof-first focused evidence fallback shell",
  );
  assert.ok(
    readmeSource.includes("`Focused Evidence` inner panel label now also uses the same workspace-aware label path"),
    "README should document the focused evidence panel-label alignment",
  );
  assert.ok(
    operatorGuideSource.includes("`Focused Evidence` context row now also carries a read-only workspace signal"),
    "operator guide should document the focused evidence workspace signal",
  );
  assert.ok(
    operatorGuideSource.includes("generic `Focused Evidence` first-paint shell now also keeps workspace/proof wording"),
    "operator guide should document the proof-first focused evidence fallback shell",
  );
  assert.ok(
    operatorGuideSource.includes("`Focused Evidence` inner panel label now also uses the same workspace-aware label path"),
    "operator guide should document the focused evidence panel-label alignment",
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
