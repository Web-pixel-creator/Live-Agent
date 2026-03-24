import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("active choose-workspace card reads as the current working area while others stay jump summaries", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="operatorWorkspaceOverviewBtn"',
    'id="operatorWorkspaceOverviewMarker"',
    'id="operatorWorkspaceOverviewSignal"',
    'id="operatorWorkspaceOverviewSignalValue"',
    'id="operatorWorkspaceOverviewSignalSource"',
    'Overview signal pending',
    'id="operatorWorkspaceApprovalsBtn"',
    'id="operatorWorkspaceApprovalsMarker"',
    'id="operatorWorkspaceApprovalsSignal"',
    'id="operatorWorkspaceApprovalsSignalValue"',
    'id="operatorWorkspaceApprovalsSignalSource"',
    'Approvals signal pending',
    'id="operatorWorkspaceRuntimeBtn"',
    'id="operatorWorkspaceRuntimeMarker"',
    'id="operatorWorkspaceRuntimeSignal"',
    'id="operatorWorkspaceRuntimeSignalValue"',
    'id="operatorWorkspaceRuntimeSignalSource"',
    'Runtime signal pending',
    'id="operatorWorkspaceAuditBtn"',
    'id="operatorWorkspaceAuditMarker"',
    'id="operatorWorkspaceAuditSignal"',
    'id="operatorWorkspaceAuditSignalValue"',
    'id="operatorWorkspaceAuditSignalSource"',
    'Audit signal pending',
    'class="operator-workspace-card-signal-label">Lead signal</span>',
    'class="operator-workspace-card-signal-source">Source: Overview</span>',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing current workspace-card token: ${token}`);
  }

  for (const token of [
    "function getOperatorWorkspaceCardTargets() {",
    'signal: el.operatorWorkspaceOverviewSignal,',
    'signalValue: el.operatorWorkspaceOverviewSignalValue,',
    'signalSource: el.operatorWorkspaceOverviewSignalSource,',
    'signal pending',
    'signal: el.operatorWorkspaceApprovalsSignal,',
    'signalValue: el.operatorWorkspaceApprovalsSignalValue,',
    'signalSource: el.operatorWorkspaceApprovalsSignalSource,',
    'signal: el.operatorWorkspaceRuntimeSignal,',
    'signalValue: el.operatorWorkspaceRuntimeSignalValue,',
    'signalSource: el.operatorWorkspaceRuntimeSignalSource,',
    'signal: el.operatorWorkspaceAuditSignal,',
    'signalValue: el.operatorWorkspaceAuditSignalValue,',
    'signalSource: el.operatorWorkspaceAuditSignalSource,',
    "function resolveOperatorWorkspaceLeadSignalPresentation(presentation) {",
    "function resolveOperatorWorkspaceLeadSignalSourcePresentation(presentation) {",
    "Current workspace. Refresh once to hydrate",
    "Current workspace. Inspect the flagged",
    "Current workspace. Review",
    "Current workspace. Stay here unless fresher proof is needed elsewhere.",
    'const markerViewId = activeView !== "incidents"',
    'const markerLabel = activeView !== "incidents" || hasManualRefresh ? "Current" : "Recommended next";',
    'target.button.dataset.workspaceActive = isActive ? "true" : "false";',
    'target.button.dataset.workspaceCurrent = isActive ? "true" : "false";',
    'target.signal.dataset.signalRole = isActive ? "current" : "jump";',
    /target\.signal\.dataset\.signalState\s*=\s*leadSignalValue\.state;/s,
    'target.signalSource.textContent = leadSignalSource;',
    'target.marker.textContent = markerLabel;',
    'target.button.dataset.workspaceMarker = markerLabel.toLowerCase().replaceAll(" ", "-");',
    /el\.operatorWorkspaceHeaderLeadFact\.dataset\.signalState\s*=\s*leadSignal\.state;/s,
    /el\.operatorWorkspaceHeaderLeadValue\.textContent\s*=\s*leadSignal\.value;/s,
  ]) {
    if (token instanceof RegExp) {
      assert.match(appSource, token, `app.js missing current workspace-card posture token: ${token}`);
    } else {
      assert.ok(appSource.includes(token), `app.js missing current workspace-card posture token: ${token}`);
    }
  }

  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card-signal[data-signal-role="current"] .operator-workspace-card-signal-label {'),
    "styles.css should style the current workspace-card lead signal role",
  );

  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card[data-workspace-current="true"] .operator-workspace-card-signal-label {'),
    "styles.css should style the current workspace-card lead signal role",
  );
  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card-signal-source {'),
    "styles.css should style the workspace-card signal source line",
  );
  assert.ok(
    readmeSource.includes("active `Choose workspace` card now reads as the current working area"),
    "README should document the current workspace-card reading as the current working area",
  );
  assert.ok(
    operatorGuideSource.includes("active `Choose workspace` card now reads as the current working area"),
    "operator guide should document the current workspace-card reading as the current working area",
  );
  assert.ok(
    readmeSource.includes("chooser, header, and evidence signals aligned"),
    "README should document chooser/header/evidence signal alignment",
  );
  assert.ok(
    operatorGuideSource.includes("chooser, header, and evidence signals aligned"),
    "operator guide should document chooser/header/evidence signal alignment",
  );
});
