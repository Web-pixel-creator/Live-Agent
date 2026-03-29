import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace next-step card exposes a concrete action focus above the prose copy", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  assert.ok(
    htmlSource.includes('data-i18n="live.caseWorkspace.nextStepFocusLabel">Action</span>')
      && htmlSource.includes('id="caseWorkspaceNextStepFocusValue"'),
    "index.html should expose a dedicated action-focus row in the Next step card",
  );

  for (const token of [
    '"live.caseWorkspace.nextStepFocusLabel": "Action"',
    'caseWorkspaceNextStepFocusValue: document.getElementById("caseWorkspaceNextStepFocusValue")',
    `const nextStepFocusLabel = document.querySelector('[data-i18n="live.caseWorkspace.nextStepFocusLabel"]');`,
    "el.caseWorkspaceNextStepFocusValue.textContent = snapshot.nextStepValue;",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing next-step focus token: ${token}`);
  }

  for (const token of [
    ".case-workspace-summary-next-focus",
    ".case-workspace-summary-next-focus-label",
    ".case-workspace-summary-next-focus-value",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing next-step focus token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Next step` now also surfaces that operator action as a short `Action` line"),
    "README should explain the new action-focus line in the Next step card",
  );
  assert.ok(
    operatorGuideSource.includes("`Next step` now also surfaces that operator action as a short `Action` line"),
    "operator guide should explain the new action-focus line in the Next step card",
  );
});
