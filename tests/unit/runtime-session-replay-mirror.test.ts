import assert from "node:assert/strict";
import test from "node:test";
import type {
  ApprovalRecord,
  EventListItem,
  RunListItem,
  SessionListItem,
} from "../../apps/api-backend/src/firestore.js";
import type { RuntimeWorkflowControlPlaneSummary } from "../../apps/api-backend/src/runtime-workflow-control-plane.js";
import { buildRuntimeSessionReplayMirrorSnapshot } from "../../apps/api-backend/src/runtime-session-replay-mirror.js";

function buildWorkflowSummary(overrides: Partial<RuntimeWorkflowControlPlaneSummary>): RuntimeWorkflowControlPlaneSummary {
  return {
    sourceKind: "repo",
    sourcePath: "./agents/orchestrator/src/workflow-store.ts",
    usingLastKnownGood: false,
    fingerprint: "workflow-fingerprint",
    loadedAt: "2026-04-01T09:59:00.000Z",
    lastAttemptAt: "2026-04-01T09:59:00.000Z",
    lastError: null,
    controlPlaneOverrideActive: false,
    controlPlaneOverrideUpdatedAt: null,
    controlPlaneOverrideReason: null,
    assistiveRouterEnabled: true,
    assistiveRouterApiKeyConfigured: true,
    assistiveRouterProvider: "mock",
    assistiveRouterModel: "mock-router",
    assistiveRouterBaseUrl: "http://localhost:8082",
    assistiveRouterTimeoutMs: 8000,
    assistiveRouterMinConfidence: 0.5,
    assistiveRouterAllowIntents: ["translation", "ui_task"],
    assistiveRouterBudgetPolicy: "balanced",
    assistiveRouterPromptCaching: "enabled",
    assistiveRouterWatchlistEnabled: true,
    idempotencyTtlMs: 300000,
    workflowExecutionStatus: "active",
    workflowCurrentStage: "review",
    workflowActiveRole: "operator",
    workflowRunId: "run-a-1",
    workflowSessionId: "session-a",
    workflowTaskId: "task-a-1",
    workflowIntent: "translation",
    workflowRoute: "live-agent",
    workflowReason: "review pending",
    workflowUpdatedAt: "2026-04-01T10:00:00.000Z",
    workflowBookingStatus: null,
    workflowBookingTopic: null,
    workflowBookingSelectedSlotLabel: null,
    workflowBookingSummary: null,
    workflowHandoffScenario: null,
    workflowHandoffStatus: null,
    workflowHandoffIntent: null,
    workflowHandoffCaseId: null,
    workflowHandoffDestinationCountry: null,
    workflowHandoffAssignedOwner: null,
    workflowHandoffPriority: null,
    workflowHandoffSummary: null,
    workflowHandoffNextStep: null,
    workflowHandoffReady: null,
    workflowFollowUpScenario: null,
    workflowFollowUpStatus: null,
    workflowFollowUpIntent: null,
    workflowFollowUpCaseId: null,
    workflowFollowUpDestinationCountry: null,
    workflowFollowUpMissingItemsCount: null,
    workflowFollowUpSummary: null,
    workflowFollowUpNextStep: null,
    workflowFollowUpReady: null,
    retryContinuationStatusCode: 409,
    retryContinuationBackoffMs: 250,
    retryTransientErrorCodes: ["ETIMEDOUT"],
    retryTransientErrorPatterns: [],
    retryTerminalErrorCodes: [],
    retryTerminalErrorPatterns: [],
    ...overrides,
  };
}

