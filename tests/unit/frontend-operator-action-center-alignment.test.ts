import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console keeps contextual recovery kits inside the same action-center shell", () => {
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
    'class="operator-action-center-support-head"',
    'class="operator-action-center-support-kicker">Recovery Rail<',
    'id="operatorActionCenterSupport"',
    'class="operator-action-center-support"',
    'class="operator-action-center-card is-neutral is-compact"',
    'Hydrate evidence',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator action-center token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorActionCenterSupport: document.getElementById("operatorActionCenterSupport")',
    "function createOperatorActionCenterActionButton(config, options = {}) {",
    "function buildOperatorActionCenterCards() {",
    "function syncOperatorActionCenter() {",
    'article.className = `operator-action-center-card is-${card.tone ?? "neutral"}`;',
    'article.classList.add("is-compact");',
    'actionRow.className = "operator-action-center-actions";',
    "syncOperatorActionCenter();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator action-center token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-action-center-support-head {",
    ".panel-operator-console .operator-action-center-support {",
    ".panel-operator-console .operator-action-center-card {",
    ".panel-operator-console .operator-action-center-card.is-fail {",
    ".panel-operator-console .operator-action-center-actions {",
    ".panel-operator-console .operator-action-center-action {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator action-center token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("contextual `Action Center`"),
    "README missing operator action-center note",
  );
  assert.ok(
    operatorGuideSource.includes("contextual `Action Center`"),
    "operator guide missing operator action-center note",
  );
});
