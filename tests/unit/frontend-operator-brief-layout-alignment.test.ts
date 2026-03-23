import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console keeps a persistent operator brief with focus-driven first fold", () => {
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
    'class="panel panel-operator-console"',
    'id="operatorSummaryGuideStatus"',
    'id="operatorSummaryGuideMeta"',
    'id="operatorSummaryGuidePreview"',
    'id="operatorSummaryGuidePreviewFocusValue"',
    'id="operatorSummaryGuidePreviewOpenValue"',
    'id="operatorSummaryGuidePreviewRecoverValue"',
    'id="operatorSummaryGuideWatchlist"',
    "Operator brief",
    "Focus",
    "Recover",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-brief token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorSummaryGuideStatus: document.getElementById("operatorSummaryGuideStatus")',
    'operatorSummaryGuideMeta: document.getElementById("operatorSummaryGuideMeta")',
    'operatorSummaryGuidePreview: document.getElementById("operatorSummaryGuidePreview")',
    'operatorSummaryGuidePreviewFocusValue: document.getElementById("operatorSummaryGuidePreviewFocusValue")',
    'operatorSummaryGuidePreviewOpenValue: document.getElementById("operatorSummaryGuidePreviewOpenValue")',
    'operatorSummaryGuidePreviewRecoverValue: document.getElementById("operatorSummaryGuidePreviewRecoverValue")',
    'operatorSummaryGuideWatchlist: document.getElementById("operatorSummaryGuideWatchlist")',
    "const OPERATOR_SUMMARY_GUIDE_SIGNAL_PRIORITIES = Object.freeze([",
    "function getOperatorSummaryGuideSignals()",
    "function formatOperatorSummaryGuideLabelList(items, maxItems = 2)",
    "function syncOperatorSummaryGuidePreview(activeSavedView, presentation) {",
    "function renderOperatorSummaryGuideWatchlist(items, fallbackText = \"Refresh summary first\")",
    'watchShell.dataset.watchState = watchItems.length > 0 ? "active" : "empty";',
    "watchShell.hidden = watchItems.length === 0;",
    'el.operatorSummaryGuide.dataset.operatorVariant = nextVariant;',
    'el.operatorSummaryGuidePreview.dataset.workspace = workspaceId;',
    'el.operatorSummaryGuidePreviewFocusValue.textContent = focusValue;',
    'el.operatorSummaryGuidePreviewOpenValue.textContent = openValue;',
    'el.operatorSummaryGuidePreviewRecoverValue.textContent = recoverValue;',
    "syncOperatorSummaryGuidePreview(activeSavedView, workspacePresentation);",
    "renderOperatorSummaryGuideWatchlist(nextWatchItems",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-brief token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console {",
    "display: grid;",
    "grid-template-areas:",
    '"status guide"',
    ".operator-summary-guide-head {",
    ".operator-summary-guide-status-row {",
    ".panel-operator-console .operator-summary-guide-preview {",
    ".panel-operator-console .operator-summary-guide-preview-item {",
    ".panel-operator-console .operator-summary-guide-preview-label {",
    ".panel-operator-console .operator-summary-guide-preview-value {",
    '.operator-summary-guide-watch[data-watch-state="empty"] {',
    ".operator-summary-guide-watchlist {",
    ".operator-summary-guide-watch-chip {",
    ".panel-operator-console .operator-signal-strip {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-brief token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("persistent `Operator brief`"),
    "README missing operator brief layout note",
  );
  assert.ok(
    readmeSource.includes("compact focus chips"),
    "README missing operator focus-chip note",
  );
  assert.ok(
    readmeSource.includes("workspace-aware `Focus / Open / Recover` preview row"),
    "README missing operator workspace preview-row note",
  );
  assert.ok(
    operatorGuideSource.includes("persistent `Operator brief`"),
    "operator guide missing operator brief layout note",
  );
  assert.ok(
    operatorGuideSource.includes("compact focus chips"),
    "operator guide missing operator focus-chip note",
  );
  assert.ok(
    operatorGuideSource.includes("workspace-aware `Focus / Open / Recover` preview row"),
    "operator guide missing operator workspace preview-row note",
  );
});