test("runtime session replay mirror aggregates selected session replay, approvals, and workflow linkage", () => {
  const sessions: SessionListItem[] = [
    {
      sessionId: "session-a",
      tenantId: "tenant-a",
      mode: "live",
      status: "active",
      version: 4,
      lastMutationId: "mutation-a",
      updatedAt: "2026-04-01T10:00:00.000Z",
    },
    {
      sessionId: "session-b",
      tenantId: "tenant-a",
      mode: "ui",
      status: "paused",
      version: 2,
      lastMutationId: "mutation-b",
      updatedAt: "2026-04-01T09:30:00.000Z",
    },
  ];

  const runs: RunListItem[] = [
    {
      runId: "run-a-1",
      sessionId: "session-a",
      status: "completed",
      route: "live-agent",
      updatedAt: "2026-04-01T10:00:00.000Z",
    },
    {
      runId: "run-b-1",
      sessionId: "session-b",
      status: "pending_approval",
      route: "ui-navigator-agent",
      updatedAt: "2026-04-01T09:30:00.000Z",
    },
  ];

  const approvals: ApprovalRecord[] = [
    {
      approvalId: "approval-b-1",
      tenantId: "tenant-a",
      sessionId: "session-b",
      runId: "run-b-1",
      status: "pending",
      decision: null,
      reason: "Awaiting operator decision",
      requestedAt: "2026-04-01T09:25:00.000Z",
      softDueAt: "2026-04-01T09:26:00.000Z",
      hardDueAt: "2026-04-01T09:35:00.000Z",
      resolvedAt: null,
      softReminderSentAt: null,
      auditLog: [],
      createdAt: "2026-04-01T09:25:00.000Z",
      updatedAt: "2026-04-01T09:25:00.000Z",
      metadata: null,
    },
  ];

  const recentEvents: EventListItem[] = [
    {
      eventId: "event-a-1",
      sessionId: "session-a",
      runId: "run-a-1",
      type: "orchestrator.response",
      source: "live-agent",
      createdAt: "2026-04-01T10:00:00.000Z",
      route: "live-agent",
      status: "completed",
      intent: "translation",
      verificationState: "verified",
      verificationSummary: "Intake review passed.",
      verifySteps: 2,
      traceSteps: 3,
      screenshotRefs: 1,
    },
    {
      eventId: "event-b-1",
      sessionId: "session-b",
      runId: "run-b-1",
      type: "orchestrator.response",
      source: "ui-navigator-agent",
      createdAt: "2026-04-01T09:30:00.000Z",
      route: "ui-navigator-agent",
      status: "pending_approval",
      intent: "ui_task",
      approvalId: "approval-b-1",
      approvalStatus: "pending",
      verificationState: "blocked_pending_approval",
    },
  ];

  const snapshot = buildRuntimeSessionReplayMirrorSnapshot({
    sessions,
    runs,
    approvals,
    recentEvents,
    selectedEvents: recentEvents.filter((item) => item.sessionId === "session-a"),
    selectedSessionId: "session-a",
    workflowSummary: buildWorkflowSummary({
      workflowSessionId: "session-a",
      workflowHandoffStatus: "ready",
      workflowHandoffIntent: "escalation",
      workflowHandoffCaseId: "case-77",
      workflowHandoffDestinationCountry: "Canada",
      workflowHandoffAssignedOwner: "ops-specialist",
      workflowHandoffPriority: "high",
      workflowHandoffSummary: "Escalation pack is ready",
      workflowHandoffNextStep: "Transfer to specialist",
      workflowHandoffReady: true,
    }),
  });

  assert.equal(snapshot.source, "repo_owned_runtime_session_replay");
  assert.equal(snapshot.mirrorVersion, 1);
  assert.equal(snapshot.selectedSessionId, "session-a");
  assert.equal(snapshot.workflowAvailable, true);
  assert.equal(snapshot.summary.totalSessions, 2);
  assert.equal(snapshot.summary.sessionsWithReplay, 2);
  assert.equal(snapshot.summary.sessionsAwaitingApproval, 1);
  assert.equal(snapshot.summary.sessionsWithVerifiedProof, 1);
  assert.equal(snapshot.selectedSession.workflow.linked, true);
  assert.equal(snapshot.selectedSession.workflow.workflowCurrentStage, "review");
  assert.equal(snapshot.selectedSession.workflow.handoff?.kind, "handoff");
  assert.equal(snapshot.selectedSession.workflow.handoff?.caseId, "case-77");
  assert.equal(snapshot.selectedSession.workflow.followUp, null);
  assert.equal(snapshot.selectedSession.replay.replayState, "verified");
  assert.equal(snapshot.selectedSession.replay.resumeReady, true);
  assert.equal(snapshot.selectedSession.replay.resumeBlockedBy, null);
  assert.equal(snapshot.selectedSession.replay.nextOperatorAction, "resume_handoff");
  assert.equal(snapshot.selectedSession.replay.nextOperatorActionLabel, "Resume handoff");
  assert.deepEqual(snapshot.selectedSession.replay.nextOperatorActionTarget, {
    targetSurface: "operator_session_ops",
    targetLabel: "Operator Session Ops",
  });
  assert.equal(snapshot.selectedSession.replay.nextOperatorWorkspace, "runtime");
  assert.equal(snapshot.selectedSession.replay.latestVerifiedStage, "review");
  assert.deepEqual(snapshot.selectedSession.replay.boundaryOwner, {
    role: "operator",
    owner: "ops-specialist",
    sessionId: "session-a",
    taskId: "task-a-1",
    workflowRunId: "run-a-1",
  });
  assert.equal(snapshot.selectedSession.replay.approvalGate, null);
  assert.equal(snapshot.selectedSession.replay.currentHandoffState?.kind, "handoff");
  assert.equal(snapshot.selectedSession.replay.currentHandoffState?.nextStep, "Transfer to specialist");
  assert.deepEqual(snapshot.selectedSession.replay.workflowBoundarySummary, {
    kind: "handoff",
    stage: "review",
    role: "operator",
    status: "ready",
    summary: "Escalation pack is ready",
    nextStep: "Transfer to specialist",
    owner: "ops-specialist",
  });
  assert.equal(snapshot.selectedSession.replay.latestVerifiedSummary, "Intake review passed.");
  assert.equal(snapshot.selectedSession.replay.latestVerifiedRunId, "run-a-1");
  assert.deepEqual(snapshot.selectedSession.replay.latestProofPointer, {
    runId: "run-a-1",
    summary: "Intake review passed.",
    verifiedAt: "2026-04-01T10:00:00.000Z",
    route: "live-agent",
    intent: "translation",
    workflowStage: "review",
  });
  assert.deepEqual(snapshot.selectedSession.replay.recoveryPathHint, {
    code: "resume_handoff",
    label: "Resume from the handoff boundary and transfer the prepared case pack.",
    action: "resume_handoff",
  });
  assert.deepEqual(snapshot.selectedSession.replay.recoveryHandoff, {
    targetPanel: "operator_session_ops",
    targetLabel: "Operator Session Ops",
    reason: "Transfer to specialist",
    action: "resume_handoff",
  });
  assert.equal(snapshot.selectedSession.replay.recoveryDrill, null);
  assert.equal(snapshot.selectedSession.replay.bySource["live-agent"], 1);
  assert.equal(snapshot.selectedSession.replay.byType["orchestrator.response"], 1);
  assert.equal(snapshot.selectedSession.replay.byRoute["live-agent"], 1);
  assert.ok(snapshot.sessions.some((item) => item.sessionId === "session-a" && item.replayState === "verified"));
  assert.ok(
    snapshot.sessions.some((item) => item.sessionId === "session-b" && item.replayState === "awaiting_approval"),
  );
});

