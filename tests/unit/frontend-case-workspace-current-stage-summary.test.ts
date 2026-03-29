import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace keeps the current stage separate from the next-step action", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  assert.ok(
    htmlSource.includes('data-i18n="live.caseWorkspace.currentStageLabel">Current stage</dt>')
      && htmlSource.includes('id="caseWorkspaceCurrentStageValue">Case</dd>'),
    "index.html should expose a dedicated current-stage row in the Current case card",
  );
  assert.ok(
    !htmlSource.includes('id="caseWorkspaceNextStepValue"'),
    "the Current case card should no longer reuse the next-step value slot",
  );

  for (const token of [
    '"live.caseWorkspace.currentStageLabel": "Current stage"',
    'caseWorkspaceCurrentStageValue: document.getElementById("caseWorkspaceCurrentStageValue")',
    "function getCaseWorkspaceSummaryStageValue(",
    "const currentStageLabel = document.querySelector('[data-i18n=\"live.caseWorkspace.currentStageLabel\"]');",
    'el.caseWorkspaceCurrentStageValue.textContent = getCaseWorkspaceSummaryStageValue(flowState, isRu);',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing current-stage summary token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Current case` now shows the active stage"),
    "README should explain that Current case now owns the stage while Next step stays action-oriented",
  );
  assert.ok(
    operatorGuideSource.includes("`Current case` now shows the active stage"),
    "operator guide should explain that Current case now owns the stage while Next step stays action-oriented",
  );
});
