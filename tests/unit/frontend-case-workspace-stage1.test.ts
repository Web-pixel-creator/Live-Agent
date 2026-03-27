import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("live first fold groups visa actions inside the Case Workspace shell", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");

  const mainStart = htmlSource.indexOf('class="case-workspace-action-section case-workspace-action-section-main"');
  const requestStart = htmlSource.indexOf('class="case-workspace-action-section case-workspace-action-section-request"');
  const caseStart = htmlSource.indexOf('id="caseWorkspaceCaseShortcuts"');
  const utilityStart = htmlSource.indexOf('class="case-workspace-action-section case-workspace-action-section-utility case-workspace-action-shell"');
  const resultToolsStart = htmlSource.indexOf('id="caseWorkspaceResultTools"');
  const composeGridStart = htmlSource.indexOf('class="intent-compose-grid intent-grid-primary"');
  const actionStackStart = htmlSource.indexOf('class="case-workspace-action-stack"');
  const flowShellStart = htmlSource.indexOf('class="case-workspace-flow-shell"');

  assert.ok(mainStart !== -1, "start-case section missing from case workspace");
  assert.ok(requestStart !== -1, "main-request section missing from case workspace");
  assert.ok(caseStart !== -1, "move-case-forward shortcuts drawer missing from case workspace");
  assert.ok(utilityStart !== -1, "utility action section missing from case workspace");
  assert.ok(resultToolsStart !== -1, "result tools shell missing from case workspace");
  assert.ok(composeGridStart !== -1, "compose grid missing after grouped actions");
  assert.ok(actionStackStart !== -1, "case-workspace action stack missing");
  assert.ok(flowShellStart !== -1, "guided flow shell missing from case workspace");
  assert.ok(!htmlSource.includes('id="caseWorkspaceCaseShortcuts" open'), "move-case-forward shortcuts should stay collapsed by default");
  assert.ok(!htmlSource.includes('id="caseWorkspaceResultTools" open'), "result tools should stay collapsed by default");
  assert.ok(flowShellStart < composeGridStart, "guided flow should stay above the compose grid");
  assert.ok(composeGridStart < actionStackStart, "compose grid should stay above the grouped action stack inside the first fold");
  assert.ok(mainStart < requestStart && requestStart < caseStart && caseStart < utilityStart, "case-workspace sections should stay ordered start case -> main request -> move case forward drawer -> result tools");

  const mainSection = htmlSource.slice(mainStart, requestStart);
  const requestSection = htmlSource.slice(requestStart, caseStart);
  const caseSection = htmlSource.slice(caseStart, utilityStart);
  const utilitySectionEnd = htmlSource.indexOf("</details>", utilityStart);
  const utilitySection = htmlSource.slice(utilityStart, utilitySectionEnd === -1 ? htmlSource.length : utilitySectionEnd);

  for (const token of ['id="runVisaDemoBtn"']) {
    assert.ok(mainSection.includes(token), `start-case section missing token: ${token}`);
  }
  for (const token of ['id="caseWorkspaceRequestTitle"', 'id="sendBtn"', 'id="sendBtnHint"']) {
    assert.ok(requestSection.includes(token), `main-request section missing token: ${token}`);
  }
  for (const token of ['id="runVisaFollowUpBtn"', 'id="runVisaReminderBtn"', 'id="runVisaHandoffBtn"', 'id="runVisaEscalationBtn"']) {
    assert.ok(caseSection.includes(token), `move-case-forward drawer missing token: ${token}`);
  }
  for (const token of ['id="reviewVisaResultBtn"', 'id="reviewVisaFollowUpResultBtn"', 'id="reviewVisaReminderResultBtn"', 'id="reviewVisaHandoffResultBtn"', 'id="reviewVisaEscalationResultBtn"', 'id="resetVisaDemoBtn"']) {
    assert.ok(utilitySection.includes(token), `utility section missing token: ${token}`);
  }

  for (const token of [
    'caseWorkspaceClient: document.getElementById("caseWorkspaceClient")',
    'caseWorkspaceStatus: document.getElementById("caseWorkspaceStatus")',
    'caseWorkspaceNextStepValue: document.getElementById("caseWorkspaceNextStepValue")',
    'caseWorkspaceNextStep: document.getElementById("caseWorkspaceNextStep")',
    'caseWorkspaceCompletedWork: document.getElementById("caseWorkspaceCompletedWork")',
    'caseWorkspaceFlowActionBtn: document.getElementById("caseWorkspaceFlowActionBtn")',
    'caseWorkspaceRequestTitle: document.getElementById("caseWorkspaceRequestTitle")',
    '"live.caseWorkspace.mainActionsTitle": "Start case"',
    '"live.caseWorkspace.requestTitle": "Main request"',
    '"live.caseWorkspace.requestHint": "Use the live composer for translation, negotiation, research, UI tasks, or free-form chat."',
    '"live.caseWorkspace.caseActionsTitle": "Move case forward"',
    '"live.caseWorkspace.caseActionsChip": "Shortcuts"',
    '"live.caseWorkspace.resultToolsTitle": "Result tools"',
    '"live.caseWorkspace.resultToolsChip": "Secondary"',
    '#caseWorkspaceResultToolsChip',
    "function syncCaseWorkspaceStaticCopy()",
    "function getCaseWorkspaceFlowState(",
    "function getCaseWorkspaceSnapshot(",
    "function renderCaseWorkspaceFlow(",
    "function renderCaseWorkspaceSummary(",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing case-workspace runtime token: ${token}`);
  }

  for (const token of [
    ".case-workspace-shell",
    ".case-workspace-flow-shell",
    ".case-workspace-stepper",
    ".case-workspace-step",
    ".case-workspace-flow-card",
    ".case-workspace-hero",
    ".case-workspace-summary-grid",
    ".case-workspace-summary-card",
    ".case-workspace-action-stack",
    ".case-workspace-action-section",
    ".case-workspace-action-shell-summary",
    ".case-workspace-action-shell-body",
    ".case-workspace-action-shell-pill",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing case-workspace style token: ${token}`);
  }
});
