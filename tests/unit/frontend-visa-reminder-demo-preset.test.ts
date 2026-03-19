import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("frontend ships a one-click consultation reminder demo preset with approved result summary", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");

  const requiredAppTokens = [
    'const VISA_REMINDER_DEMO_URL_PATH = "/ui-task-visa-reminder-demo.html";',
    'const ACTIVE_TASK_VISA_REMINDER_SUMMARY = [',
    'const ACTIVE_TASK_VISA_REMINDER_APPROVAL_REASON =',
    'const ACTIVE_TASK_VISA_REMINDER_PROMPT =',
    'const ACTIVE_TASK_VISA_REMINDER_RESULT_PROMPT =',
    '"live.compose.runVisaReminder": "Run Consultation Reminder"',
    '"live.compose.reviewVisaReminder": "Review Reminder Result"',
    '"live.result.visaReminderSummaryTitle": "Consultation reminder snapshot"',
    '"live.result.visaReminderSummaryPrep": "Preparation items"',
    '"live.result.visaReminderSummaryHandoffValue":',
    "function buildVisaReminderUiTaskOverrides() {",
    "url: resolveVisaReminderDemoUrl(),",
    "function buildVisaReminderResultUiTaskOverrides() {",
    "function primeVisaReminderDemoFields() {",
    "function resolveVisaReminderDemoUrl() {",
    "function runVisaReminderDemoPreset() {",
    "function runVisaReminderResultPreset() {",
    'demoScenario: "visa_reminder_draft"',
    'demoScenario: "visa_reminder_result"',
    'case "run_visa_reminder_demo":',
    'case "review_visa_reminder_result":',
    'state.liveDemoScenario !== "visa_result" &&',
    'state.liveDemoScenario !== "visa_escalation_result" &&',
    'state.liveDemoScenario !== "visa_reminder_result" &&',
    'state.liveDemoScenario !== "visa_handoff_result"',
    "Open the visa reminder demo page",
  ];
  for (const token of requiredAppTokens) {
    assert.ok(appSource.includes(token), `app.js missing reminder preset token: ${token}`);
  }

  const requiredHtmlTokens = [
    'id="runVisaReminderBtn"',
    'data-dashboard-action="run_visa_reminder_demo"',
    'data-i18n="live.compose.runVisaReminder"',
    'id="reviewVisaReminderResultBtn"',
    'data-dashboard-action="review_visa_reminder_result"',
    'data-i18n="live.compose.reviewVisaReminder"',
    "Launch the seeded visa relocation flow, missing-docs follow-up, consultation reminder, case escalation, or CRM handoff without filling fields manually.",
    "Prepares the seeded relocation draft, missing-docs follow-up, consultation reminder, case escalation, or CRM handoff and stops before the protected action step.",
    "Runs the approved intake, follow-up, reminder, escalation, or CRM writeback path and checks the final confirmation banner.",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `index.html missing reminder CTA token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("/ui-task-visa-reminder-demo.html"),
    "README should document the consultation reminder fixture page",
  );
  assert.ok(
    readmeSource.includes("Run Consultation Reminder"),
    "README should document the consultation reminder preset",
  );
  assert.ok(
    readmeSource.includes("Review Reminder Result"),
    "README should document the consultation reminder result preset",
  );
});
