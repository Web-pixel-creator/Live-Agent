import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console demo lanes keep one lead card and quieter supporting summaries", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function resolveOperatorCardHierarchyScore(card) {",
    "function resolveOperatorGroupLeadCard(group, visibleCards) {",
    "function syncOperatorGroupCardHierarchy(group) {",
    "function syncOperatorBoardCardHierarchy() {",
    'card.classList.toggle("operator-health-card-lead", isLead);',
    'card.classList.toggle("operator-health-card-supporting", !isLead);',
    "syncOperatorBoardCardHierarchy();",
    "syncOperatorGroupCardHierarchy(group);",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing lane card hierarchy token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-health-card.operator-health-card-lead {",
    ".panel-operator-console .operator-health-card.operator-health-card-supporting {",
    ".panel-operator-console .operator-health-card.operator-health-card-supporting .operator-health-actions,",
    ".panel-operator-console .operator-health-card.operator-health-card-supporting .operator-health-action-list,",
    ".panel-operator-console .operator-health-card.operator-health-card-supporting .operator-health-hint {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing lane card hierarchy token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("expanded operator lanes now keep one lead card at full weight"),
    "README missing lead/supporting operator lane note",
  );
  assert.ok(
    operatorGuideSource.includes("expanded operator lanes now keep one lead card at full weight"),
    "operator guide missing lead/supporting operator lane note",
  );
});
