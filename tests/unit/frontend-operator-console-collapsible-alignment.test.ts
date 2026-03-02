import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes collapse controls and pristine-card visibility gating", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const sourceHtml = readFileSync(htmlPath, "utf8");
  const sourceApp = readFileSync(appPath, "utf8");
  const sourceStyles = readFileSync(stylesPath, "utf8");

  const requiredHtmlTokens = [
    'id="operatorCollapseAllBtn"',
    'id="operatorExpandAllBtn"',
    'id="operatorHealthBoard"',
    'class="operator-health-group"',
    "data-operator-group-toggle",
    'id="operator-group-bridge-safety-body"',
    'id="operator-group-governance-evidence-body"',
    'id="operator-group-runtime-device-body"',
    'id="operator-group-queue-lifecycle-body"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(sourceHtml.includes(token), `frontend html missing operator-collapsible token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "operatorCardsCollapsed: false",
    "operatorSummaryUserRefreshed: false",
    "operatorCollapseAllBtn: document.getElementById(\"operatorCollapseAllBtn\")",
    "operatorExpandAllBtn: document.getElementById(\"operatorExpandAllBtn\")",
    "operatorHealthBoard: document.getElementById(\"operatorHealthBoard\")",
    "function setOperatorGroupCollapsed(group, collapsed)",
    "function setAllOperatorGroupsCollapsed(collapsed)",
    "function applyOperatorGroupVisibility(group)",
    "function syncOperatorCollapseActionButtons()",
    "function setOperatorCardsCollapsed(collapsed)",
    "function applyOperatorCardsVisibility()",
    "function applyOperatorCardVisibility(card)",
    "isOperatorPlaceholderStatusText",
    "const operatorGroupToggles = document.querySelectorAll(\"[data-operator-group-toggle]\")",
    "setOperatorGroupCollapsed(group, shouldCollapse);",
    "markUserRefresh: true",
    "setOperatorCardsCollapsed(false);",
    "applyOperatorCardsVisibility();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(sourceApp.includes(token), `frontend runtime missing operator-collapsible token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-health-group {",
    ".operator-health-group-head {",
    ".operator-health-group-body {",
    ".operator-health-group.is-collapsed .operator-health-group-body",
    ".operator-health-group-hidden",
    ".operator-health-card-hidden",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(sourceStyles.includes(token), `frontend styles missing operator-collapsible token: ${token}`);
  }
});
