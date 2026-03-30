import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace completed-work card exposes the verified stage from the latest protected summary", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  assert.ok(
    htmlSource.includes('id="caseWorkspaceCompletedStageShell"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.completedStageLabel">Verified stage</span>')
      && htmlSource.includes('id="caseWorkspaceCompletedStageValue"'),
    "index.html should expose a verified-stage row in Completed work",
  );

  for (const token of [
    '"live.caseWorkspace.completedStageLabel": "Verified stage"',
    'caseWorkspaceCompletedStageShell: document.getElementById("caseWorkspaceCompletedStageShell")',
    'caseWorkspaceCompletedStageValue: document.getElementById("caseWorkspaceCompletedStageValue")',
    "function getCaseWorkspaceCompletedStageValue(summaryConfig, isRu)",
    'const completedStageLabel = document.querySelector(\'[data-i18n="live.caseWorkspace.completedStageLabel"]\');',
    "el.caseWorkspaceCompletedStageShell.hidden = !completedSummaryConfig;",
    'el.caseWorkspaceCompletedStageValue.textContent = getCaseWorkspaceCompletedStageValue(completedSummaryConfig, isRu);',
    'stageKey: "case"',
    'stageKey: "documents"',
    'stageKey: "consultation"',
    'stageKey: "crm"',
    'stageKey: "handoff"',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing completed-stage token: ${token}`);
  }

  for (const token of [
    ".case-workspace-summary-completed-stage",
    ".case-workspace-summary-completed-stage-label",
    ".case-workspace-summary-completed-stage-value",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing completed-stage token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Completed work` now also shows the `Verified stage`")
      && operatorGuideSource.includes("`Completed work` now also shows the `Verified stage`"),
    "docs should explain that Completed work keeps the latest verified stage visible",
  );
});
