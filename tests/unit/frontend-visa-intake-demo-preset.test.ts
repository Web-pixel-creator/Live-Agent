import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("frontend ships a one-click visa intake demo preset with summary-backed ui task overrides", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");

  const requiredAppTokens = [
    'const VISA_INTAKE_DEMO_URL = "http://127.0.0.1:3000/ui-task-visa-intake-demo.html";',
    '"live.support.runVisaDemo": "Run Visa Intake Demo"',
    'action: "run_visa_intake_demo"',
    'summary: ACTIVE_TASK_VISA_INTAKE_DEMO_SUMMARY',
    'formData: { ...ACTIVE_TASK_VISA_INTAKE_DEMO_FORM_DATA }',
    'const uiTaskOverrides = { ...collectUiTaskOverrides(), ...explicitUiTaskOverrides };',
    'sendIntentRequest({',
    'message: ACTIVE_TASK_VISA_INTAKE_DEMO_PROMPT',
  ];
  for (const token of requiredAppTokens) {
    assert.ok(appSource.includes(token), `app.js missing visa demo preset token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("/ui-task-visa-intake-demo.html"),
    "README should document the visa intake fixture page",
  );
  assert.ok(
    readmeSource.includes("Run Visa Intake Demo"),
    "README should document the visa intake preset",
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
