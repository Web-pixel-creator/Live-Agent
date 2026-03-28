import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace drawers split current path actions from later jumps", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="caseWorkspaceCasePrimaryCard"',
    'id="caseWorkspaceCasePrimaryTitle"',
    'id="caseWorkspaceCasePrimaryHint"',
    'id="caseWorkspaceCasePrimaryChip"',
    'id="caseWorkspaceCasePrimaryActions"',
    'id="caseWorkspaceCaseLaterSteps"',
    'id="caseWorkspaceCaseLaterTitle"',
    'id="caseWorkspaceCaseLaterHint"',
    'id="caseWorkspaceCaseLaterChip"',
    'id="caseWorkspaceCaseLaterActions"',
    'id="caseWorkspaceResultPrimaryCard"',
    'id="caseWorkspaceResultPrimaryTitle"',
    'id="caseWorkspaceResultPrimaryHint"',
    'id="caseWorkspaceResultPrimaryChip"',
    'id="caseWorkspaceResultPrimaryActions"',
    'id="caseWorkspaceResultLaterTools"',
    'id="caseWorkspaceResultLaterTitle"',
    'id="caseWorkspaceResultLaterHint"',
    'id="caseWorkspaceResultLaterChip"',
    'id="caseWorkspaceResultLaterActions"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing case path grouping token: ${token}`);
  }

  for (const token of [
    'const CASE_WORKSPACE_CASE_BUTTON_ENTRIES = CASE_WORKSPACE_ACTION_BUTTONS.filter((entry) => entry.drawer === "case")',
    'const CASE_WORKSPACE_RESULT_BUTTON_ENTRIES = CASE_WORKSPACE_ACTION_BUTTONS.filter((entry) => entry.drawer === "result")',
    "function moveCaseWorkspaceDrawerButtons(",
    "function getCaseWorkspaceCasePathBodyCopy(primaryActionId, isRu)",
    "function getCaseWorkspaceResultPathBodyCopy(primaryActionId, isRu)",
    'const casePrimaryCard = document.getElementById("caseWorkspaceCasePrimaryCard")',
    'const caseLaterSteps = document.getElementById("caseWorkspaceCaseLaterSteps")',
    'const resultPrimaryCard = document.getElementById("caseWorkspaceResultPrimaryCard")',
    'const resultLaterTools = document.getElementById("caseWorkspaceResultLaterTools")',
    "function syncCaseWorkspaceSubshellOpen(",
    "moveCaseWorkspaceDrawerButtons(",
    'casePrimaryCard.hidden = !casePathCopy.showPrimary;',
    'resultPrimaryCard.hidden = !resultPathCopy.showPrimary;',
    'const visibleCaseEntries = CASE_WORKSPACE_CASE_BUTTON_ENTRIES.filter((entry) => shouldShowCaseWorkspaceCaseEntry(entry, activeActionId));',
    'caseLaterSteps.hidden = caseLaterVisibleCount === 0;',
    'syncCaseWorkspaceSubshellOpen(',
    '"case:" + (casePrimaryActionId || "later") + ":" + String(caseLaterVisibleCount)',
    'syncCaseWorkspaceSubshellOpen(resultLaterTools, resultPathCopy.laterOpen, "result:" + (resultPrimaryActionId || "later"));',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing path-group token: ${token}`);
  }

  for (const token of [
    ".case-workspace-path-shell-body",
    ".case-workspace-path-card",
    ".case-workspace-path-copy",
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
    operatorGuideSource.includes("secondary jump/review subshells")
      || operatorGuideSource.includes("secondary shell for later jumps"),
    "operator guide should mention the quieter secondary drawer shell",
  );
});
