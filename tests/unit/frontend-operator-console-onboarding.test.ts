import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console first fold exposes a state-aware refresh-inspect-recover onboarding path", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="operatorSummaryGuidePath"',
    'id="operatorSummaryGuideStepRefresh"',
    'id="operatorSummaryGuideStepRefreshTitle"',
    'id="operatorSummaryGuideStepRefreshHint"',
    'id="operatorSummaryGuideStepRefreshStatus"',
    'id="operatorSummaryGuideStepRefreshBtn"',
    'id="operatorSummaryGuideStepInspect"',
    'id="operatorSummaryGuideStepInspectTitle"',
    'id="operatorSummaryGuideStepInspectHint"',
    'id="operatorSummaryGuideStepInspectStatus"',
    'id="operatorSummaryGuideStepInspectBtn"',
    'id="operatorSummaryGuideStepRecover"',
    'id="operatorSummaryGuideStepRecoverTitle"',
    'id="operatorSummaryGuideStepRecoverHint"',
    'id="operatorSummaryGuideStepRecoverStatus"',
    'id="operatorSummaryGuideStepRecoverBtn"',
    "Inspect the hot workspace",
    "Recover only if needed",
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing onboarding path token: ${token}`);
  }

  for (const token of [
    'operatorSummaryGuidePath: document.getElementById("operatorSummaryGuidePath")',
    'operatorSummaryGuideStepRefreshBtn: document.getElementById("operatorSummaryGuideStepRefreshBtn")',
    'operatorSummaryGuideStepInspectBtn: document.getElementById("operatorSummaryGuideStepInspectBtn")',
    'operatorSummaryGuideStepRecoverBtn: document.getElementById("operatorSummaryGuideStepRecoverBtn")',
    "function runOperatorSummaryGuidePathAction(actionId, options = {}) {",
    "function syncOperatorSummaryGuidePathStep(stepElements, config = {}) {",
    "function syncOperatorSummaryGuidePath(params = {}) {",
    'stepElements.button.dataset.guideStepAction = actionId;',
    'runOperatorSummaryGuidePathAction(el.operatorSummaryGuideStepRefreshBtn.dataset.guideStepAction',
    'runOperatorSummaryGuidePathAction(el.operatorSummaryGuideStepInspectBtn.dataset.guideStepAction',
    'runOperatorSummaryGuidePathAction(el.operatorSummaryGuideStepRecoverBtn.dataset.guideStepAction',
    'runOperatorEmptyStateAction("refresh_summary");',
    'jumpToOperatorStatusCard(targetStatusId);',
    'setOperatorSavedView(savedView);',
    'openOperatorSupportPanel(el.operatorLanePlaybook, el.operatorPlaybookRunNegotiationBtn);',
    'openOperatorSupportPanel(el.operatorQuickStart, el.operatorQuickStartRunNegotiationBtn);',
    'syncOperatorSummaryGuidePath({',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing onboarding path token: ${token}`);
  }

  for (const token of [
    ".panel-operator-console .operator-summary-guide-path {",
    ".panel-operator-console .operator-summary-guide-step {",
    '.panel-operator-console .operator-summary-guide-step[data-step-state="current"] {',
    '.panel-operator-console .operator-summary-guide-step[data-step-state="done"] {',
    ".panel-operator-console .operator-summary-guide-step-index {",
    ".panel-operator-console .operator-summary-guide-step-action {",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing onboarding path style token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("state-aware `Refresh -> Inspect -> Recover` onboarding path"),
    "README should document the state-aware operator onboarding path",
  );
  assert.ok(
    readmeSource.includes("workspace-first inspect/open wording"),
    "README should document workspace-first onboarding wording",
  );
  assert.ok(
    operatorGuideSource.includes("guided `Refresh -> Inspect -> Recover` path"),
    "operator guide should document the guided operator onboarding path",
  );
  assert.ok(
    operatorGuideSource.includes("workspace-first inspect/open wording"),
    "operator guide should document workspace-first onboarding wording",
  );
});