test("runtime session replay mirror blocks resume when approval or active workflow boundary still owns the session", () => {
  const sessions: SessionListItem[] = [
    {
      sessionId: "session-b",
      tenantId: "tenant-a",
      mode: "ui",
      status: "paused",
      version: 2,
      lastMutationId: "mutation-b",
      updatedAt: "2026-04-01T09:30:00.000Z",
    },
  ];

  const runs: RunListItem[] = [
    {
      runId: "run-b-1",
      sessionId: "session-b",
      status: "pending_approval",
      route: "ui-navigator-agent",
      updatedAt: "2026-04-01T09:30:00.000Z",
    },
  ];

  const approvals: ApprovalRecord[] = [
    {
      approvalId: "approval-b-1",
      tenantId: "tenant-a",
      sessionId: "session-b",
      runId: "run-b-1",
      status: "pending",
      decision: null,
      reason: "Awaiting operator decision",
      requestedAt: "2026-04-01T09:25:00.000Z",
      softDueAt: "2026-04-01T09:26:00.000Z",
      hardDueAt: "2026-04-01T09:35:00.000Z",
      resolvedAt: null,
      softReminderSentAt: null,
      auditLog: [],
      createdAt: "2026-04-01T09:25:00.000Z",
      updatedAt: "2026-04-01T09:25:00.000Z",
      metadata: null,
    },
  ];

  const recentEvents: EventListItem[] = [
    {
      eventId: "event-b-1",
      sessionId: "session-b",
      runId: "run-b-1",
      type: "orchestrator.response",
      source: "ui-navigator-agent",
      createdAt: "2026-04-01T09:30:00.000Z",
      route: "ui-navigator-agent",
      status: "pending_approval",
      intent: "ui_task",
      approvalId: "approval-b-1",
      approvalStatus: "pending",
      verificationState: "blocked_pending_approval",
    },
  ];

  const snapshot = buildRuntimeSessionReplayMirrorSnapshot({
    sessions,
    runs,
    approvals,
    recentEvents,
    selectedEvents: recentEvents,
    selectedSessionId: "session-b",
    workflowSummary: buildWorkflowSummary({
      workflowSessionId: "session-b",
      workflowRunId: "run-b-1",
      workflowTaskId: "task-b-1",
      workflowExecutionStatus: "pending_approval",
      workflowCurrentStage: "verification",
    }),
  });

  assert.equal(snapshot.selectedSession.workflow.linked, true);
  assert.equal(snapshot.selectedSession.replay.replayState, "awaiting_approval");
  assert.equal(snapshot.selectedSession.replay.resumeReady, false);
  assert.equal(snapshot.selectedSession.replay.resumeBlockedBy, "approval_pending");
  assert.equal(snapshot.selectedSession.replay.nextOperatorAction, "resolve_approval");
  assert.equal(snapshot.selectedSession.replay.nextOperatorActionLabel, "Resolve approval");
  assert.deepEqual(snapshot.selectedSession.replay.nextOperatorActionTarget, {
    targetSurface: "operator_saved_view_approvals",
    targetLabel: "Approvals",
  });
  assert.equal(snapshot.selectedSession.replay.nextOperatorWorkspace, "approvals");
  assert.equal(snapshot.selectedSession.replay.latestVerifiedStage, null);
  assert.deepEqual(snapshot.selectedSession.replay.boundaryOwner, {
    role: "operator",
    owner: null,
    sessionId: "session-b",
    taskId: "task-b-1",
    workflowRunId: "run-b-1",
  });
  assert.deepEqual(snapshot.selectedSession.replay.approvalGate, {
    source: "session",
    status: "pending",
    approvalId: "approval-b-1",
    runId: "run-b-1",
    reason: "Awaiting operator decision",
    requestedAt: "2026-04-01T09:25:00.000Z",
    hardDueAt: "2026-04-01T09:35:00.000Z",
    pendingCount: 1,
    action: "resolve_approval",
  });
  assert.deepEqual(snapshot.selectedSession.replay.workflowBoundarySummary, {
    kind: "workflow",
    stage: "verification",
    role: "operator",
    status: "pending_approval",
    summary: "review pending",
    nextStep: "Inspect the linked workflow boundary.",
    owner: null,
  });
  assert.equal(snapshot.selectedSession.replay.latestProofPointer, null);
  assert.deepEqual(snapshot.selectedSession.replay.recoveryPathHint, {
    code: "approval_pending",
    label: "Resolve the pending approval, then reopen the selected session.",
    action: "resolve_approval",
  });
  assert.deepEqual(snapshot.selectedSession.replay.recoveryHandoff, {
    targetPanel: "operator_session_ops",
    targetLabel: "Operator Session Ops",
    reason: "Inspect the linked workflow boundary.",
    action: "resolve_approval",
  });
  assert.equal(snapshot.selectedSession.replay.recoveryDrill, null);
});

