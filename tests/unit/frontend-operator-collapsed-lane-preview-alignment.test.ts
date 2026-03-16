import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console collapsed lanes reduce to compact preview pills", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    'class="operator-health-group-collapsed-preview" data-operator-group-collapsed-preview',
    'class="operator-health-group-collapsed-pill is-muted"',
    'class="operator-health-group-collapsed-pill-label">Status</span>',
    'class="operator-health-group-collapsed-pill-value">Awaiting refresh</strong>',
    'id="operatorGroupGovernanceEvidence" class="operator-health-group is-collapsed"',
    'id="operatorGroupRuntimeDevice" class="operator-health-group is-collapsed"',
    'id="operatorGroupQueueLifecycle" class="operator-health-group is-collapsed"',
    'aria-controls="operator-group-governance-evidence-body"',
    'aria-controls="operator-group-runtime-device-body"',
    'aria-controls="operator-group-queue-lifecycle-body"',
    "Open lane",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing collapsed lane preview token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'toggle.textContent = isCollapsed ? "Open lane" : "Hide details";',
    "function createOperatorGroupCollapsedPreviewPill(config) {",
    "function syncOperatorGroupCollapsedPreview(group, config) {",
    "const staleCards = activeCards.filter((card) => card.statusCode === \"summary_stale\");",
    "previewNode.classList.toggle(\"is-stale\", previewState === \"stale\");",
    "syncOperatorGroupCollapsedPreview(group, {",
    'collapsedStateLabel = "Steady";',
    '{ label: "Status", value: collapsedStateLabel, tone: collapsedStateTone },',
    '{ label: "Focus", value: collapsedFocusValue, tone: collapsedFocusTone },',
    'label: "Coverage",',
    '`${visible} visible${hidden > 0 ? ` / ${hidden} hidden` : ""}`',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing collapsed lane preview token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-health-group-collapsed-preview {",
    ".panel-operator-console .operator-health-group-collapsed-pill {",
    ".panel-operator-console .operator-health-group-collapsed-pill-label {",
    ".panel-operator-console .operator-health-group-collapsed-pill-value {",
    ".panel-operator-console .operator-health-group-collapsed-pill.is-fail {",
    ".panel-operator-console .operator-health-group.is-collapsed .operator-health-group-copy,",
    ".panel-operator-console .operator-health-group.is-collapsed .operator-health-group-collapsed-preview {",
    ".panel-operator-console .operator-health-group.is-collapsed .operator-health-group-title-row {",
    ".panel-operator-console .operator-health-group.is-collapsed .operator-health-group-collapsed-preview {",
    ".panel-operator-console .operator-health-group.is-collapsed .operator-health-group-collapsed-pill {",
    ".panel-operator-console .operator-health-group.is-collapsed .operator-health-group-kicker {",
    ".panel-operator-console .operator-health-group.is-collapsed .operator-health-group-summary-strip {",
    '.panel-operator-console .operator-health-group.is-collapsed[data-operator-group-state="dormant"] .operator-health-group-collapsed-pill:nth-child(3),',
    '.panel-operator-console .operator-health-group.is-collapsed[data-operator-group-state="ok"] .operator-health-group-collapsed-pill:nth-child(3) {',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing collapsed lane preview token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("Collapsed nominal lanes now reduce to compact lane previews with `Status`, `Focus`, and `Coverage` pills"),
    "README missing collapsed lane preview note",
  );
  assert.ok(
    operatorGuideSource.includes("Collapsed nominal lanes now reduce to compact lane previews with `Status`, `Focus`, and `Coverage` pills"),
    "operator guide missing collapsed lane preview note",
  );
  assert.ok(
    readmeSource.includes("drop the kicker and extra summary strip"),
    "README missing quieter collapsed lane note",
  );
  assert.ok(
    readmeSource.includes("static HTML shell"),
    "README missing pre-refresh static shell note",
  );
  assert.ok(
    operatorGuideSource.includes("drop the kicker and extra summary strip"),
    "operator guide missing quieter collapsed lane note",
  );
  assert.ok(
    operatorGuideSource.includes("static HTML shell"),
    "operator guide missing pre-refresh static shell note",
  );
});
