import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console compacts single-lead demo lanes into summary-plus-incident headers on desktop", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    'body.classList.remove("has-single-lead-card");',
    'group.classList.remove("has-single-lead-layout");',
    "const hasSingleVisibleCard = visibleCards.length === 1;",
    'group.classList.toggle("has-single-lead-layout", hasSingleVisibleCard);',
    'body.classList.toggle("has-single-lead-card", hasSingleVisibleCard);',
    'group.classList.contains("has-single-lead-layout")',
    'const preferredActionLabel = useCompactSummary ? compactActionLabel || actionLabel : actionLabel;',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing single-lead compaction token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-health-group.has-single-lead-layout:not(.is-collapsed):not(.has-supporting-ledger-layout) .operator-health-group-copy,",
    ".panel-operator-console .operator-health-group.has-single-lead-layout:not(.is-collapsed):not(.has-supporting-ledger-layout) .operator-health-group-preview {",
    ".panel-operator-console .operator-health-group.has-single-lead-layout:not(.is-collapsed):not(.has-supporting-ledger-layout) .operator-group-metrics {",
    ".panel-operator-console .operator-health-group-body.has-single-lead-card {",
    '.operator-health-group-body.has-single-lead-card\n    > .operator-health-card.operator-health-card-lead[data-operator-lead-summary-density="compact"] {',
    "display: inline-flex;",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing single-lead compaction token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("single visible lead signal"),
    "README missing single-lead lane compaction note",
  );
  assert.ok(
    readmeSource.includes("Run Negotiation first."),
    "README missing single-lead compact hint note",
  );
  assert.ok(
    operatorGuideSource.includes("single visible lead signal"),
    "operator guide missing single-lead lane compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("Run Negotiation first."),
    "operator guide missing single-lead compact hint note",
  );
});
