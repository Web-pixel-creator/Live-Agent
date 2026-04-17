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
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiCostLabel">Cost posture</dt>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiCostValue"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiPackLabel">Evidence pack</dt>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiPackValue"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiRefsLabel">Source refs</dt>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiRefsValue"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiQuestionsLabel">Open questions</dt>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiQuestionsValue"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiTimelineLabel">Timeline</dt>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiTimelineValue"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiDrilldownLabel">Evidence drilldown</dt>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiDrilldownValue"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiHandoffLabel">Handoff preview</dt>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiHandoffValue"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiProofChipsLabel">Proof focus</span>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiProofChips"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiQuestionChipsLabel">Question focus</span>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiQuestionChips"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiProofDetailLabel">Proof detail</span>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiProofDetailTitle"')
      && htmlSource.includes('id="caseWorkspaceCaseWikiProofDetailMeta"')
      && htmlSource.includes('id="caseWorkspaceCaseWikiProofDetailBadges"')
      && htmlSource.includes('id="caseWorkspaceCaseWikiProofDetailBody"')
      && htmlSource.includes('id="caseWorkspaceCaseWikiProofHandoffCopyBtn"')
      && htmlSource.includes('id="caseWorkspaceCaseWikiProofRefsCopyBtn"')
      && htmlSource.includes('id="caseWorkspaceCaseWikiProofOpenOpsBtn"')
      && htmlSource.includes('data-i18n="live.caseWorkspace.caseWikiQuestionDetailLabel">Question detail</span>')
      && htmlSource.includes('id="caseWorkspaceCaseWikiQuestionDetailTitle"')
      && htmlSource.includes('id="caseWorkspaceCaseWikiQuestionDetailMeta"')
      && htmlSource.includes('id="caseWorkspaceCaseWikiQuestionDetailBadges"')
      && htmlSource.includes('id="caseWorkspaceCaseWikiQuestionDetailBody"')
      && htmlSource.includes('id="caseWorkspaceCaseWikiQuestionHandoffCopyBtn"')
      && htmlSource.includes('id="caseWorkspaceCaseWikiQuestionRefsCopyBtn"')
      && htmlSource.includes('id="caseWorkspaceCaseWikiQuestionOpenOpsBtn"')
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
    '"live.caseWorkspace.caseWikiCostLabel": "Cost posture"',
    '"live.caseWorkspace.caseWikiPackLabel": "Evidence pack"',
    '"live.caseWorkspace.caseWikiRefsLabel": "Source refs"',
    '"live.caseWorkspace.caseWikiQuestionsLabel": "Open questions"',
    '"live.caseWorkspace.caseWikiTimelineLabel": "Timeline"',
    '"live.caseWorkspace.caseWikiDrilldownLabel": "Evidence drilldown"',
    '"live.caseWorkspace.caseWikiHandoffLabel": "Handoff preview"',
    '"live.caseWorkspace.caseWikiProofChipsLabel": "Proof focus"',
    '"live.caseWorkspace.caseWikiQuestionChipsLabel": "Question focus"',
    '"live.caseWorkspace.caseWikiProofDetailLabel": "Proof detail"',
    '"live.caseWorkspace.caseWikiQuestionDetailLabel": "Question detail"',
    '"live.caseWorkspace.caseWikiCopyHandoff": "Copy handoff"',
    '"live.caseWorkspace.caseWikiCopyRefs": "Copy refs"',
    '"live.caseWorkspace.caseWikiOpenOps": "Open in Operator Ops"',
    '"live.caseWorkspace.caseWikiProofLabel": "Top proof"',
    '"live.caseWorkspace.caseWikiEntityLabel": "Key entity"',
    'caseWorkspaceCaseWikiPill: document.getElementById("caseWorkspaceCaseWikiPill")',
    'caseWorkspaceCaseWikiStatusValue: document.getElementById("caseWorkspaceCaseWikiStatusValue")',
    'caseWorkspaceCaseWikiSummaryValue: document.getElementById("caseWorkspaceCaseWikiSummaryValue")',
    'caseWorkspaceCaseWikiBlockerValue: document.getElementById("caseWorkspaceCaseWikiBlockerValue")',
    'caseWorkspaceCaseWikiNextActionValue: document.getElementById("caseWorkspaceCaseWikiNextActionValue")',
    'caseWorkspaceCaseWikiCostValue: document.getElementById("caseWorkspaceCaseWikiCostValue")',
    'caseWorkspaceCaseWikiPackValue: document.getElementById("caseWorkspaceCaseWikiPackValue")',
    'caseWorkspaceCaseWikiRefsValue: document.getElementById("caseWorkspaceCaseWikiRefsValue")',
    'caseWorkspaceCaseWikiQuestionsValue: document.getElementById("caseWorkspaceCaseWikiQuestionsValue")',
    'caseWorkspaceCaseWikiTimelineValue: document.getElementById("caseWorkspaceCaseWikiTimelineValue")',
    'caseWorkspaceCaseWikiDrilldownValue: document.getElementById("caseWorkspaceCaseWikiDrilldownValue")',
    'caseWorkspaceCaseWikiHandoffValue: document.getElementById("caseWorkspaceCaseWikiHandoffValue")',
    'caseWorkspaceCaseWikiProofChips: document.getElementById("caseWorkspaceCaseWikiProofChips")',
    'caseWorkspaceCaseWikiQuestionChips: document.getElementById("caseWorkspaceCaseWikiQuestionChips")',
    'caseWorkspaceCaseWikiProofDetailTitle: document.getElementById("caseWorkspaceCaseWikiProofDetailTitle")',
    'caseWorkspaceCaseWikiProofDetailMeta: document.getElementById("caseWorkspaceCaseWikiProofDetailMeta")',
    'caseWorkspaceCaseWikiProofDetailBadges: document.getElementById("caseWorkspaceCaseWikiProofDetailBadges")',
    'caseWorkspaceCaseWikiProofDetailBody: document.getElementById("caseWorkspaceCaseWikiProofDetailBody")',
    'caseWorkspaceCaseWikiProofHandoffCopyBtn: document.getElementById("caseWorkspaceCaseWikiProofHandoffCopyBtn")',
    'caseWorkspaceCaseWikiProofRefsCopyBtn: document.getElementById("caseWorkspaceCaseWikiProofRefsCopyBtn")',
    'caseWorkspaceCaseWikiProofOpenOpsBtn: document.getElementById("caseWorkspaceCaseWikiProofOpenOpsBtn")',
    'caseWorkspaceCaseWikiQuestionDetailTitle: document.getElementById("caseWorkspaceCaseWikiQuestionDetailTitle")',
    'caseWorkspaceCaseWikiQuestionDetailMeta: document.getElementById("caseWorkspaceCaseWikiQuestionDetailMeta")',
    'caseWorkspaceCaseWikiQuestionDetailBadges: document.getElementById("caseWorkspaceCaseWikiQuestionDetailBadges")',
    'caseWorkspaceCaseWikiQuestionDetailBody: document.getElementById("caseWorkspaceCaseWikiQuestionDetailBody")',
    'caseWorkspaceCaseWikiQuestionHandoffCopyBtn: document.getElementById("caseWorkspaceCaseWikiQuestionHandoffCopyBtn")',
    'caseWorkspaceCaseWikiQuestionRefsCopyBtn: document.getElementById("caseWorkspaceCaseWikiQuestionRefsCopyBtn")',
    'caseWorkspaceCaseWikiQuestionOpenOpsBtn: document.getElementById("caseWorkspaceCaseWikiQuestionOpenOpsBtn")',
    'caseWorkspaceCaseWikiProofTitle: document.getElementById("caseWorkspaceCaseWikiProofTitle")',
    'caseWorkspaceCaseWikiProofSummary: document.getElementById("caseWorkspaceCaseWikiProofSummary")',
    'caseWorkspaceCaseWikiEntityTitle: document.getElementById("caseWorkspaceCaseWikiEntityTitle")',
    'caseWorkspaceCaseWikiEntitySummary: document.getElementById("caseWorkspaceCaseWikiEntitySummary")',
    "function buildCaseWorkspaceCaseWikiSummary(isRu)",
    "function renderCaseWorkspaceCaseWikiSummary()",
    "const evidencePack = resolveOperatorCaseWikiEvidencePack(snapshot);",
    "const focusedItem = resolveOperatorCaseWikiPreferredWorkspaceFocus(snapshot, evidencePack);",
    "const previewPack = isRecord(snapshot.previewPack) ? snapshot.previewPack : null;",
    "const workspacePack = isRecord(snapshot.workspacePack) ? snapshot.workspacePack : null;",
    "function buildCaseWorkspaceCaseWikiCostValue(costSummary, isRu) {",
    "const workspaceCostValue =",
    "buildCaseWorkspaceCaseWikiCostValue(workspacePack?.costSummary, isRu)",
    "const focusPack = isRecord(snapshot?.focusPack) ? snapshot.focusPack : null;",
    "function resolveOperatorCaseWikiPreferredWorkspaceFocus(snapshot, evidencePack, preferredKind = null) {",
    "const defaultFocus = isRecord(workspacePack?.defaultFocus) ? workspacePack.defaultFocus : null;",
    "const defaultFocusRecord = resolveById(defaultFocusKind, defaultFocus?.focusId);",
    "resolveOperatorCaseWikiTopProof(snapshot)?.id",
    "resolveOperatorCaseWikiTopBlockingQuestion(snapshot)?.id",
    "const explicitFocus = normalizeOperatorCaseWikiFocus(state.operatorCaseWikiFocus);",
    "resolveOperatorCaseWikiPreferredWorkspaceFocus(snapshot, evidencePack, kind)",
    "const questionsValue =",
    "const timelineValue =",
    "const proofChips = buildOperatorCaseWikiFocusChipRail(evidencePack, \"proof\");",
    "const questionChips = buildOperatorCaseWikiFocusChipRail(evidencePack, \"question\");",
    "Array.isArray(focusPack?.proofs)",
    "Array.isArray(focusPack?.questions)",
    "const labelSource = toOptionalText(item?.focusLabel)",
    "title: toOptionalText(item?.chipTitle) ?? null,",
    "const proofDetailPackItem = resolveOperatorCaseWikiDetailPackItem(snapshot, \"proof\", proofDetailFocusId);",
    "const questionDetailPackItem = resolveOperatorCaseWikiDetailPackItem(snapshot, \"question\", questionDetailFocusId);",
    "const proofDetail =",
    "const questionDetail =",
    "const workspaceStatusValue =",
    "const workspaceSummaryValue =",
    "const workspaceBlockerValue =",
    "const workspaceNextActionValue =",
    "costValue: workspaceCostValue",
    "const workspaceProofTitle =",
    "const workspaceProofSummary =",
    "const workspaceEntityTitle =",
    "const workspaceEntitySummary =",
    "resolveOperatorCaseWikiDetailPackItem(snapshot, \"proof\", proofDetailFocusId)",
    "resolveOperatorCaseWikiDetailPackItem(snapshot, \"question\", questionDetailFocusId)",
    "function buildOperatorCaseWikiDetailValueFromPackItem(detailPackItem) {",
    "function buildOperatorCaseWikiDetailBadgesFromPackItem(detailPackItem) {",
    "function resolveOperatorCaseWikiActionPackItem(snapshot, kind, focusId) {",
    "function resolveOperatorCaseWikiFocusPackItem(snapshot, kind, focusId) {",
    "function buildOperatorCaseWikiProofDetailValue(proof, isRu) {",
    "function buildOperatorCaseWikiQuestionDetailValue(question, isRu) {",
    "function buildOperatorCaseWikiDetailBadges(kind, item, isRu) {",
    "function buildOperatorCaseWikiDetailActionBundle(kind, isRu) {",
    "const focusedItem = resolveOperatorCaseWikiPreferredWorkspaceFocus(snapshot, evidencePack, kind);",
    "explicitFocus?.kind === kind && explicitFocus?.id === focusedItem.id",
    "const actionPackItem = resolveOperatorCaseWikiActionPackItem(snapshot, kind, target.id);",
    "const focusPackItem = focusId ? resolveOperatorCaseWikiFocusPackItem(snapshot, focusedItem.kind, focusId) : null;",
    "function renderCaseWorkspaceCaseWikiDetailBadges(container, badges) {",
    "async function copyOperatorCaseWikiDetailAction(kind, action) {",
    "function openCaseWorkspaceCaseWikiInOperatorOps(kind) {",
    "openOperatorSupportPanel(el.operatorSessionOpsControl, el.operatorCaseWikiFocusedRoutingSnapshot);",
    "const drilldownValue =",
    "const handoffValue =",
    "function renderCaseWorkspaceCaseWikiFocusRail(container, chips, emptyText) {",
    "const caseWikiSummary = buildCaseWorkspaceCaseWikiSummary(isRu);",
    "const caseWikiExportGate = resolveOperatorCaseWikiComplianceExportGate(caseWikiSnapshot);",
    "const caseWikiExportBlocked = caseWikiExportGate.blocked === true;",
    "buildComplianceRemediationNextStepText",
    "remediation",
    "primaryAction",
    "Next step:",
    "el.caseWorkspaceCaseWikiStatusValue.textContent = caseWikiSummary.statusValue;",
    "el.caseWorkspaceCaseWikiCostValue.textContent = caseWikiSummary.costValue;",
    "el.caseWorkspaceCaseWikiProofTitle.textContent = caseWikiSummary.proofTitle;",
    "el.caseWorkspaceCaseWikiEntityTitle.textContent = caseWikiSummary.entityTitle;",
    "el.caseWorkspaceCaseWikiPackValue.textContent = caseWikiSummary.packValue;",
    "el.caseWorkspaceCaseWikiRefsValue.textContent = caseWikiSummary.refsValue;",
    "el.caseWorkspaceCaseWikiQuestionsValue.textContent = caseWikiSummary.questionsValue;",
    "el.caseWorkspaceCaseWikiTimelineValue.textContent = caseWikiSummary.timelineValue;",
    "el.caseWorkspaceCaseWikiDrilldownValue.textContent = caseWikiSummary.drilldownValue;",
    "el.caseWorkspaceCaseWikiHandoffValue.textContent = caseWikiSummary.handoffValue;",
    "el.caseWorkspaceCaseWikiProofDetailTitle.textContent = caseWikiSummary.proofDetailTitle;",
    "el.caseWorkspaceCaseWikiQuestionDetailTitle.textContent = caseWikiSummary.questionDetailTitle;",
    "renderCaseWorkspaceCaseWikiDetailBadges(",
    "el.caseWorkspaceCaseWikiProofHandoffCopyBtn.disabled = caseWikiExportBlocked || !proofActionBundle?.handoffText;",
    "el.caseWorkspaceCaseWikiProofRefsCopyBtn.disabled = caseWikiExportBlocked || !proofActionBundle?.refsText;",
    "el.caseWorkspaceCaseWikiQuestionHandoffCopyBtn.disabled = caseWikiExportBlocked || !questionActionBundle?.handoffText;",
    "el.caseWorkspaceCaseWikiQuestionRefsCopyBtn.disabled = caseWikiExportBlocked || !questionActionBundle?.refsText;",
    "Case Wiki export is blocked until raw evidence refs are redacted",
    "el.caseWorkspaceCaseWikiProofOpenOpsBtn.disabled = !proofActionBundle?.focusId;",
    "el.caseWorkspaceCaseWikiQuestionOpenOpsBtn.disabled = !questionActionBundle?.focusId;",
    "renderCaseWorkspaceCaseWikiFocusRail(",
    "renderCaseWorkspaceCaseWikiSummary();",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing case wiki workspace token: ${token}`);
  }

  for (const token of [
    ".case-workspace-summary-case-wiki {",
    "grid-column: 1 / -1;",
    ".case-workspace-summary-case-wiki .case-workspace-summary-list {",
    ".case-workspace-case-wiki-focus-shell {",
    ".case-workspace-case-wiki-focus-rail {",
    ".case-workspace-case-wiki-focus-chip {",
    ".case-workspace-case-wiki-detail-shell {",
    ".case-workspace-case-wiki-detail-row {",
    ".case-workspace-case-wiki-detail-summary {",
    ".case-workspace-case-wiki-detail-badges {",
    ".case-workspace-case-wiki-detail-badge {",
    ".case-workspace-case-wiki-detail-actions {",
    ".case-workspace-case-wiki-detail-action {",
    ".case-workspace-case-wiki-evidence-rail {",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing case wiki workspace token: ${token}`);
  }
});
