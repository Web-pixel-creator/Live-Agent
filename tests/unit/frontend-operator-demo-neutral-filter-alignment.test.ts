import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator demo view hides uninitialized neutral cards in focus-critical mode", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function getOperatorStatusCode(statusNode)",
    "function isOperatorUninitializedStatusText(value)",
    "function shouldHideOperatorDemoNeutralCard(card, statusNode)",
    "normalizeOperatorBoardMode(state.operatorBoardMode) !== \"demo\"",
    "state.operatorFocusCriticalOnly !== true",
    "isOperatorDemoEssentialCard(card)",
    "statusNode.classList.contains(\"status-neutral\")",
    "isOperatorUninitializedStatusText(getOperatorStatusCode(statusNode));",
    "if (shouldHideOperatorDemoNeutralCard(card, statusNode)) {",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator demo-noise token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("auto-hides uninitialized neutral cards"),
    "README missing operator demo uninitialized-neutral visibility note",
  );
  assert.ok(
    operatorGuideSource.includes("uninitialized neutral cards"),
    "operator guide missing operator demo uninitialized-neutral visibility note",
  );
});
