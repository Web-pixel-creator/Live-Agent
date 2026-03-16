import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("device nodes keeps quick-start first fold and advanced controls collapsed", () => {
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
    'class="device-node-hero"',
    'id="deviceNodeIntro"',
    'id="deviceNodeQuickStartKicker"',
    'id="deviceNodeQuickStartHeading"',
    'id="deviceNodeQuickStartCopy"',
    'id="deviceNodeSelectionGuide"',
    'id="deviceNodeGuideKicker"',
    'id="deviceNodeGuideHeading"',
    'id="deviceNodeGuideCopy"',
    'id="deviceNodeGuideMuted"',
    'class="device-node-guide-rail"',
    'class="device-node-guide-chip"',
    'class="device-node-context-card"',
    'class="device-node-context-label"',
    'class="device-node-primary-shell"',
    'class="device-node-primary-summary-copy"',
    'class="device-node-primary-summary-strip"',
    'id="deviceNodePrimarySummaryKicker"',
    'id="deviceNodePrimarySummaryHeading"',
    'id="deviceNodePrimarySummaryHint"',
    'id="deviceNodePrimarySummaryMode"',
    'id="deviceNodePrimarySummaryRole"',
    'class="device-node-primary-body"',
    'class="device-node-write-guard"',
    'class="device-node-write-guard-side"',
    'id="deviceNodeRoleMirror"',
    'id="deviceNodeWriteAccessKicker"',
    'id="deviceNodeRoleFieldLabel"',
    'id="deviceNodeWriteAccessTitle"',
    'id="deviceNodeWriteAccessHint"',
    'id="deviceNodeWriteAccessBadge"',
    'id="deviceNodePrimaryActionHint"',
    'class="device-node-primary-action-shell device-node-actions-primary"',
    'class="actions device-node-actions device-node-actions-support"',
    'class="device-node-fleet-shell"',
    'class="device-node-selection-strip"',
    'class="device-node-selection-card is-current"',
    'id="deviceNodeSelectionStrip"',
    'class="device-node-selection-subvalue"',
    'class="device-node-list-shell"',
    'class="device-node-list-shell-head"',
    'class="device-node-list-shell-rail"',
    'id="deviceNodeListShellRail"',
    'class="device-node-list-actions"',
    'id="deviceNodeCreateAction"',
    'id="deviceNodeStack"',
    'id="deviceNodeAdvancedControls"',
    'id="deviceNodeAdvancedRoleChip"',
    'id="deviceNodeAdvancedTargetChip"',
    'class="device-node-advanced-summary-strip"',
    'class="device-node-advanced-grid"',
    'class="device-node-advanced-card device-node-advanced-card-actions"',
    'class="device-node-advanced-inline-notes"',
    'class="device-node-advanced-inline-note"',
    'class="device-node-advanced-panel device-node-advanced-panel-context"',
    'class="device-node-advanced-panel device-node-advanced-panel-filters"',
    "device-node-actions-primary",
    "device-node-actions-secondary",
    "Targeted checks",
    "Register one node first",
    "Watch health and select a node",
    "Heartbeat payload",
    "Run checks",
    "Fleet view",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `device-node html missing ux token: ${token}`);
  }

  const heroIndex = htmlSource.indexOf('class="device-node-hero"');
  const fleetIndex = htmlSource.indexOf('class="device-node-fleet-shell"');
  const advancedIndex = htmlSource.indexOf('id="deviceNodeAdvancedControls"');
  const primaryIndex = htmlSource.indexOf('class="device-node-primary-shell"');
  assert.ok(heroIndex >= 0 && fleetIndex > heroIndex, "device-node quick-start hero should render before the fleet");
  assert.ok(advancedIndex > fleetIndex, "device-node advanced controls should render after the fleet");
  assert.ok(primaryIndex > advancedIndex, "device-node admin editor should render after targeted checks");

  const requiredRuntimeTokens = [
    "Quick start: seed one demo node, create or update it, then refresh the fleet.",
    "Register one node first, then read the fleet. Deep checks stay in Targeted checks.",
    '"deviceNodes.primary.kicker"',
    '"deviceNodes.populated.intro"',
    '"deviceNodes.populated.quickStart.kicker"',
    '"deviceNodes.populated.guide.kicker"',
    '"deviceNodes.contextStrip.mode"',
    '"deviceNodes.contextStrip.target"',
    '"deviceNodes.contextStrip.registry"',
    '"deviceNodes.guide.write"',
    '"deviceNodes.guide.verify"',
    '"deviceNodes.primary.guard.kicker"',
    '"deviceNodes.primary.empty.kicker"',
    '"deviceNodes.primary.guard.empty.kicker"',
    '"deviceNodes.primary.guard.roleLabel"',
    '"deviceNodes.primary.guard.roleLabel.empty"',
    '"deviceNodes.primary.guard.state.admin"',
    '"deviceNodes.actions.upsertFirst"',
    '"deviceNodes.actions.template.empty"',
    '"deviceNodes.actions.refresh.empty"',
    '"deviceNodes.actions.upsertLocked"',
    '"deviceNodes.actions.upsertRequiresAdmin"',
    '"deviceNodes.advanced.summary.role"',
    '"deviceNodes.advanced.summary.targetValue"',
    '"deviceNodes.listShell.kicker"',
    '"deviceNodes.listShell.heading"',
    'deviceNodeStack: document.getElementById("deviceNodeStack")',
    'deviceNodeAdvancedControls: document.getElementById("deviceNodeAdvancedControls")',
    'deviceNodePrimaryShell: document.getElementById("deviceNodePrimaryShell")',
    'deviceNodePrimarySummaryKicker: document.getElementById("deviceNodePrimarySummaryKicker")',
    'deviceNodePrimarySummaryHeading: document.getElementById("deviceNodePrimarySummaryHeading")',
    'deviceNodePrimarySummaryHint: document.getElementById("deviceNodePrimarySummaryHint")',
    'deviceNodePrimarySummaryMode: document.getElementById("deviceNodePrimarySummaryMode")',
    'deviceNodePrimarySummaryRole: document.getElementById("deviceNodePrimarySummaryRole")',
    'deviceNodeWriteAccessKicker: document.getElementById("deviceNodeWriteAccessKicker")',
    'deviceNodeRoleFieldLabel: document.getElementById("deviceNodeRoleFieldLabel")',
    "function setDeviceNodePrimaryShellOpen(isOpen, reason = \"manual\") {",
    "function setDeviceNodeAdvancedShellOpen(isOpen) {",
    "function syncDeviceNodeSurfaceVisibility(hasNodes = state.deviceNodes instanceof Map && state.deviceNodes.size > 0) {",
    "function syncDeviceNodeSupportLayout() {",
    'layout = primaryOpen ? "empty-primary" : "empty-idle";',
    "function prepareDeviceNodeCreateForm(options = {}) {",
    "function openDeviceNodeCreateEditor(options = {}) {",
    "function selectDeviceNode(node, options = {}) {",
    "function syncDeviceNodeHeroState(nodeCount = 0) {",
    "function syncDeviceNodePrimaryShellSummaryMode(modeText = null)",
    "function syncDeviceNodePrimaryShellSummaryRole(roleLabel = null)",
    '"deviceNodes.selectionSummary.current"',
    '"deviceNodes.selectionSummary.none"',
    '"deviceNodes.selectionSummary.emptyHint"',
    '"deviceNodes.selectionSummary.nodeId"',
    '"deviceNodes.card.route"',
    '"deviceNodes.card.routePending"',
    '"deviceNodes.card.current"',
    '"deviceNodes.actions.addNode"',
    '"deviceNodes.card.edit"',
    '"deviceNodes.card.ariaEdit"',
    '"deviceNodes.card.checks"',
    '"deviceNodes.card.capOverflow"',
    '"deviceNodes.quickStart.copy": "Template the first node, save it, then read the fleet."',
    '"deviceNodes.guide.copy": "Admin is only needed for the first save. Operator is enough for health and heartbeat."',
    '"deviceNodes.listShell.heading": "Fleet board"',
    '"deviceNodes.actions.addNode": "New node"',
    '"deviceNodes.fleet.heading": "Fleet overview"',
    '"deviceNodes.listShell.aside": "Open checks from a chosen node, not from the whole board."',
    '"deviceNodes.snapshot.heading": "Target switcher"',
    '"deviceNodes.snapshot.pill": "{visible} of {total}"',
    'deviceNodeSnapshot: document.getElementById("deviceNodeSnapshot")',
    'deviceNodeSelectionStrip: document.getElementById("deviceNodeSelectionStrip")',
    'deviceNodeListShellRail: document.getElementById("deviceNodeListShellRail")',
    "const versionValue =",
    "el.deviceNodeSelectedIdentityMeta.textContent = versionValue",
    'el.deviceNodeSnapshotGrid.classList.toggle("is-compact-switcher", useCompactSwitcher);',
    '"deviceNodes.advanced.contextTitle"',
    '"deviceNodes.advanced.actionsTitle"',
    '"deviceNodes.advanced.filtersTitle"',
    "Current target and fleet health",
    "Choose a node below, then open Checks or Edit only on demand.",
    '"is-device-populated"',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `device-node runtime copy missing token: ${token}`);
  }

  const requiredStyleTokens = [
    ".device-node-hero {",
    ".device-node-step-strip {",
    ".device-node-context-card {",
    ".device-node-context-label {",
    ".device-node-write-guard {",
    ".device-node-write-guard-side {",
    ".device-node-role-field {",
    ".device-node-primary-action-shell {",
    ".device-node-actions-support {",
    ".device-node-guide-card",
    ".device-node-guide-rail {",
    ".device-node-guide-chip {",
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes.is-populated .device-node-hero {',
    ".device-node-primary-shell",
    ".device-node-primary-shell > summary {",
    ".device-node-primary-summary-copy {",
    ".device-node-primary-summary-strip {",
    ".device-node-primary-body {",
    '.layout[data-active-tab="device-nodes"] .device-node-advanced-shell:not([open]) > summary {',
    '.layout[data-active-tab="device-nodes"] .device-node-primary-shell:not([open]) > summary {',
    ".device-node-fleet-shell",
    ".device-node-selection-strip {",
    ".device-node-selection-card {",
    ".device-node-selection-subvalue {",
    ".device-node-list-shell {",
    ".device-node-list-shell-head {",
    ".device-node-list-shell-rail {",
    ".device-node-list-actions {",
    ".device-node-list-action {",
    ".device-node-advanced-shell {",
    ".device-node-advanced-summary-strip {",
    ".device-node-advanced-body {",
    ".device-node-advanced-grid {",
    ".device-node-advanced-card {",
    ".device-node-advanced-inline-notes {",
    ".device-node-advanced-inline-note {",
    ".device-node-advanced-panel {",
    ".device-node-advanced-panel-copy {",
    ".device-node-advanced-panel-title {",
    ".device-node-advanced-panel-body {",
    ".device-node-card-glance {",
    ".device-node-card-fact {",
    ".device-node-card-route {",
    ".device-node-card-footer {",
    ".device-node-card-actions {",
    ".device-node-card-selection {",
    ".device-node-card-action {",
    ".device-node-cap-pill.is-overflow {",
    ".device-node-actions-primary {",
    ".device-node-actions-secondary {",
    ".device-node-form-grid-secondary {",
    ".device-node-field-wide {",
    '.layout[data-active-tab="device-nodes"] .dashboard-workspace-summary.is-device-minimal {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes .device-node-stack {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes .device-node-stack[data-support-layout="primary-focus"] {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes .device-node-stack[data-support-layout="advanced-focus"] {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes:not(.is-populated) .device-node-stack[data-support-layout="empty-primary"],',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes > h2,',
    '.layout[data-active-tab="device-nodes"] #deviceNodeIntro {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes:not(.is-populated) .device-node-selection-strip,',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes:not(.is-populated) #deviceNodeSnapshot,',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes:not(.is-populated) .device-node-list-shell-rail,',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes:not(.is-populated) .device-node-advanced-shell {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes:not(.is-populated) .device-node-step-card {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes:not(.is-populated) .device-node-guide-muted {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes:not(.is-populated) .device-node-primary-shell > summary {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes:not(.is-populated) #deviceNodePrimarySummaryMode {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes:not(.is-populated) .device-node-primary-summary-strip {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes:not(.is-populated) .device-node-write-guard-label {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes:not(.is-populated) .device-node-list.is-empty {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes:not(.is-populated) .device-node-primary-shell .device-node-form-grid {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes:not(.is-populated) .device-node-primary-action-shell {',
    '.layout[data-active-tab="device-nodes"] .device-node-primary-shell[open] .device-node-shell-head {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes .device-node-stack[data-support-layout="primary-focus"] .device-node-primary-shell .device-node-form-grid {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes .device-node-stack[data-support-layout="primary-focus"] .device-node-write-guard {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes .device-node-stack[data-support-layout="primary-focus"] .device-node-primary-action-shell {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes.is-populated .device-node-advanced-shell:not([open]),',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes.is-populated .device-node-context-row {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes.is-populated .device-node-list.is-dense {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes.is-populated .device-node-list-hint.is-ready {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes.is-populated .device-node-selection-card.is-version {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes.is-populated .device-node-fleet-card.is-total {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes.is-populated .device-node-snapshot.is-compact-switcher {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes.is-populated .device-node-snapshot-grid.is-compact-switcher {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes.is-populated .device-node-list-action:hover {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes.is-populated .device-node-snapshot-head {',
    '.layout[data-active-tab="device-nodes"] .panel-device-nodes.is-populated .device-node-stack[data-support-layout="primary-focus"] .device-node-primary-shell {',
    '.layout[data-active-tab="device-nodes"] .dashboard-workspace-summary.is-device-minimal.is-device-populated {',
    '.layout[data-active-tab="device-nodes"] .dashboard-workspace-summary.is-device-minimal.is-device-populated .dashboard-workspace-description {',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `device-node styles missing ux token: ${token}`);
  }

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
    readmeSource.includes("short diagnostics drawer"),
    "README missing device-node diagnostics-drawer note",
  );
  assert.ok(
    readmeSource.includes("nested `Heartbeat payload` and `Fleet view` panels"),
    "README missing device-node nested-panel note",
  );
  assert.ok(
    readmeSource.includes("route/trust/recency/capabilities"),
    "README missing device-node fleet-card quiet summary note",
  );
  assert.ok(
    readmeSource.includes("collapsible admin editor"),
    "README missing device-node admin-editor note",
  );
  assert.ok(
    readmeSource.includes("Once the fleet is populated"),
    "README missing device-node populated-state compaction note",
  );
  assert.ok(
    readmeSource.includes("quiet `Checks` action"),
    "README missing device-node checks-action note",
  );
  assert.ok(
    readmeSource.includes("open panel owns the wider lower-fold lane"),
    "README missing device-node support-layout note",
  );
  assert.ok(
    readmeSource.includes("quiet drawer-form"),
    "README missing device-node drawer-form note",
  );
  assert.ok(
    readmeSource.includes("On desktop, that populated first fold now drops the old context strip"),
    "README missing device-node desktop first-fold note",
  );
  assert.ok(
    readmeSource.includes("shared workspace shell above the tab also switches to `Target / Role / Next`"),
    "README missing device-node desktop workspace-shell note",
  );
  assert.ok(
    readmeSource.includes("compact control row"),
    "README missing device-node compact control-row note",
  );
  assert.ok(
    readmeSource.includes("lower support shells stay hidden"),
    "README missing device-node hidden support-shell note",
  );
  assert.ok(
    readmeSource.includes("calmer first-save header"),
    "README missing device-node calmer first-save header note",
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
    operatorGuideSource.includes("short diagnostics drawer"),
    "operator guide missing device-node diagnostics-drawer note",
  );
  assert.ok(
    operatorGuideSource.includes("nested `Heartbeat payload` and `Fleet view` panels"),
    "operator guide missing device-node nested-panel note",
  );
  assert.ok(
    operatorGuideSource.includes("route/trust/recency/capabilities"),
    "operator guide missing device-node fleet-card quiet summary note",
  );
  assert.ok(
    operatorGuideSource.includes("collapsible admin editor"),
    "operator guide missing device-node admin-editor note",
  );
  assert.ok(
    operatorGuideSource.includes("Once the fleet is populated"),
    "operator guide missing device-node populated-state compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("quiet `Checks` action"),
    "operator guide missing device-node checks-action note",
  );
  assert.ok(
    operatorGuideSource.includes("open panel owns the wider lower-fold lane"),
    "operator guide missing device-node support-layout note",
  );
  assert.ok(
    operatorGuideSource.includes("quiet drawer-form"),
    "operator guide missing device-node drawer-form note",
  );
  assert.ok(
    operatorGuideSource.includes("On desktop, that populated first fold now drops the old context strip"),
    "operator guide missing device-node desktop first-fold note",
  );
  assert.ok(
    operatorGuideSource.includes("shared workspace shell above the tab also switches to `Target / Role / Next`"),
    "operator guide missing device-node desktop workspace-shell note",
  );
  assert.ok(
    operatorGuideSource.includes("compact control row"),
    "operator guide missing device-node compact control-row note",
  );
  assert.ok(
    operatorGuideSource.includes("lower support shells stay hidden"),
    "operator guide missing device-node hidden support-shell note",
  );
  assert.ok(
    operatorGuideSource.includes("calmer first-save header"),
    "operator guide missing device-node calmer first-save header note",
  );
});
