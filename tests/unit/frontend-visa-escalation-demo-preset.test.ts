import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("frontend ships a one-click case escalation demo preset with approved human handoff summary", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");

  const requiredAppTokens = [
    'const VISA_ESCALATION_DEMO_URL_PATH = "/ui-task-visa-escalation-demo.html";',
    'const ACTIVE_TASK_VISA_ESCALATION_OWNER = "Sofia Kim";',
    'const ACTIVE_TASK_VISA_ESCALATION_QUEUE = "Visa Escalations Tier 2";',
    'const ACTIVE_TASK_VISA_ESCALATION_SUMMARY = [',
    'const ACTIVE_TASK_VISA_ESCALATION_APPROVAL_REASON =',
    'const ACTIVE_TASK_VISA_ESCALATION_PROMPT =',
    'const ACTIVE_TASK_VISA_ESCALATION_RESULT_PROMPT =',
    '"live.compose.runVisaEscalation": "Escalate to Specialist"',
    '"live.compose.reviewVisaEscalation": "See Escalation Summary"',
    '"live.compose.runVisaEscalationCardTitle": "Specialist handoff"',
    '"live.compose.reviewVisaEscalationCardTitle": "Escalation completed"',
    '"live.result.visaEscalationSummaryTitle": "Case escalation snapshot"',
    '"live.result.visaEscalationSummaryOwner": "Human owner"',
    '"live.result.visaEscalationSummaryReason": "Escalation reason"',
    '"live.result.visaEscalationSummaryHandoffValue":',
    "function buildVisaEscalationUiTaskOverrides() {",
    "url: resolveVisaEscalationDemoUrl(),",
    "function buildVisaEscalationResultUiTaskOverrides() {",
    "function primeVisaEscalationDemoFields() {",
    "function resolveVisaEscalationDemoUrl() {",
    "function runVisaEscalationDemoPreset() {",
    "function runVisaEscalationResultPreset() {",
    'demoScenario: "visa_escalation_draft"',
    'demoScenario: "visa_escalation_result"',
    'case "run_visa_escalation_demo":',
    'case "review_visa_escalation_result":',
    'state.liveDemoScenario !== "visa_escalation_result" &&',
    "Open the visa escalation demo page",
  ];
  for (const token of requiredAppTokens) {
    assert.ok(appSource.includes(token), `app.js missing escalation preset token: ${token}`);
  }

  const requiredHtmlTokens = [
    'id="runVisaEscalationBtn"',
    'data-dashboard-action="run_visa_escalation_demo"',
    'data-i18n="live.compose.runVisaEscalation"',
    'id="reviewVisaEscalationResultBtn"',
    'data-dashboard-action="review_visa_escalation_result"',
    'data-i18n="live.compose.reviewVisaEscalation"',
    "Use these ready-made examples to show intake, document follow-up, reminders, CRM updates, and escalation without filling everything manually.",
    "Starts a ready-made visa case and pauses before the final protected step.",
    "Shows the finished result after approval, including the final summary on the right.",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `index.html missing escalation CTA token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("/ui-task-visa-escalation-demo.html"),
    "README should document the escalation fixture page",
  );
  assert.ok(
    readmeSource.includes("Escalate to Specialist"),
    "README should document the escalation preset",
  );
  assert.ok(
    readmeSource.includes("See Escalation Summary"),
    "README should document the escalation result preset",
  );
});
