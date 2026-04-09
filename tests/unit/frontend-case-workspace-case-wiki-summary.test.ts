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
      && htmlSource.includes('id="caseWorkspaceCaseWikiNextActionValue"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiPackLabel">Evidence pack</dt>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiPackValue"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiRefsLabel">Source refs</dt>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiRefsValue"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiProofLabel">Top proof</span>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiProofTitle"')
      && htmlSource.includes('id="caseWorkspaceCaseWikiProofSummary"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiEntityLabel">Key entity</span>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiEntityTitle"')
      && htmlSource.includes('id="caseWorkspaceCaseWikiEntitySummary"'),
    "index.html should expose a compact Case Wiki summary card inside Case Workspace",
  );

  for (const token of [
    '"live.caseWorkspace.caseWiki": "Case Wiki"',
    '"live.caseWorkspace.caseWikiStatusLabel": "Compiled status"',
    '"live.caseWorkspace.caseWikiSummaryLabel": "Known now"',
    '"live.caseWorkspace.caseWikiBlockerLabel": "Top blocker"',
    '"live.caseWorkspace.caseWikiNextActionLabel": "Next action"',
    '"live.caseWorkspace.caseWikiPackLabel": "Evidence pack"',
    '"live.caseWorkspace.caseWikiRefsLabel": "Source refs"',
    '"live.caseWorkspace.caseWikiProofLabel": "Top proof"',
    '"live.caseWorkspace.caseWikiEntityLabel": "Key entity"',
    'caseWorkspaceCaseWikiPill: document.getElementById("caseWorkspaceCaseWikiPill")',
    'caseWorkspaceCaseWikiStatusValue: document.getElementById("caseWorkspaceCaseWikiStatusValue")',
    'caseWorkspaceCaseWikiSummaryValue: document.getElementById("caseWorkspaceCaseWikiSummaryValue")',
    'caseWorkspaceCaseWikiBlockerValue: document.getElementById("caseWorkspaceCaseWikiBlockerValue")',
    'caseWorkspaceCaseWikiNextActionValue: document.getElementById("caseWorkspaceCaseWikiNextActionValue")',
    'caseWorkspaceCaseWikiPackValue: document.getElementById("caseWorkspaceCaseWikiPackValue")',
    'caseWorkspaceCaseWikiRefsValue: document.getElementById("caseWorkspaceCaseWikiRefsValue")',
    'caseWorkspaceCaseWikiProofTitle: document.getElementById("caseWorkspaceCaseWikiProofTitle")',
    'caseWorkspaceCaseWikiProofSummary: document.getElementById("caseWorkspaceCaseWikiProofSummary")',
    'caseWorkspaceCaseWikiEntityTitle: document.getElementById("caseWorkspaceCaseWikiEntityTitle")',
    'caseWorkspaceCaseWikiEntitySummary: document.getElementById("caseWorkspaceCaseWikiEntitySummary")',
    "function buildCaseWorkspaceCaseWikiSummary(isRu)",
    "function renderCaseWorkspaceCaseWikiSummary()",
    "const evidencePack = resolveOperatorCaseWikiEvidencePack(snapshot);",
    "const caseWikiSummary = buildCaseWorkspaceCaseWikiSummary(isRu);",
    "el.caseWorkspaceCaseWikiStatusValue.textContent = caseWikiSummary.statusValue;",
    "el.caseWorkspaceCaseWikiProofTitle.textContent = caseWikiSummary.proofTitle;",
    "el.caseWorkspaceCaseWikiEntityTitle.textContent = caseWikiSummary.entityTitle;",
    "el.caseWorkspaceCaseWikiPackValue.textContent = caseWikiSummary.packValue;",
    "el.caseWorkspaceCaseWikiRefsValue.textContent = caseWikiSummary.refsValue;",
    "renderCaseWorkspaceCaseWikiSummary();",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing case wiki workspace token: ${token}`);
  }

  for (const token of [
    ".case-workspace-summary-case-wiki {",
    "grid-column: 1 / -1;",
    ".case-workspace-summary-case-wiki .case-workspace-summary-list {",
    ".case-workspace-case-wiki-evidence-rail {",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing case wiki workspace token: ${token}`);
  }
});
