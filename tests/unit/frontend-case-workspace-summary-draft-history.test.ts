import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace keeps the latest verified summary while draft-only prep stays under what next", () => {
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
    '"live.caseWorkspace.statusPillCompleted": "Summary"',
    '"live.caseWorkspace.completedIdle": "The latest verified summary appears here after the first protected result or operator-ready handoff note."',
    '"live.caseWorkspace.completedBusy": "The latest verified summary updates here after the current action finishes."',
    "liveCaseLastVerifiedSummaryConfig: null,",
    "function getCaseWorkspaceCompletedSummaryPill(isRu)",
    "function getCaseWorkspaceCompletedIdleText(isRu)",
    "function getCaseWorkspaceCompletedBusyText(isRu)",
    "function cloneLiveResultSummaryConfig(summaryConfig)",
    'preparedDraftNote: "",',
    "defaultSnapshot.completedWork = getCaseWorkspaceCompletedIdleText(isRu);",
    "defaultSnapshot.completedPill = getCaseWorkspaceCompletedSummaryPill(isRu);",
    "busySnapshot.completedWork = getCaseWorkspaceCompletedBusyText(isRu);",
    "const completedSummaryConfig = summaryConfig ?? state.liveCaseLastVerifiedSummaryConfig;",
    "const sharedCompletedWork = buildCaseWorkspaceCompletedWorkText(completedSummaryConfig);",
    "const sharedCompletedPill =",
    "state.liveCaseLastVerifiedSummaryConfig = cloneLiveResultSummaryConfig(summaryConfig);",
    "state.liveCaseLastVerifiedSummaryConfig = null;",
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
    htmlSource.includes('id="caseWorkspaceCompletedPill" class="status-pill status-neutral" data-i18n="live.caseWorkspace.statusPillCompleted">Summary</span>')
      && htmlSource.includes("The latest verified summary appears here after the first protected result or operator-ready handoff note."),
    "index.html should keep a latest-summary fallback for completed work before the first verified result lands",
  );
  assert.ok(
    !appSource.includes('completedPill: { text: isRu ? "Готово" : "Completed", tone: "ok" },'),
    "verified result states should not relabel completed work as a generic completed card when it is showing the latest summary",
  );

  assert.ok(
    readmeSource.includes("`Completed work` now stays focused on the latest verified summary")
      && readmeSource.includes("`Result tools` keeps earlier verified history plus restart")
      && readmeSource.includes("`Next step` as `Prepared in draft`")
      && readmeSource.includes("keeps the verified summary badge during verified result states"),
    "README should explain that completed work keeps only the latest verified summary while Result tools holds earlier history",
  );
  assert.ok(
    operatorGuideSource.includes("`Completed work` now stays focused on the latest verified summary")
      && operatorGuideSource.includes("`Result tools` keeps earlier verified history plus restart")
      && operatorGuideSource.includes("`Next step` as `Prepared in draft`")
      && operatorGuideSource.includes("keeps the verified summary badge during verified result states"),
    "operator guide should explain that completed work keeps only the latest verified summary while Result tools holds earlier history",
  );
});
