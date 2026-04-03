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
  assert.match(readme, /resume-ready|latest verified proof pointer|handoff|recovery path|workflow boundary|approval gate|boundary owner|recovery drill|next action target|next operator workspace|checklist|remaining steps|primary step|step progress|step path|active|queued|runnable|blocked|openable|executable|primed|not_primed|needsrefresh|fresh|needs_refresh|refresh disposition|refresh evidence hint|refresh outcome|refresh confidence|refresh detour|refresh escalation|refresh escalation target|refresh escalation mode|refresh escalation cta|approval escalation|recovery escalation|workflow owner escalation|inspect|recover|owner_handoff|approval gate evidence|workflow boundary evidence|recovery drill evidence|proof pointer|approval gate is current again|workflow boundary is current again|recovery drill state is current again|proof pointer is current again|high|medium|low|silent_rehydrate|reopen_then_refresh|reload_before_run|refresh action|refresh first|refresh replay|refresh target state|refresh scope|after refresh|latest gate state|gate|boundary|proof|recovery/i);
  assert.match(operatorGuide, /GET \/v1\/runtime\/session-replay/);
  assert.match(operatorGuide, /Runtime session replay note:/);
  assert.match(operatorGuide, /resume-ready|latest verified proof pointer|handoff|recovery path|workflow boundary|approval gate|boundary owner|recovery drill|next action target|next operator workspace|checklist|remaining steps|primary step|step progress|step path|active|queued|runnable|blocked|openable|executable|primed|not_primed|needsrefresh|fresh|needs_refresh|refresh disposition|refresh evidence hint|refresh outcome|refresh confidence|refresh detour|refresh escalation|refresh escalation target|refresh escalation mode|refresh escalation cta|approval escalation|recovery escalation|workflow owner escalation|inspect|recover|owner_handoff|approval gate evidence|workflow boundary evidence|recovery drill evidence|proof pointer|approval gate is current again|workflow boundary is current again|recovery drill state is current again|proof pointer is current again|high|medium|low|silent_rehydrate|reopen_then_refresh|reload_before_run|refresh action|refresh first|refresh replay|refresh target state|refresh scope|after refresh|latest gate state|gate|boundary|proof|recovery/i);
  assert.match(architecture, /runtime session replay mirror/i);
  assert.match(architecture, /resume-ready|latest verified proof pointer|handoff|recovery path|workflow boundary|approval gate|boundary owner|recovery drill|next action target|next operator workspace|checklist|remaining steps|primary step|step progress|step path|active|queued|runnable|blocked|openable|executable|primed|not_primed|needsrefresh|fresh|needs_refresh|refresh disposition|refresh evidence hint|refresh outcome|refresh confidence|refresh detour|refresh escalation|refresh escalation target|refresh escalation mode|refresh escalation cta|approval escalation|recovery escalation|workflow owner escalation|inspect|recover|owner_handoff|approval gate evidence|workflow boundary evidence|recovery drill evidence|proof pointer|approval gate is current again|workflow boundary is current again|recovery drill state is current again|proof pointer is current again|high|medium|low|silent_rehydrate|reopen_then_refresh|reload_before_run|refresh action|refresh first|refresh replay|refresh target state|refresh scope|after refresh|latest gate state|gate|boundary|proof|recovery/i);
});
