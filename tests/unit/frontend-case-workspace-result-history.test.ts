import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("result tools keeps current review above completed review history", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function shouldShowCaseWorkspaceResultEntry(entry, activeActionId)",
    'if (entry.actionId === "reset_visa_demo") {',
    "return buttonIndex <= activeIndex;",
    "const visibleResultEntries = CASE_WORKSPACE_RESULT_BUTTON_ENTRIES.filter((entry) => shouldShowCaseWorkspaceResultEntry(entry, activeActionId));",
    "const visibleResultActionIds = new Set(visibleResultEntries.map((entry) => entry.actionId));",
    "const resultLaterVisibleCount = visibleResultEntries.filter((entry) => entry.actionId !== resultPrimaryActionId).length;",
    '{ visibleActionIds: visibleResultActionIds },',
    '"Completed summaries and restart"',
    '"Earlier verified summaries and restart stay here as the review history lane."',
    '"History"',
    "resultLaterTools.hidden = resultLaterVisibleCount === 0;",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing result-history token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("current protected review on top")
      && readmeSource.includes("completed summary history plus restart underneath it"),
    "README should describe Result tools as current review plus completed review history",
  );
  assert.ok(
    operatorGuideSource.includes("current protected review on top")
      && operatorGuideSource.includes("completed summary history plus restart underneath it"),
    "operator guide should describe Result tools as current review plus completed review history",
  );
});
