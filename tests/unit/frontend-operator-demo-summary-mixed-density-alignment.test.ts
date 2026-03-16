import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator demo summary quiet tiles collapse independently during mixed desktop states", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function syncOperatorDemoSummaryDensity() {",
    'summaryCard.classList.toggle("is-quiet", isQuiet);',
    'const hasQuiet = quietCount > 0;',
    'el.operatorDemoSummaryStrip.dataset.summaryDensity = allQuiet ? "quiet" : hasQuiet ? "mixed" : "standard";',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing mixed demo-summary token: ${token}`);
  }

  const requiredStyleTokens = [
    '.panel-operator-console .operator-demo-summary-strip[data-summary-density="mixed"] {',
    '.panel-operator-console .operator-demo-summary-strip[data-summary-density="mixed"] .operator-demo-summary-card.is-quiet {',
    '.panel-operator-console .operator-demo-summary-strip[data-summary-density="mixed"] .operator-demo-summary-card.is-quiet .operator-demo-summary-copy,',
    '.panel-operator-console .operator-demo-summary-strip[data-summary-density="mixed"] .operator-demo-summary-card.is-quiet .operator-demo-summary-ledger {',
    '.panel-operator-console .operator-demo-summary-strip[data-summary-density="mixed"] .operator-demo-summary-card.is-quiet .status-pill {',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing mixed demo-summary token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("those quieter tiles now collapse on their own into mini ledger cards"),
    "README missing mixed demo-summary compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("those quieter tiles now collapse on their own into mini ledger cards"),
    "operator guide missing mixed demo-summary compaction note",
  );
});
