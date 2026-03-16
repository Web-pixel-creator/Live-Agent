import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator desktop ledger lead cards flatten summary facts into quieter inline chips", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function shouldUseOperatorCompactLeadSummary(card) {",
    "function normalizeOperatorLeadSummaryLabel(value) {",
    "function normalizeOperatorLeadSummaryValue(label, value, isPlaceholder = false) {",
    'return useCompactSummary ? "Refresh first." : "Next: Refresh Summary.";',
    'label.textContent = useCompactSummary ? normalizeOperatorLeadSummaryLabel(fullLabel) : fullLabel;',
    'value.textContent = useCompactSummary ? normalizeOperatorLeadSummaryValue(fullLabel, fullValue, fact.isPlaceholder === true) : fullValue;',
    'item.title = fullLabel && fullValue ? `${fullLabel}: ${fullValue}` : fullValue || fullLabel;',
    'card.dataset.operatorLeadSummaryDensity = useCompactSummary ? "compact" : "default";',
  ];

  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing compact lead density token: ${token}`);
  }

  const requiredStyleTokens = [
    '.operator-health-card.operator-health-card-lead[data-operator-lead-summary-density="compact"] {',
    '.operator-health-card.operator-health-card-lead[data-operator-lead-summary-density="compact"]',
    '.operator-health-group-body.has-supporting-ledger',
    '"status title"',
    "display: flex;",
    "display: inline-flex;",
    "border-radius: 999px;",
    "white-space: nowrap;",
    "background: none;",
    "font-size: 0.64rem;",
  ];

  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing compact lead density token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("flatten into short inline chips"),
    "README missing compact lead chip note",
  );
  assert.ok(
    readmeSource.includes("Refresh first."),
    "README missing compact lead stale action note",
  );
  assert.ok(
    readmeSource.includes("pin `status + title` onto one top row"),
    "README missing compact lead incident-strip note",
  );
  assert.ok(
    operatorGuideSource.includes("flatten into short inline chips"),
    "operator guide missing compact lead chip note",
  );
  assert.ok(
    operatorGuideSource.includes("Refresh first."),
    "operator guide missing compact lead stale action note",
  );
  assert.ok(
    operatorGuideSource.includes("pin `status + title` onto one top row"),
    "operator guide missing compact lead incident-strip note",
  );
});
