import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console keeps a focused evidence drawer near the active queue", () => {
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
    'id="operatorEvidenceDrawer"',
    'class="operator-evidence-drawer"',
    'id="operatorEvidenceDrawerTitle"',
    'id="operatorEvidenceDrawerTabs"',
    'data-operator-evidence-view="latest"',
    'data-operator-evidence-view="trace"',
    'data-operator-evidence-view="recovery"',
    'data-operator-evidence-view="audit"',
    'id="operatorEvidenceDrawerPanel"',
    'id="operatorEvidenceDrawerPanelLabel"',
    'id="operatorEvidenceDrawerPanelMeta"',
    'id="operatorEvidenceDrawerFacts"',
    'id="operatorEvidenceDrawerTimelineLabel"',
    'id="operatorEvidenceDrawerTimeline"',
    'id="operatorEvidenceDrawerActions"',
    'class="operator-evidence-drawer-kicker">Focused Evidence<',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator evidence-drawer token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorFocusedEvidenceStatusId: ""',
    'operatorEvidenceDrawerView: ""',
    'operatorEvidenceDrawerContextStatusId: ""',
    'operatorEvidenceDrawer: document.getElementById("operatorEvidenceDrawer")',
    'operatorEvidenceDrawerTabs: document.getElementById("operatorEvidenceDrawerTabs")',
    'operatorEvidenceDrawerPanelLabel: document.getElementById("operatorEvidenceDrawerPanelLabel")',
    'operatorEvidenceDrawerTimelineLabel: document.getElementById("operatorEvidenceDrawerTimelineLabel")',
    'operatorEvidenceDrawerTimeline: document.getElementById("operatorEvidenceDrawerTimeline")',
    'const OPERATOR_EVIDENCE_DRAWER_VIEWS = Object.freeze([',
    "function normalizeOperatorEvidenceDrawerView(value) {",
    "function resolveOperatorFocusedEvidenceStatusId() {",
    "function createOperatorEvidenceDrawerTimelineEntry(config) {",
    "function buildOperatorEvidenceDrawerLatestTimeline(details) {",
    "function buildOperatorEvidenceDrawerTraceTimeline(details) {",
    "function buildOperatorEvidenceDrawerRecoveryTimeline(details) {",
    "function buildOperatorEvidenceDrawerAuditTimeline(details) {",
    "function buildOperatorEvidenceDrawerModel(statusId) {",
    "function setOperatorEvidenceDrawerView(viewId, options = {}) {",
    "function syncOperatorEvidenceDrawer() {",
    "state.operatorFocusedEvidenceStatusId = normalizedStatusId;",
    "syncOperatorEvidenceDrawer();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator evidence-drawer token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-evidence-drawer {",
    ".panel-operator-console .operator-evidence-drawer-tabs {",
    ".panel-operator-console .operator-evidence-drawer-tab {",
    ".panel-operator-console .operator-evidence-drawer-panel-head {",
    ".panel-operator-console .operator-evidence-drawer-panel-label {",
    ".panel-operator-console .operator-evidence-drawer-facts {",
    ".panel-operator-console .operator-evidence-drawer-fact {",
    ".panel-operator-console .operator-evidence-drawer-timeline-shell {",
    ".panel-operator-console .operator-evidence-drawer-timeline {",
    ".panel-operator-console .operator-evidence-drawer-timeline-item {",
    ".panel-operator-console .operator-evidence-drawer-actions {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator evidence-drawer token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("compact `Focused Evidence` drawer"),
    "README missing focused evidence drawer note",
  );
  assert.ok(
    readmeSource.includes("tabbed compact `Focused Evidence` drawer"),
    "README missing tabbed focused evidence drawer note",
  );
  assert.ok(
    readmeSource.includes("compact three-step evidence timeline"),
    "README missing focused evidence timeline note",
  );
  assert.ok(
    operatorGuideSource.includes("compact `Focused Evidence` drawer"),
    "operator guide missing focused evidence drawer note",
  );
  assert.ok(
    operatorGuideSource.includes("tabbed compact `Focused Evidence` drawer"),
    "operator guide missing tabbed focused evidence drawer note",
  );
  assert.ok(
    operatorGuideSource.includes("compact three-step evidence timeline"),
    "operator guide missing focused evidence timeline note",
  );
});
