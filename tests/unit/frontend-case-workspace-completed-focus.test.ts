import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace completed-work card exposes the latest proof title above summary details", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");

  assert.ok(
    htmlSource.includes('data-i18n="live.caseWorkspace.completedFocusLabel">Latest proof</span>')
      && htmlSource.includes('id="caseWorkspaceCompletedFocusValue"'),
    "index.html should expose a latest-proof row in the Completed work card",
  );

  for (const token of [
    '"live.caseWorkspace.completedFocusLabel": "Latest proof"',
    'caseWorkspaceCompletedFocusValue: document.getElementById("caseWorkspaceCompletedFocusValue")',
    "function getCaseWorkspaceCompletedFocusValue(summaryConfig, isRu)",
    "el.caseWorkspaceCompletedFocusValue.textContent = getCaseWorkspaceCompletedFocusValue(completedSummaryConfig, isRu);",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing completed-focus token: ${token}`);
  }

  for (const token of [
    ".case-workspace-summary-completed-focus",
    ".case-workspace-summary-completed-focus-label",
    ".case-workspace-summary-completed-focus-value",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing completed-focus token: ${token}`);
  }
});
