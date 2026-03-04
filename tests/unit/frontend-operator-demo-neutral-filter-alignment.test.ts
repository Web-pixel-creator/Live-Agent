import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator demo view suppresses uninitialized neutral noise in demo modes", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function getOperatorStatusCode(statusNode)",
    "function isOperatorUninitializedStatusText(value)",
    "function shouldHideOperatorDemoNeutralCard(card, statusNode)",
    "function shouldCondenseOperatorDemoNeutralCard(card, statusNode)",
    "const OPERATOR_EMPTY_STATE_ACTIONS = {",
    "operatorDeviceNodesStatus: { action: \"open_device_nodes\", label: \"Open Device Nodes\" },",
    "function runOperatorEmptyStateAction(actionId)",
    "function ensureOperatorCardEmptyActions(card, statusNode)",
    "runOperatorEmptyStateAction(\"refresh_summary\");",
    "runOperatorEmptyStateAction(actionId);",
    "ensureOperatorCardEmptyActions(card, statusNode);",
    "normalizeOperatorBoardMode(state.operatorBoardMode) !== \"demo\"",
    "statusNode.classList.contains(\"status-neutral\")",
    "!isOperatorUninitializedStatusText(getOperatorStatusCode(statusNode))",
    "if (state.operatorFocusCriticalOnly === true) {",
    "return !isOperatorDemoEssentialCard(card);",
    "isOperatorUninitializedStatusText(getOperatorStatusCode(statusNode))",
    "const shouldCondense = shouldCondenseOperatorDemoNeutralCard(card, statusNode);",
    "card.classList.toggle(\"operator-health-card-condensed\", shouldCondense);",
    "if (shouldHideOperatorDemoNeutralCard(card, statusNode)) {",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator demo-noise token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-health-card.operator-health-card-condensed .operator-health-row {",
    ".operator-health-card.operator-health-card-condensed .status-pill {",
    ".operator-health-card.operator-health-card-condensed .operator-health-hint {",
    ".operator-health-card.operator-health-card-empty {",
    ".operator-health-empty-actions {",
    ".operator-health-empty-cue {",
    ".operator-health-empty-action {",
    ".operator-health-empty-action-refresh {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator demo-noise token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("auto-hides uninitialized neutral noise cards"),
    "README missing operator demo uninitialized-neutral visibility note",
  );
  assert.ok(
    readmeSource.includes("compact render (`title + status + hint`)"),
    "README missing operator demo compact neutral-card note",
  );
  assert.ok(
    readmeSource.includes("inline next-step CTAs (`Run Negotiation` / `Run UI Task` / `Open Device Nodes` + `Refresh Summary`)"),
    "README missing operator demo inline CTA note",
  );
  assert.ok(
    operatorGuideSource.includes("uninitialized neutral noise cards"),
    "operator guide missing operator demo uninitialized-neutral visibility note",
  );
  assert.ok(
    operatorGuideSource.includes("compact mode (`title + status + hint`)"),
    "operator guide missing operator demo compact neutral-card note",
  );
  assert.ok(
    operatorGuideSource.includes("inline recovery CTAs"),
    "operator guide missing operator demo inline CTA note",
  );
});
