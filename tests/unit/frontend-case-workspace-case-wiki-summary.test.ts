import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace surfaces a compact case wiki summary fed from operator compiled memory", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");

  assert.ok(
    htmlSource.includes('data-i18n="live.caseWorkspace.caseWiki">Case Wiki</span>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiPill"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiStatusLabel">Compiled status</dt>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiStatusValue"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiSummaryLabel">Known now</dt>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiSummaryValue"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiBlockerLabel">Top blocker</dt>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiBlockerValue"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiNextActionLabel">Next action</dt>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiNextActionValue"'),
    "index.html should expose a compact Case Wiki summary card inside Case Workspace",
  );

  for (const token of [
    '"live.caseWorkspace.caseWiki": "Case Wiki"',
    '"live.caseWorkspace.caseWikiStatusLabel": "Compiled status"',
    '"live.caseWorkspace.caseWikiSummaryLabel": "Known now"',
    '"live.caseWorkspace.caseWikiBlockerLabel": "Top blocker"',
    '"live.caseWorkspace.caseWikiNextActionLabel": "Next action"',
    'caseWorkspaceCaseWikiPill: document.getElementById("caseWorkspaceCaseWikiPill")',
    'caseWorkspaceCaseWikiStatusValue: document.getElementById("caseWorkspaceCaseWikiStatusValue")',
    'caseWorkspaceCaseWikiSummaryValue: document.getElementById("caseWorkspaceCaseWikiSummaryValue")',
    'caseWorkspaceCaseWikiBlockerValue: document.getElementById("caseWorkspaceCaseWikiBlockerValue")',
    'caseWorkspaceCaseWikiNextActionValue: document.getElementById("caseWorkspaceCaseWikiNextActionValue")',
    "function buildCaseWorkspaceCaseWikiSummary(isRu)",
    "function renderCaseWorkspaceCaseWikiSummary()",
    "const caseWikiSummary = buildCaseWorkspaceCaseWikiSummary(isRu);",
    "el.caseWorkspaceCaseWikiStatusValue.textContent = caseWikiSummary.statusValue;",
    "renderCaseWorkspaceCaseWikiSummary();",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing case wiki workspace token: ${token}`);
  }

  for (const token of [
    ".case-workspace-summary-case-wiki {",
    "grid-column: 1 / -1;",
    ".case-workspace-summary-case-wiki .case-workspace-summary-list {",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing case wiki workspace token: ${token}`);
  }
});
