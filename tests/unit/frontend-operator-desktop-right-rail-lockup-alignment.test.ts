import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console keeps the desktop right rail as a tighter brief-queue-evidence lockup", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    'id="operatorSummaryGuide"',
    'id="operatorTriageSummary"',
    'id="operatorEvidenceDrawer"',
    'class="operator-summary-guide-actions"',
    'class="operator-triage-summary-hint"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing desktop right-rail token: ${token}`);
  }

  const requiredStyleTokens = [
    "@media (min-width: 921px) {",
    ".panel-operator-console .operator-summary-guide-status-row {",
    "grid-template-columns: auto minmax(0, 1fr);",
    ".panel-operator-console .operator-summary-guide-hint {",
    ".panel-operator-console .operator-summary-guide-view-note {",
    ".panel-operator-console .operator-summary-guide-watch-label {",
    "grid-template-columns: repeat(3, minmax(0, 1fr));",
    ".panel-operator-console .operator-summary-guide-actions > .operator-summary-guide-action-refresh {",
    ".panel-operator-console .operator-triage-summary-hint {",
    ".panel-operator-console .operator-action-center-support-hint {",
    ".panel-operator-console .operator-evidence-drawer-tabs {",
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"] .operator-evidence-drawer-fact,',
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"] .operator-evidence-drawer-provenance,',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing desktop right-rail token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("right triage rail now tightens into a shorter `brief -> queue -> evidence` lockup"),
    "README missing desktop right-rail lockup note",
  );
  assert.ok(
    readmeSource.includes("all three `Operator brief` actions sit on one row"),
    "README missing brief single-row action note",
  );
  assert.ok(
    readmeSource.includes("queue/support helper copy drops out"),
    "README missing queue/support helper-copy note",
  );
  assert.ok(
    operatorGuideSource.includes("right triage rail now tightens into a shorter `brief -> queue -> evidence` lockup"),
    "operator guide missing desktop right-rail lockup note",
  );
  assert.ok(
    operatorGuideSource.includes("all three `Operator brief` actions sit on one row"),
    "operator guide missing brief single-row action note",
  );
  assert.ok(
    operatorGuideSource.includes("queue/support helper copy drops out"),
    "operator guide missing queue/support helper-copy note",
  );
});
