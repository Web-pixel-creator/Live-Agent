import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("frontend ships a one-click missing-docs follow-up demo preset with approved result summary", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");

  const requiredAppTokens = [
    "const ACTIVE_TASK_VISA_FOLLOW_UP_MISSING_DOCUMENTS =",
    "const ACTIVE_TASK_VISA_FOLLOW_UP_SUMMARY =",
    "const ACTIVE_TASK_VISA_FOLLOW_UP_APPROVAL_REASON =",
    "const ACTIVE_TASK_VISA_FOLLOW_UP_PROMPT =",
    "const ACTIVE_TASK_VISA_FOLLOW_UP_RESULT_PROMPT =",
    'const VISA_FOLLOW_UP_DEMO_URL_PATH = "/ui-task-visa-follow-up-demo.html";',
    '"live.compose.runVisaFollowUp": "Run Missing Docs Follow-up"',
    '"live.compose.reviewVisaFollowUp": "Review Follow-up Result"',
    '"live.compose.runVisaFollowUpHint": "Seed the same visa-relocation lead with missing documents and keep the safe action lane ready."',
    '"live.compose.runVisaFollowUpCardTitle": "Missing docs follow-up"',
    '"live.compose.reviewVisaFollowUpCardTitle": "Approved follow-up handoff"',
    '"live.result.visaFollowUpSummaryTitle": "Missing documents follow-up snapshot"',
    '"live.result.visaFollowUpSummaryDocs": "Missing documents"',
    '"live.result.visaFollowUpSummaryHandoffValue":',
    '"live.result.visaFollowUpSummaryCopySuccess":',
    "function buildVisaFollowUpUiTaskOverrides() {",
    "url: resolveVisaFollowUpDemoUrl(),",
    "function buildVisaFollowUpResultUiTaskOverrides() {",
    "function primeVisaFollowUpDemoFields() {",
    "function resolveVisaFollowUpDemoUrl() {",
    "function runVisaFollowUpDemoPreset() {",
    "function runVisaFollowUpResultPreset() {",
    'demoScenario: "visa_follow_up_draft"',
    'demoScenario: "visa_follow_up_result"',
    "Open the visa follow-up demo page",
    'case "run_visa_follow_up_demo":',
    'case "review_visa_follow_up_result":',
    'state.liveDemoScenario !== "visa_result" &&',
    'state.liveDemoScenario !== "visa_follow_up_result" &&',
    'state.liveDemoScenario !== "visa_reminder_result" &&',
    'state.liveDemoScenario !== "visa_handoff_result"',
    "summaryConfig.copyLabel ?? t(\"live.result.visaSummaryCopy\"",
    "summaryConfig?.copySuccess ??",
  ];
  for (const token of requiredAppTokens) {
    assert.ok(appSource.includes(token), `app.js missing follow-up preset token: ${token}`);
  }

  const requiredHtmlTokens = [
    'id="runVisaFollowUpBtn"',
    'data-dashboard-action="run_visa_follow_up_demo"',
    'data-i18n="live.compose.runVisaFollowUp"',
    'id="reviewVisaFollowUpResultBtn"',
    'data-dashboard-action="review_visa_follow_up_result"',
    'data-i18n="live.compose.reviewVisaFollowUp"',
    "Launch the seeded visa relocation flow, missing-docs follow-up, consultation reminder, case escalation, or CRM handoff without filling fields manually.",
    "Prepares the seeded relocation draft, missing-docs follow-up, consultation reminder, case escalation, or CRM handoff and stops before the protected action step.",
    "Runs the approved intake, follow-up, reminder, escalation, or CRM writeback path and checks the final confirmation banner.",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `index.html missing follow-up CTA token: ${token}`);
  }

  const requiredStyleTokens = [
    ".live-compose-preset-hint",
    ".live-compose-preset-map",
    ".live-compose-preset-card",
    ".live-result-summary",
    ".live-result-summary-copy-btn",
    "grid-template-columns: repeat(2, minmax(172px, max-content));",
    "#resetVisaDemoBtn {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `styles.css missing follow-up preset style token: ${token}`);
  }
});
