import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console demotes dashboard navigation into a quiet left rail on desktop", () => {
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredStyleTokens = [
    '.layout[data-active-tab="operator"] .dashboard-body {',
    'grid-template-columns: minmax(118px, 132px) minmax(0, 1fr);',
    '.layout[data-active-tab="operator"] .dashboard-sidebar {',
    '.layout[data-active-tab="operator"] .dashboard-nav {',
    '.layout[data-active-tab="operator"] .dashboard-nav .tab-btn {',
    'min-height: 40px;',
    'opacity: 0.56;',
    '.layout[data-active-tab="operator"] .dashboard-nav .tab-btn::before {',
    '.layout[data-active-tab="operator"] .dashboard-nav .tab-btn.active::before {',
    '.layout[data-active-tab="operator"] .dashboard-nav-icon {',
    'font-size: 0.54rem;',
    '.layout[data-active-tab="operator"] .dashboard-nav-hint {',
    'display: none;',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-sidebar quiet-rail token: ${token}`);
  }

  assert.ok(
    readmeSource.includes('global dashboard nav also retreats into a quieter left rail for `Operator`'),
    'README missing desktop operator quiet-sidebar note',
  );
  assert.ok(
    operatorGuideSource.includes('global dashboard nav now retreats into a quieter left rail for `Operator`'),
    'operator guide missing desktop operator quiet-sidebar note',
  );
});
