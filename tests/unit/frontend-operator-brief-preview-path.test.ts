import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator brief preview row stays wired to the existing operator-first path", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");

  for (const token of [
    'id="operatorSummaryGuidePreview"',
    'id="operatorSummaryGuidePreviewFocusBtn"',
    'id="operatorSummaryGuidePreviewFocusValue"',
    'id="operatorSummaryGuidePreviewOpenBtn"',
    'id="operatorSummaryGuidePreviewOpenValue"',
    'id="operatorSummaryGuidePreviewRecoverBtn"',
    'id="operatorSummaryGuidePreviewRecoverValue"',
    'class="operator-summary-guide-preview-label">Focus<',
    'class="operator-summary-guide-preview-label">Open<',
    'class="operator-summary-guide-preview-label">Recover<',
    'id="operatorSummaryGuidePath"',
    'id="operatorSummaryGuideStepRefreshBtn"',
    'id="operatorSummaryGuideStepInspectBtn"',
    'id="operatorSummaryGuideStepRecoverBtn"',
  ]) {
    assert.ok(htmlSource.includes(token), `operator brief HTML missing preview/path token: ${token}`);
  }

  for (const token of [
    "function syncOperatorSummaryGuidePreview(activeSavedView, presentation) {",
    'el.operatorSummaryGuidePreview.dataset.workspace = workspaceId;',
    'el.operatorSummaryGuidePreview.dataset.workspaceState = workspaceTone;',
    'el.operatorSummaryGuidePreviewFocusBtn.dataset.guidePreviewAction = "refresh_summary";',
    'el.operatorSummaryGuidePreviewOpenBtn.dataset.guidePreviewAction = openAction;',
    'el.operatorSummaryGuidePreviewRecoverBtn.dataset.guidePreviewAction = recoverAction;',
    'el.operatorSummaryGuidePreviewFocusValue.textContent = focusValue;',
    'el.operatorSummaryGuidePreviewOpenValue.textContent = openValue;',
    'el.operatorSummaryGuidePreviewRecoverValue.textContent = recoverValue;',
    "function syncOperatorSummaryGuidePath(params = {}) {",
    'stepElements.button.dataset.guideStepAction = actionId;',
    'runOperatorSummaryGuidePathAction(el.operatorSummaryGuideStepRefreshBtn.dataset.guideStepAction',
    'runOperatorSummaryGuidePathAction(el.operatorSummaryGuideStepInspectBtn.dataset.guideStepAction',
    'runOperatorSummaryGuidePathAction(el.operatorSummaryGuideStepRecoverBtn.dataset.guideStepAction',
    'runOperatorSummaryGuidePathAction(el.operatorSummaryGuidePreviewFocusBtn.dataset.guidePreviewAction',
    'runOperatorSummaryGuidePathAction(el.operatorSummaryGuidePreviewOpenBtn.dataset.guidePreviewAction',
    'runOperatorSummaryGuidePathAction(el.operatorSummaryGuidePreviewRecoverBtn.dataset.guidePreviewAction',
    'setOperatorSavedView(savedView);',
    'openOperatorConsoleFromLive({ savedView: "approvals", focusId: "operatorConsoleEntryApprovalsBtn" });',
  ]) {
    assert.ok(appSource.includes(token), `operator brief runtime missing preview/path token: ${token}`);
  }
});
