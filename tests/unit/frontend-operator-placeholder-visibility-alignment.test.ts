import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console keeps placeholder cards hidden until first manual summary refresh", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "operatorSummaryUserRefreshed: false",
    "function isOperatorPlaceholderStatusText(value)",
    'return normalized === "no_data" || normalized === "summary_error";',
    "state.operatorSummaryUserRefreshed !== true &&",
    "card.classList.toggle(\"operator-health-card-hidden\", shouldHide);",
    "group.classList.toggle(\"operator-health-group-hidden\", !hasVisibleCards);",
    "if (markUserRefresh && state.operatorSummaryUserRefreshed !== true) {",
    "state.operatorSummaryUserRefreshed = true;",
    "setOperatorCardsCollapsed(false);",
    "applyOperatorCardsVisibility();",
    "document.getElementById(\"operatorRefreshBtn\").addEventListener(\"click\", () => {",
    "void refreshOperatorSummary({ markUserRefresh: true });",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-placeholder token: ${token}`);
  }

  assert.match(
    appSource,
    /if \(markUserRefresh && state\.operatorSummaryUserRefreshed !== true\)\s*\{\s*state\.operatorSummaryUserRefreshed = true;\s*setOperatorCardsCollapsed\(false\);\s*applyOperatorCardsVisibility\(\);\s*\}/,
    "manual refresh branch must unlock placeholder visibility and expand cards",
  );

  const requiredStyleTokens = [
    ".operator-health-group-hidden",
    ".operator-health-card-hidden",
    "display: none;",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-placeholder token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("hides placeholder cards (`no_data` / `summary_error`) until the first manual `Refresh Summary`"),
    "README missing operator placeholder visibility note",
  );
  assert.ok(
    operatorGuideSource.includes("Placeholder cards (`no_data` / `summary_error`) stay hidden until the first manual `Refresh Summary`"),
    "operator guide missing operator placeholder visibility note",
  );
});
