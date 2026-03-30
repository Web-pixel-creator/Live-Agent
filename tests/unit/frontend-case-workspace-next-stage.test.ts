import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace next-step card exposes an after-this stage row", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  assert.ok(
    htmlSource.includes('data-i18n="live.caseWorkspace.nextStepStageLabel">After this</span>')
      && htmlSource.includes('id="caseWorkspaceNextStepStageValue"')
      && htmlSource.includes('class="case-workspace-summary-next-stage-value">Documents</strong>'),
    "index.html should expose an After this row in the Next step card",
  );

  for (const token of [
    '"live.caseWorkspace.nextStepStageLabel": "After this"',
    'caseWorkspaceNextStepStageValue: document.getElementById("caseWorkspaceNextStepStageValue")',
    "function getCaseWorkspaceNextStageValue(flowState, isRu)",
    "return isRu ? \"\\u041f\\u0443\\u0442\\u044c \\u043a\\u0435\\u0439\\u0441\\u0430\" : \"Guided case path\";",
    'return isRu ? "\\u041f\\u0440\\u043e\\u0432\\u0435\\u0440\\u043a\\u0430 intake" : "Intake review";',
    'return isRu ? "\\u041f\\u0440\\u043e\\u0432\\u0435\\u0440\\u043a\\u0430 \\u0434\\u043e\\u043a\\u0443\\u043c\\u0435\\u043d\\u0442\\u043e\\u0432" : "Documents review";',
    'const manualContinuationLabel = isRu ? "\\u0420\\u0443\\u0447\\u043d\\u043e\\u0435 \\u043f\\u0440\\u043e\\u0434\\u043e\\u043b\\u0436\\u0435\\u043d\\u0438\\u0435" : "Manual continuation";',
    "if (/_draft$/.test(scenario)) {",
    "if (/_result$/.test(scenario)) {",
    "const nextStepStageLabel = document.querySelector('[data-i18n=\"live.caseWorkspace.nextStepStageLabel\"]');",
    'el.caseWorkspaceNextStepStageValue.textContent = getCaseWorkspaceNextStageValue(flowState, isRu);',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing next-stage token: ${token}`);
  }

  for (const token of [
    ".case-workspace-summary-next-stage",
    ".case-workspace-summary-next-stage-label",
    ".case-workspace-summary-next-stage-value",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing next-stage style token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Next step` now also shows `After this`"),
    "README should explain the new After this row in the Next step card",
  );
  assert.ok(
    operatorGuideSource.includes("`Next step` now also shows `After this`"),
    "operator guide should explain the new After this row in the Next step card",
  );
  assert.ok(
    readmeSource.includes("what opens immediately after this step")
      && operatorGuideSource.includes("what opens immediately after this step"),
    "docs should explain that After this follows the immediate proof path, not a distant future stage",
  );
});
