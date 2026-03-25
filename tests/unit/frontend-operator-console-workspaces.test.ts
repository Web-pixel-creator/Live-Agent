import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes a productized workspace chooser and route-aware workspace header above the board toolbar", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="operatorWorkspaceChooser"',
    'id="operatorWorkspaceChooserStatus"',
    'id="operatorWorkspaceChooserMeta"',
    'id="operatorWorkspaceHeader"',
    'id="operatorWorkspaceHeaderBadge"',
    'id="operatorWorkspaceHeaderTitle"',
    'id="operatorWorkspaceHeaderHint"',
    'id="operatorWorkspaceHeaderFocusValue"',
    'id="operatorWorkspaceHeaderNextValue"',
    'id="operatorWorkspaceHeaderModeValue"',
    'id="operatorWorkspaceHeaderViewValue"',
    'id="operatorWorkspaceOverviewBtn"',
    'id="operatorWorkspaceOverviewStatus"',
    'id="operatorWorkspaceOverviewMeta"',
    'id="operatorWorkspaceOverviewViewValue"',
    'id="operatorWorkspaceOverviewNextValue"',
    'id="operatorWorkspaceOverviewModeValue"',
    'id="operatorWorkspaceOverviewSignalSource"',
    'id="operatorWorkspaceOverviewSignalFreshness"',
    'id="operatorWorkspaceApprovalsBtn"',
    'id="operatorWorkspaceApprovalsStatus"',
    'id="operatorWorkspaceApprovalsMeta"',
    'id="operatorWorkspaceApprovalsViewValue"',
    'id="operatorWorkspaceApprovalsNextValue"',
    'id="operatorWorkspaceApprovalsModeValue"',
    'id="operatorWorkspaceApprovalsSignalSource"',
    'id="operatorWorkspaceApprovalsSignalFreshness"',
    'id="operatorWorkspaceRuntimeBtn"',
    'id="operatorWorkspaceRuntimeStatus"',
    'id="operatorWorkspaceRuntimeMeta"',
    'id="operatorWorkspaceRuntimeViewValue"',
    'id="operatorWorkspaceRuntimeNextValue"',
    'id="operatorWorkspaceRuntimeModeValue"',
    'id="operatorWorkspaceRuntimeSignalSource"',
    'id="operatorWorkspaceRuntimeSignalFreshness"',
    'id="operatorWorkspaceAuditBtn"',
    'id="operatorWorkspaceAuditStatus"',
    'id="operatorWorkspaceAuditMeta"',
    'id="operatorWorkspaceAuditViewValue"',
    'id="operatorWorkspaceAuditNextValue"',
    'id="operatorWorkspaceAuditModeValue"',
    'id="operatorWorkspaceAuditSignalSource"',
    'id="operatorWorkspaceAuditSignalFreshness"',
    'class="operator-workspace-card-status-label">Status</span>',
    'class="operator-workspace-card-mode-label">Mode</span>',
    'class="operator-workspace-card-view-label">View</span>',
    'class="operator-workspace-card-next-label">Next</span>',
    'class="operator-workspace-card-signal-meta-label">Source</span>',
    'class="operator-workspace-card-signal-meta-label">Freshness</span>',
    'data-operator-saved-view="incidents"',
    'data-operator-saved-view="approvals"',
    'data-operator-saved-view="runtime"',
    'data-operator-saved-view="audit"',
    "Choose workspace",
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing workspace chooser token: ${token}`);
  }

  const chooserIndex = htmlSource.indexOf('id="operatorWorkspaceChooser"');
  const headerIndex = htmlSource.indexOf('id="operatorWorkspaceHeader"');
  const toolbarIndex = htmlSource.indexOf('class="actions operator-toolbar"');
  assert.ok(chooserIndex !== -1 && headerIndex !== -1 && toolbarIndex !== -1 && chooserIndex < headerIndex && headerIndex < toolbarIndex, "workspace chooser and header should appear before the full board toolbar");

  for (const token of [
    "const OPERATOR_WORKSPACE_ROUTE_FACTS = Object.freeze({",
    'operatorWorkspaceChooser: document.getElementById("operatorWorkspaceChooser")',
    'operatorWorkspaceChooserStatus: document.getElementById("operatorWorkspaceChooserStatus")',
    'operatorWorkspaceChooserMeta: document.getElementById("operatorWorkspaceChooserMeta")',
    'operatorWorkspaceHeader: document.getElementById("operatorWorkspaceHeader")',
    'operatorWorkspaceHeaderBadge: document.getElementById("operatorWorkspaceHeaderBadge")',
    'operatorWorkspaceHeaderTitle: document.getElementById("operatorWorkspaceHeaderTitle")',
    'operatorWorkspaceHeaderHint: document.getElementById("operatorWorkspaceHeaderHint")',
    'operatorWorkspaceHeaderFocusValue: document.getElementById("operatorWorkspaceHeaderFocusValue")',
    'operatorWorkspaceHeaderNextValue: document.getElementById("operatorWorkspaceHeaderNextValue")',
    'operatorWorkspaceHeaderModeValue: document.getElementById("operatorWorkspaceHeaderModeValue")',
    'operatorWorkspaceHeaderViewValue: document.getElementById("operatorWorkspaceHeaderViewValue")',
    'operatorWorkspaceOverviewBtn: document.getElementById("operatorWorkspaceOverviewBtn")',
    'operatorWorkspaceOverviewStatus: document.getElementById("operatorWorkspaceOverviewStatus")',
    'operatorWorkspaceOverviewMeta: document.getElementById("operatorWorkspaceOverviewMeta")',
    'operatorWorkspaceOverviewViewValue: document.getElementById("operatorWorkspaceOverviewViewValue")',
    'operatorWorkspaceOverviewNextValue: document.getElementById("operatorWorkspaceOverviewNextValue")',
    'operatorWorkspaceOverviewModeValue: document.getElementById("operatorWorkspaceOverviewModeValue")',
    'operatorWorkspaceOverviewSignalSource: document.getElementById("operatorWorkspaceOverviewSignalSource")',
    'operatorWorkspaceOverviewSignalFreshness: document.getElementById("operatorWorkspaceOverviewSignalFreshness")',
    'operatorWorkspaceApprovalsBtn: document.getElementById("operatorWorkspaceApprovalsBtn")',
    'operatorWorkspaceApprovalsStatus: document.getElementById("operatorWorkspaceApprovalsStatus")',
    'operatorWorkspaceApprovalsMeta: document.getElementById("operatorWorkspaceApprovalsMeta")',
    'operatorWorkspaceApprovalsViewValue: document.getElementById("operatorWorkspaceApprovalsViewValue")',
    'operatorWorkspaceApprovalsNextValue: document.getElementById("operatorWorkspaceApprovalsNextValue")',
    'operatorWorkspaceApprovalsModeValue: document.getElementById("operatorWorkspaceApprovalsModeValue")',
    'operatorWorkspaceApprovalsSignalSource: document.getElementById("operatorWorkspaceApprovalsSignalSource")',
    'operatorWorkspaceApprovalsSignalFreshness: document.getElementById("operatorWorkspaceApprovalsSignalFreshness")',
    'operatorWorkspaceRuntimeBtn: document.getElementById("operatorWorkspaceRuntimeBtn")',
    'operatorWorkspaceRuntimeStatus: document.getElementById("operatorWorkspaceRuntimeStatus")',
    'operatorWorkspaceRuntimeMeta: document.getElementById("operatorWorkspaceRuntimeMeta")',
    'operatorWorkspaceRuntimeViewValue: document.getElementById("operatorWorkspaceRuntimeViewValue")',
    'operatorWorkspaceRuntimeNextValue: document.getElementById("operatorWorkspaceRuntimeNextValue")',
    'operatorWorkspaceRuntimeModeValue: document.getElementById("operatorWorkspaceRuntimeModeValue")',
    'operatorWorkspaceRuntimeSignalSource: document.getElementById("operatorWorkspaceRuntimeSignalSource")',
    'operatorWorkspaceRuntimeSignalFreshness: document.getElementById("operatorWorkspaceRuntimeSignalFreshness")',
    'operatorWorkspaceAuditBtn: document.getElementById("operatorWorkspaceAuditBtn")',
    'operatorWorkspaceAuditStatus: document.getElementById("operatorWorkspaceAuditStatus")',
    'operatorWorkspaceAuditMeta: document.getElementById("operatorWorkspaceAuditMeta")',
    'operatorWorkspaceAuditViewValue: document.getElementById("operatorWorkspaceAuditViewValue")',
    'operatorWorkspaceAuditNextValue: document.getElementById("operatorWorkspaceAuditNextValue")',
    'operatorWorkspaceAuditModeValue: document.getElementById("operatorWorkspaceAuditModeValue")',
    'operatorWorkspaceAuditSignalSource: document.getElementById("operatorWorkspaceAuditSignalSource")',
    'operatorWorkspaceAuditSignalFreshness: document.getElementById("operatorWorkspaceAuditSignalFreshness")',
    "function getOperatorWorkspaceCardTargets() {",
    "function syncOperatorWorkspaceCards() {",
    "function syncOperatorWorkspaceChooser() {",
    "function syncOperatorWorkspaceHeader() {",
    'el.operatorWorkspaceChooser.dataset.activeWorkspace = activeConfig.id;',
    'el.operatorWorkspaceHeader.dataset.workspace = normalizedView;',
    'target.button.dataset.workspaceState = presentation.tone;',
    'setStatusPill(target.status, cardLabel, presentation.tone);',
    'target.meta.textContent =',
    'target.viewValue.textContent = resolveOperatorWorkspaceCardViewLabel(presentation);',
    'function resolveOperatorWorkspaceCardViewLabel(presentation) {',
    'const defaultViewId = resolveOperatorEvidenceDrawerDefaultView({',
    'return resolveOperatorEvidenceDrawerWorkspaceTabLabel(defaultViewId, {',
    "function resolveOperatorWorkspaceCardLeadSignalSourceValue(presentation) {",
    "function resolveOperatorWorkspaceCardFreshnessValue() {",
    'target.modeValue.textContent = presentation.routeFacts.modeLabel;',
    'target.nextValue.textContent = presentation.next;',
    'const leadSignalSource = resolveOperatorWorkspaceCardLeadSignalSourceValue(presentation);',
    'const freshness = resolveOperatorWorkspaceCardFreshnessValue();',
    'function buildOperatorWorkspaceCardSignalSummary(sourceValue, freshnessValue) {',
    /setOperatorWorkspaceCardMetaValue\(\s*target\.signalSource,\s*isActive\s*\?\s*leadSignalSource\s*:\s*buildOperatorWorkspaceCardSignalSummary\(leadSignalSource,\s*freshness\.value\),\s*\);/s,
    'buildOperatorWorkspaceCardSignalSummary(leadSignalSource, freshness.value)',
    'target.signal.dataset.signalDensity = isActive ? "full" : "compact";',
    'target.signalFreshness.hidden = !isActive;',
    'target.signalFreshness.setAttribute("aria-hidden", isActive ? "false" : "true");',
    'setOperatorWorkspaceCardMetaValue(target.signalFreshness, freshness.value);',
    'return "Workspace";',
    'value: "awaiting refresh",',
    'value: "refresh failed",',
    'Current workspace. Refresh once to hydrate',
    'Next: inspect',
    'Next: review',
    'Next: keep',
    'setStatusPill(el.operatorWorkspaceHeaderBadge, routeFacts.label, tone);',
    'el.operatorWorkspaceHeaderTitle.textContent = title;',
    'el.operatorWorkspaceHeaderHint.textContent = hint;',
    'el.operatorWorkspaceHeaderFocusValue.textContent = routeFacts.focus;',
    'el.operatorWorkspaceHeaderNextValue.textContent = next;',
    'el.operatorWorkspaceHeaderModeValue.textContent = routeFacts.modeLabel;',
    'el.operatorWorkspaceHeaderViewValue.textContent = resolveOperatorWorkspaceCardViewLabel(presentation);',
    'setStatusPill(el.operatorWorkspaceChooserStatus, "overview", "neutral");',
    'const activeLabel = activeConfig.id === "incidents" ? "overview active" : `${activeConfig.label} active`;',
    'syncOperatorWorkspaceChooser();',
    'syncOperatorWorkspaceCards();',
    'syncOperatorWorkspaceHeader();',
  ]) {
    if (token instanceof RegExp) {
      assert.match(appSource, token, `app.js missing workspace chooser token: ${token}`);
    } else {
      assert.ok(appSource.includes(token), `app.js missing workspace chooser token: ${token}`);
    }
  }

  for (const token of [
    ".panel-operator-console .operator-workspace-chooser {",
    ".panel-operator-console .operator-workspace-header {",
    ".panel-operator-console .operator-workspace-header-copy {",
    ".panel-operator-console .operator-workspace-header-facts {",
    ".panel-operator-console .operator-workspace-header-fact {",
    ".panel-operator-console .operator-workspace-chooser-head {",
    ".panel-operator-console .operator-workspace-chooser-cards {",
    ".panel-operator-console .operator-workspace-card {",
    '.panel-operator-console .operator-workspace-card[data-workspace-state="fail"] {',
    ".panel-operator-console .operator-workspace-card-footer {",
    ".panel-operator-console .operator-workspace-card-status {",
    ".panel-operator-console .operator-workspace-card-status-label {",
    ".panel-operator-console .operator-workspace-card-meta {",
    ".panel-operator-console .operator-workspace-card-mode {",
    ".panel-operator-console .operator-workspace-card-mode-label {",
    ".panel-operator-console .operator-workspace-card-mode-value {",
    '.panel-operator-console .operator-workspace-card[data-workspace-state="neutral"] .operator-workspace-card-mode-value {',
    '.panel-operator-console .operator-workspace-card[data-workspace-state="fail"] .operator-workspace-card-mode-value {',
    ".panel-operator-console .operator-workspace-card-view {",
    ".panel-operator-console .operator-workspace-card-view-label {",
    ".panel-operator-console .operator-workspace-card-view-value {",
    '.panel-operator-console .operator-workspace-card[data-workspace-state="neutral"] .operator-workspace-card-view-value {',
    '.panel-operator-console .operator-workspace-card[data-workspace-state="fail"] .operator-workspace-card-view-value {',
    ".panel-operator-console .operator-workspace-card-next {",
    ".panel-operator-console .operator-workspace-card-next-label {",
    ".panel-operator-console .operator-workspace-card-next-value {",
    '.panel-operator-console .operator-workspace-card[data-workspace-state="neutral"] .operator-workspace-card-next-value {',
    '.panel-operator-console .operator-workspace-card[data-workspace-state="fail"] .operator-workspace-card-next-value {',
    ".panel-operator-console .operator-workspace-card-signal-meta {",
    ".panel-operator-console .operator-workspace-card-signal-meta-label {",
    ".panel-operator-console .operator-workspace-card-signal-meta-value {",
    '.panel-operator-console .operator-workspace-card-signal[data-signal-density="compact"] {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-density="compact"] .operator-workspace-card-signal-meta-label {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-density="compact"] .operator-workspace-card-signal-source {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-density="compact"] .operator-workspace-card-signal-source .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-state="dormant"] .operator-workspace-card-signal-source .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-freshness-state="dormant"] .operator-workspace-card-signal-freshness .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-state="steady"] .operator-workspace-card-signal-source .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-freshness-state="steady"] .operator-workspace-card-signal-freshness .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-state="neutral"] .operator-workspace-card-signal-source .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-freshness-state="neutral"] .operator-workspace-card-signal-freshness .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-state="fail"] .operator-workspace-card-signal-source .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-freshness-state="fail"] .operator-workspace-card-signal-freshness .operator-workspace-card-signal-meta-value {',
    ".panel-operator-console .operator-workspace-card.is-active {",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing workspace chooser style token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("dedicated `Choose workspace` strip (`Overview`, `Approvals`, `Runtime`, `Audit`)"),
    "README should document the operator workspace chooser",
  );
  assert.ok(
    readmeSource.includes("route-aware workspace header inside `Operator Console`"),
    "README should document the route-aware workspace header",
  );
  assert.ok(
    readmeSource.includes("workspace header now also exposes a compact read-only `View` line"),
    "README should document the workspace-header view line",
  );
  assert.ok(
    readmeSource.includes("workspace chooser cards now also surface their own live state and next-step copy"),
    "README should document state-aware workspace cards",
  );
  assert.ok(
    readmeSource.includes("compact read-only `Next` line"),
    "README should document the chooser-card next line",
  );
  assert.ok(
    readmeSource.includes("compact read-only `View` line"),
    "README should document the chooser-card view line",
  );
  assert.ok(
    readmeSource.includes("visible `Status` label for the existing workspace posture pill"),
    "README should document the chooser-card status label",
  );
  assert.ok(
    operatorGuideSource.includes("includes a `Choose workspace` strip (`Overview`, `Approvals`, `Runtime`, `Audit`)"),
    "operator guide should document the operator workspace chooser",
  );
  assert.ok(
    operatorGuideSource.includes("route-aware workspace header"),
    "operator guide should document the route-aware workspace header",
  );
  assert.ok(
    operatorGuideSource.includes("workspace header now also exposes a compact read-only `View` line"),
    "operator guide should document the workspace-header view line",
  );
  assert.ok(
    operatorGuideSource.includes("workspace chooser cards now also surface their own live state and next-step copy"),
    "operator guide should document state-aware workspace cards",
  );
  assert.ok(
    operatorGuideSource.includes("compact read-only `Next` line"),
    "operator guide should document the chooser-card next line",
  );
  assert.ok(
    operatorGuideSource.includes("compact read-only `View` line"),
    "operator guide should document the chooser-card view line",
  );
  assert.ok(
    operatorGuideSource.includes("visible `Status` label for the existing workspace posture pill"),
    "operator guide should document the chooser-card status label",
  );
});
