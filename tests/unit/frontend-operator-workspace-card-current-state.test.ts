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
    'id="operatorWorkspaceOverviewSignalFreshness"',
    'Overview signal pending',
    'Refresh to load incident evidence.',
    'id="operatorWorkspaceApprovalsBtn"',
    'id="operatorWorkspaceApprovalsMarker"',
    'id="operatorWorkspaceApprovalsSignal"',
    'id="operatorWorkspaceApprovalsSignalValue"',
    'id="operatorWorkspaceApprovalsSignalSource"',
    'id="operatorWorkspaceApprovalsSignalFreshness"',
    'Approvals signal pending',
    'Refresh to load approvals evidence.',
    'id="operatorWorkspaceRuntimeBtn"',
    'id="operatorWorkspaceRuntimeMarker"',
    'id="operatorWorkspaceRuntimeSignal"',
    'id="operatorWorkspaceRuntimeSignalValue"',
    'id="operatorWorkspaceRuntimeSignalSource"',
    'id="operatorWorkspaceRuntimeSignalFreshness"',
    'Runtime signal pending',
    'Refresh to load runtime evidence.',
    'id="operatorWorkspaceAuditBtn"',
    'id="operatorWorkspaceAuditMarker"',
    'id="operatorWorkspaceAuditSignal"',
    'id="operatorWorkspaceAuditSignalValue"',
    'id="operatorWorkspaceAuditSignalSource"',
    'id="operatorWorkspaceAuditSignalFreshness"',
    'Audit signal pending',
    'Refresh to load audit evidence.',
    'class="operator-workspace-card-signal-label">Lead signal</span>',
    'class="operator-workspace-card-signal-meta-label">Source</span>',
    'class="operator-workspace-card-signal-meta-label">Freshness</span>',
    'class="operator-workspace-card-signal-meta-value">Overview</span>',
    'class="operator-workspace-card-signal-meta-value">awaiting refresh</span>',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing current workspace-card token: ${token}`);
  }

  for (const token of [
    "function getOperatorWorkspaceCardTargets() {",
    'signal: el.operatorWorkspaceOverviewSignal,',
    'signalValue: el.operatorWorkspaceOverviewSignalValue,',
    'signalSource: el.operatorWorkspaceOverviewSignalSource,',
    'signalFreshness: el.operatorWorkspaceOverviewSignalFreshness,',
    'meta: el.operatorWorkspaceOverviewMeta,',
    'signal pending',
    'getOperatorEvidenceDrawerRefreshLabel()',
    'getOperatorEvidenceDrawerRefreshStamp(refreshLabel)',
    'signal: el.operatorWorkspaceApprovalsSignal,',
    'signalValue: el.operatorWorkspaceApprovalsSignalValue,',
    'signalSource: el.operatorWorkspaceApprovalsSignalSource,',
    'signalFreshness: el.operatorWorkspaceApprovalsSignalFreshness,',
    'meta: el.operatorWorkspaceApprovalsMeta,',
    'signal: el.operatorWorkspaceRuntimeSignal,',
    'signalValue: el.operatorWorkspaceRuntimeSignalValue,',
    'signalSource: el.operatorWorkspaceRuntimeSignalSource,',
    'signalFreshness: el.operatorWorkspaceRuntimeSignalFreshness,',
    'meta: el.operatorWorkspaceRuntimeMeta,',
    'signal: el.operatorWorkspaceAuditSignal,',
    'signalValue: el.operatorWorkspaceAuditSignalValue,',
    'signalSource: el.operatorWorkspaceAuditSignalSource,',
    'signalFreshness: el.operatorWorkspaceAuditSignalFreshness,',
    'meta: el.operatorWorkspaceAuditMeta,',
    "function resolveOperatorWorkspaceLeadSignalPresentation(presentation) {",
    "function resolveOperatorWorkspaceCardLeadSignalSourceValue(presentation) {",
    "function resolveOperatorWorkspaceCardFreshnessValue() {",
    "function buildOperatorWorkspaceCardCompactSignalSummary(sourceValue, freshnessValue) {",
    "Current workspace. Refresh once to hydrate",
    "Current workspace. Inspect the flagged",
    "Current workspace. Review",
    "Current workspace. Stay here unless fresher proof is needed elsewhere.",
    'const markerViewId = activeView !== "incidents"',
    'const markerVariant = activeView !== "incidents" || hasManualRefresh ? "current" : "recommended-next";',
    'const markerLabel = markerVariant === "current" ? "Current workspace" : "Recommended next";',
    'target.button.dataset.workspaceActive = isActive ? "true" : "false";',
    'target.button.dataset.workspaceCurrent = isActive ? "true" : "false";',
    'target.signal.dataset.signalRole = isActive ? "current" : "jump";',
    'target.signal.dataset.signalDensity = isActive ? "full" : "compact";',
    /target\.signal\.dataset\.signalState\s*=\s*leadSignal\.state;/s,
    'target.signal.dataset.freshnessState = freshness.state;',
    'const leadSignalSource = resolveOperatorWorkspaceCardLeadSignalSourceValue(presentation);',
    'const freshness = resolveOperatorWorkspaceCardFreshnessValue();',
    'function buildOperatorWorkspaceCardJumpSummary(presentation) {',
    'const workspaceSummary = buildOperatorWorkspaceCardJumpSummary(presentation);',
    'target.button.dataset.workspaceSummaryDensity = isActive ? "full" : "compact";',
    'focusLabel.textContent = isActive ? "Focus" : "Workspace";',
    'target.focusValue.textContent = isActive ? presentation.routeFacts.focus : workspaceSummary;',
    'modeSection.hidden = !isActive;',
    'viewLabel.textContent = isActive ? "View" : "Open";',
    'viewSection.hidden = false;',
    'viewSection.setAttribute("aria-hidden", "false");',
    'nextSection.hidden = !isActive;',
    'buildOperatorWorkspaceCardCompactSignalSummary(leadSignalSource, freshness.value)',
    /setOperatorWorkspaceCardMetaValue\(\s*target\.signalSource,\s*isActive\s*\?\s*leadSignalSource\s*:\s*buildOperatorWorkspaceCardCompactSignalSummary\(leadSignalSource,\s*freshness\.value\),\s*\);/s,
    'target.signalFreshness.hidden = !isActive;',
    'target.signalFreshness.setAttribute("aria-hidden", isActive ? "false" : "true");',
    'setOperatorWorkspaceCardMetaValue(target.signalFreshness, freshness.value);',
    'target.marker.textContent = markerLabel;',
    'target.button.dataset.workspaceMarker = markerVariant;',
    /el\.operatorWorkspaceHeaderLeadFact\.dataset\.signalState\s*=\s*leadSignal\.state;/s,
    /el\.operatorWorkspaceHeaderLeadFact\.dataset\.freshnessState\s*=\s*freshness\.state;/s,
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
    stylesSource.includes('.panel-operator-console .operator-workspace-card[data-workspace-summary-density="compact"] .operator-workspace-card-focus {'),
    "styles.css should compact inactive workspace summaries",
  );
  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card[data-workspace-summary-density="compact"] .operator-workspace-card-focus-label {'),
    "styles.css should quiet inactive workspace summary labels",
  );
  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card[data-workspace-summary-density="compact"] .operator-workspace-card-focus-value {'),
    "styles.css should soften inactive workspace summary values",
  );
  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card[data-workspace-summary-density="compact"] .operator-workspace-card-view {'),
    "styles.css should preserve a compact open line for inactive workspace cards",
  );
  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card[data-workspace-summary-density="compact"] .operator-workspace-card-view-label {'),
    "styles.css should quiet inactive workspace open labels",
  );
  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card[data-workspace-summary-density="compact"] .operator-workspace-card-view-value {'),
    "styles.css should soften inactive workspace open values",
  );
  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card-signal[data-signal-density="compact"] {'),
    "styles.css should collapse signal metadata for inactive workspace cards",
  );
  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card-signal[data-signal-density="compact"] .operator-workspace-card-signal-source .operator-workspace-card-signal-meta-label {'),
    "styles.css should quiet signal metadata labels for inactive workspace cards",
  );
  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card-signal-meta-label {'),
    "styles.css should style the workspace-card signal meta labels",
  );
  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card-signal-meta-value {'),
    "styles.css should style the workspace-card signal meta values",
  );
  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card-signal[data-signal-density="compact"] {'),
    "styles.css should style compact signal density for inactive workspace cards",
  );
  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card-signal-source {'),
    "styles.css should style the workspace-card signal source line",
  );
  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card-signal-freshness {'),
    "styles.css should style the workspace-card signal freshness line",
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
    readmeSource.includes("explicit `Current workspace` marker"),
    "README should document the explicit current-workspace chooser marker",
  );
  assert.ok(
    operatorGuideSource.includes("explicit `Current workspace` marker"),
    "operator guide should document the explicit current-workspace chooser marker",
  );
  assert.ok(
    readmeSource.includes("chooser, header, and evidence signals aligned"),
    "README should document chooser/header/evidence signal alignment",
  );
  assert.ok(
    operatorGuideSource.includes("chooser, header, and evidence signals aligned"),
    "operator guide should document chooser/header/evidence signal alignment",
  );
  assert.ok(
    readmeSource.includes("compact freshness subline from the operator refresh state"),
    "README should document the workspace-card lead-signal freshness subline",
  );
  assert.ok(
    operatorGuideSource.includes("compact freshness subline from the operator refresh state"),
    "operator guide should document the workspace-card lead-signal freshness subline",
  );
});
