import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace drawers split the current path from idle preview and later jumps", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="caseWorkspaceCasePrimaryCard"',
    'id="caseWorkspaceCasePrimaryActions"',
    'id="caseWorkspaceCaseIdlePreview"',
    'id="caseWorkspaceCaseLaterSteps"',
    'id="caseWorkspaceCaseLaterActions"',
    'id="caseWorkspaceResultPrimaryCard"',
    'id="caseWorkspaceResultLaterTools"',
    'id="caseWorkspaceResultLaterActions"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing case path grouping token: ${token}`);
  }

  for (const token of [
    'const CASE_WORKSPACE_CASE_BUTTON_ENTRIES = CASE_WORKSPACE_ACTION_BUTTONS.filter((entry) => entry.drawer === "case")',
    'const CASE_WORKSPACE_RESULT_BUTTON_ENTRIES = CASE_WORKSPACE_ACTION_BUTTONS.filter((entry) => entry.drawer === "result")',
    "function moveCaseWorkspaceDrawerButtons(",
    "function renderCaseWorkspacePreviewRail(",
    "function getCaseWorkspaceCasePathBodyCopy(primaryActionId, isRu, options = {})",
    "function getCaseWorkspaceResultPathBodyCopy(primaryActionId, laterVisibleCount, isRu, options = {})",
    'const caseIdlePreview = document.getElementById("caseWorkspaceCaseIdlePreview")',
    'const caseDrawerMainOwned = drawerTarget === "case" && casePrimaryActionId.length > 0;',
    'suppressedActionIds: caseDrawerMainOwned ? new Set([casePrimaryActionId]) : null,',
    'const idleCasePathPreview =',
    '"Route preview after intake"',
    '"Before intake is confirmed, this rail shows only the future path order. After intake, the same steps unlock as the working case path."',
    '"Later case moves"',
    'renderCaseWorkspacePreviewRail(caseIdlePreview, visibleCaseEntries, isRu);',
    'caseLaterActions.hidden = idleCasePathPreview;',
    'caseLaterSteps.hidden = idleCasePathPreview || caseLaterVisibleCount === 0;',
    'caseDrawer.dataset.caseWorkspaceDrawerOwnership = caseDrawerMainOwned ? "secondary" : "launcher";',
    'resultLaterTools.hidden = resultLaterVisibleCount === 0;',
    '"case:" + (casePrimaryActionId || "later") + ":" + String(caseLaterVisibleCount)',
    '"result:" + (resultPrimaryActionId || "later") + ":" + String(resultLaterVisibleCount)',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing path-group token: ${token}`);
  }

  for (const token of [
    ".case-workspace-path-shell-body",
    ".case-workspace-path-card",
    ".case-workspace-path-copy",
    ".case-workspace-preview-rail",
    ".case-workspace-preview-row",
    ".case-workspace-preview-kicker",
    ".case-workspace-preview-title",
    ".case-workspace-path-actions",
    ".case-workspace-action-subshell",
    ".case-workspace-action-subshell-summary",
    ".case-workspace-action-subshell-body",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing case path grouping style: ${token}`);
  }

  assert.ok(
    readmeSource.includes("secondary jump/review subshells"),
    "README should mention the quieter secondary drawer shell",
  );
  assert.ok(
    readmeSource.includes("static preview rail"),
    "README should mention the idle static preview rail",
  );
  assert.ok(
    operatorGuideSource.includes("secondary jump/review subshells")
      || operatorGuideSource.includes("secondary shell for later jumps"),
    "operator guide should mention the quieter secondary drawer shell",
  );
  assert.ok(
    operatorGuideSource.includes("static preview rail"),
    "operator guide should mention the idle static preview rail",
  );
});
