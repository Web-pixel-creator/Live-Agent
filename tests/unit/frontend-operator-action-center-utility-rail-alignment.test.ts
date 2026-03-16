import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console turns a single calm recovery kit into a desktop utility strip", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "const utilityRailOnly =",
    "function resolveOperatorActionCenterUtilityActionLabel(config) {",
    "function resolveOperatorActionCenterUtilityTitle(card) {",
    'el.operatorActionCenterSupport.dataset.supportDensity = utilityRailOnly ? "utility" : "card";',
    'article.classList.add("is-utility-rail");',
    "card.tags.slice(0, utilityRailOnly ? 1 : 3)",
    'button.dataset.actionDensity = compact ? "compact" : "default";',
    "button.textContent = compactLabel || fullLabel;",
    "title.textContent = utilityTitle || fullTitle;",
    "if (!utilityRailOnly) {",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing action-center utility token: ${token}`);
  }

  const requiredStyleTokens = [
    '.panel-operator-console .operator-action-center-support[data-support-density="utility"] {',
    ".panel-operator-console .operator-action-center-card.is-utility-rail {",
    '.panel-operator-console .operator-action-center-support[data-support-density="utility"] .operator-action-center-card.is-utility-rail .operator-action-center-card-kicker {',
    ".panel-operator-console .operator-action-center-card.is-utility-rail .operator-action-center-meta {",
    ".panel-operator-console .operator-action-center-card.is-utility-rail .operator-action-center-actions {",
    '.panel-operator-console .operator-action-center-support[data-support-density="utility"] .operator-action-center-card.is-utility-rail .operator-action-center-action[data-action-density="compact"] {',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing action-center utility token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("single calm `Recovery Rail` kit now drops into a shorter utility strip"),
    "README missing action-center utility-strip note",
  );
  assert.ok(
    readmeSource.includes("utility strip now also shortens the visible title/action labels (`Hydrate evidence`, `Refresh`, `Negotiate`)"),
    "README missing action-center utility-label note",
  );
  assert.ok(
    operatorGuideSource.includes("single calm `Recovery Rail` kit now drops into a shorter utility strip"),
    "operator guide missing action-center utility-strip note",
  );
  assert.ok(
    operatorGuideSource.includes("utility strip now also shortens the visible title/action labels (`Hydrate evidence`, `Refresh`, `Negotiate`)"),
    "operator guide missing action-center utility-label note",
  );
});
