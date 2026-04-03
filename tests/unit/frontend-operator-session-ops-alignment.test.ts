import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

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
    'id="operatorDiscoveryRefreshBtn"',
    'id="operatorSessionOpsPurposeSnapshot"',
    'id="operatorSessionOpsReplaySnapshot"',
    'id="operatorSessionOpsDiscoverySnapshot"',
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
    "operatorSessionOpsLastResult: null",
    "OPERATOR_PURPOSE_DECLARATION_STORAGE_KEY",
    "function ensureOperatorPurposeDeclaration(actionLabel)",
    "function renderOperatorSessionOpsPanel()",
    "function buildOperatorSessionReplaySnapshot(value)",
    "function normalizeOperatorReplayWorkflowBooking(value)",
    "function normalizeOperatorReplayWorkflowHandoff(value)",
    "function normalizeOperatorReplayWorkflowFollowUp(value)",
    "function normalizeOperatorReplayCurrentHandoffState(value)",
    "function normalizeOperatorReplayLatestProofPointer(value)",
    "function buildOperatorDiscoverySnapshot(personas, recipes)",
    "async function refreshOperatorSessionReplay(options = {})",
    "async function refreshOperatorDiscovery(options = {})",
    "new URL(`${state.apiBaseUrl}/v1/runtime/session-replay`)",
    "replayUrl.searchParams.set(\"sessionLimit\", String(OPERATOR_SESSION_REPLAY_LIMIT))",
    "replayUrl.searchParams.set(\"eventLimit\", String(OPERATOR_SESSION_REPLAY_EVENT_LIMIT))",
    "buildOperatorSessionReplaySnapshot(replayPayload?.data)",
    'fetch(`${state.apiBaseUrl}/v1/skills/personas`, {',
    'fetch(`${state.apiBaseUrl}/v1/skills/recipes`, {',
    'operatorSessionOpsControl: document.getElementById("operatorSessionOpsControl")',
    'operatorPurposeCategory: document.getElementById("operatorPurposeCategory")',
    'operatorPurposeInput: document.getElementById("operatorPurposeInput")',
    'operatorSessionReplaySessionId: document.getElementById("operatorSessionReplaySessionId")',
    'operatorPurposeSaveBtn: document.getElementById("operatorPurposeSaveBtn")',
    'operatorPurposeClearBtn: document.getElementById("operatorPurposeClearBtn")',
    'operatorSessionReplayRefreshBtn: document.getElementById("operatorSessionReplayRefreshBtn")',
    'operatorSessionReplayLoadBtn: document.getElementById("operatorSessionReplayLoadBtn")',
    'operatorDiscoveryRefreshBtn: document.getElementById("operatorDiscoveryRefreshBtn")',
    "buildSessionExportOperatorSessionReplay",
    "buildSessionExportOperatorDiscovery",
    "resumeReady",
    "resumeBlockedBy",
    "nextOperatorAction",
    "nextOperatorActionLabel",
    "nextOperatorActionTarget",
    "nextOperatorWorkspace",
    "nextOperatorChecklist",
    "nextOperatorRemainingSteps",
    "nextOperatorPrimaryStep",
    "actionMode",
    "surfaceState",
    "needsRefresh",
    "refreshDisposition",
    "refreshEvidenceHint",
    "refreshOutcomeLabel",
    "refreshConfidence",
    "refreshDetourHint",
    "refreshEscalationHint",
    "refreshEscalationTarget",
    "refreshEscalationCTA",
    "refreshEscalationReadiness",
    "refreshEscalationPrepHint",
    "refreshEscalationOpenGuard",
    "refreshEscalationFallbackTarget",
    "refreshEscalationFallbackCTA",
    "refreshEscalationFallbackReadiness",
    "refreshEscalationFallbackPrepHint",
    "refreshEscalationFallbackOpenGuard",
    "refreshEscalationFallbackOutcomeLabel",
    "mode",
    "refreshAction",
    "refreshTargetState",
    "stateLabel",
    "refreshScope",
    "nextOperatorStepProgress",
    "nextOperatorStepPath",
    "runState",
    "latestVerifiedStage",
    "boundaryOwner",
    "approvalGate",
    "workflowBoundarySummary",
    "latestProofPointer",
    "recoveryPathHint",
    "recoveryHandoff",
    "recoveryDrill",
    "currentHandoffState",
    "workflowBooking",
    "workflowHandoff",
    "workflowFollowUp",
    "readStoredOperatorPurposeDeclaration()",
    "refreshOperatorSessionReplay({ silent: true }).catch(() => {",
    "refreshOperatorDiscovery({ silent: true }).catch(() => {",
    "nextAction=",
    "nextTarget=",
    "nextWorkspace=",
    "firstStep=",
    "firstStepState=",
    "firstStepMode=",
    "firstStepPrime=",
    "firstStepFreshness=",
    "firstStepRefreshDisposition=",
    "firstStepRefreshConfidence=",
    "firstStepRefreshEvidence=",
    "firstStepRefreshOutcome=",
    "firstStepRefreshDetour=",
    "firstStepRefreshEscalation=",
    "firstStepRefreshEscalationTarget=",
    "firstStepRefreshEscalationMode=",
    "firstStepRefreshEscalationCTA=",
    "firstStepRefreshEscalationReadiness=",
    "firstStepRefreshEscalationPrep=",
    "firstStepRefreshEscalationOpenGuard=",
    "firstStepRefreshEscalationFallback=",
    "firstStepRefreshEscalationFallbackCTA=",
    "firstStepRefreshEscalationFallbackReadiness=",
    "firstStepRefreshEscalationFallbackPrep=",
    "firstStepRefreshEscalationFallbackOpenGuard=",
    "firstStepRefreshEscalationFallbackOutcome=",
    "firstStepRefresh=",
    "firstStepAfterRefresh=",
    "firstStepRefreshScope=",
    "stepProgress=",
    "stepPath=",
    "checklist=",
    "remainingSteps=",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing session-ops token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-session-ops-control {",
    ".operator-session-ops-control-body {",
    ".operator-session-ops-control-grid {",
    ".operator-session-ops-control-actions > button {",
    ".operator-session-ops-control-output-grid {",
    ".operator-session-ops-control-output-card {",
    ".operator-session-ops-control-output {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing session-ops token: ${token}`);
  }

  assert.ok(readmeSource.includes("`Operator Session Ops`"), "README missing session-ops panel note");
  assert.ok(readmeSource.includes("`operatorPurpose`"), "README missing operatorPurpose note");
  assert.ok(readmeSource.includes("`GET /v1/runtime/session-replay`"), "README missing session replay API note");
  assert.match(readmeSource, /resume-ready|latest verified proof pointer|handoff|workflow boundary|recovery path|approval gate|boundary owner|recovery drill|next action target|next operator workspace|checklist|remaining steps|primary step|step progress|step path|active|queued|runnable|blocked|openable|executable|primed|not_primed|needsrefresh|fresh|needs_refresh|refresh disposition|refresh evidence hint|refresh outcome|refresh confidence|refresh detour|refresh escalation|refresh escalation target|refresh escalation mode|refresh escalation cta|refresh escalation readiness|refresh escalation prep|refresh escalation open guard|refresh escalation fallback|refresh escalation fallback cta|refresh escalation fallback readiness|refresh escalation fallback prep|refresh escalation fallback open guard|refresh escalation fallback outcome|approval escalation|recovery escalation|workflow owner escalation|inspect|recover|owner_handoff|ready|needs_prep|approval gate evidence|workflow boundary evidence|recovery drill evidence|proof pointer|approval gate is current again|workflow boundary is current again|recovery drill state is current again|proof pointer is current again|approval gate fallback is open|boundary fallback is open|replay fallback is open|high|medium|low|silent_rehydrate|reopen_then_refresh|reload_before_run|refresh action|refresh first|refresh replay|refresh target state|refresh scope|after refresh|latest gate state|gate|boundary|proof|recovery|linked workflow boundary or workflow owner handoff|repo-owned recovery drill|gate fallback|handoff fallback|boundary fallback|replay fallback|open gate fallback|inspect boundary fallback|open replay fallback/i);
  assert.ok(readmeSource.includes("`GET /v1/skills/personas`"), "README missing persona discovery API note");
  assert.ok(operatorGuideSource.includes("`Operator Session Ops`"), "operator guide missing session-ops panel note");
  assert.ok(operatorGuideSource.includes("`operatorPurpose`"), "operator guide missing operator purpose note");
  assert.ok(operatorGuideSource.includes("`GET /v1/runtime/session-replay`"), "operator guide missing session replay note");
  assert.match(operatorGuideSource, /resume-ready|latest verified proof pointer|handoff|workflow boundary|recovery path|approval gate|boundary owner|recovery drill|next action target|next operator workspace|checklist|remaining steps|primary step|step progress|step path|active|queued|runnable|blocked|openable|executable|primed|not_primed|needsrefresh|fresh|needs_refresh|refresh disposition|refresh evidence hint|refresh outcome|refresh confidence|refresh detour|refresh escalation|refresh escalation target|refresh escalation mode|refresh escalation cta|refresh escalation readiness|refresh escalation prep|refresh escalation open guard|refresh escalation fallback|refresh escalation fallback cta|refresh escalation fallback readiness|refresh escalation fallback prep|refresh escalation fallback open guard|refresh escalation fallback outcome|approval escalation|recovery escalation|workflow owner escalation|inspect|recover|owner_handoff|ready|needs_prep|approval gate evidence|workflow boundary evidence|recovery drill evidence|proof pointer|approval gate is current again|workflow boundary is current again|recovery drill state is current again|proof pointer is current again|approval gate fallback is open|boundary fallback is open|replay fallback is open|high|medium|low|silent_rehydrate|reopen_then_refresh|reload_before_run|refresh action|refresh first|refresh replay|refresh target state|refresh scope|after refresh|latest gate state|gate|boundary|proof|recovery|linked workflow boundary or workflow owner handoff|repo-owned recovery drill|gate fallback|handoff fallback|boundary fallback|replay fallback|open gate fallback|inspect boundary fallback|open replay fallback/i);
});
