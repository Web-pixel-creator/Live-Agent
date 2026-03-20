import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("live first fold groups visa actions inside the Case Workspace shell", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");

  const mainStart = htmlSource.indexOf('class="case-workspace-action-section case-workspace-action-section-main"');
  const caseStart = htmlSource.indexOf('class="case-workspace-action-section case-workspace-action-section-case"');
  const utilityStart = htmlSource.indexOf('class="case-workspace-action-section case-workspace-action-section-utility"');
  const composeGridStart = htmlSource.indexOf('class="intent-compose-grid intent-grid-primary"');
  const actionStackStart = htmlSource.indexOf('class="case-workspace-action-stack"');

  assert.ok(mainStart !== -1, "main action section missing from case workspace");
  assert.ok(caseStart !== -1, "case action section missing from case workspace");
  assert.ok(utilityStart !== -1, "utility action section missing from case workspace");
  assert.ok(composeGridStart !== -1, "compose grid missing after grouped actions");
  assert.ok(actionStackStart !== -1, "case-workspace action stack missing");
  assert.ok(composeGridStart < actionStackStart, "compose grid should stay above the grouped action stack inside the first fold");
  assert.ok(mainStart < caseStart && caseStart < utilityStart, "case-workspace sections should stay ordered main -> case -> utility");

  const mainSection = htmlSource.slice(mainStart, caseStart);
  const caseSection = htmlSource.slice(caseStart, utilityStart);
  const utilitySectionEnd = htmlSource.indexOf("</section>", utilityStart);
  const utilitySection = htmlSource.slice(utilityStart, utilitySectionEnd === -1 ? htmlSource.length : utilitySectionEnd);

  for (const token of ['id="sendBtn"', 'id="runVisaDemoBtn"']) {
    assert.ok(mainSection.includes(token), `main section missing token: ${token}`);
  }
  for (const token of ['id="runVisaFollowUpBtn"', 'id="runVisaReminderBtn"', 'id="runVisaHandoffBtn"', 'id="runVisaEscalationBtn"']) {
    assert.ok(caseSection.includes(token), `case section missing token: ${token}`);
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
    "function syncCaseWorkspaceStaticCopy()",
    "function getCaseWorkspaceSnapshot(",
    "function renderCaseWorkspaceSummary(",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing case-workspace runtime token: ${token}`);
  }

  for (const token of [
    ".case-workspace-shell",
    ".case-workspace-hero",
    ".case-workspace-summary-grid",
    ".case-workspace-summary-card",
    ".case-workspace-action-stack",
    ".case-workspace-action-section",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing case-workspace style token: ${token}`);
  }
});
