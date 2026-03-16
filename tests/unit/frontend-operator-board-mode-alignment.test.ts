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
    'class="operator-mode-copy-block"',
    'id="operatorSummaryGuide"',
    'id="operatorSummaryGuideRefreshBtn"',
    'id="operatorSummaryGuideRunNegotiationBtn"',
    'id="operatorSummaryGuideRunStoryBtn"',
    'class="operator-summary-guide-actions"',
    'id="operatorQuickStartRunNegotiationBtn"',
    'id="operatorQuickStartRunStoryBtn"',
    'id="operatorQuickStartRunUiTaskBtn"',
    'id="operatorQuickStartOpenDeviceNodesBtn"',
    'id="operatorQuickStartRefreshBtn"',
    'class="operator-quick-start-actions"',
    '<details id="operatorQuickStart" class="operator-quick-start operator-support-panel"',
    '<details id="operatorAdvancedControlSurfaces" class="operator-control-surfaces operator-support-panel"',
    '<details id="operatorScopeControls" class="operator-scope-controls operator-support-panel"',
    'id="operatorPlaybookRunNegotiationBtn"',
    'id="operatorPlaybookRefreshBridgeBtn"',
    'id="operatorPlaybookRunStoryBtn"',
    'id="operatorPlaybookRefreshStoryBtn"',
    'id="operatorPlaybookRunUiTaskBtn"',
    'id="operatorPlaybookRefreshUiBtn"',
    'id="operatorPlaybookOpenDeviceNodesBtn"',
    'id="operatorPlaybookRefreshDeviceNodesBtn"',
    '<details id="operatorLanePlaybook" class="operator-lane-playbook operator-support-panel"',
    'class="operator-support-summary-title"',
    'class="operator-support-summary-hint"',
    'class="actions operator-toolbar"',
    'id="operatorBoardActions"',
    "Board Actions",
    'class="actions operator-advanced-actions-row operator-board-actions-row"',
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
    "OPERATOR_BOARD_MODE_STORAGE_KEY",
    "readStoredOperatorBoardMode",
    "mla.demoFrontend.operatorBoardMode",
    'operatorDemoViewBtn: document.getElementById("operatorDemoViewBtn")',
    'operatorFullOpsViewBtn: document.getElementById("operatorFullOpsViewBtn")',
    'operatorBoardModeHint: document.getElementById("operatorBoardModeHint")',
    'operatorModeBanner: document.getElementById("operatorModeBanner")',
    'operatorModeBadge: document.getElementById("operatorModeBadge")',
    'operatorModeCopy: document.getElementById("operatorModeCopy")',
    'operatorSummaryGuide: document.getElementById("operatorSummaryGuide")',
    'operatorSummaryGuideRefreshBtn: document.getElementById("operatorSummaryGuideRefreshBtn")',
    'operatorSummaryGuideRunNegotiationBtn: document.getElementById("operatorSummaryGuideRunNegotiationBtn")',
    'operatorSummaryGuideRunStoryBtn: document.getElementById("operatorSummaryGuideRunStoryBtn")',
    'operatorAdvancedControlSurfaces: document.getElementById("operatorAdvancedControlSurfaces")',
    'operatorQuickStartRunNegotiationBtn: document.getElementById("operatorQuickStartRunNegotiationBtn")',
    'operatorQuickStartRunStoryBtn: document.getElementById("operatorQuickStartRunStoryBtn")',
    'operatorQuickStartRunUiTaskBtn: document.getElementById("operatorQuickStartRunUiTaskBtn")',
    'operatorQuickStartOpenDeviceNodesBtn: document.getElementById("operatorQuickStartOpenDeviceNodesBtn")',
    'operatorQuickStartRefreshBtn: document.getElementById("operatorQuickStartRefreshBtn")',
    'operatorPlaybookRunNegotiationBtn: document.getElementById("operatorPlaybookRunNegotiationBtn")',
    'operatorPlaybookRefreshBridgeBtn: document.getElementById("operatorPlaybookRefreshBridgeBtn")',
    'operatorPlaybookRunStoryBtn: document.getElementById("operatorPlaybookRunStoryBtn")',
    'operatorPlaybookRefreshStoryBtn: document.getElementById("operatorPlaybookRefreshStoryBtn")',
    'operatorPlaybookRunUiTaskBtn: document.getElementById("operatorPlaybookRunUiTaskBtn")',
    'operatorPlaybookRefreshUiBtn: document.getElementById("operatorPlaybookRefreshUiBtn")',
    'operatorPlaybookOpenDeviceNodesBtn: document.getElementById("operatorPlaybookOpenDeviceNodesBtn")',
    'operatorPlaybookRefreshDeviceNodesBtn: document.getElementById("operatorPlaybookRefreshDeviceNodesBtn")',
    "function openDeviceNodesFromOperatorQuickStart()",
    "const parentControlSurfaces = panel.closest(\".operator-control-surfaces-body\")?.parentElement;",
    "function normalizeOperatorBoardMode(value)",
    "function syncOperatorBoardModeButtons()",
    "function syncOperatorSummaryGuide()",
    "function applyOperatorDemoGroupPreset()",
    "function setOperatorBoardMode(mode, options = {})",
    "window.localStorage?.setItem(OPERATOR_BOARD_MODE_STORAGE_KEY, nextMode);",
    "el.operatorModeBanner.classList.toggle(\"is-demo\", isDemo);",
    "el.operatorModeBanner.classList.toggle(\"is-full-ops\", !isDemo);",
    "setStatusPill(el.operatorModeBadge, isDemo ? \"Demo view\" : \"Full ops\", isDemo ? \"ok\" : \"neutral\");",
    "function isOperatorDemoEssentialCard(card)",
    "state.operatorBoardMode === \"demo\" && state.operatorFocusCriticalOnly === true && !isOperatorDemoEssentialCard(card)",
    'setOperatorBoardMode(requestedMode, { syncPresets: false, persist: persistMode });',
    "resetOperatorBoardView({ mode: readStoredOperatorBoardMode(), persistMode: false });",
    "el.operatorDemoViewBtn.addEventListener(\"click\", () => {",
    "setOperatorBoardMode(\"demo\");",
    "el.operatorFullOpsViewBtn.addEventListener(\"click\", () => {",
    "setOperatorBoardMode(\"full\");",
    "el.operatorSummaryGuideRefreshBtn.addEventListener(\"click\", () => {",
    "void refreshOperatorSummary({ markUserRefresh: true });",
    "el.operatorSummaryGuideRunNegotiationBtn.addEventListener(\"click\", () => {",
    "openOperatorSupportPanel(el.operatorQuickStart, el.operatorQuickStartRunNegotiationBtn);",
    "el.operatorSummaryGuideRunStoryBtn.addEventListener(\"click\", () => {",
    "openOperatorSupportPanel(el.operatorLanePlaybook, el.operatorPlaybookRunNegotiationBtn);",
    "el.operatorQuickStartRunNegotiationBtn.addEventListener(\"click\", () => {",
    "el.operatorQuickStartRunStoryBtn.addEventListener(\"click\", () => {",
    "el.operatorQuickStartRunUiTaskBtn.addEventListener(\"click\", () => {",
    "el.operatorQuickStartOpenDeviceNodesBtn.addEventListener(\"click\", () => {",
    "openDeviceNodesFromOperatorQuickStart();",
    "setActiveTab(\"device-nodes\");",
    "el.operatorQuickStartRefreshBtn.addEventListener(\"click\", () => {",
    "el.operatorPlaybookRunNegotiationBtn.addEventListener(\"click\", () => {",
    "el.operatorPlaybookRefreshBridgeBtn.addEventListener(\"click\", () => {",
    "el.operatorPlaybookRunStoryBtn.addEventListener(\"click\", () => {",
    "el.operatorPlaybookRefreshStoryBtn.addEventListener(\"click\", () => {",
    "el.operatorPlaybookRunUiTaskBtn.addEventListener(\"click\", () => {",
    "el.operatorPlaybookRefreshUiBtn.addEventListener(\"click\", () => {",
    "el.operatorPlaybookOpenDeviceNodesBtn.addEventListener(\"click\", () => {",
    "el.operatorPlaybookRefreshDeviceNodesBtn.addEventListener(\"click\", () => {",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-board-mode token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-view-mode-actions {",
    ".operator-toolbar {",
    ".operator-board-actions {",
    ".operator-board-actions-row {",
    ".operator-view-mode-actions .button-muted {",
    ".operator-board-mode-hint {",
    ".operator-mode-copy-block {",
    ".operator-mode-banner {",
    ".operator-mode-banner.is-full-ops {",
    ".operator-mode-copy {",
    ".operator-summary-guide {",
    ".operator-summary-guide-actions {",
    ".operator-status-strip {",
    "grid-template-columns: minmax(178px, auto) minmax(0, 1fr);",
    ".panel-operator-console .operator-mode-banner .status-pill {",
    ".operator-control-surfaces {",
    ".operator-control-surfaces-body {",
    ".operator-scope-controls-body {",
    ".operator-quick-start {",
    ".operator-support-panel {",
    ".operator-support-panel > summary {",
    ".operator-support-summary-title {",
    ".operator-support-summary-hint {",
    ".operator-quick-start-body {",
    ".operator-quick-start-actions {",
    ".operator-lane-playbook {",
    ".operator-lane-playbook-body {",
    ".operator-lane-playbook-card {",
    ".operator-summary-guide.is-hidden {",
    ".operator-health-board.is-demo-view .operator-health-card[data-operator-demo-essential] {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-board-mode token: ${token}`);
  }

  assert.ok(!stylesSource.includes('"boardhint boardhint"'), "frontend styles still keep a separate boardhint row");
  assert.ok(!stylesSource.includes('grid-area: boardhint;'), "frontend styles still assign a dedicated boardhint area");
  assert.match(
    stylesSource,
    /@media \(max-width: 620px\)\s*\{[\s\S]*?\.panel-operator-console \.operator-mode-copy-block \{\s*display: none;/,
    "frontend styles missing mobile operator mode-banner compaction",
  );

  assert.ok(
    readmeSource.includes("`Demo View` (default, critical-first) and `Full Ops View`"),
    "README missing operator board-mode note",
  );
  assert.ok(
    readmeSource.includes("keeps eight judge-facing cards visible by default"),
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
    readmeSource.includes("one primary refresh CTA plus calmer handoff buttons (`Open Quick Start`, `Recovery Playbook`)"),
    "README missing operator summary guide handoff note",
  );
  assert.ok(readmeSource.includes("collapsible `Quick Start` rail"), "README missing operator quick-start rail note");
  assert.ok(
    readmeSource.includes("collapsed `Board Actions` block"),
    "README missing operator board-actions compacting note",
  );
  assert.ok(readmeSource.includes("collapsible `Recovery Playbook` cards"), "README missing operator lane playbook note");
  assert.ok(
    readmeSource.includes("collapsible `Advanced Controls` drawer"),
    "README missing advanced controls drawer note",
  );
  assert.ok(
    readmeSource.includes("collapsible `Scope & Access` panel"),
    "README missing operator scope-and-access note",
  );
  assert.ok(
    readmeSource.includes("mode banner (`Demo view` / `Full ops`)"),
    "README missing operator mode-banner note",
  );
  assert.ok(
    readmeSource.includes("same compact status shell as `Last refresh`"),
    "README missing compact status-shell note",
  );
  assert.ok(
    readmeSource.includes("status shell now flattens further into a shorter incident line"),
    "README missing desktop status-line compaction note",
  );
  assert.ok(
    readmeSource.includes("mode banner collapses to the status badge"),
    "README missing mobile mode-banner compaction note",
  );
  assert.ok(
    readmeSource.includes("mla.demoFrontend.operatorBoardMode"),
    "README missing operator board-mode persistence note",
  );
  assert.ok(
    operatorGuideSource.includes("`Demo View` (default) keeps Operator Console in critical-first mode"),
    "operator guide missing operator board-mode note",
  );
  assert.ok(
    operatorGuideSource.includes("same compact status shell as `Last refresh`"),
    "operator guide missing compact status-shell note",
  );
  assert.ok(
    operatorGuideSource.includes("mode banner collapses to the status badge"),
    "operator guide missing mobile mode-banner compaction note",
  );
  assert.ok(
    operatorGuideSource.includes(
      "prioritizes eight cards (`Live Bridge`, `Queue`, `Approvals`, `Startup`, `UI Executor`, `Workflow Runtime`, `Runtime Guardrails`, `Device Nodes`)",
    ),
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
    operatorGuideSource.includes("one-click `Refresh Summary`, calmer handoff buttons (`Open Quick Start`, `Recovery Playbook`)"),
    "operator guide missing operator summary guide handoff note",
  );
  assert.ok(
    operatorGuideSource.includes("collapsible `Quick Start` rail"),
    "operator guide missing operator quick-start rail note",
  );
  assert.ok(
    operatorGuideSource.includes("collapsed `Board Actions` block"),
    "operator guide missing operator board-actions compacting note",
  );
  assert.ok(
    operatorGuideSource.includes("collapsible `Recovery Playbook` cards"),
    "operator guide missing operator lane playbook note",
  );
  assert.ok(
    operatorGuideSource.includes("collapsible `Advanced Controls` drawer"),
    "operator guide missing advanced controls drawer note",
  );
  assert.ok(
    operatorGuideSource.includes("collapsible `Scope & Access` keeps `Operator Role`, `Task ID`, and `Target Service`"),
    "operator guide missing operator scope-and-access note",
  );
  assert.ok(
    operatorGuideSource.includes("mode banner (`Demo view` / `Full ops`) now shares the same compact status shell as `Last refresh`"),
    "operator guide missing operator mode-banner note",
  );
  assert.ok(
    operatorGuideSource.includes("status shell flattens again into a shorter incident line"),
    "operator guide missing desktop status-line compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("mla.demoFrontend.operatorBoardMode"),
    "operator guide missing operator board-mode persistence note",
  );
});
