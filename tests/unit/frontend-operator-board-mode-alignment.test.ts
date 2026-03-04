import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes demo/full board mode toggles with runtime presets", () => {
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
    'id="operatorDemoViewBtn"',
    'id="operatorFullOpsViewBtn"',
    'id="operatorBoardModeHint"',
    'id="operatorModeBanner"',
    'id="operatorModeBadge"',
    'id="operatorModeCopy"',
    'id="operatorSummaryGuide"',
    'id="operatorSummaryGuideRefreshBtn"',
    "data-operator-demo-essential",
    "Demo View",
    "Full Ops View",
    'class="action-group operator-view-mode-actions"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-board-mode token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorBoardMode: "demo"',
    'operatorDemoViewBtn: document.getElementById("operatorDemoViewBtn")',
    'operatorFullOpsViewBtn: document.getElementById("operatorFullOpsViewBtn")',
    'operatorBoardModeHint: document.getElementById("operatorBoardModeHint")',
    'operatorModeBanner: document.getElementById("operatorModeBanner")',
    'operatorModeBadge: document.getElementById("operatorModeBadge")',
    'operatorModeCopy: document.getElementById("operatorModeCopy")',
    'operatorSummaryGuide: document.getElementById("operatorSummaryGuide")',
    'operatorSummaryGuideRefreshBtn: document.getElementById("operatorSummaryGuideRefreshBtn")',
    "function normalizeOperatorBoardMode(value)",
    "function syncOperatorBoardModeButtons()",
    "function syncOperatorSummaryGuide()",
    "function applyOperatorDemoGroupPreset()",
    "function setOperatorBoardMode(mode, options = {})",
    "el.operatorModeBanner.classList.toggle(\"is-demo\", isDemo);",
    "el.operatorModeBanner.classList.toggle(\"is-full-ops\", !isDemo);",
    "setStatusPill(el.operatorModeBadge, isDemo ? \"demo_view\" : \"full_ops_view\", isDemo ? \"ok\" : \"neutral\");",
    "function isOperatorDemoEssentialCard(card)",
    "state.operatorBoardMode === \"demo\" && state.operatorFocusCriticalOnly === true && !isOperatorDemoEssentialCard(card)",
    'setOperatorBoardMode("demo", { syncPresets: false });',
    "el.operatorDemoViewBtn.addEventListener(\"click\", () => {",
    "setOperatorBoardMode(\"demo\");",
    "el.operatorFullOpsViewBtn.addEventListener(\"click\", () => {",
    "setOperatorBoardMode(\"full\");",
    "el.operatorSummaryGuideRefreshBtn.addEventListener(\"click\", () => {",
    "void refreshOperatorSummary({ markUserRefresh: true });",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-board-mode token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-view-mode-actions {",
    ".operator-view-mode-actions .button-muted {",
    ".operator-board-mode-hint {",
    ".operator-mode-banner {",
    ".operator-mode-banner.is-full-ops {",
    ".operator-mode-copy {",
    ".operator-summary-guide {",
    ".operator-summary-guide.is-hidden {",
    ".operator-health-board.is-demo-view .operator-health-card[data-operator-demo-essential] {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-board-mode token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Demo View` (default, critical-first) and `Full Ops View`"),
    "README missing operator board-mode note",
  );
  assert.ok(
    readmeSource.includes("keeps six judge-facing cards visible by default"),
    "README missing operator demo essential-cards note",
  );
  assert.ok(
    readmeSource.includes("keeps `Live Bridge & Turn Safety` lane expanded by default"),
    "README missing operator demo default-expanded lane note",
  );
  assert.ok(
    readmeSource.includes("guided pre-refresh banner"),
    "README missing operator summary guide note",
  );
  assert.ok(
    readmeSource.includes("mode banner (`demo_view` / `full_ops_view`)"),
    "README missing operator mode-banner note",
  );
  assert.ok(
    operatorGuideSource.includes("`Demo View` (default) keeps Operator Console in critical-first mode"),
    "operator guide missing operator board-mode note",
  );
  assert.ok(
    operatorGuideSource.includes("prioritizes six cards (`Live Bridge`, `Queue`, `Approvals`, `Startup`, `UI Executor`, `Device Nodes`)"),
    "operator guide missing operator demo essential-cards note",
  );
  assert.ok(
    operatorGuideSource.includes("keeps `Live Bridge & Turn Safety` expanded by default"),
    "operator guide missing operator demo default-expanded lane note",
  );
  assert.ok(
    operatorGuideSource.includes("guided pre-refresh banner"),
    "operator guide missing operator summary guide note",
  );
  assert.ok(
    operatorGuideSource.includes("mode banner (`demo_view` / `full_ops_view`) confirms active triage scope"),
    "operator guide missing operator mode-banner note",
  );
});
