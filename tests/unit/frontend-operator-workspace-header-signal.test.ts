import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator workspace header exposes a read-only lead signal fact wired from presentation.signal", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="operatorWorkspaceHeaderLeadFact"',
    'id="operatorWorkspaceHeaderLeadValue"',
    'id="operatorWorkspaceHeaderLeadSource"',
    'id="operatorWorkspaceHeaderLeadFreshness"',
    'id="operatorWorkspaceHeaderNextValue"',
    "Lead signal",
    "Overview signal pending",
    'class="operator-workspace-header-fact-source">Source: Overview</span>',
    'class="operator-workspace-header-fact-freshness">Freshness: awaiting refresh</span>',
    'Refresh Summary',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing workspace lead signal token: ${token}`);
  }

  for (const token of [
    'operatorWorkspaceHeaderLeadFact: document.getElementById("operatorWorkspaceHeaderLeadFact")',
    'operatorWorkspaceHeaderLeadValue: document.getElementById("operatorWorkspaceHeaderLeadValue")',
    'operatorWorkspaceHeaderLeadSource: document.getElementById("operatorWorkspaceHeaderLeadSource")',
    'operatorWorkspaceHeaderLeadFreshness: document.getElementById("operatorWorkspaceHeaderLeadFreshness")',
    'operatorWorkspaceHeaderNextValue: document.getElementById("operatorWorkspaceHeaderNextValue")',
    "|| !(el.operatorWorkspaceHeaderLeadFact instanceof HTMLElement)",
    "|| !(el.operatorWorkspaceHeaderLeadValue instanceof HTMLElement)",
    "|| !(el.operatorWorkspaceHeaderLeadFreshness instanceof HTMLElement)",
    "function resolveOperatorWorkspaceLeadSignalPresentation(presentation) {",
    "function resolveOperatorWorkspaceLeadSignalSourcePresentation(presentation) {",
    "function resolveOperatorWorkspaceFreshnessPresentation() {",
    'const signalValue =',
    'signal pending',
    'getOperatorEvidenceDrawerRefreshLabel()',
    'getOperatorEvidenceDrawerRefreshStamp(refreshLabel)',
    'const signalState = presentation?.signal?.variant ?? (presentation?.tone === "ok" ? "steady" : "dormant");',
    'const signalSource =',
    "const presentation = getOperatorWorkspacePresentationState();",
    "const leadSignal = resolveOperatorWorkspaceLeadSignalPresentation(presentation);",
    "const leadSignalSource = resolveOperatorWorkspaceLeadSignalSourcePresentation(presentation);",
    "const freshness = resolveOperatorWorkspaceFreshnessPresentation();",
    'el.operatorWorkspaceHeader.dataset.workspaceSignal = leadSignal.state;',
    'el.operatorWorkspaceHeaderLeadFact.dataset.signalState = leadSignal.state;',
    'el.operatorWorkspaceHeaderLeadFact.dataset.freshnessState = freshness.state;',
    'el.operatorWorkspaceHeaderLeadValue.textContent = leadSignal.value;',
    'el.operatorWorkspaceHeaderLeadSource.textContent = leadSignalSource;',
    'el.operatorWorkspaceHeaderLeadFreshness.textContent = freshness.value;',
    'el.operatorWorkspaceHeaderNextValue.textContent =',
    'Refresh Summary',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace lead signal token: ${token}`);
  }

  for (const token of [
    ".panel-operator-console .operator-workspace-header-facts {",
    "grid-template-columns: repeat(4, minmax(0, 1fr));",
    '.panel-operator-console .operator-workspace-header-fact-source {',
    '.panel-operator-console .operator-workspace-header-fact-freshness {',
    '.panel-operator-console .operator-workspace-header-fact[data-freshness-state="dormant"] .operator-workspace-header-fact-freshness {',
    '.panel-operator-console .operator-workspace-header-fact[data-freshness-state="steady"] .operator-workspace-header-fact-freshness {',
    '.panel-operator-console .operator-workspace-header-fact[data-freshness-state="neutral"] .operator-workspace-header-fact-freshness {',
    '.panel-operator-console .operator-workspace-header-fact[data-freshness-state="fail"] .operator-workspace-header-fact-freshness {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="dormant"] .operator-workspace-header-fact-value {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="steady"] .operator-workspace-header-fact-value {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="neutral"] .operator-workspace-header-fact-value {',
    '.panel-operator-console .operator-workspace-header-fact[data-signal-state="fail"] .operator-workspace-header-fact-value {',
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing workspace lead signal token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("workspace header now also exposes a read-only `Lead signal` fact"),
    "README should document the read-only workspace lead signal fact",
  );
  assert.ok(
    operatorGuideSource.includes("workspace header now also exposes a read-only `Lead signal` fact"),
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
    "README should document the lead-signal freshness subline",
  );
  assert.ok(
    operatorGuideSource.includes("compact freshness subline from the operator refresh state"),
    "operator guide should document the lead-signal freshness subline",
  );
});
