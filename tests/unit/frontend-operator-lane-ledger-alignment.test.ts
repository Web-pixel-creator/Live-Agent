import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console expanded demo lanes group supporting signals into a quiet evidence ledger", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function ensureOperatorSupportingLedger(group) {",
    'ledger.className = "operator-health-supporting-ledger";',
    'title.textContent = "Other evidence";',
    'copy.textContent = "Select a supporting signal to inspect it in the focused drawer without reopening a deeper surface.";',
    "function syncOperatorGroupSupportingLedger(group) {",
    'group.classList.remove("has-supporting-ledger-layout", "has-single-supporting-ledger-layout");',
    'body.classList.add("has-supporting-ledger");',
    'body.classList.toggle("has-single-supporting-ledger", supportingCards.length === 1);',
    'group.classList.add("has-supporting-ledger-layout");',
    'group.classList.toggle("has-single-supporting-ledger-layout", supportingCards.length === 1);',
    'ledger.classList.toggle("is-single-signal", supportingCards.length === 1);',
    "list.replaceChildren(...supportingCards);",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing lane ledger token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-health-group.has-supporting-ledger-layout:not(.is-collapsed) {",
    ".panel-operator-console .operator-health-group.has-supporting-ledger-layout:not(.is-collapsed) .operator-health-group-copy,",
    ".panel-operator-console .operator-health-group.has-supporting-ledger-layout:not(.is-collapsed) .operator-health-group-preview {",
    ".panel-operator-console .operator-health-group.has-supporting-ledger-layout:not(.is-collapsed) .operator-health-group-summary-strip {",
    ".panel-operator-console .operator-health-group.has-supporting-ledger-layout:not(.is-collapsed) .operator-health-supporting-ledger-head {",
    ".panel-operator-console .operator-health-group.has-supporting-ledger-layout:not(.is-collapsed) .operator-group-metric-pill.is-ok,",
    ".panel-operator-console .operator-health-group.has-supporting-ledger-layout:not(.is-collapsed) .operator-group-metric-pill.is-hidden {",
    ".panel-operator-console .operator-health-group.has-supporting-ledger-layout:not(.is-collapsed) .operator-group-metrics {",
    ".panel-operator-console .operator-health-group-body.has-supporting-ledger {",
    ".panel-operator-console .operator-health-group-body.has-single-supporting-ledger {",
    '.operator-health-group-body.has-supporting-ledger\n    > .operator-health-card.operator-health-card-lead.has-compact-lead-shell[data-operator-lead-summary-count="2"] {',
    ".panel-operator-console .operator-health-supporting-ledger {",
    ".panel-operator-console .operator-health-supporting-ledger.is-single-signal .operator-health-supporting-ledger-head {",
    ".panel-operator-console .operator-health-supporting-ledger-head {",
    ".panel-operator-console .operator-health-supporting-ledger-copy {",
    ".panel-operator-console .operator-health-supporting-ledger-list {",
    ".panel-operator-console .operator-health-supporting-ledger .operator-health-card.operator-health-card-supporting {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing lane ledger token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("quiet `Other evidence` ledger"),
    "README missing supporting ledger note",
  );
  assert.ok(
    readmeSource.includes("row-based signal list"),
    "README missing desktop row-ledger note",
  );
  assert.ok(
    readmeSource.includes("drop the extra lane-copy"),
    "README missing compact lane header note",
  );
  assert.ok(
    readmeSource.includes("drop the header summary-chip strip entirely"),
    "README missing compact ledger summary-strip note",
  );
  assert.ok(
    readmeSource.includes("drops its helper header entirely once the lane is open"),
    "README missing compact ledger helper-header note",
  );
  assert.ok(
    readmeSource.includes("Ok` / `Hidden` counter pills drop out"),
    "README missing tighter ledger shell note",
  );
  assert.ok(
    readmeSource.includes("one lead issue + compact evidence list"),
    "README missing compact evidence list note",
  );
  assert.ok(
    operatorGuideSource.includes("quiet `Other evidence` ledger"),
    "operator guide missing supporting ledger note",
  );
  assert.ok(
    operatorGuideSource.includes("row-based signal list"),
    "operator guide missing desktop row-ledger note",
  );
  assert.ok(
    operatorGuideSource.includes("drop the extra lane-copy"),
    "operator guide missing compact lane header note",
  );
  assert.ok(
    operatorGuideSource.includes("drop the header summary-chip strip entirely"),
    "operator guide missing compact ledger summary-strip note",
  );
  assert.ok(
    operatorGuideSource.includes("drops its helper header entirely once the lane is open"),
    "operator guide missing compact ledger helper-header note",
  );
  assert.ok(
    operatorGuideSource.includes("Ok` / `Hidden` counter pills drop out"),
    "operator guide missing tighter ledger shell note",
  );
  assert.ok(
    operatorGuideSource.includes("one lead issue + compact evidence list"),
    "operator guide missing compact evidence list note",
  );
});
