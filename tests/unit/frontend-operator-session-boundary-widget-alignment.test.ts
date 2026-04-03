import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes compact session boundary widget", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");
  const architecturePath = resolve(process.cwd(), "docs", "architecture.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");
  const architectureSource = readFileSync(architecturePath, "utf8");

  const requiredHtmlTokens = [
    "<h3>Session Boundary</h3>",
    'id="operatorSessionBoundaryStatus"',
    'id="operatorSessionBoundarySession"',
    'id="operatorSessionBoundarySummary"',
    'id="operatorSessionBoundaryOwner"',
    'id="operatorSessionBoundaryApprovalGate"',
    'id="operatorSessionBoundaryNextAction"',
    'id="operatorSessionBoundaryPrimaryStep"',
    'id="operatorSessionBoundaryAfterRefresh"',
    'id="operatorSessionBoundaryStepProgress"',
    'id="operatorSessionBoundaryChecklist"',
    'id="operatorSessionBoundaryLatestProof"',
    'id="operatorSessionBoundaryRecovery"',
    'id="operatorSessionBoundaryHandoff"',
    'id="operatorSessionBoundaryOpenBtn"',
    'id="operatorSessionBoundaryHint"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing session boundary token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorSessionBoundaryOpenBtn: document.getElementById("operatorSessionBoundaryOpenBtn")',
    'operatorSessionBoundaryStatus: document.getElementById("operatorSessionBoundaryStatus")',
    'operatorSessionBoundarySession: document.getElementById("operatorSessionBoundarySession")',
    'operatorSessionBoundarySummary: document.getElementById("operatorSessionBoundarySummary")',
    'operatorSessionBoundaryOwner: document.getElementById("operatorSessionBoundaryOwner")',
    'operatorSessionBoundaryApprovalGate: document.getElementById("operatorSessionBoundaryApprovalGate")',
    'operatorSessionBoundaryNextAction: document.getElementById("operatorSessionBoundaryNextAction")',
    'operatorSessionBoundaryPrimaryStep: document.getElementById("operatorSessionBoundaryPrimaryStep")',
    'operatorSessionBoundaryAfterRefresh: document.getElementById("operatorSessionBoundaryAfterRefresh")',
    'operatorSessionBoundaryStepProgress: document.getElementById("operatorSessionBoundaryStepProgress")',
    'operatorSessionBoundaryChecklist: document.getElementById("operatorSessionBoundaryChecklist")',
    'operatorSessionBoundaryLatestProof: document.getElementById("operatorSessionBoundaryLatestProof")',
    'operatorSessionBoundaryRecovery: document.getElementById("operatorSessionBoundaryRecovery")',
    'operatorSessionBoundaryHandoff: document.getElementById("operatorSessionBoundaryHandoff")',
    'operatorSessionBoundaryHint: document.getElementById("operatorSessionBoundaryHint")',
    "setOperatorSessionBoundaryHint",
    "resetOperatorSessionBoundaryWidget",
    "renderOperatorSessionBoundaryWidget",
    "openOperatorSessionBoundaryTarget",
    "boundaryOwner",
    "approvalGate",
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
    "mode",
    "refreshAction",
    "refreshTargetState",
    "stateLabel",
    "refreshScope",
    "nextOperatorStepProgress",
    "nextOperatorStepPath",
    "runState",
    "workflowBoundarySummary",
    "latestProofPointer",
    "recoveryPathHint",
    "recoveryHandoff",
    "recoveryDrill",
    "latestVerifiedStage",
    "renderOperatorSessionBoundaryWidget(state.operatorSessionReplaySnapshot);",
    "recoveryTargetButtonLabel",
    'toOptionalText(primaryStepRefreshAction?.ctaLabel) ??',
    "primaryStepRefreshDisposition",
    "primaryStepRefreshEvidenceHint",
    "primaryStepRefreshOutcomeLabel",
    "primaryStepRefreshConfidence",
    "primaryStepRefreshDetourHint",
    "primaryStepRefreshEscalationHint",
    "primaryStepRefreshEscalationTarget",
    "firstStepRefreshEscalationMode=",
    "refreshEscalationCTA",
    "refreshEscalationReadiness",
    "refreshEscalationPrepHint",
    "firstStepRefreshEscalationCTA=",
    "firstStepRefreshEscalationReadiness=",
    "firstStepRefreshEscalationPrep=",
    "primaryStepRefreshTargetState",
    "afterRefreshDetail",
    "refresh_session_replay",
    "await refreshOperatorSessionReplay({",
    'toOptionalText(nextOperatorPrimaryStep?.ctaLabel) ??',
    "openOperatorSessionBoundaryTarget();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing session boundary token: ${token}`);
  }

  assert.ok(readmeSource.includes("`Session Boundary`"), "README missing Session Boundary card note");
  assert.match(readmeSource, /approval gate|boundary owner|recovery path|recovery drill|next action target|next operator workspace|checklist|remaining steps|primary step|step progress|step path|active|queued|runnable|blocked|openable|executable|primed|not_primed|needsrefresh|fresh|needs_refresh|refresh disposition|refresh evidence hint|refresh outcome|refresh confidence|refresh detour|refresh escalation|refresh escalation target|refresh escalation mode|refresh escalation cta|refresh escalation readiness|refresh escalation prep|approval escalation|recovery escalation|workflow owner escalation|inspect|recover|owner_handoff|ready|needs_prep|approval gate evidence|workflow boundary evidence|recovery drill evidence|proof pointer|approval gate is current again|workflow boundary is current again|recovery drill state is current again|proof pointer is current again|high|medium|low|silent_rehydrate|reopen_then_refresh|reload_before_run|refresh action|refresh first|refresh replay|refresh target state|refresh scope|after refresh|latest gate state|gate|boundary|proof|recovery/i);
  assert.ok(operatorGuideSource.includes("`Session Boundary`"), "operator guide missing Session Boundary card note");
  assert.match(operatorGuideSource, /approval gate|boundary owner|recovery path|recovery drill|next action target|next operator workspace|checklist|remaining steps|primary step|step progress|step path|active|queued|runnable|blocked|openable|executable|primed|not_primed|needsrefresh|fresh|needs_refresh|refresh disposition|refresh evidence hint|refresh outcome|refresh confidence|refresh detour|refresh escalation|refresh escalation target|refresh escalation mode|refresh escalation cta|refresh escalation readiness|refresh escalation prep|approval escalation|recovery escalation|workflow owner escalation|inspect|recover|owner_handoff|ready|needs_prep|approval gate evidence|workflow boundary evidence|recovery drill evidence|proof pointer|approval gate is current again|workflow boundary is current again|recovery drill state is current again|proof pointer is current again|high|medium|low|silent_rehydrate|reopen_then_refresh|reload_before_run|refresh action|refresh first|refresh replay|refresh target state|refresh scope|after refresh|latest gate state|gate|boundary|proof|recovery/i);
  assert.match(architectureSource, /approval gate|boundary owner|recovery path|recovery drill|next action target|next operator workspace|checklist|remaining steps|primary step|step progress|step path|active|queued|runnable|blocked|openable|executable|primed|not_primed|needsrefresh|fresh|needs_refresh|refresh disposition|refresh evidence hint|refresh outcome|refresh confidence|refresh detour|refresh escalation|refresh escalation target|refresh escalation mode|refresh escalation cta|refresh escalation readiness|refresh escalation prep|approval escalation|recovery escalation|workflow owner escalation|inspect|recover|owner_handoff|ready|needs_prep|approval gate evidence|workflow boundary evidence|recovery drill evidence|proof pointer|approval gate is current again|workflow boundary is current again|recovery drill state is current again|proof pointer is current again|high|medium|low|silent_rehydrate|reopen_then_refresh|reload_before_run|refresh action|refresh first|refresh replay|refresh target state|refresh scope|after refresh|latest gate state|gate|boundary|proof|recovery/i);
});
