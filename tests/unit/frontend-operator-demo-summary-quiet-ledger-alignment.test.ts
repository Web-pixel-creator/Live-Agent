import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator demo summary collapses into a quiet desktop ledger while all tiles are stale or awaiting", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function isOperatorDemoSummaryQuietStatus(statusNode) {",
    "function syncOperatorDemoSummaryDensity() {",
    'summaryCard.classList.toggle("is-quiet", isQuiet);',
    'const hasQuiet = quietCount > 0;',
    'el.operatorDemoSummaryStrip.dataset.summaryDensity = allQuiet ? "quiet" : hasQuiet ? "mixed" : "standard";',
    "syncOperatorDemoSummaryDensity();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing quiet-ledger token: ${token}`);
  }

  const requiredStyleTokens = [
    '.panel-operator-console .operator-demo-summary-strip[data-summary-density="quiet"] {',
    '.panel-operator-console .operator-demo-summary-strip[data-summary-density="quiet"] .operator-demo-summary-card {',
    '.panel-operator-console .operator-demo-summary-strip[data-summary-density="quiet"] .operator-demo-summary-copy,',
    '.panel-operator-console .operator-demo-summary-strip[data-summary-density="quiet"] .operator-demo-summary-ledger {',
    '.panel-operator-console .operator-demo-summary-strip[data-summary-density="quiet"] .operator-demo-summary-card .status-pill {',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing quiet-ledger token: ${token}`);
  }

  assert.ok(
    htmlSource.includes('id="operatorDemoSummaryStrip"') && htmlSource.includes('data-summary-density="quiet"'),
    "frontend html missing quiet-ledger first-paint seed",
  );

  assert.ok(
    readmeSource.includes("collapses again into a quieter six-tile ledger"),
    "README missing quiet-ledger compaction note",
  );
  assert.ok(
    readmeSource.includes("ships in that quieter desktop ledger posture from first paint"),
    "README missing quiet-ledger first-paint note",
  );
  assert.ok(
    operatorGuideSource.includes("collapses again into a quieter six-tile ledger"),
    "operator guide missing quiet-ledger compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("ships in that quieter desktop ledger posture from first paint"),
    "operator guide missing quiet-ledger first-paint note",
  );
});
