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
    'const VISA_INTAKE_DEMO_URL = "http://127.0.0.1:3000/ui-task-visa-intake-demo.html";',
    'const ACTIVE_TASK_VISA_INTAKE_DEMO_APPROVAL_REASON =',
    '"live.support.runVisaDemo": "Run Visa Intake Demo"',
    '"live.compose.reviewVisaDemo": "Review Visa Draft Result"',
    '"live.compose.runVisaDemoCardTitle": "Draft + approval boundary"',
    '"live.compose.reviewVisaDemoCardTitle": "Approved + verified completion"',
    '"live.result.visaSummaryTitle": "Visa intake completion snapshot"',
    '"live.result.visaSummaryHandoff": "Next operator step"',
    'demoScenario: "visa_result"',
    'action: "run_visa_intake_demo"',
    'case "review_visa_draft_result":',
    "runVisaIntakeResultPreset();",
    'summary: ACTIVE_TASK_VISA_INTAKE_DEMO_SUMMARY',
    'formData: { ...ACTIVE_TASK_VISA_INTAKE_DEMO_FORM_DATA }',
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
    'id="runVisaDemoBtn"',
    'data-dashboard-action="run_visa_intake_demo"',
    'data-i18n="live.compose.runVisaDemo"',
    'id="reviewVisaResultBtn"',
    'data-dashboard-action="review_visa_draft_result"',
    'data-i18n="live.compose.reviewVisaDemo"',
    'id="runVisaDemoHint"',
    'data-i18n="live.compose.runVisaDemoHint"',
    'class="live-compose-preset-map"',
    'data-i18n="live.compose.runVisaDemoCardTitle"',
    'data-i18n="live.compose.reviewVisaDemoCardTitle"',
    'id="liveResultSummary"',
    'id="liveResultSummaryTitle"',
    'id="liveResultSummaryList"',
    'id="liveResultSummaryHandoff"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `index.html missing visa demo CTA token: ${token}`);
  }

  const requiredStyleTokens = [
    ".live-compose-preset-hint",
    ".live-compose-preset-map",
    ".live-compose-preset-card",
    ".live-result-summary",
    ".live-result-summary-item",
    ".live-result-summary-handoff",
    "grid-template-columns: repeat(3, max-content);",
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
    readmeSource.includes("Run Visa Intake Demo"),
    "README should document the visa intake preset",
  );
  assert.ok(
    readmeSource.includes("Review Visa Draft Result"),
    "README should document the visa result preset",
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
