import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildConsultationBookingApprovedArtifact,
  summarizeNavigatorVisaFlowResults,
  type VisaFlowResult,
} from "../../scripts/demo-e2e-navigator-visa-flows.ts";

function createResult(
  name: string,
  overrides?: Partial<VisaFlowResult>,
): VisaFlowResult {
  return {
    name,
    url: `http://localhost:3000/${name}.html`,
    jobId: `job-${name}`,
    actionPlanSteps: 3,
    blockedPlanSteps: 2,
    finalStatus: "completed",
    pausedStatus: "paused",
    persistentSessionReady: true,
    persistentSessionReleased: true,
    verificationState: "verified",
    verificationRequested: true,
    completedVerifySteps: 1,
    checkpointCount: 1,
    resumedCheckpointCount: 1,
    staleRefCount: 1,
    healedRefCount: 1,
    staleRefTargets: ["prepare"],
    healedRefTargets: ["prepare"],
    runtimeResumedCheckpointCount: 1,
    runtimeStaleRefCount: 1,
    runtimeHealedRefCount: 1,
    checkpointReadyCleared: true,
    replayBundlePresent: true,
    traceCount: 3,
    latestResultRef: `artifact://${name}`,
    summary: "healed 1 stale grounding ref; resumed 1 checkpoint.",
    success: true,
    ...overrides,
  };
}

test("navigator visa flow summary validates when all flows carry persistent replay-backed recovery proof", () => {
  const summary = summarizeNavigatorVisaFlowResults([
    createResult("booking"),
    createResult("reminder"),
    createResult("handoff"),
    createResult("escalation"),
  ]);

  assert.equal(summary.validated, true);
  assert.equal(summary.totalFlows, 4);
  assert.equal(summary.succeededFlows, 4);
  assert.equal(summary.successRate, 1);
  assert.equal(summary.persistentSessionCount, 4);
  assert.equal(summary.replayBundleCount, 4);
  assert.equal(summary.verifiedCount, 4);
  assert.equal(summary.staleRecoveryObservedCount, 4);
  assert.equal(summary.healedRecoveryObservedCount, 4);
  assert.equal(summary.resumedCheckpointCount, 4);
  assert.deepEqual(summary.scenarioNames, ["booking", "reminder", "handoff", "escalation"]);
});

test("navigator visa flow summary drops validation when one flow misses replay-backed recovery guarantees", () => {
  const summary = summarizeNavigatorVisaFlowResults([
    createResult("booking"),
    createResult("reminder"),
    createResult("handoff", {
      success: false,
      verificationState: "partially_verified",
      replayBundlePresent: false,
      staleRefCount: 0,
      healedRefCount: 0,
      resumedCheckpointCount: 0,
      persistentSessionReleased: false,
    }),
    createResult("escalation"),
  ]);

  assert.equal(summary.validated, false);
  assert.equal(summary.totalFlows, 4);
  assert.equal(summary.succeededFlows, 3);
  assert.equal(summary.successRate, 0.75);
  assert.equal(summary.persistentSessionCount, 3);
  assert.equal(summary.replayBundleCount, 3);
  assert.equal(summary.verifiedCount, 3);
  assert.equal(summary.staleRecoveryObservedCount, 3);
  assert.equal(summary.healedRecoveryObservedCount, 3);
  assert.equal(summary.resumedCheckpointCount, 3);
});

test("navigator visa proof pins visa approval keywords so demo-e2e stays deterministic across local env files", () => {
  const source = readFileSync(
    resolve(process.cwd(), "scripts", "demo-e2e-navigator-visa-flows.ts"),
    "utf8",
  );

  assert.match(source, /UI_NAVIGATOR_APPROVAL_KEYWORDS/);
  assert.match(source, /visa,relocation,immigration,work permit,residency/);
});

test("navigator visa flows emit a deterministic consultation booking approval artifact from the booking scenario", () => {
  const summary = summarizeNavigatorVisaFlowResults([
    createResult("booking", {
      latestResultRef: "ui://browser-jobs/job-booking/result-completed",
      jobId: "job-booking",
      checkpointCount: 1,
      resumedCheckpointCount: 1,
      summary: "healed 1 stale grounding ref; resumed 1 checkpoint.",
    }),
    createResult("reminder"),
    createResult("handoff"),
    createResult("escalation"),
  ]);

  const artifact = buildConsultationBookingApprovedArtifact(
    summary,
    "artifacts/demo-e2e/navigator-visa-flows.json",
    "2026-04-24T00:00:00.000Z",
  );

  assert.ok(artifact);
  assert.equal(artifact?.artifactType, "consultation_booking_approved");
  assert.equal(artifact?.workflow, "consultation_booking");
  assert.equal(artifact?.scenarioName, "booking");
  assert.equal(artifact?.status, "approved");
  assert.equal(artifact?.approvalStatus, "approved");
  assert.equal(artifact?.approvalBoundaryRespected, true);
  assert.equal(artifact?.bookingFlowValidated, true);
  assert.equal(artifact?.calendarWritebackCompleted, false);
  assert.equal(artifact?.preferredSlot, "Tomorrow 15:30");
  assert.equal(artifact?.backupSlot, "Tomorrow 17:00");
  assert.equal(artifact?.evidence.navigatorVisaFlowsPath, "artifacts/demo-e2e/navigator-visa-flows.json");
  assert.equal(artifact?.evidence.latestResultRef, "ui://browser-jobs/job-booking/result-completed");
});
