import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console demo lead cards collapse into a compact incident summary", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function ensureOperatorLeadCardSummary(card) {",
    'summary.className = "operator-health-card-lead-summary";',
    "function collectOperatorLeadCardSummaryFacts(card) {",
    'const targetCount = variant === "fail" ? 3 : 2;',
    'card.classList.add("has-lead-summary");',
    'card.dataset.operatorLeadSummaryCount = String(facts.length);',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing lead summary token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-health-card.operator-health-card-lead.has-lead-summary .operator-health-row,",
    ".panel-operator-console .operator-health-card-lead-summary {",
    ".panel-operator-console .operator-health-card-lead-summary-item {",
    ".panel-operator-console .operator-health-card-lead-summary-item.is-primary {",
    ".panel-operator-console .operator-health-card.operator-health-card-lead.has-lead-summary .operator-health-hint {",
    '.panel-operator-console .operator-health-card.operator-health-card-lead[data-operator-lead-summary-count="2"] .operator-health-card-lead-summary {',
    '.panel-operator-console .operator-health-card.operator-health-card-lead[data-operator-lead-summary-count="2"] .operator-health-card-lead-summary-item.is-primary {',
    'has-compact-lead-shell[data-operator-lead-summary-count="2"]',
    ".operator-health-card-lead-summary-item {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing lead summary token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("compact 2-3 fact incident summary"),
    "README missing lead incident summary note",
  );
  assert.ok(
    readmeSource.includes("caps calm/stale lead summaries at two facts"),
    "README missing calm/stale lead summary cap note",
  );
  assert.ok(
    readmeSource.includes("summary now stays on one row"),
    "README missing one-row lead summary note",
  );
  assert.ok(
    readmeSource.includes("tighten their shell spacing"),
    "README missing compact lead shell note",
  );
  assert.ok(
    operatorGuideSource.includes("compact 2-3 fact incident summary"),
    "operator guide missing lead incident summary note",
  );
  assert.ok(
    operatorGuideSource.includes("caps calm/stale lead summaries at two facts"),
    "operator guide missing calm/stale lead summary cap note",
  );
  assert.ok(
    operatorGuideSource.includes("summary now stays on one row"),
    "operator guide missing one-row lead summary note",
  );
  assert.ok(
    operatorGuideSource.includes("tighten their shell spacing"),
    "operator guide missing compact lead shell note",
  );
});
