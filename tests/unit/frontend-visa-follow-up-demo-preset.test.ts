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
    '"live.compose.runVisaFollowUp": "Request Missing Documents"',
    '"live.compose.reviewVisaFollowUp": "See Follow-up Summary"',
    '"live.compose.runVisaFollowUpHint": "Open the same case with missing documents and keep the safe action step ready."',
    '"live.compose.runVisaFollowUpCardTitle": "Missing documents"',
    '"live.compose.reviewVisaFollowUpCardTitle": "Follow-up completed"',
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
    "Use these ready-made examples to show intake, document follow-up, reminders, CRM updates, and escalation without filling everything manually.",
    "Starts a ready-made visa case and pauses before the final protected step.",
    "Shows the finished result after approval, including the final summary on the right.",
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
