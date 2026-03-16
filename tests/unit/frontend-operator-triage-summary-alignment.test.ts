import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes an active queue with quieter board-visibility counters", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    'class="operator-triage-summary"',
    'id="operatorPriorityQueueList"',
    'class="operator-priority-queue-list"',
    'class="operator-triage-stat-label"',
    'class="operator-triage-stat-value"',
    'id="operatorTriageTotal"',
    'id="operatorTriageVisible"',
    'id="operatorTriageFail"',
    'id="operatorTriageNeutral"',
    'id="operatorTriageOk"',
    'id="operatorTriageHidden"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-triage token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "operatorTriageTotal: document.getElementById(\"operatorTriageTotal\")",
    "operatorTriageVisible: document.getElementById(\"operatorTriageVisible\")",
    "operatorTriageFail: document.getElementById(\"operatorTriageFail\")",
    "operatorTriageNeutral: document.getElementById(\"operatorTriageNeutral\")",
    "operatorTriageOk: document.getElementById(\"operatorTriageOk\")",
    "operatorTriageHidden: document.getElementById(\"operatorTriageHidden\")",
    "operatorPriorityQueueList: document.getElementById(\"operatorPriorityQueueList\")",
    "function readOperatorStatusVariant(statusNode)",
    "function syncOperatorPriorityQueue() {",
    "function createOperatorPriorityQueueSignalEntry(signal) {",
    "function refreshOperatorTriageSummary()",
    "setText(el.operatorTriageTotal, String(cards.length));",
    "setText(el.operatorTriageVisible, String(visible));",
    "setText(el.operatorTriageFail, String(fail));",
    "setText(el.operatorTriageNeutral, String(neutral));",
    "setText(el.operatorTriageOk, String(ok));",
    "setText(el.operatorTriageHidden, String(hidden));",
    "syncOperatorPriorityQueue();",
    "refreshOperatorTriageSummary();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-triage token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-triage-summary {",
    ".operator-priority-queue-list {",
    ".operator-priority-queue-item {",
    ".operator-triage-summary-foot {",
    ".operator-triage-stat {",
    ".operator-triage-stat-label {",
    ".operator-triage-stat-value {",
    ".operator-triage-stat-fail {",
    ".operator-triage-stat-neutral {",
    ".operator-triage-stat-ok {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-triage token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Triage Summary` now behaves like an `Active Queue`"),
    "README missing operator triage summary note",
  );
  assert.ok(
    readmeSource.includes("compact chip ledger"),
    "README missing compact board-visibility ledger note",
  );
  assert.ok(
    operatorGuideSource.includes("`Triage Summary` now behaves like an `Active Queue`"),
    "operator guide missing operator triage summary note",
  );
  assert.ok(
    operatorGuideSource.includes("compact chip ledger"),
    "operator guide missing compact board-visibility ledger note",
  );
});
