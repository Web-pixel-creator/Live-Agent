import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("frontend ships a one-click CRM handoff demo preset with approved result summary", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");

  const requiredAppTokens = [
    'const VISA_HANDOFF_DEMO_URL_PATH = "/ui-task-visa-handoff-demo.html";',
    'const ACTIVE_TASK_VISA_HANDOFF_OWNER = "Sofia Kim";',
    'const ACTIVE_TASK_VISA_HANDOFF_WRITEBACK =',
    'const ACTIVE_TASK_VISA_HANDOFF_SUMMARY = [',
    'const ACTIVE_TASK_VISA_HANDOFF_APPROVAL_REASON =',
    'const ACTIVE_TASK_VISA_HANDOFF_PROMPT =',
    'const ACTIVE_TASK_VISA_HANDOFF_RESULT_PROMPT =',
    '"live.compose.runVisaHandoff": "Run CRM Update Demo"',
    '"live.compose.reviewVisaHandoff": "Review CRM Handoff Result"',
    '"live.compose.runVisaHandoffCardTitle": "CRM update + handoff"',
    '"live.compose.reviewVisaHandoffCardTitle": "Approved CRM writeback"',
    '"live.result.visaHandoffSummaryTitle": "CRM update handoff snapshot"',
    '"live.result.visaHandoffSummaryOwner": "CRM owner"',
    '"live.result.visaHandoffSummaryWriteback": "Writeback payload"',
    '"live.result.visaHandoffSummaryHandoffValue":',
    "function buildVisaHandoffUiTaskOverrides() {",
    "url: resolveVisaHandoffDemoUrl(),",
    "function buildVisaHandoffResultUiTaskOverrides() {",
    "function primeVisaHandoffDemoFields() {",
    "function resolveVisaHandoffDemoUrl() {",
    "function runVisaHandoffDemoPreset() {",
    "function runVisaHandoffResultPreset() {",
    'demoScenario: "visa_handoff_draft"',
    'demoScenario: "visa_handoff_result"',
    'case "run_visa_handoff_demo":',
    'case "review_visa_handoff_result":',
    'state.liveDemoScenario !== "visa_handoff_result"',
    "Open the visa CRM handoff demo page",
  ];
  for (const token of requiredAppTokens) {
    assert.ok(appSource.includes(token), `app.js missing CRM handoff preset token: ${token}`);
  }

  const requiredHtmlTokens = [
    'id="runVisaHandoffBtn"',
    'data-dashboard-action="run_visa_handoff_demo"',
    'data-i18n="live.compose.runVisaHandoff"',
    'id="reviewVisaHandoffResultBtn"',
    'data-dashboard-action="review_visa_handoff_result"',
    'data-i18n="live.compose.reviewVisaHandoff"',
    "Launch the seeded visa relocation flow, missing-docs follow-up, consultation reminder, case escalation, or CRM handoff without filling fields manually.",
    "Prepares the seeded relocation draft, missing-docs follow-up, consultation reminder, case escalation, or CRM handoff and stops before the protected action step.",
    "Runs the approved intake, follow-up, reminder, escalation, or CRM writeback path and checks the final confirmation banner.",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `index.html missing CRM handoff CTA token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("/ui-task-visa-handoff-demo.html"),
    "README should document the CRM handoff fixture page",
  );
  assert.ok(
    readmeSource.includes("Run CRM Update Demo"),
    "README should document the CRM handoff preset",
  );
  assert.ok(
    readmeSource.includes("Review CRM Handoff Result"),
    "README should document the CRM handoff result preset",
  );
});
