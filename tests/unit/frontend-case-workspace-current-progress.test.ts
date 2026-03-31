import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("current case card exposes a case-progress row sourced from guided flow state", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  assert.ok(
    htmlSource.includes('data-i18n="live.caseWorkspace.currentProgressLabel">Case progress</dt>')
      && htmlSource.includes('id="caseWorkspaceCurrentProgressValue">Step 1 of 5</dd>'),
    "index.html should expose a dedicated case-progress row in the Current case card",
  );

  for (const token of [
    '"live.caseWorkspace.currentProgressLabel": "Case progress"',
    'caseWorkspaceCurrentProgressValue: document.getElementById("caseWorkspaceCurrentProgressValue")',
    "function getCaseWorkspaceSummaryProgressValue(flowState, isRu)",
    "const totalSteps = CASE_WORKSPACE_FLOW_STEPS.length;",
    'return isRu ? `\\u0417\\u0430\\u0432\\u0435\\u0440\\u0448\\u0435\\u043d\\u043e ${totalSteps} \\u0438\\u0437 ${totalSteps}` : `Completed ${totalSteps} of ${totalSteps}`;',
    'return isRu ? `\\u0428\\u0430\\u0433 ${stepNumber} \\u0438\\u0437 ${totalSteps}` : `Step ${stepNumber} of ${totalSteps}`;',
    "const currentProgressLabel = document.querySelector('[data-i18n=\"live.caseWorkspace.currentProgressLabel\"]');",
    'el.caseWorkspaceCurrentProgressValue.textContent = getCaseWorkspaceSummaryProgressValue(flowState, isRu);',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing current-progress token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Current case` now also shows `Case progress`")
      && operatorGuideSource.includes("`Current case` now also shows `Case progress`"),
    "docs should explain the new guided-flow case-progress row",
  );
});
