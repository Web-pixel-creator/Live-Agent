import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend keeps live negotiator UX guardrails for advanced controls and sticky KPI rail", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    'id="connectionAdvancedSection"',
    'id="liveSetupAdvanced"',
    'id="approvalAdvancedSection"',
    'id="uiTaskAdvancedSection"',
    'id="exportMenu"',
    "class=\"actions actions-priority\"",
    "class=\"action-group action-group-primary\"",
    "class=\"action-group action-group-secondary\"",
    "class=\"panel panel-transcript panel-transcript-live\"",
    'id="uiTaskFields"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing live-negotiator ux token: ${token}`);
  }

  const transcriptIdOccurrences = htmlSource.match(/id="transcript"/g)?.length ?? 0;
  assert.equal(transcriptIdOccurrences, 1, "frontend html should keep a single transcript container id");

  const requiredRuntimeTokens = [
    'uiTaskAdvancedSection: document.getElementById("uiTaskAdvancedSection")',
    "el.uiTaskAdvancedSection.hidden = !isUiTaskIntent;",
    'el.uiTaskAdvancedSection.setAttribute("aria-hidden", isUiTaskIntent ? "false" : "true");',
    "el.uiTaskAdvancedSection.open = isUiTaskIntent;",
    "function renderActiveTaskEmptyState() {",
    "applyIntentTemplateFromActiveTasks(scenario.intent, scenario.template);",
    "renderActiveTaskEmptyState();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing live-negotiator ux token: ${token}`);
  }

  const requiredStyleTokens = [
    ".advanced-settings {",
    ".advanced-connection-settings {",
    ".live-negotiator-secondary {",
    "position: sticky;",
    ".actions-priority {",
    ".actions-priority .action-group-primary {",
    ".actions-priority .action-group-secondary.action-group-export {",
    ".action-group {",
    ".panel-transcript-live .transcript {",
    "position: static;",
    ".active-task-empty-state {",
    ".active-task-empty-actions {",
    ".active-task-empty-action-refresh {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing live-negotiator ux token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("primary` and `secondary` action lanes"),
    "README missing action-lane hierarchy note",
  );
  assert.ok(
    operatorGuideSource.includes("top toolbars separate `primary` and `secondary` action lanes"),
    "operator guide missing action-lane hierarchy note",
  );
  assert.ok(
    operatorGuideSource.includes("`Active Tasks` empty state offers one-click quick starts"),
    "operator guide missing active task empty-state quick starts note",
  );
});
