import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("current case card exposes a dedicated current-responsibility row without collapsing into next-step copy", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  assert.ok(
    htmlSource.includes('data-i18n="live.caseWorkspace.currentResponsibilityLabel">Current responsibility</dt>')
      && htmlSource.includes('id="caseWorkspaceCurrentResponsibilityValue">Intake launch</dd>'),
    "index.html should expose a dedicated current-responsibility row in the Current case card",
  );

  for (const token of [
    '"live.caseWorkspace.currentResponsibilityLabel": "Current responsibility"',
    'caseWorkspaceCurrentResponsibilityValue: document.getElementById("caseWorkspaceCurrentResponsibilityValue")',
    "function getCaseWorkspaceSummaryResponsibilityValue(flowState, isRu)",
    'const currentResponsibilityLabel = document.querySelector(\'[data-i18n="live.caseWorkspace.currentResponsibilityLabel"]\');',
    'el.caseWorkspaceCurrentResponsibilityValue.textContent = getCaseWorkspaceSummaryResponsibilityValue(flowState, isRu);',
    '"Operator approval"',
    '"Operator review"',
    '"Operator case move"',
    '"Assigned human owner"',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing current-responsibility token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Current case` now also shows the current responsibility")
      && operatorGuideSource.includes("`Current case` now also shows the current responsibility"),
    "docs should explain that Current case now keeps a separate current-responsibility row",
  );
});
