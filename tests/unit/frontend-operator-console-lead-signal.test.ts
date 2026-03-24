import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console workspace cards expose a read-only lead signal line without changing workspace navigation", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="operatorWorkspaceOverviewSignal"',
    'id="operatorWorkspaceOverviewSignalValue"',
    'id="operatorWorkspaceApprovalsSignal"',
    'id="operatorWorkspaceApprovalsSignalValue"',
    'id="operatorWorkspaceRuntimeSignal"',
    'id="operatorWorkspaceRuntimeSignalValue"',
    'id="operatorWorkspaceAuditSignal"',
    'id="operatorWorkspaceAuditSignalValue"',
    'class="operator-workspace-card-signal-label">Lead signal</span>',
    'Awaiting refresh',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing workspace-card lead-signal token: ${token}`);
  }

  for (const token of [
    'operatorWorkspaceOverviewSignal: document.getElementById("operatorWorkspaceOverviewSignal")',
    'operatorWorkspaceOverviewSignalValue: document.getElementById("operatorWorkspaceOverviewSignalValue")',
    'operatorWorkspaceApprovalsSignal: document.getElementById("operatorWorkspaceApprovalsSignal")',
    'operatorWorkspaceApprovalsSignalValue: document.getElementById("operatorWorkspaceApprovalsSignalValue")',
    'operatorWorkspaceRuntimeSignal: document.getElementById("operatorWorkspaceRuntimeSignal")',
    'operatorWorkspaceRuntimeSignalValue: document.getElementById("operatorWorkspaceRuntimeSignalValue")',
    'operatorWorkspaceAuditSignal: document.getElementById("operatorWorkspaceAuditSignal")',
    'operatorWorkspaceAuditSignalValue: document.getElementById("operatorWorkspaceAuditSignalValue")',
    "signal: el.operatorWorkspaceOverviewSignal,",
    "signalValue: el.operatorWorkspaceOverviewSignalValue,",
    "function resolveOperatorWorkspaceLeadSignalPresentation(presentation) {",
    'const signalValue =',
    'const signalState = presentation?.signal?.variant ?? (presentation?.tone === "ok" ? "steady" : "dormant");',
    "const leadSignal = resolveOperatorWorkspaceLeadSignalPresentation(presentation);",
    "target.signal.dataset.signalState = leadSignal.state;",
    "target.signalValue.textContent = leadSignal.value;",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace-card lead-signal wiring token: ${token}`);
  }

  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card-signal {'),
    "styles.css should style the workspace-card lead signal row",
  );
  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-workspace-card-signal[data-signal-state="fail"] .operator-workspace-card-signal-value {'),
    "styles.css should style the workspace-card fail lead signal tone",
  );

  assert.ok(
    readmeSource.includes("`Choose workspace` cards now also expose a read-only `Lead signal` line"),
    "README should document the workspace-card lead signal line",
  );
  assert.ok(
    operatorGuideSource.includes("`Choose workspace` cards now also expose a read-only `Lead signal` line"),
    "operator guide should document the workspace-card lead signal line",
  );
});
