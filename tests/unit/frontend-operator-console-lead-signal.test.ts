import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console workspace cards expose a read-only lead signal line and current card marker without changing navigation", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'Choose workspace',
    'id="operatorWorkspaceOverviewBtn"',
    'id="operatorWorkspaceApprovalsBtn"',
    'id="operatorWorkspaceRuntimeBtn"',
    'id="operatorWorkspaceAuditBtn"',
    'id="operatorWorkspaceOverviewMeta"',
    'id="operatorWorkspaceOverviewNextValue"',
    'id="operatorWorkspaceApprovalsMeta"',
    'id="operatorWorkspaceApprovalsNextValue"',
    'id="operatorWorkspaceRuntimeMeta"',
    'id="operatorWorkspaceRuntimeNextValue"',
    'id="operatorWorkspaceAuditMeta"',
    'id="operatorWorkspaceAuditNextValue"',
    'id="operatorWorkspaceOverviewMarker"',
    'id="operatorWorkspaceApprovalsMarker"',
    'id="operatorWorkspaceRuntimeMarker"',
    'id="operatorWorkspaceAuditMarker"',
    'class="operator-workspace-card-signal-label">Lead signal</span>',
    'class="operator-workspace-card-next-label">Next</span>',
    'Refresh to load incident evidence.',
    'Refresh to load approvals evidence.',
    'Refresh to load runtime evidence.',
    'Refresh to load audit evidence.',
    'Overview signal pending',
    'Approvals signal pending',
    'Runtime signal pending',
    'Audit signal pending',
    'id="operatorWorkspaceOverviewSignalSource"',
    'id="operatorWorkspaceOverviewSignalFreshness"',
    'id="operatorWorkspaceApprovalsSignalSource"',
    'id="operatorWorkspaceApprovalsSignalFreshness"',
    'id="operatorWorkspaceRuntimeSignalSource"',
    'id="operatorWorkspaceRuntimeSignalFreshness"',
    'id="operatorWorkspaceAuditSignalSource"',
    'id="operatorWorkspaceAuditSignalFreshness"',
    'id="operatorWorkspaceHeaderLeadSource"',
    'id="operatorWorkspaceHeaderLeadFreshness"',
    'class="operator-workspace-card-signal-meta-label">Source</span>',
    'class="operator-workspace-card-signal-meta-label">Freshness</span>',
    'class="operator-workspace-card-signal-meta-value">Overview</span>',
    'class="operator-workspace-card-signal-meta-value">Approvals</span>',
    'class="operator-workspace-card-signal-meta-value">Runtime</span>',
    'class="operator-workspace-card-signal-meta-value">Audit</span>',
    'class="operator-workspace-card-signal-meta-value">awaiting refresh</span>',
    'class="operator-workspace-header-fact-source">Source: Overview</span>',
    'class="operator-workspace-header-fact-freshness">Freshness: awaiting refresh</span>',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing workspace chooser token: ${token}`);
  }

  for (const token of [
    'operatorWorkspaceOverviewBtn: document.getElementById("operatorWorkspaceOverviewBtn")',
    'operatorWorkspaceApprovalsBtn: document.getElementById("operatorWorkspaceApprovalsBtn")',
    'operatorWorkspaceRuntimeBtn: document.getElementById("operatorWorkspaceRuntimeBtn")',
    'operatorWorkspaceAuditBtn: document.getElementById("operatorWorkspaceAuditBtn")',
    'operatorWorkspaceOverviewMarker: document.getElementById("operatorWorkspaceOverviewMarker")',
    'operatorWorkspaceApprovalsMarker: document.getElementById("operatorWorkspaceApprovalsMarker")',
    'operatorWorkspaceRuntimeMarker: document.getElementById("operatorWorkspaceRuntimeMarker")',
    'operatorWorkspaceAuditMarker: document.getElementById("operatorWorkspaceAuditMarker")',
    'operatorWorkspaceOverviewSignal: document.getElementById("operatorWorkspaceOverviewSignal")',
    'operatorWorkspaceOverviewSignalValue: document.getElementById("operatorWorkspaceOverviewSignalValue")',
    'operatorWorkspaceOverviewSignalSource: document.getElementById("operatorWorkspaceOverviewSignalSource")',
    'operatorWorkspaceOverviewSignalFreshness: document.getElementById("operatorWorkspaceOverviewSignalFreshness")',
    'operatorWorkspaceOverviewNextValue: document.getElementById("operatorWorkspaceOverviewNextValue")',
    'operatorWorkspaceOverviewMeta: document.getElementById("operatorWorkspaceOverviewMeta")',
    'operatorWorkspaceApprovalsSignal: document.getElementById("operatorWorkspaceApprovalsSignal")',
    'operatorWorkspaceApprovalsSignalValue: document.getElementById("operatorWorkspaceApprovalsSignalValue")',
    'operatorWorkspaceApprovalsSignalSource: document.getElementById("operatorWorkspaceApprovalsSignalSource")',
    'operatorWorkspaceApprovalsSignalFreshness: document.getElementById("operatorWorkspaceApprovalsSignalFreshness")',
    'operatorWorkspaceApprovalsNextValue: document.getElementById("operatorWorkspaceApprovalsNextValue")',
    'operatorWorkspaceApprovalsMeta: document.getElementById("operatorWorkspaceApprovalsMeta")',
    'operatorWorkspaceRuntimeSignal: document.getElementById("operatorWorkspaceRuntimeSignal")',
    'operatorWorkspaceRuntimeSignalValue: document.getElementById("operatorWorkspaceRuntimeSignalValue")',
    'operatorWorkspaceRuntimeSignalSource: document.getElementById("operatorWorkspaceRuntimeSignalSource")',
    'operatorWorkspaceRuntimeSignalFreshness: document.getElementById("operatorWorkspaceRuntimeSignalFreshness")',
    'operatorWorkspaceRuntimeNextValue: document.getElementById("operatorWorkspaceRuntimeNextValue")',
    'operatorWorkspaceRuntimeMeta: document.getElementById("operatorWorkspaceRuntimeMeta")',
    'operatorWorkspaceAuditSignal: document.getElementById("operatorWorkspaceAuditSignal")',
    'operatorWorkspaceAuditSignalValue: document.getElementById("operatorWorkspaceAuditSignalValue")',
    'operatorWorkspaceAuditSignalSource: document.getElementById("operatorWorkspaceAuditSignalSource")',
    'operatorWorkspaceAuditSignalFreshness: document.getElementById("operatorWorkspaceAuditSignalFreshness")',
    'operatorWorkspaceAuditNextValue: document.getElementById("operatorWorkspaceAuditNextValue")',
    'operatorWorkspaceAuditMeta: document.getElementById("operatorWorkspaceAuditMeta")',
    'meta: el.operatorWorkspaceOverviewMeta,',
    'meta: el.operatorWorkspaceApprovalsMeta,',
    'meta: el.operatorWorkspaceRuntimeMeta,',
    'meta: el.operatorWorkspaceAuditMeta,',
    'function syncOperatorWorkspaceCards() {',
    'function syncOperatorWorkspaceHeader() {',
    'const markerViewId = activeView !== "incidents"',
    'const markerLabel = activeView !== "incidents" || hasManualRefresh ? "Current" : "Recommended next";',
    'target.button.dataset.workspaceActive = isActive ? "true" : "false";',
    'target.button.dataset.workspaceMarker = markerLabel.toLowerCase().replaceAll(" ", "-");',
    'function resolveOperatorWorkspaceLeadSignalPresentation(presentation) {',
    'function resolveOperatorWorkspaceCardLeadSignalSourceValue(presentation) {',
    'function resolveOperatorWorkspaceCardFreshnessValue() {',
    'const signalValue =',
    'signal pending',
    'getOperatorEvidenceDrawerRefreshLabel()',
    'getOperatorEvidenceDrawerRefreshStamp(refreshLabel)',
    'const signalState = presentation?.signal?.variant ?? (presentation?.tone === "ok" ? "steady" : "dormant");',
    'const leadSignal = resolveOperatorWorkspaceLeadSignalPresentation(presentation);',
    'const leadSignalSource = resolveOperatorWorkspaceCardLeadSignalSourceValue(presentation);',
    'const freshness = resolveOperatorWorkspaceCardFreshnessValue();',
    /target\.signal\.dataset\.signalState\s*=\s*leadSignal\.state;/s,
    'target.signal.dataset.freshnessState = freshness.state;',
    /target\.signalValue\.textContent\s*=\s*leadSignal\.value;/s,
    'setOperatorWorkspaceCardMetaValue(target.signalSource, leadSignalSource);',
    'setOperatorWorkspaceCardMetaValue(target.signalFreshness, freshness.value);',
    'target.meta.textContent =',
    'Current workspace. Refresh once to hydrate',
    'Next: inspect',
    'Next: review',
    'Next: keep',
    'Refresh Summary',
    'const leadSignalSource = resolveOperatorWorkspaceLeadSignalSourcePresentation(presentation);',
    'operatorWorkspaceHeaderLeadSource: document.getElementById("operatorWorkspaceHeaderLeadSource")',
    'operatorWorkspaceHeaderLeadFreshness: document.getElementById("operatorWorkspaceHeaderLeadFreshness")',
    'el.operatorWorkspaceHeaderLeadSource.textContent = leadSignalSource;',
    'el.operatorWorkspaceHeaderLeadFreshness.textContent = freshness.value;',
    'Refresh Summary',
  ]) {
    if (token instanceof RegExp) {
      assert.match(appSource, token, `app.js missing workspace lead-signal or current-marker token: ${token}`);
    } else {
      assert.ok(appSource.includes(token), `app.js missing workspace lead-signal or current-marker token: ${token}`);
    }
  }

  for (const token of [
    '.panel-operator-console .operator-workspace-card[data-workspace-marker="current"] .operator-workspace-card-marker {',
    '.panel-operator-console .operator-workspace-card[data-workspace-marker="recommended-next"] .operator-workspace-card-marker {',
    '.panel-operator-console .operator-workspace-card-signal {',
    '.panel-operator-console .operator-workspace-card-signal-meta-label {',
    '.panel-operator-console .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal-source {',
    '.panel-operator-console .operator-workspace-card-signal-freshness {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-state="fail"] .operator-workspace-card-signal-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-state="dormant"] .operator-workspace-card-signal-source .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-freshness-state="dormant"] .operator-workspace-card-signal-freshness .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-state="steady"] .operator-workspace-card-signal-source .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-freshness-state="steady"] .operator-workspace-card-signal-freshness .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-state="neutral"] .operator-workspace-card-signal-source .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-freshness-state="neutral"] .operator-workspace-card-signal-freshness .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-state="fail"] .operator-workspace-card-signal-source .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-freshness-state="fail"] .operator-workspace-card-signal-freshness .operator-workspace-card-signal-meta-value {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="dormant"] .operator-workspace-header-fact-value {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="steady"] .operator-workspace-header-fact-value {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="neutral"] .operator-workspace-header-fact-value {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="fail"] .operator-workspace-header-fact-value {',
    '.panel-operator-console .operator-workspace-header-fact-source {',
    '.panel-operator-console .operator-workspace-header-fact-freshness {',
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing workspace lead-signal or marker token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Choose workspace` cards now also expose a read-only `Lead signal` line"),
    "README should document the workspace-card lead signal line",
  );
  assert.ok(
    operatorGuideSource.includes("`Choose workspace` cards now also expose a read-only `Lead signal` line"),
    "operator guide should document the workspace-card lead signal line",
  );
  assert.ok(
    readmeSource.includes("read-only `Lead signal` fact"),
    "README should document the read-only workspace lead signal fact",
  );
  assert.ok(
    operatorGuideSource.includes("read-only `Lead signal` fact"),
    "operator guide should document the read-only workspace lead signal fact",
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
    "README should document the aligned lead-signal freshness subline",
  );
  assert.ok(
    operatorGuideSource.includes("compact freshness subline from the operator refresh state"),
    "operator guide should document the aligned lead-signal freshness subline",
  );
});
