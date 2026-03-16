import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator workspace shell compacts into a quieter desktop header", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    'const isOperatorTab = resolvedTabId === "operator";',
    'workspaceSummary.classList.toggle("is-operator-minimal", isOperatorTab);',
    '"Overview first"',
    '"Refresh, then open one lane."',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator workspace-shell token: ${token}`);
  }

  const requiredStyleTokens = [
    '@media (min-width: 921px) {',
    '.layout[data-active-tab="operator"] .hero {',
    '.layout[data-active-tab="operator"] .hero-toolbar {',
    '.layout[data-active-tab="operator"] .hero-language-control {',
    '.layout[data-active-tab="operator"] .hero-language-control > span {',
    '.layout[data-active-tab="operator"] #themeToggleBtn {',
    '.layout[data-active-tab="operator"] .hero-sub {',
    '.layout[data-active-tab="operator"] .dashboard-workspace-summary.is-operator-minimal {',
    '.layout[data-active-tab="operator"] .dashboard-workspace-summary.is-operator-minimal .dashboard-workspace-eyebrow {',
    '.layout[data-active-tab="operator"] .dashboard-workspace-summary.is-operator-minimal .dashboard-workspace-description {',
    '.layout[data-active-tab="operator"] .dashboard-workspace-summary.is-operator-minimal .dashboard-shell-meta {',
    '.layout[data-active-tab="operator"] .dashboard-workspace-summary.is-operator-minimal .dashboard-glance-card {',
    '.layout[data-active-tab="operator"] .dashboard-workspace-summary.is-operator-minimal .dashboard-glance-card:not([hidden]):not(:last-child)::after {',
    '.layout[data-active-tab="operator"] .dashboard-workspace-summary.is-operator-minimal .dashboard-glance-hint {',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator workspace-shell token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("shared workspace shell above `Operator Console` now collapses into a quieter ops header"),
    "README missing operator workspace-shell compaction note",
  );
  assert.ok(
    readmeSource.includes("global dashboard hero above it now also flattens into a thinner control bar for `Operator`"),
    "README missing operator hero compaction note",
  );
  assert.ok(
    readmeSource.includes("ops header now retreats one step further into a ribbon"),
    "README missing operator ops-ribbon note",
  );
  assert.ok(
    operatorGuideSource.includes("shared workspace shell above `Operator Console` also collapses into a quieter ops header"),
    "operator guide missing operator workspace-shell compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("global dashboard hero above it also flattens into a thinner control bar for `Operator`"),
    "operator guide missing operator hero compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("ops header now retreats one step further into a ribbon"),
    "operator guide missing operator ops-ribbon note",
  );
});
