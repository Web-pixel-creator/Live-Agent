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
    'Awaiting refresh',
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
    'operatorWorkspaceApprovalsSignal: document.getElementById("operatorWorkspaceApprovalsSignal")',
    'operatorWorkspaceApprovalsSignalValue: document.getElementById("operatorWorkspaceApprovalsSignalValue")',
    'operatorWorkspaceRuntimeSignal: document.getElementById("operatorWorkspaceRuntimeSignal")',
    'operatorWorkspaceRuntimeSignalValue: document.getElementById("operatorWorkspaceRuntimeSignalValue")',
    'operatorWorkspaceAuditSignal: document.getElementById("operatorWorkspaceAuditSignal")',
    'operatorWorkspaceAuditSignalValue: document.getElementById("operatorWorkspaceAuditSignalValue")',
    'function syncOperatorWorkspaceCards() {',
    'function syncOperatorWorkspaceHeader() {',
    'const markerViewId = activeView !== "incidents"',
    'const markerLabel = activeView !== "incidents" || hasManualRefresh ? "Current" : "Recommended next";',
    'target.button.dataset.workspaceActive = isActive ? "true" : "false";',
    'target.button.dataset.workspaceMarker = markerLabel.toLowerCase().replaceAll(" ", "-");',
    'function resolveOperatorWorkspaceLeadSignalPresentation(presentation) {',
    'const signalValue =',
    'const signalState = presentation?.signal?.variant ?? (presentation?.tone === "ok" ? "steady" : "dormant");',
    'const leadSignal = resolveOperatorWorkspaceLeadSignalPresentation(presentation);',
    /target\.signal\.dataset\.signalState\s*=\s*leadSignalValue\.state;/s,
    /target\.signalValue\.textContent\s*=\s*leadSignal\.value;/s,
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
    '.panel-operator-console .operator-workspace-card-signal[data-signal-state="fail"] .operator-workspace-card-signal-value {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="dormant"] .operator-workspace-header-fact-value {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="steady"] .operator-workspace-header-fact-value {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="neutral"] .operator-workspace-header-fact-value {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="fail"] .operator-workspace-header-fact-value {',
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
});
