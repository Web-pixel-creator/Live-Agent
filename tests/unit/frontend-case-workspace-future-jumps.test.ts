import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("move case forward keeps only the current move and future case jumps", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function shouldShowCaseWorkspaceCaseEntry(entry, activeActionId)",
    "return buttonIndex >= activeIndex;",
    'const caseDrawerMainOwned = drawerTarget === "case" && casePrimaryActionId.length > 0;',
    "const visibleCaseEntries = CASE_WORKSPACE_CASE_BUTTON_ENTRIES.filter((entry) => shouldShowCaseWorkspaceCaseEntry(entry, activeActionId));",
    "const visibleCaseActionIds = new Set(visibleCaseEntries.map((entry) => entry.actionId));",
    'suppressedActionIds: caseDrawerMainOwned ? new Set([casePrimaryActionId]) : null,',
    '"Later case moves"',
    "const caseLaterVisibleCount = visibleCaseEntries.filter((entry) => entry.actionId !== casePrimaryActionId).length;",
    "const idleCasePathPreview =",
    "caseLaterSteps.hidden = idleCasePathPreview || caseLaterVisibleCount === 0;",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing future-jumps token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("main row owns the active step")
      && readmeSource.includes("later case moves")
      && readmeSource.includes("earlier verified summary history plus restart"),
    "README should explain that completed review affordances live only in Result tools",
  );
  assert.ok(
    operatorGuideSource.includes("main row owns the active step")
      && operatorGuideSource.includes("later case moves")
      && operatorGuideSource.includes("earlier verified summary history plus restart"),
    "operator guide should explain that completed review affordances live only in Result tools",
  );
});
