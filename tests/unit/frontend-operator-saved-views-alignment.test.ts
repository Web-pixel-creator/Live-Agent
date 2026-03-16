import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes saved views and a mobile action dock for common triage postures", () => {
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
    'class="operator-toolbar-cluster operator-toolbar-cluster-saved"',
    'class="operator-saved-view-buttons"',
    'id="operatorSavedViewIncidentsBtn"',
    'id="operatorSavedViewRuntimeBtn"',
    'id="operatorSavedViewApprovalsBtn"',
    'id="operatorSavedViewAuditBtn"',
    'id="operatorSavedViewHint"',
    'id="operatorSummaryGuideContext"',
    'id="operatorSummaryGuideViewPill"',
    'id="operatorSummaryGuideViewNote"',
    'id="operatorEvidenceDrawerKicker"',
    'id="operatorMobileDock"',
    'id="operatorMobileRefreshBtn"',
    'id="operatorMobileSavedViewIncidentsBtn"',
    'id="operatorMobileSavedViewRuntimeBtn"',
    'id="operatorMobileSavedViewApprovalsBtn"',
    'id="operatorMobileSavedViewAuditBtn"',
    'id="operatorGroupRuntimeDevice"',
    'id="operatorGroupQueueLifecycle"',
    'id="operatorGroupGovernanceEvidence"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator saved-view token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorSavedView: ""',
    'const OPERATOR_SAVED_VIEW_STORAGE_KEY = "mla.demoFrontend.operatorSavedView"',
    "const OPERATOR_SAVED_VIEWS = Object.freeze({",
    "function normalizeOperatorSavedView(value) {",
    "function ensureOperatorMobileDockMounted() {",
    "function syncOperatorMobileDockVisibility(tabId = null) {",
    "function readStoredOperatorSavedView() {",
    "function getActiveOperatorSavedViewConfig() {",
    "function resolveOperatorSavedViewEvidenceStatusId(config, signals) {",
    "function syncOperatorSavedViewContext() {",
    "function syncOperatorSavedViewButtons() {",
    "function syncOperatorSavedViewFocusState() {",
    "function clearOperatorSavedView(options = {}) {",
    "function flashOperatorStatusCard(statusId) {",
    "function setOperatorSavedView(viewId, options = {}) {",
    'drawerKicker: "Runtime Evidence"',
    'groupPreviewText: "No runtime snapshot yet. Refresh summary, then open Drill Runner only if this area still looks empty."',
    'const operatorSavedViewButtons = document.querySelectorAll("[data-operator-saved-view]");',
    'setOperatorSavedView(button.dataset.operatorSavedView ?? "");',
    'const initialOperatorSavedView = readStoredOperatorSavedView();',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator saved-view token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-toolbar-cluster-saved {",
    ".panel-operator-console .operator-saved-view-buttons {",
    ".panel-operator-console .operator-toolbar-hint {",
    ".operator-mobile-dock {",
    ".operator-mobile-dock-btn {",
    ".operator-mobile-dock-refresh {",
    ".panel-operator-console .operator-summary-guide.operator-saved-view-focus,",
    ".panel-operator-console #operatorGroupRuntimeDevice,",
    ".panel-operator-console .operator-summary-guide-context {",
    ".panel-operator-console .operator-summary-guide-view-pill {",
    ".panel-operator-console .operator-summary-guide-view-note {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator saved-view token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("saved operator views (`Incidents`, `Runtime`, `Approvals`, `Audit`)"),
    "README missing operator saved-views note",
  );
  assert.ok(readmeSource.includes("retune the operator brief/evidence drawer"), "README missing saved-view posture note");
  assert.ok(
    readmeSource.includes("sticky action dock"),
    "README missing operator mobile dock note",
  );
  assert.ok(
    operatorGuideSource.includes("saved operator views (`Incidents`, `Runtime`, `Approvals`, `Audit`)"),
    "operator guide missing operator saved-views note",
  );
  assert.ok(operatorGuideSource.includes("retune the brief/evidence posture"), "operator guide missing saved-view posture note");
  assert.ok(
    operatorGuideSource.includes("sticky action dock"),
    "operator guide missing operator mobile dock note",
  );
});
