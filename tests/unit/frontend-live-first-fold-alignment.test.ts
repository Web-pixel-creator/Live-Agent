import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("live negotiator keeps primary compose controls ahead of support dock chrome", () => {
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

  const caseWorkspaceShellIndex = htmlSource.indexOf('class="case-workspace-shell"');
  const flowShellIndex = htmlSource.indexOf('class="case-workspace-flow-shell"');
  const currentCaseIndex = htmlSource.indexOf('id="caseWorkspaceClient"');
  const nextStepIndex = htmlSource.indexOf('id="caseWorkspaceNextStep"');
  const completedWorkIndex = htmlSource.indexOf('id="caseWorkspaceCompletedWork"');
  const summaryGridIndex = htmlSource.indexOf('class="case-workspace-summary-grid"');
  const actionStackIndex = htmlSource.indexOf('class="case-workspace-action-stack"');
  const mainSectionIndex = htmlSource.indexOf('class="case-workspace-action-section case-workspace-action-section-main"');
  const requestSectionIndex = htmlSource.indexOf('id="caseWorkspaceRequestShell"');
  const caseSectionIndex = htmlSource.indexOf('id="caseWorkspaceCaseShortcuts"');
  const utilitySectionIndex = htmlSource.indexOf('class="case-workspace-action-section case-workspace-action-section-utility case-workspace-action-shell"');
  const resultToolsIndex = htmlSource.indexOf('id="caseWorkspaceResultTools"');
  const demoGuideIndex = htmlSource.indexOf('id="caseWorkspaceDemoGuide"');
  const composeShellIndex = htmlSource.indexOf('class="live-compose-primary-shell"');
  const dockIndex = htmlSource.indexOf('class="live-context-dock-shell"');
  const trayIndex = htmlSource.indexOf('id="liveContextTray"');

  assert.ok(caseWorkspaceShellIndex !== -1, "frontend html missing case workspace shell");
  assert.ok(flowShellIndex !== -1, "frontend html missing guided flow shell");
  assert.ok(currentCaseIndex !== -1, "frontend html missing current case summary");
  assert.ok(nextStepIndex !== -1, "frontend html missing next-step summary");
  assert.ok(completedWorkIndex !== -1, "frontend html missing completed-work summary");
  assert.ok(summaryGridIndex !== -1, "frontend html missing case-workspace summary grid");
  assert.ok(actionStackIndex !== -1, "frontend html missing grouped case workspace actions");
  assert.ok(mainSectionIndex !== -1, "frontend html missing start-case section");
  assert.ok(requestSectionIndex !== -1, "frontend html missing live-request drawer");
  assert.ok(caseSectionIndex !== -1, "frontend html missing move-case-forward shortcuts drawer");
  assert.ok(utilitySectionIndex !== -1, "frontend html missing utility section");
  assert.ok(resultToolsIndex !== -1, "frontend html missing result-tools shell");
  assert.ok(demoGuideIndex !== -1, "frontend html missing demo-guide shell");
  assert.ok(composeShellIndex !== -1, "frontend html missing primary compose shell");
  assert.ok(dockIndex !== -1, "frontend html missing live support dock");
  assert.ok(trayIndex !== -1, "frontend html missing live support tray");

  assert.ok(caseWorkspaceShellIndex < composeShellIndex, "case workspace shell should open the first fold");
  assert.ok(flowShellIndex < summaryGridIndex, "guided flow should lead into the summary cards");
  assert.ok(currentCaseIndex < nextStepIndex, "current case should appear before next-step guidance");
  assert.ok(nextStepIndex < completedWorkIndex, "completed work should trail the current-case guidance");
  assert.ok(actionStackIndex < dockIndex, "grouped actions should stay above the support dock");
  assert.ok(mainSectionIndex < requestSectionIndex, "start-case actions should lead into the live-request drawer");
  assert.ok(requestSectionIndex < caseSectionIndex, "live-request drawer should stay ahead of move-case-forward actions");
  assert.ok(caseSectionIndex < utilitySectionIndex, "utility actions should stay after the move-case-forward drawer");
  assert.ok(caseSectionIndex < resultToolsIndex, "result tools should stay after the move-case-forward drawer");
  assert.ok(resultToolsIndex < demoGuideIndex, "demo guide should stay after result tools");
  assert.ok(!htmlSource.includes('id="caseWorkspaceDemoGuide" open'), "demo guide should stay collapsed in the first scan");
  assert.ok(dockIndex < trayIndex, "support tray should stay attached to the dock after the compose shell");

  assert.ok(
    htmlSource.includes('id="caseWorkspaceFlowTitle"'),
    "frontend html should expose the guided-flow card title",
  );
  assert.ok(
    htmlSource.includes('id="caseWorkspaceFlowActionBtn"'),
    "frontend html should expose the guided-flow CTA",
  );
  assert.ok(
    htmlSource.includes('data-i18n="live.caseWorkspace.title"'),
    "frontend html should expose a case-workspace title hook",
  );
  assert.ok(
    htmlSource.includes('data-i18n="live.caseWorkspace.mainActionsTitle"'),
    "frontend html should expose grouped start-case actions in the first fold",
  );
  assert.ok(
    htmlSource.includes('id="caseWorkspaceRequestTitle"'),
    "frontend html should expose a dedicated live-request drawer in the first fold",
  );
  assert.ok(
    htmlSource.includes('id="caseWorkspaceRequestChip"'),
    "frontend html should expose an optional pill for the live-request drawer",
  );
  assert.ok(
    htmlSource.includes('id="caseWorkspaceCaseActionsChip"'),
    "frontend html should expose a shortcuts pill for the move-case-forward drawer",
  );
  assert.ok(
    htmlSource.includes('id="caseWorkspaceResultToolsTitle"'),
    "frontend html should expose a dedicated result-tools heading",
  );
  assert.ok(
    htmlSource.includes('id="caseWorkspaceResultToolsChip"'),
    "frontend html should expose a dedicated result-tools pill",
  );
  assert.ok(
    htmlSource.includes('id="caseWorkspaceDemoGuideTitle"'),
    "frontend html should expose a dedicated demo-guide heading",
  );
  assert.ok(
    htmlSource.includes('id="caseWorkspaceDemoGuideChip"'),
    "frontend html should expose a dedicated demo-guide pill",
  );
  assert.ok(
    htmlSource.includes('id="sendBtnHint"'),
    "frontend html should keep the generic send hint inside the live-request drawer",
  );
  assert.ok(
    appSource.includes('caseWorkspaceFlowActionBtn: document.getElementById("caseWorkspaceFlowActionBtn")'),
    "frontend runtime should bind the guided-flow CTA",
  );
  assert.ok(
    appSource.includes("function getCaseWorkspaceFlowState("),
    "frontend runtime should derive a guided flow state for the first fold",
  );
  assert.ok(
    appSource.includes("function renderCaseWorkspaceFlow("),
    "frontend runtime should render the guided flow card and stepper",
  );
  assert.ok(
    appSource.includes('caseWorkspaceClient: document.getElementById("caseWorkspaceClient")'),
    "frontend runtime should bind the current-case summary nodes",
  );
  assert.ok(
    appSource.includes("function renderCaseWorkspaceSummary("),
    "frontend runtime should render the case-workspace state",
  );
  assert.ok(
    stylesSource.includes(".case-workspace-flow-shell"),
    "frontend styles should define the guided flow shell",
  );
  assert.ok(
    stylesSource.includes(".case-workspace-stepper"),
    "frontend styles should define the case stepper",
  );
  assert.ok(
    stylesSource.includes(".case-workspace-flow-card"),
    "frontend styles should define the guided flow card",
  );
  assert.ok(
    stylesSource.includes(".case-workspace-shell"),
    "frontend styles should define the case-workspace shell",
  );
  assert.ok(
    stylesSource.includes(".case-workspace-summary-grid"),
    "frontend styles should define the case-workspace summary grid",
  );
  assert.ok(
    stylesSource.includes(".case-workspace-action-stack"),
    "frontend styles should define the grouped case-workspace action stack",
  );
  assert.ok(
    stylesSource.includes(".case-workspace-action-shell-summary"),
    "frontend styles should define the result-tools shell summary",
  );
  assert.ok(
    readmeSource.includes("dedicated `Case Workspace` shell"),
    "README should document the new case-workspace first fold",
  );
  assert.ok(
    operatorGuideSource.includes("dedicated `Case Workspace` block"),
    "operator guide should document the new case-workspace first fold",
  );
});
