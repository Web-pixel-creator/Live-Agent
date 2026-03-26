import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("frontend ships a one-click visa intake demo preset with summary-backed ui task overrides", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");

  const requiredAppTokens = [
    'const VISA_INTAKE_DEMO_URL_PATH = "/ui-task-visa-intake-demo.html";',
    'const VISA_INTAKE_DEMO_URL_FALLBACK = "http://127.0.0.1:3000/ui-task-visa-intake-demo.html";',
    'const ACTIVE_TASK_VISA_INTAKE_DEMO_APPROVAL_REASON =',
    '"live.support.runVisaDemo": "Start New Visa Case"',
    '"live.compose.reviewVisaDemo": "See Intake Summary"',
    '"live.compose.resetVisaDemo": "Start Over"',
    '"live.caseWorkspace.resultToolsTitle": "Result tools"',
    '"live.caseWorkspace.resultToolsChip": "Secondary"',
    '"live.compose.runVisaDemoHint":',
    '"live.compose.runVisaDemoCardTitle": "Before final confirmation"',
    '"live.compose.runVisaDemoCardCopy":',
    '"live.compose.reviewVisaDemoCardTitle": "After confirmation"',
    '"live.compose.reviewVisaDemoCardCopy":',
    '"live.result.demoDraftPending":',
    '"live.result.visaSummaryTitle": "Visa intake completion snapshot"',
    '"live.result.visaSummaryHandoff": "Next operator step"',
    '"live.result.visaSummaryCopy": "Copy operator summary"',
    '"live.result.visaSummaryCopySuccess": "Operator summary copied for the visa demo handoff."',
    'function buildVisaDemoOperatorSummaryText(summaryConfig) {',
    "function getDraftDemoReviewActionLabel(responseText = \"\") {",
    "function rewriteUiTaskDraftDemoResponseText(responseIntent, output, responseText) {",
    "const rewrittenDelegatedText = rewriteUiTaskDraftDemoResponseText(",
    "function resolveVisaIntakeDemoUrl() {",
    "async function copyTextToClipboard(text) {",
    'el.liveResultSummaryCopyBtn.addEventListener("click", async () => {',
    'demoScenario: "visa_result"',
    'action: "run_visa_intake_demo"',
    'case "review_visa_draft_result":',
    'case "reset_visa_demo":',
    "runVisaIntakeResultPreset();",
    "resetVisaIntakeDemoPreset();",
    'summary: ACTIVE_TASK_VISA_INTAKE_DEMO_SUMMARY',
    'formData: { ...ACTIVE_TASK_VISA_INTAKE_DEMO_FORM_DATA }',
    'domSnapshot: ACTIVE_TASK_VISA_INTAKE_DEMO_DOM_SNAPSHOT',
    'accessibilityTree: ACTIVE_TASK_VISA_INTAKE_DEMO_ACCESSIBILITY_TREE',
    'markHints: [...ACTIVE_TASK_VISA_INTAKE_DEMO_MARK_HINTS]',
    'approvalConfirmed: true,',
    'approvalDecision: "approved",',
    'approvalReason: ACTIVE_TASK_VISA_INTAKE_DEMO_APPROVAL_REASON,',
    'const uiTaskOverrides = { ...collectUiTaskOverrides(), ...explicitUiTaskOverrides };',
    'sendIntentRequest({',
    'message: ACTIVE_TASK_VISA_INTAKE_DEMO_PROMPT',
    'message: ACTIVE_TASK_VISA_INTAKE_RESULT_PROMPT',
  ];
  for (const token of requiredAppTokens) {
    assert.ok(appSource.includes(token), `app.js missing visa demo preset token: ${token}`);
  }

  const requiredHtmlTokens = [
    'class="case-workspace-shell"',
    'class="case-workspace-flow-shell"',
    'class="case-workspace-stepper"',
    'data-case-workspace-step="case"',
    'id="caseWorkspaceFlowTitle"',
    'id="caseWorkspaceFlowActionBtn"',
    'id="caseWorkspaceClient"',
    'id="caseWorkspaceStatus"',
    'id="caseWorkspaceNextStepValue"',
    'id="caseWorkspaceNextStep"',
    'id="caseWorkspaceCompletedWork"',
    'class="case-workspace-action-section case-workspace-action-section-main"',
    'class="case-workspace-action-section case-workspace-action-section-utility case-workspace-action-shell"',
    'id="caseWorkspaceResultTools"',
    'id="caseWorkspaceResultToolsTitle"',
    'data-i18n="live.caseWorkspace.resultToolsTitle"',
    'id="runVisaDemoBtn"',
    'data-dashboard-action="run_visa_intake_demo"',
    'data-i18n="live.compose.runVisaDemo"',
    'id="reviewVisaResultBtn"',
    'data-dashboard-action="review_visa_draft_result"',
    'data-i18n="live.compose.reviewVisaDemo"',
    'id="resetVisaDemoBtn"',
    'data-dashboard-action="reset_visa_demo"',
    'data-i18n="live.compose.resetVisaDemo"',
    'id="runVisaDemoHint"',
    'data-i18n="live.compose.runVisaDemoHint"',
    'class="live-compose-preset-map"',
    'data-i18n="live.compose.runVisaDemoCardTitle"',
    'data-i18n="live.compose.reviewVisaDemoCardTitle"',
    'id="liveResultSummary"',
    'id="liveResultSummaryTitle"',
    'id="liveResultSummaryList"',
    'id="liveResultSummaryHandoff"',
    'id="liveResultSummaryCopyBtn"',
    'data-i18n="live.result.visaSummaryCopy"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `index.html missing visa demo CTA token: ${token}`);
  }

  const mainSectionStart = htmlSource.indexOf('class="case-workspace-action-section case-workspace-action-section-main"');
  const utilitySectionStart = htmlSource.indexOf('class="case-workspace-action-section case-workspace-action-section-utility case-workspace-action-shell"');
  const utilitySectionEnd = htmlSource.indexOf("</details>", utilitySectionStart);
  assert.ok(mainSectionStart !== -1 && utilitySectionStart !== -1 && utilitySectionEnd !== -1, "case-workspace sections should wrap the visa intake CTAs");
  assert.ok(!htmlSource.includes('id="caseWorkspaceResultTools" open'), "result tools should stay collapsed in the first scan");
  const mainSection = htmlSource.slice(mainSectionStart, utilitySectionStart);
  const utilitySection = htmlSource.slice(utilitySectionStart, utilitySectionEnd);
  assert.ok(mainSection.includes('id="runVisaDemoBtn"'), "visa intake launch CTA should stay in the start-case section");
  assert.ok(utilitySection.includes('id="reviewVisaResultBtn"'), "visa intake review CTA should stay in the utility section");
  assert.ok(utilitySection.includes('id="resetVisaDemoBtn"'), "visa reset CTA should stay in the utility section");

  const requiredStyleTokens = [
    ".case-workspace-shell",
    ".case-workspace-flow-shell",
    ".case-workspace-stepper",
    ".case-workspace-flow-card",
    ".case-workspace-summary-grid",
    ".case-workspace-action-stack",
    ".case-workspace-action-section",
    ".case-workspace-action-shell-summary",
    ".case-workspace-action-shell-body",
    ".live-compose-preset-hint",
    ".live-compose-preset-map",
    ".live-compose-preset-card",
    ".live-result-summary",
    ".live-result-summary-item",
    ".live-result-summary-handoff",
    ".live-result-summary-copy-btn",
    "grid-template-columns: repeat(2, minmax(172px, max-content));",
    "justify-content: start;",
    "justify-items: start;",
    ".live-compose-send-hint,",
    ".live-compose-preset-hint {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `styles.css missing visa demo CTA style token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("/ui-task-visa-intake-demo.html"),
    "README should document the visa intake fixture page",
  );
  assert.ok(
    readmeSource.includes("current frontend origin"),
    "README should document the hosted visa preset target behavior",
  );
  assert.ok(
    readmeSource.includes("Start New Visa Case"),
    "README should document the visa intake preset",
  );
  assert.ok(
    readmeSource.includes("Result tools"),
    "README should document the collapsed result-tools shell",
  );
  assert.ok(
    readmeSource.includes("See Intake Summary"),
    "README should document the visa result preset",
  );
  assert.ok(
    readmeSource.includes("Start Over"),
    "README should document the visa demo reset action",
  );
  assert.ok(
    readmeSource.includes("Copy operator summary"),
    "README should document the visa operator-summary copy action",
  );
});

test("visa intake demo fixture keeps the protected submit boundary stable", () => {
  const fixtureSource = readFileSync(
    resolve(process.cwd(), "apps", "demo-frontend", "public", "ui-task-visa-intake-demo.html"),
    "utf8",
  );

  const requiredFixtureTokens = [
    'id="visa-intake-form"',
    'id="full_name"',
    'id="destination_country"',
    'id="relocation_city"',
    'id="visa_type"',
    'id="passport_number"',
    'id="submit-intake" type="submit" disabled',
    'id="preview-intake"',
    "Protected submit is disabled until the intake draft has the required fields.",
    "Visa intake draft submitted for approval.",
    "Preview intake card",
  ];
  for (const token of requiredFixtureTokens) {
    assert.ok(fixtureSource.includes(token), `visa intake fixture missing token: ${token}`);
  }
});