test("runtime session replay mirror surfaces recovery drill guidance for failed workflow boundaries", () => {
  const sessions: SessionListItem[] = [
    {
      sessionId: "session-c",
      tenantId: "tenant-a",
      mode: "live",
      status: "paused",
      version: 3,
      lastMutationId: "mutation-c",
      updatedAt: "2026-04-01T11:10:00.000Z",
    },
  ];

  const runs: RunListItem[] = [
    {
      runId: "run-c-1",
      sessionId: "session-c",
      status: "failed",
      route: "live-agent",
      updatedAt: "2026-04-01T11:10:00.000Z",
    },
  ];

  const recentEvents: EventListItem[] = [
    {
      eventId: "event-c-1",
      sessionId: "session-c",
      runId: "run-c-1",
      type: "orchestrator.response",
      source: "live-agent",
      createdAt: "2026-04-01T11:10:00.000Z",
      route: "live-agent",
      status: "failed",
      intent: "translation",
      verificationState: "unverified",
      verificationSummary: "Workflow boundary failed before protected review.",
    },
  ];

  const snapshot = buildRuntimeSessionReplayMirrorSnapshot({
    sessions,
    runs,
    approvals: [],
    recentEvents,
    selectedEvents: recentEvents,
    selectedSessionId: "session-c",
    workflowSummary: buildWorkflowSummary({
      workflowSessionId: "session-c",
      workflowRunId: "run-c-1",
      workflowTaskId: "task-c-1",
      workflowExecutionStatus: "failed",
      workflowCurrentStage: "handoff",
      workflowReason: "Recovery drill is required before replay can resume.",
      workflowHandoffStatus: "blocked",
      workflowHandoffIntent: "escalation",
      workflowHandoffCaseId: "case-99",
      workflowHandoffDestinationCountry: "Canada",
      workflowHandoffAssignedOwner: "ops-recovery",
      workflowHandoffSummary: "Specialist transfer stalled",
      workflowHandoffNextStep: "Rebuild the handoff package",
      workflowHandoffReady: false,
    }),
  });

  assert.equal(snapshot.selectedSession.replay.replayState, "active");
  assert.equal(snapshot.selectedSession.replay.resumeReady, false);
  assert.equal(snapshot.selectedSession.replay.resumeBlockedBy, "workflow_failed");
  assert.equal(snapshot.selectedSession.replay.nextOperatorAction, "plan_recovery_drill");
  assert.equal(snapshot.selectedSession.replay.nextOperatorActionLabel, "Plan recovery drill");
  assert.deepEqual(snapshot.selectedSession.replay.nextOperatorActionTarget, {
    targetSurface: "operator_runtime_drills",
    targetLabel: "Runtime Drill Runner",
  });
  assert.equal(snapshot.selectedSession.replay.nextOperatorWorkspace, "runtime");
  assert.deepEqual(snapshot.selectedSession.replay.recoveryPathHint, {
    code: "workflow_failed",
    label: "Plan the workflow recovery drill before resuming the linked boundary.",
    action: "plan_recovery_drill",
  });
  assert.deepEqual(snapshot.selectedSession.replay.recoveryHandoff, {
    targetPanel: "operator_runtime_drills",
    targetLabel: "Runtime Drill Runner",
    reason: "Specialist transfer stalled",
    action: "plan_recovery_drill",
  });
  assert.deepEqual(snapshot.selectedSession.replay.recoveryDrill, {
    profileId: "orchestrator-last-known-good",
    phase: "recovery",
    label: "Workflow recovery drill",
    service: "orchestrator",
    reason: "Specialist transfer stalled",
    action: "plan_recovery_drill",
  });
});
