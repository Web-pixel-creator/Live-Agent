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
    "liveTransport",
    "activeMode",
    "evidenceSource",
    "capturedAt",
    "firstAudioMs",
    "firstAudioCapturedAt",
    "firstOutputMs",
    "firstOutputCapturedAt",
    "fallbackEventCount",
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
    "refreshState",
    "structured_primary_refresh_state",
    "flat_refresh_escalation_fields",
    "compatibility",
    "primaryReadModel",
    "legacyProjection",
    "legacyFlatFieldPrefix",
    "followupTreeDepth",
    "followupTree",
    "refreshAction",
    "refreshTargetState",
    "refreshRecoveryFollowupPath",
    "mode",
    "approval escalation",
    "recovery escalation",
    "workflow owner escalation",
    "inspect",
    "recover",
    "owner_handoff",
    "ready",
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
    "latestContextSource",
    "latestContextIngressSource",
    "latestVerifiedContextSource",
    "latestVerifiedContextIngressSource",
    "contextSource",
    "ingressSource",
    "workflowAvailable",
    "evidenceSignature",
  ]) {
    assert.ok(helperSource.includes(token), `runtime session replay helper missing token: ${token}`);
  }

  for (const token of [
    "refreshEscalationHint",
    "refreshEscalationTarget",
    "refreshEscalationCTA",
    "RuntimeSessionReplayPrimaryOperatorStepBase",
    "RuntimeSessionReplayPrimaryRefreshLegacyProjection",
    "buildNextOperatorPrimaryStepRefreshLegacyProjection",
    "refreshLegacyProjection",
  ]) {
    assert.ok(helperSource.includes(token), `runtime session replay legacy projection missing token: ${token}`);
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
  assert.match(readme, /refresh recovery follow-?up path/i);
  assert.match(readme, /structured refresh state/i);
  assert.match(readme, /evidenceSignature|tamper-evident|tamper evidence/i);
  assert.match(readme, /followuptree|followup tree/i);
  assert.match(readme, /compatibility block|compatibility metadata/i);
  assert.match(readme, /flat `refreshEscalation\.\.\.` fields remain a transitional legacy projection/i);
  assert.match(readme, /contextingresssource|ingress provenance|preserved_input_case_wiki|gateway_hydrated_case_wiki/i);
  assert.match(readme, /resume-ready|live transport|first-audio|first-output|fallback-event count|latest verified proof pointer|handoff|recovery path|workflow boundary|approval gate|boundary owner|primary step|step progress|structured refresh state|followuptree|compatibility|legacy projection/i);
  assert.match(operatorGuide, /GET \/v1\/runtime\/session-replay/);
  assert.match(operatorGuide, /Runtime session replay note:/);
  assert.match(operatorGuide, /refresh recovery follow-?up path/i);
  assert.match(operatorGuide, /structured refresh state/i);
  assert.match(operatorGuide, /evidenceSignature|tamper-evident|tamper evidence/i);
  assert.match(operatorGuide, /followuptree|followup tree/i);
  assert.match(operatorGuide, /compatibility block|compatibility metadata/i);
  assert.match(operatorGuide, /flat `refreshEscalation\.\.\.` fields remain a transitional legacy projection/i);
  assert.match(operatorGuide, /contextingresssource|ingress provenance|preserved_input_case_wiki|gateway_hydrated_case_wiki/i);
  assert.match(operatorGuide, /resume-ready|live transport|first-audio|first-output|fallback-event count|latest verified proof pointer|handoff|recovery path|workflow boundary|approval gate|boundary owner|primary step|step progress|structured refresh state|followuptree|compatibility|legacy projection/i);
  assert.match(architecture, /runtime session replay mirror/i);
  assert.match(architecture, /refresh recovery follow-?up path/i);
  assert.match(architecture, /structured refresh state/i);
  assert.match(architecture, /evidenceSignature|tamper-evident|tamper evidence/i);
  assert.match(architecture, /followuptree|followup tree/i);
  assert.match(architecture, /compatibility block|compatibility metadata/i);
  assert.match(architecture, /flat `refreshEscalation\.\.\.` projection remains transitional/i);
  assert.match(architecture, /contextingresssource|ingress provenance|preserved_input_case_wiki|gateway_hydrated_case_wiki/i);
  assert.match(architecture, /resume-ready|live transport|first-audio|first-output|fallback-event count|latest verified proof pointer|handoff|recovery path|workflow boundary|approval gate|boundary owner|primary step|step progress|structured refresh state|followuptree|compatibility|legacy projection/i);
});
