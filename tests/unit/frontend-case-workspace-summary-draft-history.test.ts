import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace keeps completed work on verified history while draft-only prep stays under what next", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="caseWorkspacePreparedDraftShell"',
    'id="caseWorkspacePreparedDraftLabel"',
    'id="caseWorkspacePreparedDraftNote"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing prepared-draft summary token: ${token}`);
  }

  for (const token of [
    'caseWorkspacePreparedDraftShell: document.getElementById("caseWorkspacePreparedDraftShell")',
    'caseWorkspacePreparedDraftLabel: document.getElementById("caseWorkspacePreparedDraftLabel")',
    'caseWorkspacePreparedDraftNote: document.getElementById("caseWorkspacePreparedDraftNote")',
    '"live.caseWorkspace.preparedDraftLabel": "Prepared in draft"',
    'preparedDraftNote: "",',
    "const sharedCompletedWork = buildCaseWorkspaceCompletedWorkText(summaryConfig);",
    "const sharedCompletedPill =",
    'preparedDraftNote: isRu',
    "completedWork: sharedCompletedWork || defaultSnapshot.completedWork,",
    "completedPill: sharedCompletedPill,",
    'el.caseWorkspacePreparedDraftShell.hidden = !(typeof snapshot.preparedDraftNote === "string" && snapshot.preparedDraftNote.trim().length > 0);',
    'typeof snapshot.preparedDraftNote === "string" ? snapshot.preparedDraftNote : ""',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing prepared-draft summary token: ${token}`);
  }

  for (const token of [
    ".case-workspace-summary-prepared",
    ".case-workspace-summary-prepared-label",
    ".case-workspace-summary-prepared-copy",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing prepared-draft summary token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Completed work` now stays reserved for verified history")
      && readmeSource.includes("`Next step` as `Prepared in draft`"),
    "README should explain that draft-only context moved under Next step while completed work stays verified-history only",
  );
  assert.ok(
    operatorGuideSource.includes("`Completed work` now stays reserved for verified history")
      && operatorGuideSource.includes("`Next step` as `Prepared in draft`"),
    "operator guide should explain that draft-only context moved under Next step while completed work stays verified-history only",
  );
});
