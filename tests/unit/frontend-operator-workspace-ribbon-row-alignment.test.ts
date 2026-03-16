import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator workspace ribbon keeps title and glance ledger on one desktop row", () => {
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredStyleTokens = [
    '.layout[data-active-tab="operator"] .dashboard-workspace-summary.is-operator-minimal {',
    "grid-template-columns: auto minmax(0, 1fr);",
    '.layout[data-active-tab="operator"] .dashboard-workspace-summary.is-operator-minimal .dashboard-shell-meta {',
    "justify-content: flex-end;",
    '.layout[data-active-tab="operator"] .dashboard-workspace-summary.is-operator-minimal .dashboard-workspace-head {',
    "min-width: 0;",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator workspace-ribbon row token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("ops ribbon now keeps the title/status pair and glance ledger on one row"),
    "README missing operator workspace-ribbon row note",
  );
  assert.ok(
    operatorGuideSource.includes("ops ribbon now also keeps the title/status pair and glance ledger on one row"),
    "operator guide missing operator workspace-ribbon row note",
  );
});
