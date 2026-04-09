import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function assertStructuredReplayRefreshContract(source) {
  assert.match(source, /approval gate|boundary owner|recovery path|recovery drill/i);
  assert.match(source, /primary step|step progress|checklist|next action target|next operator workspace/i);
  assert.match(source, /structured refresh state|refreshState|refresh state/i);
  assert.match(source, /followuptree|followup tree|followupPath|followup path/i);
  assert.match(source, /compatibility metadata|compatibility block/i);
  assert.ok(
    source.includes("legacy projection") ||
      source.includes("flat `refreshEscalation...` fields") ||
      source.includes("flat `refreshEscalation...` projection"),
    "docs missing transitional flat refreshEscalation legacy projection note",
  );
}
test("operator console exposes session ops purpose, replay, and discovery surfaces", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    '<details id="operatorSessionOpsControl" class="operator-session-ops-control operator-support-panel"',
    "Operator Session Ops",
    'id="operatorSessionOpsControlStatus"',
    'id="operatorSessionOpsControlMeta"',
    'id="operatorPurposeCategory"',
    'id="operatorPurposeInput"',
    'id="operatorSessionReplaySessionId"',
    'id="operatorPurposeSaveBtn"',
    'id="operatorPurposeClearBtn"',
    'id="operatorSessionReplayRefreshBtn"',
    'id="operatorSessionReplayLoadBtn"',
    'id="operatorCaseWikiRefreshBtn"',
    'id="operatorDiscoveryRefreshBtn"',
    'id="operatorCaseWikiSaveBtn"',
    'id="operatorCaseWikiTitle"',
    'id="operatorCaseWikiPriority"',
    'id="operatorCaseWikiBlocking"',
    'id="operatorCaseWikiNote"',
    'id="operatorCaseWikiOwner"',
    'id="operatorCaseWikiSuggestedNextStep"',
    'id="operatorSessionOpsPurposeSnapshot"',
    'id="operatorSessionOpsReplaySnapshot"',
    'id="operatorSessionOpsDiscoverySnapshot"',
    'id="operatorCaseWikiOverviewSnapshot"',
    'id="operatorCaseWikiEvidenceSnapshot"',
    'id="operatorCaseWikiFocusedHandoffSnapshot"',
    'id="operatorCaseWikiFocusedHandoffCopyBtn"',
    'id="operatorCaseWikiFocusedHandoffExportBtn"',
    'id="operatorCaseWikiFocusedRoutingSnapshot"',
    'id="operatorCaseWikiFocusedRoutingCtaBtn"',
    'id="operatorCaseWikiFocusedRoutingCopyBtn"',
    'id="operatorCaseWikiFocusedRoutingExportBtn"',
    'id="operatorCaseWikiQuestionsSnapshot"',
    'id="operatorCaseWikiTimelineSnapshot"',
    'id="operatorSessionOpsLastResult"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing session-ops token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "operatorPurposeDeclaration: null",
    "operatorSessionReplaySessions: []",
    "operatorSessionReplaySnapshot: null",
    "operatorDiscoverySnapshot: null",
    "operatorCaseWikiSnapshot: null",
    "operatorCaseWikiLoadedAt: null",
    "operatorSessionOpsLastResult: null",
    "OPERATOR_PURPOSE_DECLARATION_STORAGE_KEY",
    "function ensureOperatorPurposeDeclaration(actionLabel)",
    "function renderOperatorSessionOpsPanel()",
    "function buildOperatorSessionReplaySnapshot(value)",
    "function buildOperatorCaseWikiSnapshot(value)",
    "function buildOperatorCaseWikiOverviewPreview()",
    "function buildOperatorCaseWikiEvidencePreview()",
    "resolveOperatorCaseWikiEvidencePack(snapshot)",
    "buildOperatorCaseWikiEvidencePackProofSummary",
    "buildOperatorCaseWikiEvidencePackQuestionSummary",
    "resolveOperatorCaseWikiFocusedRoutingPackItem(snapshot, focusedItem)",
    "resolveOperatorCaseWikiFocusPackItem(snapshot, focusedItem.kind, focusId)",
    "buildOperatorCaseWikiHandoffPreview",
    "resolveOperatorCaseWikiFocusedItem(evidencePack)",
    "buildOperatorCaseWikiFocusedHandoffPreview(snapshot, evidencePack, focusedItem)",
    "function buildOperatorCaseWikiFocusedHandoffBlock(snapshot, evidencePack, focusedItem)",
    "function buildOperatorCaseWikiFocusedRoutingBlock(snapshot, evidencePack, focusedItem)",
    "function buildOperatorCaseWikiFocusedRoutingCTA(lane, route, nextAction, focusedItem)",
    "function buildOperatorCaseWikiFocusedHandoffPreviewBlock()",
    "function buildOperatorCaseWikiFocusedRoutingPreviewBlock()",
    "async function copyOperatorCaseWikiFocusedHandoffBlock(mode = \"handoff\")",
    "async function copyOperatorCaseWikiFocusedRoutingBlock(mode = \"routing\")",
    "function runOperatorCaseWikiFocusedRoutingCTA()",
    "buildOperatorCaseWikiFocusSummary(focusedItem)",
    "function buildOperatorCaseWikiQuestionsPreview()",
    "function buildOperatorCaseWikiTimelinePreview()",
    "function canAppendOperatorCaseWikiNote()",
    "function resetOperatorCaseWikiDraft()",
    "function normalizeOperatorReplayWorkflowBooking(value)",
    "function normalizeOperatorReplayWorkflowHandoff(value)",
    "function normalizeOperatorReplayWorkflowFollowUp(value)",
    "function normalizeOperatorReplayCurrentHandoffState(value)",
    "function normalizeOperatorReplayLatestProofPointer(value)",
    "function buildOperatorDiscoverySnapshot(personas, recipes)",
    "async function refreshOperatorSessionReplay(options = {})",
    "async function refreshOperatorCaseWiki(options = {})",
    "async function refreshOperatorDiscovery(options = {})",
    "async function appendOperatorCaseWikiNote()",
    "new URL(`${state.apiBaseUrl}/v1/runtime/session-replay`)",
    "new URL(`${state.apiBaseUrl}/v1/runtime/case-wiki`)",
    "replayUrl.searchParams.set(\"sessionLimit\", String(OPERATOR_SESSION_REPLAY_LIMIT))",
    "replayUrl.searchParams.set(\"eventLimit\", String(OPERATOR_SESSION_REPLAY_EVENT_LIMIT))",
    "buildOperatorSessionReplaySnapshot(replayPayload?.data)",
    "buildOperatorCaseWikiSnapshot(payload?.data)",
    'fetch(`${state.apiBaseUrl}/v1/skills/personas`, {',
    'fetch(`${state.apiBaseUrl}/v1/skills/recipes`, {',
    'fetch(`${state.apiBaseUrl}/v1/runtime/case-wiki/notes`, {',
    'operatorSessionOpsControl: document.getElementById("operatorSessionOpsControl")',
    'operatorPurposeCategory: document.getElementById("operatorPurposeCategory")',
    'operatorPurposeInput: document.getElementById("operatorPurposeInput")',
    'operatorSessionReplaySessionId: document.getElementById("operatorSessionReplaySessionId")',
    'operatorPurposeSaveBtn: document.getElementById("operatorPurposeSaveBtn")',
    'operatorPurposeClearBtn: document.getElementById("operatorPurposeClearBtn")',
    'operatorSessionReplayRefreshBtn: document.getElementById("operatorSessionReplayRefreshBtn")',
    'operatorSessionReplayLoadBtn: document.getElementById("operatorSessionReplayLoadBtn")',
    'operatorCaseWikiRefreshBtn: document.getElementById("operatorCaseWikiRefreshBtn")',
    'operatorDiscoveryRefreshBtn: document.getElementById("operatorDiscoveryRefreshBtn")',
    'operatorCaseWikiSaveBtn: document.getElementById("operatorCaseWikiSaveBtn")',
    'operatorCaseWikiTitle: document.getElementById("operatorCaseWikiTitle")',
    'operatorCaseWikiPriority: document.getElementById("operatorCaseWikiPriority")',
    'operatorCaseWikiBlocking: document.getElementById("operatorCaseWikiBlocking")',
    'operatorCaseWikiNote: document.getElementById("operatorCaseWikiNote")',
    'operatorCaseWikiOwner: document.getElementById("operatorCaseWikiOwner")',
    'operatorCaseWikiSuggestedNextStep: document.getElementById("operatorCaseWikiSuggestedNextStep")',
    'operatorCaseWikiEvidenceSnapshot: document.getElementById("operatorCaseWikiEvidenceSnapshot")',
    'operatorCaseWikiFocusedHandoffSnapshot: document.getElementById("operatorCaseWikiFocusedHandoffSnapshot")',
    'operatorCaseWikiFocusedHandoffCopyBtn: document.getElementById("operatorCaseWikiFocusedHandoffCopyBtn")',
    'operatorCaseWikiFocusedHandoffExportBtn: document.getElementById("operatorCaseWikiFocusedHandoffExportBtn")',
    'operatorCaseWikiFocusedRoutingSnapshot: document.getElementById("operatorCaseWikiFocusedRoutingSnapshot")',
    'operatorCaseWikiFocusedRoutingCtaBtn: document.getElementById("operatorCaseWikiFocusedRoutingCtaBtn")',
    'operatorCaseWikiFocusedRoutingCopyBtn: document.getElementById("operatorCaseWikiFocusedRoutingCopyBtn")',
    'operatorCaseWikiFocusedRoutingExportBtn: document.getElementById("operatorCaseWikiFocusedRoutingExportBtn")',
    "buildSessionExportOperatorSessionReplay",
    "buildSessionExportOperatorDiscovery",
    "buildSessionExportOperatorCaseWiki",
    "buildOperatorReplayPrimaryStepRefreshView",
    "OPERATOR_REPLAY_REFRESH_LEGACY_TEXT_FIELDS",
    "OPERATOR_REPLAY_REFRESH_LEGACY_TARGET_FIELDS",
    "OPERATOR_REPLAY_REFRESH_LEGACY_CTA_FIELDS",
    "function normalizeOperatorReplayLegacyTarget(value, includeMode = false)",
    "function normalizeOperatorReplayLegacyCTA(value)",
    "function normalizeOperatorReplayLiveTransport(value)",
    "function buildCurrentLiveTransportEvidence(options = {})",
    "function normalizeOperatorReplayPrimaryStepRefreshLegacyProjection(value)",
    "function normalizeOperatorReplayRefreshRecoveryFollowupTree(value)",
    "function normalizeOperatorReplayPrimaryStepRefreshState(value)",
    "buildOperatorReplayRefreshRecoveryFollowupSummary",
    "refreshRecoveryFollowupPathSummary",
    "refreshRecoveryLegacyFallbackSummary",
    "refreshRecoveryAfterRefreshDetail",
    "refreshState",
    "refreshStateSource",
    "refreshStateCompatibility",
    "firstStepRefreshCompatibility=",
    "primaryReadModel",
    "legacyProjection",
    "followupTree",
    "flat_refresh_escalation_fields",
    "readStoredOperatorPurposeDeclaration()",
    "refreshOperatorSessionReplay({ silent: true }).catch(() => {",
    "refreshOperatorDiscovery({ silent: true }).catch(() => {",
    "nextAction=",
    "nextTarget=",
    "nextWorkspace=",
    "liveTransport=",
    "liveTransportSource=",
    "liveProvider=",
    "liveBootstrap=",
    "firstStep=",
    "firstStepState=",
    "firstStepMode=",
    "firstStepPrime=",
    "firstStepFreshness=",
    "firstStepRefreshModel=",
    "firstStepRefresh=",
    "firstStepAfterRefresh=",
    "firstStepRefreshScope=",
    "firstStepRefreshDisposition=",
    "firstStepRefreshConfidence=",
    "firstStepRefreshEvidence=",
    "firstStepRefreshOutcome=",
    "firstStepRefreshDetour=",
    "firstStepRefreshFollowupCount=",
    "firstStepRefreshFollowupHead=",
    "firstStepRefreshFollowupPath=",
    "firstStepRefreshLegacyFallback=",
    "stepProgress=",
    "stepPath=",
    "checklist=",
    "remainingSteps=",
    "caseWiki=",
    "caseWikiStatus=",
    "caseWikiCase=",
    "caseWikiQuestions=",
    "caseWikiBlocking=",
    "caseWikiNextAction=",
    "caseWikiProof=",
    "caseWikiEntity=",
    "evidencePack:",
    "resolveOperatorCaseWikiFocusedHandoffPackItem(snapshot, focusedItem)",
    "handoffPack:",
    "detailPack:",
    "routingPack:",
    "actionPack:",
    "focusPack:",
    "resolveOperatorCaseWikiActionPackItem(snapshot, kind, target.id)",
    "focus:",
    "handoffPreview:",
    "handoffFocus:",
    "focusedHandoffBlock:",
    "focusedRoutingBlock:",
    "focusedRoutingCta:",
    "focusedRoutingCtaAction:",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing session-ops token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-session-ops-control {",
    ".operator-session-ops-control-body {",
    ".operator-session-ops-control-grid {",
    ".operator-session-ops-control-note-grid {",
    ".operator-session-ops-control-note-field {",
    ".operator-session-ops-control-note-step-field {",
    ".operator-session-ops-control-actions > button {",
    ".operator-session-ops-control-output-grid {",
    ".operator-session-ops-control-output-card {",
    ".operator-session-ops-control-output-actions {",
    ".operator-session-ops-control-output {",
    ".operator-session-ops-control-output-primary-action {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing session-ops token: ${token}`);
  }

  assert.ok(readmeSource.includes("`Operator Session Ops`"), "README missing session-ops panel note");
  assert.ok(readmeSource.includes("`operatorPurpose`"), "README missing operatorPurpose note");
  assert.ok(readmeSource.includes("`GET /v1/runtime/session-replay`"), "README missing session replay API note");
  assert.ok(readmeSource.includes("`GET /v1/runtime/case-wiki`"), "README missing case wiki API note");
  assert.ok(readmeSource.includes("`POST /v1/runtime/case-wiki/notes`"), "README missing case wiki note API note");
  assert.ok(readmeSource.includes("Case Workspace"), "README missing case workspace case wiki note");
  assert.match(readmeSource, /Case Wiki Overview/i);
  assert.match(readmeSource, /Case Wiki Evidence/i);
  assert.match(readmeSource, /Case Wiki Focused Handoff/i);
  assert.match(readmeSource, /Case Wiki Focused Routing/i);
  assert.match(readmeSource, /handoffPack/i);
  assert.match(readmeSource, /detailPack/i);
  assert.match(readmeSource, /routingPack/i);
  assert.match(readmeSource, /actionPack/i);
  assert.match(readmeSource, /focusPack/i);
  assert.match(readmeSource, /one-click CTA action/i);
  assert.match(readmeSource, /Case Wiki Open Questions/i);
  assert.match(readmeSource, /refresh recovery follow-?up path/i);
  assert.match(readmeSource, /structured refresh state/i);
  assert.match(readmeSource, /followuptree|followup tree/i);
  assert.match(readmeSource, /compatibility block|compatibility metadata/i);
  assert.match(readmeSource, /flat `refreshEscalation\.\.\.` fields remain a transitional legacy projection/i);
  assertStructuredReplayRefreshContract(readmeSource);
  assert.ok(readmeSource.includes("`GET /v1/skills/personas`"), "README missing persona discovery API note");
  assert.ok(operatorGuideSource.includes("`Operator Session Ops`"), "operator guide missing session-ops panel note");
  assert.ok(operatorGuideSource.includes("`GET /v1/runtime/case-wiki`"), "operator guide missing case wiki note");
  assert.ok(operatorGuideSource.includes("`POST /v1/runtime/case-wiki/notes`"), "operator guide missing case wiki note append");
  assert.ok(operatorGuideSource.includes("Case Workspace"), "operator guide missing case workspace case wiki note");
  assert.match(operatorGuideSource, /Case Wiki Overview/i);
  assert.match(operatorGuideSource, /Case Wiki Evidence/i);
  assert.match(operatorGuideSource, /Case Wiki Focused Handoff/i);
  assert.match(operatorGuideSource, /Case Wiki Focused Routing/i);
  assert.match(operatorGuideSource, /handoffPack/i);
  assert.match(operatorGuideSource, /detailPack/i);
  assert.match(operatorGuideSource, /routingPack/i);
  assert.match(operatorGuideSource, /actionPack/i);
  assert.match(operatorGuideSource, /focusPack/i);
  assert.match(operatorGuideSource, /one-click CTA action/i);
  assert.match(operatorGuideSource, /Case Wiki Open Questions/i);
  assert.match(operatorGuideSource, /refresh recovery follow-?up path/i);
  assert.match(operatorGuideSource, /structured refresh state/i);
  assert.match(operatorGuideSource, /followuptree|followup tree/i);
  assert.match(operatorGuideSource, /compatibility block|compatibility metadata/i);
  assert.ok(operatorGuideSource.includes("`operatorPurpose`"), "operator guide missing operator purpose note");
  assert.ok(operatorGuideSource.includes("`GET /v1/runtime/session-replay`"), "operator guide missing session replay note");
  assert.match(operatorGuideSource, /flat `refreshEscalation\.\.\.` fields remain a transitional legacy projection/i);
  assertStructuredReplayRefreshContract(operatorGuideSource);
});
