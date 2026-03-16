import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console keeps board visibility as a quieter desktop footer ledger", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    'class="operator-triage-summary-foot"',
    'class="operator-triage-summary-foot-label"',
    'class="operator-triage-summary-grid"',
    'class="operator-triage-stat operator-triage-stat-fail"',
    'class="operator-triage-stat operator-triage-stat-ok"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing triage-footer token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-triage-summary-foot {",
    "border-top: 1px solid color-mix(in oklch, var(--border-soft) 72%, transparent);",
    ".panel-operator-console .operator-triage-summary-grid {",
    ".panel-operator-console .operator-triage-stat {",
    "padding: 4px 8px;",
    ".panel-operator-console .operator-triage-stat-label {",
    "font-size: 0.58rem;",
    ".panel-operator-console .operator-triage-stat-value {",
    "font-size: 0.76rem;",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing triage-footer token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("lower `Board Visibility` footer now retreats another step into a quieter chip ledger"),
    "README missing triage-footer ledger note",
  );
  assert.ok(
    operatorGuideSource.includes("lower `Board Visibility` footer now retreats another step into a quieter chip ledger"),
    "operator guide missing triage-footer ledger note",
  );
});
