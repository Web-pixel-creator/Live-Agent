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
    "Lead signal",
    "Awaiting refresh",
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing workspace lead signal token: ${token}`);
  }

  for (const token of [
    'operatorWorkspaceHeaderLeadFact: document.getElementById("operatorWorkspaceHeaderLeadFact")',
    'operatorWorkspaceHeaderLeadValue: document.getElementById("operatorWorkspaceHeaderLeadValue")',
    "|| !(el.operatorWorkspaceHeaderLeadFact instanceof HTMLElement)",
    "|| !(el.operatorWorkspaceHeaderLeadValue instanceof HTMLElement)",
    "const { normalizedView, routeFacts, signal, tone, title, hint, next } = getOperatorWorkspacePresentationState();",
    'const leadSignalValue =',
    ': "Awaiting refresh";',
    'const leadSignalState = signal?.variant ?? (tone === "ok" ? "steady" : "dormant");',
    'el.operatorWorkspaceHeader.dataset.workspaceSignal = leadSignalState;',
    'el.operatorWorkspaceHeaderLeadFact.dataset.signalState = leadSignalState;',
    'el.operatorWorkspaceHeaderLeadValue.textContent = leadSignalValue;',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace lead signal token: ${token}`);
  }

  for (const token of [
    ".panel-operator-console .operator-workspace-header-facts {",
    "grid-template-columns: repeat(4, minmax(0, 1fr));",
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
});
