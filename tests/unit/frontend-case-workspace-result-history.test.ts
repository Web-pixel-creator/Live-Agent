import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("result tools keeps earlier completed review history once the main row owns the current review", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function shouldShowCaseWorkspaceResultEntry(entry, activeActionId)",
    'if (entry.actionId === "reset_visa_demo") {',
    "return buttonIndex <= activeIndex;",
    'const resultDrawerMainOwned = drawerTarget === "result" && resultPrimaryActionId.length > 0;',
    "const visibleResultEntries = CASE_WORKSPACE_RESULT_BUTTON_ENTRIES.filter((entry) => shouldShowCaseWorkspaceResultEntry(entry, activeActionId));",
    "const visibleResultActionIds = new Set(visibleResultEntries.map((entry) => entry.actionId));",
    "const resultLaterVisibleCount = visibleResultEntries.filter((entry) => entry.actionId !== resultPrimaryActionId).length;",
    'suppressedActionIds: resultDrawerMainOwned ? new Set([resultPrimaryActionId]) : null,',
    '"Review history and restart"',
    '"Completed summaries and restart"',
    '"The current protected review is already open in the main row above. Earlier verified summaries and restart stay here."',
    '"History"',
    'resultDrawer.dataset.caseWorkspaceDrawerOwnership = drawerTarget === "result" ? "secondary" : "launcher";',
    "resultLaterTools.hidden = resultLaterVisibleCount === 0;",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing result-history token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("main row owns the active step")
      && readmeSource.includes("earlier verified summary history plus restart"),
    "README should describe Result tools as earlier history once the main row owns the current review",
  );
  assert.ok(
    operatorGuideSource.includes("main row owns the active step")
      && operatorGuideSource.includes("earlier verified summary history plus restart"),
    "operator guide should describe Result tools as earlier history once the main row owns the current review",
  );
});
