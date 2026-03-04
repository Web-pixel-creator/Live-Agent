import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes reset-view control for triage defaults", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    'id="operatorResetViewBtn"',
    "Reset View",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-reset-view token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "operatorResetViewBtn: document.getElementById(\"operatorResetViewBtn\")",
    "function resetOperatorBoardView(options = {})",
    "const requestedMode = normalizeOperatorBoardMode(options.mode);",
    "const persistMode = options && options.persistMode === false ? false : true;",
    "setOperatorBoardMode(requestedMode, { syncPresets: false, persist: persistMode });",
    "setOperatorCardsCollapsed(false);",
    "setOperatorIssuesOnlyMode(false);",
    "setOperatorFocusCriticalMode(requestedMode === \"demo\");",
    "if (el.operatorResetViewBtn) {",
    "el.operatorResetViewBtn.addEventListener(\"click\", () => {",
    "resetOperatorBoardView();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-reset-view token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Reset View` returns Operator Console to default triage layout"),
    "README missing operator reset-view note",
  );
  assert.ok(
    operatorGuideSource.includes("`Reset View` restores default triage layout"),
    "operator guide missing operator reset-view note",
  );
});
