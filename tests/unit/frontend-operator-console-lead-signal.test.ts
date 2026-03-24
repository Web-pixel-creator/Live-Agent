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
    'id="operatorWorkspaceOverviewMarker"',
    'id="operatorWorkspaceApprovalsMarker"',
    'id="operatorWorkspaceRuntimeMarker"',
    'id="operatorWorkspaceAuditMarker"',
    'class="operator-workspace-card-signal-label">Lead signal</span>',
    'Overview signal pending',
    'Approvals signal pending',
    'Runtime signal pending',
    'Audit signal pending',
    'id="operatorWorkspaceOverviewSignalSource"',
    'id="operatorWorkspaceApprovalsSignalSource"',
    'id="operatorWorkspaceRuntimeSignalSource"',
    'id="operatorWorkspaceAuditSignalSource"',
    'id="operatorWorkspaceHeaderLeadSource"',
    'class="operator-workspace-card-signal-source">Source: Overview</span>',
    'class="operator-workspace-card-signal-source">Source: Approvals</span>',
    'class="operator-workspace-card-signal-source">Source: Runtime</span>',
    'class="operator-workspace-card-signal-source">Source: Audit</span>',
    'class="operator-workspace-header-fact-source">Source: Overview</span>',
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
    'operatorWorkspaceApprovalsSignal: document.getElementById("operatorWorkspaceApprovalsSignal")',
    'operatorWorkspaceApprovalsSignalValue: document.getElementById("operatorWorkspaceApprovalsSignalValue")',
    'operatorWorkspaceApprovalsSignalSource: document.getElementById("operatorWorkspaceApprovalsSignalSource")',
    'operatorWorkspaceRuntimeSignal: document.getElementById("operatorWorkspaceRuntimeSignal")',
    'operatorWorkspaceRuntimeSignalValue: document.getElementById("operatorWorkspaceRuntimeSignalValue")',
    'operatorWorkspaceRuntimeSignalSource: document.getElementById("operatorWorkspaceRuntimeSignalSource")',
    'operatorWorkspaceAuditSignal: document.getElementById("operatorWorkspaceAuditSignal")',
    'operatorWorkspaceAuditSignalValue: document.getElementById("operatorWorkspaceAuditSignalValue")',
    'operatorWorkspaceAuditSignalSource: document.getElementById("operatorWorkspaceAuditSignalSource")',
    'function syncOperatorWorkspaceCards() {',
    'function syncOperatorWorkspaceHeader() {',
    'const markerViewId = activeView !== "incidents"',
    'const markerLabel = activeView !== "incidents" || hasManualRefresh ? "Current" : "Recommended next";',
    'target.button.dataset.workspaceActive = isActive ? "true" : "false";',
    'target.button.dataset.workspaceMarker = markerLabel.toLowerCase().replaceAll(" ", "-");',
    'function resolveOperatorWorkspaceLeadSignalPresentation(presentation) {',
    'function resolveOperatorWorkspaceLeadSignalSourcePresentation(presentation) {',
    'const signalValue =',
    'signal pending',
    'const signalState = presentation?.signal?.variant ?? (presentation?.tone === "ok" ? "steady" : "dormant");',
    'const leadSignal = resolveOperatorWorkspaceLeadSignalPresentation(presentation);',
    'const leadSignalSource = resolveOperatorWorkspaceLeadSignalSourcePresentation(presentation);',
    /target\.signal\.dataset\.signalState\s*=\s*leadSignalValue\.state;/s,
    /target\.signalValue\.textContent\s*=\s*leadSignal\.value;/s,
    'target.signalSource.textContent = leadSignalSource;',
    'const leadSignalSource = resolveOperatorWorkspaceLeadSignalSourcePresentation(presentation);',
    'operatorWorkspaceHeaderLeadSource: document.getElementById("operatorWorkspaceHeaderLeadSource")',
    'el.operatorWorkspaceHeaderLeadSource.textContent = leadSignalSource;',
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
    '.panel-operator-console .operator-workspace-card-signal-source {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-state="fail"] .operator-workspace-card-signal-value {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-state="dormant"] .operator-workspace-card-signal-source {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-state="steady"] .operator-workspace-card-signal-source {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-state="neutral"] .operator-workspace-card-signal-source {',
    '.panel-operator-console .operator-workspace-card-signal[data-signal-state="fail"] .operator-workspace-card-signal-source {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="dormant"] .operator-workspace-header-fact-value {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="steady"] .operator-workspace-header-fact-value {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="neutral"] .operator-workspace-header-fact-value {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="fail"] .operator-workspace-header-fact-value {',
    '.panel-operator-console .operator-workspace-header-fact-source {',
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
});
