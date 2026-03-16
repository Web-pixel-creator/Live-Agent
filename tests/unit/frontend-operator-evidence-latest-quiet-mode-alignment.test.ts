import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator latest evidence view stays compact in non-fail desktop states", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function resolveOperatorEvidenceDrawerCompactRefreshFactValue(value) {",
    "function buildOperatorEvidenceDrawerLatestCompactFact(fact, details = {}) {",
    "function resolveOperatorEvidenceDrawerLatestFactsMode(details = {}) {",
    'compactFact.compactLabel = "Event";',
    '"No signal yet"',
    '"Awaiting"',
    'parts = [state.operatorSummaryUserRefreshed === true ? "Awaiting fresh signal" : "Refresh Summary first"];',
    'const latestFactsMode = resolveOperatorEvidenceDrawerLatestFactsMode({',
    "factsMode: latestFactsMode,",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing latest quiet mode token: ${token}`);
  }

  const requiredStyleTokens = [
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"][data-evidence-facts="compact"] .operator-evidence-drawer-facts {',
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"][data-evidence-facts="compact"] .operator-evidence-drawer-fact,',
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"][data-evidence-facts="compact"] .operator-evidence-drawer-fact-label {',
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"][data-evidence-facts="compact"] .operator-evidence-drawer-fact strong,',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing latest quiet mode token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("Latest` now also drops into the same compact fact mode outside fail-state"),
    "README missing latest quiet fact-mode note",
  );
  assert.ok(
    readmeSource.includes("No signal yet"),
    "README missing latest compact placeholder vocabulary note",
  );
  assert.ok(
    operatorGuideSource.includes("Latest` now also drops into the same compact fact mode outside fail-state"),
    "operator guide missing latest quiet fact-mode note",
  );
  assert.ok(
    operatorGuideSource.includes("No signal yet"),
    "operator guide missing latest compact placeholder vocabulary note",
  );
});
