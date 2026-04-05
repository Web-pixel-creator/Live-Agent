import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("runtime session replay mirror route stays aligned across API, helper, inventory, and docs", () => {
  const indexSource = readFileSync(resolve(process.cwd(), "apps", "api-backend", "src", "index.ts"), "utf8");
  const helperSource = readFileSync(
    resolve(process.cwd(), "apps", "api-backend", "src", "runtime-session-replay-mirror.ts"),
    "utf8",
  );
  const inventorySource = readFileSync(
    resolve(process.cwd(), "apps", "api-backend", "src", "runtime-surface-inventory.ts"),
    "utf8",
  );
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuide = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");
  const architecture = readFileSync(resolve(process.cwd(), "docs", "architecture.md"), "utf8");

  for (const token of [
    "/v1/runtime/session-replay",
    "buildRuntimeSessionReplayMirrorSnapshot",
    "listSessions(sessionLimit",
    "listRuns(runLimit)",
    "listApprovals({",
    "listRecentEvents(recentEventLimit)",
    "listEvents({ sessionId: selectedSessionId, limit: eventLimit })",
    "buildRuntimeWorkflowControlPlaneSnapshot",
  ]) {
    assert.ok(indexSource.includes(token), `runtime session replay API missing token: ${token}`);
  }

  for (const token of [
    'source: "repo_owned_runtime_session_replay"',
    "mirrorVersion: 1",
    "sessionsWithReplay",
    "sessionsAwaitingApproval",
    "sessionsWithVerifiedProof",
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
    "refreshEscalationFallbackConfidence",
    "refreshEscalationFallbackDetourHint",
    "refreshEscalationFallbackEscalationHint",
    "refreshEscalationFallbackEscalationTarget",
    "refreshEscalationFallbackEscalationCTA",
    "refreshEscalationFallbackEscalationReadiness",
    "refreshEscalationFallbackEscalationPrepHint",
    "refreshEscalationFallbackEscalationOpenGuard",
    "refreshEscalationFallbackEscalationFallbackTarget",
    "refreshEscalationFallbackEscalationFallbackCTA",
    "refreshEscalationFallbackEscalationFallbackReadiness",
    "refreshEscalationFallbackEscalationFallbackPrepHint",
    "refreshEscalationFallbackEscalationFallbackOpenGuard",
    "refreshEscalationFallbackEscalationFallbackOutcomeLabel",
    "refreshEscalationFallbackEscalationFallbackConfidence",
    "refreshEscalationFallbackEscalationFallbackDetourHint",
    "refreshEscalationFallbackEscalationFallbackEscalationHint",
    "refreshEscalationFallbackEscalationFallbackEscalationTarget",
    "refreshEscalationFallbackEscalationFallbackEscalationCTA",
    "refreshEscalationFallbackEscalationFallbackEscalationReadiness",
    "refreshEscalationFallbackEscalationFallbackEscalationPrepHint",
    "refreshEscalationFallbackEscalationFallbackEscalationOpenGuard",
    "refreshEscalationFallbackEscalationFallbackEscalationFallbackTarget",
    "refreshEscalationFallbackEscalationFallbackEscalationFallbackCTA",
    "refreshEscalationFallbackEscalationFallbackEscalationFallbackReadiness",
    "refreshEscalationFallbackEscalationFallbackEscalationFallbackPrepHint",
    "refreshEscalationFallbackEscalationFallbackEscalationFallbackOpenGuard",
    "mode",
    "refreshAction",
    "refreshTargetState",
    "approval escalation",
    "recovery escalation",
    "workflow owner escalation",
    "inspect",
    "recover",
    "owner_handoff",
    "Inspect escalation path",
    "Recover after refresh",
    "Hand off after refresh",
    "ready",
    "needs_prep",
    "Load the linked workflow boundary before escalating through Workflow Control.",
    "Load the repo-owned recovery drill before escalating through Runtime Drill Runner.",
    "Load the linked workflow boundary or workflow owner handoff before opening the fallback escalation.",
    "Open once a linked workflow boundary or workflow owner handoff is loaded.",
    "Operator Session Ops | manual handoff",
    "Open backup handoff",
    "Load the latest replay handoff before opening the backup handoff.",
    "Open once the latest replay handoff is loaded.",
    "Backup handoff is open.",
    "Use manual follow-through if the backup handoff still does not restore the session path.",
    "Escalate to manual handoff if the backup handoff still does not restore the session path.",
    "Hand off after backup escalation",
    "needs_prep",
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
    "workflowHandoffStatus",
    "workflowFollowUpStatus",
    "latestVerifiedSummary",
    "workflowAvailable",
  ]) {
    assert.ok(helperSource.includes(token), `runtime session replay helper missing token: ${token}`);
  }

  for (const token of [
    'id: "runtime-session-replay"',
    'label: "Session replay mirror"',
    'path: "/v1/runtime/session-replay"',
  ]) {
    assert.ok(inventorySource.includes(token), `runtime surface inventory missing token: ${token}`);
  }

  assert.match(readme, /GET \/v1\/runtime\/session-replay/);
  assert.match(readme, /session replay mirror/i);
  assert.match(readme, /refresh escalation fallback escalation fallback escalation fallback cta/i);
  assert.match(readme, /refresh escalation fallback escalation fallback escalation fallback prep hint/i);
  assert.match(readme, /refresh escalation fallback escalation fallback escalation fallback open guard/i);
  assert.match(readme, /resume-ready|latest verified proof pointer|handoff|recovery path|workflow boundary|approval gate|boundary owner|recovery drill|next action target|next operator workspace|checklist|remaining steps|primary step|step progress|step path|active|queued|runnable|blocked|openable|executable|primed|not_primed|needsrefresh|fresh|needs_refresh|refresh disposition|refresh evidence hint|refresh outcome|refresh confidence|refresh detour|refresh escalation|refresh escalation target|refresh escalation mode|refresh escalation cta|refresh escalation readiness|refresh escalation prep|refresh escalation open guard|refresh escalation fallback|refresh escalation fallback cta|refresh escalation fallback readiness|refresh escalation fallback prep|refresh escalation fallback open guard|refresh escalation fallback outcome|refresh escalation fallback confidence|refresh escalation fallback detour|refresh escalation fallback escalation|refresh escalation fallback escalation target|refresh escalation fallback escalation mode|refresh escalation fallback escalation cta|refresh escalation fallback escalation readiness|refresh escalation fallback escalation prep|refresh escalation fallback escalation open guard|refresh escalation fallback escalation fallback|approval escalation|recovery escalation|workflow owner escalation|boundary review|manual handoff|inspect|recover|owner_handoff|ready|needs_prep|approval gate evidence|workflow boundary evidence|recovery drill evidence|proof pointer|approval gate is current again|workflow boundary is current again|recovery drill state is current again|proof pointer is current again|approval gate fallback is open|boundary fallback is open|replay fallback is open|high|medium|low|silent_rehydrate|reopen_then_refresh|reload_before_run|refresh action|refresh first|refresh replay|refresh target state|refresh scope|after refresh|latest gate state|gate|boundary|proof|recovery|linked workflow boundary or workflow owner handoff|repo-owned recovery drill|gate fallback|handoff fallback|boundary fallback|replay fallback|open gate fallback|inspect boundary fallback|open replay fallback|inspect fallback escalation|hand off after fallback|load the latest replay handoff before opening the backup handoff escalation|open once the latest replay handoff is loaded/i);
  assert.match(operatorGuide, /GET \/v1\/runtime\/session-replay/);
  assert.match(operatorGuide, /Runtime session replay note:/);
  assert.match(operatorGuide, /refresh escalation fallback escalation fallback escalation fallback cta/i);
  assert.match(operatorGuide, /refresh escalation fallback escalation fallback escalation fallback prep hint/i);
  assert.match(operatorGuide, /refresh escalation fallback escalation fallback escalation fallback open guard/i);
  assert.match(operatorGuide, /resume-ready|latest verified proof pointer|handoff|recovery path|workflow boundary|approval gate|boundary owner|recovery drill|next action target|next operator workspace|checklist|remaining steps|primary step|step progress|step path|active|queued|runnable|blocked|openable|executable|primed|not_primed|needsrefresh|fresh|needs_refresh|refresh disposition|refresh evidence hint|refresh outcome|refresh confidence|refresh detour|refresh escalation|refresh escalation target|refresh escalation mode|refresh escalation cta|refresh escalation readiness|refresh escalation prep|refresh escalation open guard|refresh escalation fallback|refresh escalation fallback cta|refresh escalation fallback readiness|refresh escalation fallback prep|refresh escalation fallback open guard|refresh escalation fallback outcome|refresh escalation fallback confidence|refresh escalation fallback detour|refresh escalation fallback escalation|refresh escalation fallback escalation target|refresh escalation fallback escalation mode|refresh escalation fallback escalation cta|refresh escalation fallback escalation readiness|refresh escalation fallback escalation prep|refresh escalation fallback escalation open guard|refresh escalation fallback escalation fallback|approval escalation|recovery escalation|workflow owner escalation|boundary review|manual handoff|inspect|recover|owner_handoff|ready|needs_prep|approval gate evidence|workflow boundary evidence|recovery drill evidence|proof pointer|approval gate is current again|workflow boundary is current again|recovery drill state is current again|proof pointer is current again|approval gate fallback is open|boundary fallback is open|replay fallback is open|high|medium|low|silent_rehydrate|reopen_then_refresh|reload_before_run|refresh action|refresh first|refresh replay|refresh target state|refresh scope|after refresh|latest gate state|gate|boundary|proof|recovery|linked workflow boundary or workflow owner handoff|repo-owned recovery drill|gate fallback|handoff fallback|boundary fallback|replay fallback|open gate fallback|inspect boundary fallback|open replay fallback|inspect fallback escalation|hand off after fallback|load the latest replay handoff before opening the backup handoff escalation|open once the latest replay handoff is loaded/i);
  assert.match(architecture, /runtime session replay mirror/i);
  assert.match(architecture, /refresh escalation fallback escalation fallback escalation fallback cta/i);
  assert.match(architecture, /refresh escalation fallback escalation fallback escalation fallback prep hint/i);
  assert.match(architecture, /refresh escalation fallback escalation fallback escalation fallback open guard/i);
  assert.match(architecture, /resume-ready|latest verified proof pointer|handoff|recovery path|workflow boundary|approval gate|boundary owner|recovery drill|next action target|next operator workspace|checklist|remaining steps|primary step|step progress|step path|active|queued|runnable|blocked|openable|executable|primed|not_primed|needsrefresh|fresh|needs_refresh|refresh disposition|refresh evidence hint|refresh outcome|refresh confidence|refresh detour|refresh escalation|refresh escalation target|refresh escalation mode|refresh escalation cta|refresh escalation readiness|refresh escalation prep|refresh escalation open guard|refresh escalation fallback|refresh escalation fallback cta|refresh escalation fallback readiness|refresh escalation fallback prep|refresh escalation fallback open guard|refresh escalation fallback outcome|refresh escalation fallback confidence|refresh escalation fallback detour|refresh escalation fallback escalation|refresh escalation fallback escalation target|refresh escalation fallback escalation mode|refresh escalation fallback escalation cta|refresh escalation fallback escalation readiness|refresh escalation fallback escalation prep|refresh escalation fallback escalation open guard|refresh escalation fallback escalation fallback|approval escalation|recovery escalation|workflow owner escalation|boundary review|manual handoff|inspect|recover|owner_handoff|ready|needs_prep|approval gate evidence|workflow boundary evidence|recovery drill evidence|proof pointer|approval gate is current again|workflow boundary is current again|recovery drill state is current again|proof pointer is current again|approval gate fallback is open|boundary fallback is open|replay fallback is open|high|medium|low|silent_rehydrate|reopen_then_refresh|reload_before_run|refresh action|refresh first|refresh replay|refresh target state|refresh scope|after refresh|latest gate state|gate|boundary|proof|recovery|linked workflow boundary or workflow owner handoff|repo-owned recovery drill|gate fallback|handoff fallback|boundary fallback|replay fallback|open gate fallback|inspect boundary fallback|open replay fallback|inspect fallback escalation|hand off after fallback|load the latest replay handoff before opening the backup handoff escalation|open once the latest replay handoff is loaded/i);
});
