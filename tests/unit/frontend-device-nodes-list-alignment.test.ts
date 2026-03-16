import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend presents device nodes as selectable cards with guided empty state", () => {
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
    'id="deviceNodeFleetSummary"',
    'id="deviceNodeFleetTotal"',
    'id="deviceNodeFleetOnline"',
    'id="deviceNodeFleetDegraded"',
    'id="deviceNodeFleetOffline"',
    'id="deviceNodeFleetStale"',
    'id="deviceNodeListFilter"',
    'id="deviceNodeListSort"',
    'id="deviceNodeListVisibleCount"',
    'id="deviceNodeListTotalCount"',
    'id="deviceNodeListHint"',
    'id="deviceNodeIntro"',
    'id="deviceNodeQuickStartHeading"',
    'id="deviceNodeGuideHeading"',
    'id="deviceNodeSnapshot"',
    'id="deviceNodeSnapshotCount"',
    'id="deviceNodeSnapshotGrid"',
    'id="deviceNodeSelectedIdentity"',
    'id="deviceNodeSelectedIdentityMeta"',
    'class="device-node-context-card"',
    'class="device-node-write-guard"',
    'class="device-node-write-guard-side"',
    'id="deviceNodeRoleMirror"',
    'id="deviceNodeWriteAccessTitle"',
    'id="deviceNodeWriteAccessHint"',
    'id="deviceNodeWriteAccessBadge"',
    'id="deviceNodePrimaryActionHint"',
    'id="deviceNodePrimarySummaryMode"',
    'id="deviceNodePrimarySummaryRole"',
    'class="device-node-primary-summary-strip"',
    'class="device-node-list-shell"',
    'class="device-node-list-shell-head"',
    'class="device-node-selection-strip"',
    'class="device-node-selection-card is-current"',
    'class="device-node-advanced-card device-node-advanced-card-actions"',
    'class="device-node-advanced-panel device-node-advanced-panel-context"',
    'class="device-node-advanced-panel device-node-advanced-panel-filters"',
    'class="events device-node-list"',
    'id="deviceNodeList"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing device-node list token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'deviceNodeListHint: document.getElementById("deviceNodeListHint")',
    'deviceNodeListFilter: document.getElementById("deviceNodeListFilter")',
    'deviceNodeListSort: document.getElementById("deviceNodeListSort")',
    'deviceNodeListVisibleCount: document.getElementById("deviceNodeListVisibleCount")',
    'deviceNodeListTotalCount: document.getElementById("deviceNodeListTotalCount")',
    'deviceNodeSnapshotCount: document.getElementById("deviceNodeSnapshotCount")',
    'deviceNodeSnapshotGrid: document.getElementById("deviceNodeSnapshotGrid")',
    'deviceNodeSelectedIdentity: document.getElementById("deviceNodeSelectedIdentity")',
    'deviceNodeSelectedIdentityMeta: document.getElementById("deviceNodeSelectedIdentityMeta")',
    'deviceNodeIntro: document.getElementById("deviceNodeIntro")',
    'deviceNodeQuickStartHeading: document.getElementById("deviceNodeQuickStartHeading")',
    'deviceNodeGuideHeading: document.getElementById("deviceNodeGuideHeading")',
    'deviceNodeRoleMirror: document.getElementById("deviceNodeRoleMirror")',
    'deviceNodeWriteAccessTitle: document.getElementById("deviceNodeWriteAccessTitle")',
    'deviceNodePrimaryShell: document.getElementById("deviceNodePrimaryShell")',
    'deviceNodePrimarySummaryMode: document.getElementById("deviceNodePrimarySummaryMode")',
    'deviceNodePrimarySummaryRole: document.getElementById("deviceNodePrimarySummaryRole")',
    'deviceNodeAdvancedControls: document.getElementById("deviceNodeAdvancedControls")',
    'deviceNodeAdvancedRoleChip: document.getElementById("deviceNodeAdvancedRoleChip")',
    '"deviceNodes.contextStrip.mode"',
    '"deviceNodes.contextStrip.target"',
    '"deviceNodes.contextStrip.registry"',
    '"deviceNodes.primary.guard.kicker"',
    '"deviceNodes.actions.upsertLocked"',
    '"deviceNodes.advanced.summary.role"',
    '"deviceNodes.listShell.kicker"',
    '"deviceNodes.listShell.heading"',
    'deviceNodeFleetTotal: document.getElementById("deviceNodeFleetTotal")',
    "DEVICE_NODE_STALE_AGE_MS",
    "function updateDeviceNodeSelectionMeta(node) {",
    "function normalizeOperatorRoleValue(value) {",
    "function syncOperatorRoleControls(nextRole = null) {",
    "function syncDeviceNodeActionSurfaces() {",
    "function setDeviceNodePrimaryShellOpen(isOpen, reason = \"manual\") {",
    "function setDeviceNodeAdvancedShellOpen(isOpen) {",
    "function selectDeviceNode(node, options = {}) {",
    "function syncDeviceNodeHeroState(nodeCount = 0) {",
    '"deviceNodes.selectionSummary.none"',
    '"deviceNodes.selectionSummary.emptyHint"',
    '"deviceNodes.selectionSummary.nodeId"',
    "function setDeviceNodeListStats(visibleCount, totalCount)",
    "function syncDeviceNodeSelectionUi(selectedNodeId)",
    "function normalizeDeviceNodeListFilter(value)",
    "function normalizeDeviceNodeListSort(value)",
    "function createDeviceNodeSnapshotRow(node, isSelected = false)",
    "row.setAttribute(\"role\", \"button\");",
    "row.addEventListener(\"keydown\", (event) => {",
    "event.key === \"Enter\" || event.key === \" \"",
    "function renderDeviceNodeSnapshot(visibleNodes, totalCount, selectedNodeId = null)",
    "function isDeviceNodeStale(node, nowMs = Date.now())",
    "function filterDeviceNodesForList(nodes, filterValue)",
    "function sortDeviceNodesForList(nodes, sortValue)",
    "function renderDeviceNodeFleetSummary(nodes)",
    "function formatDeviceNodeFleetPercent(part, total)",
    "function setDeviceNodeListHint(text)",
    "function renderDeviceNodeEmptyState()",
    "function renderDeviceNodeFilteredEmptyState(filterValue)",
    "renderDeviceNodeList(Array.from(state.deviceNodes.values()));",
    "function createDeviceNodeCard(node, isSelected)",
    'el.deviceNodeList.classList.toggle("is-compact", orderedVisibleNodes.length > 0 && orderedVisibleNodes.length <= 2);',
    't("deviceNodes.snapshot.empty"',
    't("deviceNodes.snapshot.emptyFiltered"',
    '"deviceNodes.snapshot.heading"',
    '"deviceNodes.snapshot.more"',
    't("deviceNodes.empty.title"',
    't("deviceNodes.filtered.title"',
    't("deviceNodes.actions.showAll"',
    '"deviceNodes.hints.empty"',
    '"deviceNodes.hints.filtered"',
    '"deviceNodes.hints.ready"',
    "applyDemoDeviceNodeTemplate",
    "getLocalizedDeviceNodeStatus(normalized)",
    "syncDeviceNodeSelectionUi(node.nodeId);",
    '"deviceNodes.card.current"',
    '"deviceNodes.card.checks"',
    "renderDeviceNodeSnapshot(orderedVisibleNodes, normalizedNodes.length, selected?.nodeId ?? null);",
    "card.className = \"device-node-card\";",
    "card.classList.add(\"is-selected\");",
    "el.deviceNodeListFilter.addEventListener(\"change\", () => {",
    "el.deviceNodeListSort.addEventListener(\"change\", () => {",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing device-node list token: ${token}`);
  }

  const requiredStyleTokens = [
    ".device-node-list-hint {",
    ".device-node-fleet-summary {",
    ".device-node-list-toolbar {",
    ".device-node-toolbar-controls {",
    ".device-node-context-card {",
    ".device-node-write-guard {",
    ".device-node-write-guard-side {",
    ".device-node-role-field {",
    ".device-node-primary-action-shell {",
    ".device-node-primary-shell > summary {",
    ".device-node-primary-summary-strip {",
    ".device-node-primary-body {",
    '.layout[data-active-tab="device-nodes"] .device-node-advanced-shell:not([open]) > summary {',
    '.layout[data-active-tab="device-nodes"] .device-node-primary-shell:not([open]) > summary {',
    ".device-node-list-shell {",
    ".device-node-list-shell-head {",
    ".device-node-filter-field {",
    ".device-node-sort-field {",
    ".device-node-list-stats {",
    ".device-node-selection-strip {",
    ".device-node-selection-card {",
    ".device-node-selection-subvalue {",
    ".device-node-advanced-summary-strip {",
    ".device-node-advanced-panel {",
    ".device-node-advanced-panel-copy {",
    ".device-node-advanced-panel-title {",
    ".device-node-advanced-panel-body {",
    ".device-node-snapshot {",
    ".device-node-snapshot-grid {",
    ".device-node-snapshot-row[role=\"button\"] {",
    ".device-node-snapshot-row[role=\"button\"]:focus-visible {",
    ".device-node-snapshot-row.is-selected {",
    ".device-node-fleet-card {",
    ".device-node-fleet-card.is-online {",
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes.is-populated .device-node-intro {',
    ".device-node-list {",
    '.layout[data-active-tab="device-nodes"] .device-node-list.is-compact {',
    ".device-node-empty-state {",
    ".device-node-empty-state-filtered {",
    ".device-node-empty-action {",
    ".device-node-empty-action-clear {",
    ".device-node-card {",
    ".device-node-card.is-selected {",
    ".device-node-card-footer {",
    ".device-node-card-selection {",
    ".device-node-card-action {",
    ".device-node-card-meta {",
    ".device-node-cap-pill {",
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes .device-node-stack {',
    '.layout[data-active-tab="device-nodes"] .device-node-advanced-grid {',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing device-node list token: ${token}`);
  }
  assert.match(
    stylesSource,
    /\.layout\[data-active-tab="device-nodes"\]\s+\.panel-device-nodes\s+\.device-node-stack\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1\.18fr\)\s+minmax\(360px,\s*0\.82fr\);/,
    "device-node stack should switch to a fleet-first desktop workspace when the tab is active",
  );
  assert.match(
    stylesSource,
    /\.layout\[data-active-tab="device-nodes"\]\s+\.device-node-fleet-shell\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1;/,
    "device-node fleet shell should own the first fold on desktop",
  );
  assert.match(
    stylesSource,
    /\.layout\[data-active-tab="device-nodes"\]\s+\.device-node-advanced-shell\s*\{[\s\S]*?grid-column:\s*1;/,
    "device-node advanced checks should anchor in the lower left lane on desktop",
  );
  assert.match(
    stylesSource,
    /\.layout\[data-active-tab="device-nodes"\]\s+\.device-node-primary-shell\s*\{[\s\S]*?grid-column:\s*2;/,
    "device-node admin editor should anchor in the lower right lane on desktop",
  );

  assert.ok(
    readmeSource.includes("fleet-first workspace"),
    "README missing device-node fleet-first note",
  );
  assert.ok(
    readmeSource.includes("human-readable context strip"),
    "README missing device-node context-strip note",
  );
  assert.ok(
    readmeSource.includes("role-aware write guard"),
    "README missing device-node role-aware write-guard note",
  );
  assert.ok(
    readmeSource.includes("`Quick node picker`"),
    "README missing device-node quick-picker note",
  );
  assert.ok(
    operatorGuideSource.includes("fleet-first workspace"),
    "operator guide missing device-node fleet-first note",
  );
  assert.ok(
    operatorGuideSource.includes("human-readable context strip"),
    "operator guide missing device-node context-strip note",
  );
  assert.ok(
    operatorGuideSource.includes("role-aware write guard"),
    "operator guide missing device-node role-aware write-guard note",
  );
  assert.ok(
    operatorGuideSource.includes("`Quick node picker`"),
    "operator guide missing device-node quick-picker note",
  );
  assert.ok(
    readmeSource.includes("collapsible admin editor"),
    "README missing device-node admin editor note",
  );
  assert.ok(
    readmeSource.includes("Once the fleet is populated"),
    "README missing populated-state compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("collapsible admin editor"),
    "operator guide missing device-node admin editor note",
  );
  assert.ok(
    operatorGuideSource.includes("Once the fleet is populated"),
    "operator guide missing populated-state compaction note",
  );
});
