import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator desktop supporting ledger cards collapse into compact evidence chips", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function ensureOperatorSupportingCardSummary(card) {",
    "function collectOperatorSupportingCardSummaryFacts(card) {",
    "function normalizeOperatorSupportingSummaryLabel(value) {",
    "function normalizeOperatorSupportingSummaryValue(label, value, isPlaceholder = false) {",
    "function syncOperatorSupportingCardSummary(card) {",
    'summary.className = "operator-health-card-supporting-summary";',
    'item.className = "operator-health-card-supporting-summary-item";',
    'label.className = "operator-health-card-supporting-summary-label";',
    'value.className = "operator-health-card-supporting-summary-value";',
    'card.classList.add("has-supporting-summary");',
    'return normalizedLabel === "recovery path" ? "Refresh needed" : "Awaiting";',
    'return "Refresh needed";',
    'note.textContent = isActive ? "Focused" : "Inspect";',
    "syncOperatorSupportingCardSummary(card);",
  ];

  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing supporting-card summary token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-health-card-supporting-summary {",
    ".panel-operator-console .operator-health-supporting-ledger .operator-health-card.operator-health-card-supporting.has-supporting-summary {",
    ".panel-operator-console .operator-health-supporting-ledger .operator-health-card.operator-health-card-supporting .operator-health-card-supporting-summary {",
    ".panel-operator-console .operator-health-supporting-ledger .operator-health-card.operator-health-card-supporting .operator-health-card-supporting-summary-item {",
    '[data-operator-supporting-summary-count="2"]',
    ".panel-operator-console .operator-health-supporting-ledger .operator-health-card.operator-health-card-supporting.has-supporting-summary .operator-health-hint {",
  ];

  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing supporting-card summary token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("supporting cards now also swap their longer hint paragraph for one or two compact evidence chips"),
    "README missing supporting-card evidence-chip note",
  );
  assert.ok(
    readmeSource.includes("shortens long supporting chip labels/values"),
    "README missing supporting-card semantic compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("supporting cards now also swap their longer hint paragraph for one or two compact evidence chips"),
    "operator guide missing supporting-card evidence-chip note",
  );
  assert.ok(
    operatorGuideSource.includes("shortens long supporting chip labels/values"),
    "operator guide missing supporting-card semantic compaction note",
  );
});
