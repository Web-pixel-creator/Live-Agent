import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend keeps dashboard shell with sidebar rail and compact active-workspace shell", () => {
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
    'class="dashboard-body"',
    'class="dashboard-sidebar"',
    'class="tabs dashboard-nav"',
    'class="dashboard-workspace-summary"',
    'id="workspaceTitle"',
    'id="workspaceStatusBadge"',
    'class="dashboard-shell-meta"',
    'id="workspaceGlanceOneValue"',
    'id="tabLiveHint"',
    'id="tabDeviceHint"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing dashboard-shell token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "function setDashboardGlanceCard(labelNode, valueNode, hintNode, glance) {",
    "function runDashboardAction(actionId) {",
    "function getDashboardWorkspaceConfig(tabId) {",
    "function renderDashboardWorkspace(tabId = null) {",
    "renderDashboardWorkspace(resolvedTabId);",
    "setStatusPill(el.workspaceStatusBadge, config.statusText, config.statusTone);",
    "setDashboardGlanceCard(el.workspaceGlanceOneLabel, el.workspaceGlanceOneValue, el.workspaceGlanceOneHint, config.glances[0]);",
    "renderDashboardWorkspace();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing dashboard-shell token: ${token}`);
  }

  const requiredStyleTokens = [
    ".dashboard-body {",
    ".dashboard-sidebar {",
    ".dashboard-nav .tab-btn {",
    ".dashboard-nav-icon {",
    ".dashboard-workspace-summary {",
    ".dashboard-shell-meta {",
    ".dashboard-glance-card {",
    ".dashboard-glance-card:first-child {",
    ".dashboard-nav-copy {",
    "text-align: left;",
    ".dashboard-sidebar:not(.is-story-focused) .dashboard-nav .tab-btn {",
    ".dashboard-sidebar:not(.is-story-focused) .dashboard-nav-title,",
    '.layout[data-active-tab="operator"] .dashboard-sidebar .dashboard-nav .tab-btn {',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing dashboard-shell token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("compact active-workspace shell"),
    "README missing compact workspace-shell note",
  );
  assert.ok(
    readmeSource.includes("hover does not change button size"),
    "README missing dashboard-nav footprint note",
  );
  assert.ok(
    readmeSource.includes("readable without shortening"),
    "README missing dashboard-nav full-title note",
  );
  assert.ok(
    operatorGuideSource.includes("compact active-workspace shell"),
    "operator guide missing compact workspace-shell note",
  );
  assert.ok(
    operatorGuideSource.includes("hover does not change button size"),
    "operator guide missing dashboard-nav footprint note",
  );
  assert.ok(
    operatorGuideSource.includes("readable without shortening"),
    "operator guide missing dashboard-nav full-title note",
  );
  assert.ok(
    operatorGuideSource.includes("hero no longer duplicates task choice"),
    "operator guide missing single-action-entry note",
  );
});
