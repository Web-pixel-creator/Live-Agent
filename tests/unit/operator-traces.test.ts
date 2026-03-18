import test from "node:test";
import assert from "node:assert/strict";
import { buildOperatorTraceSummary } from "../../apps/api-backend/src/operator-traces.js";
import type { ApprovalRecord, EventListItem, RunListItem } from "../../apps/api-backend/src/firestore.js";

test("operator trace summary aggregates run/event/approval telemetry", () => {
  const runs: RunListItem[] = [
    {
      runId: "run-ui-1",
      sessionId: "session-1",
      status: "completed",
      route: "ui-navigator-agent",
      updatedAt: "2026-02-20T10:00:00.000Z",
    },
    {
      runId: "run-live-1",
      sessionId: "session-2",
      status: "completed",
      route: "live-agent",
      updatedAt: "2026-02-20T09:59:00.000Z",
    },
  ];

  const events: EventListItem[] = [
    {
      eventId: "event-ui-1",
      sessionId: "session-1",
      runId: "run-ui-1",
      type: "orchestrator.response",
      source: "ui-navigator-agent",
      createdAt: "2026-02-20T10:00:00.000Z",
      route: "ui-navigator-agent",
      status: "completed",
      intent: "ui_task",
      traceId: "trace-ui-1",
      approvalId: "approval-run-ui-1",
      approvalStatus: "approved",
      traceSteps: 3,
      screenshotRefs: 2,
      verificationState: "verified",
      verificationFailureClass: undefined,
      verificationSummary: "Execution verified with 1 verification step.",
      verifySteps: 1,
      hasVisualTesting: true,
      hasError: false,
    },
    {
      eventId: "event-live-1",
      sessionId: "session-2",
      runId: "run-live-1",
      type: "orchestrator.response",
      source: "live-agent",
      createdAt: "2026-02-20T09:59:00.000Z",
      route: "live-agent",
      status: "completed",
      intent: "translation",
      traceSteps: 0,
      screenshotRefs: 0,
      hasVisualTesting: false,
      hasError: false,
    },
  ];

  const approvals: ApprovalRecord[] = [
    {
      approvalId: "approval-run-ui-1",
      sessionId: "session-1",
      runId: "run-ui-1",
      status: "approved",
      decision: "approved",
      reason: "approved by operator",
      requestedAt: "2026-02-20T09:58:00.000Z",
      softDueAt: "2026-02-20T09:59:00.000Z",
      hardDueAt: "2026-02-20T10:03:00.000Z",
      resolvedAt: "2026-02-20T10:00:00.000Z",
      softReminderSentAt: null,
      auditLog: [],
      createdAt: "2026-02-20T09:58:00.000Z",
      updatedAt: "2026-02-20T10:00:00.000Z",
      metadata: null,
    },
  ];

  const summary = buildOperatorTraceSummary({
    runs,
    events,
    approvals,
    activeTasks: [],
    runLimit: 20,
    eventLimit: 20,
  });

  assert.equal(summary.totals.runsConsidered, 2);
  assert.equal(summary.totals.eventsConsidered, 2);
  assert.equal(summary.totals.uiTraceRuns, 1);
  assert.equal(summary.totals.approvalLinkedRuns, 1);
  assert.equal(summary.totals.traceSteps, 3);
  assert.equal(summary.totals.screenshotRefs, 2);
  assert.equal(summary.totals.verifiedRuns, 1);
  assert.equal(summary.totals.verifySteps, 1);
  assert.equal(summary.byRoute["ui-navigator-agent"], 1);
  assert.equal(summary.byStatus.completed, 2);
  assert.equal(summary.byStage["execution"] ?? 0, 0);
  assert.equal(summary.liveBridgeHealth.state, "unknown");
  assert.equal(summary.liveBridgeHealth.degradedEvents, 0);
  assert.equal(summary.liveBridgeHealth.recoveredEvents, 0);

  const uiRun = summary.recentRuns.find((item) => item.runId === "run-ui-1");
  assert.ok(uiRun);
  assert.equal(uiRun?.traceId, "trace-ui-1");
  assert.equal(uiRun?.approvalStatus, "approved");
  assert.equal(uiRun?.traceSteps, 3);
  assert.equal(uiRun?.screenshotRefs, 2);
  assert.equal(uiRun?.verificationState, "verified");
  assert.equal(uiRun?.verifySteps, 1);
});

test("operator trace summary falls back to active tasks and approvals without persisted runs", () => {
  const approvals: ApprovalRecord[] = [
    {
      approvalId: "approval-run-pending-1",
      sessionId: "session-pending",
      runId: "run-pending-1",
      status: "pending",
      decision: null,
      reason: "Awaiting approval decision",
      requestedAt: "2026-02-20T11:00:00.000Z",
      softDueAt: "2026-02-20T11:01:00.000Z",
      hardDueAt: "2026-02-20T11:05:00.000Z",
      resolvedAt: null,
      softReminderSentAt: null,
      auditLog: [],
      createdAt: "2026-02-20T11:00:00.000Z",
      updatedAt: "2026-02-20T11:00:00.000Z",
      metadata: null,
    },
  ];

  const summary = buildOperatorTraceSummary({
    runs: [],
    events: [],
    approvals,
    activeTasks: [
      {
        taskId: "task-1",
        runId: "run-pending-1",
        sessionId: "session-pending",
        route: "ui-navigator-agent",
        status: "pending_approval",
        stage: "awaiting_approval",
        intent: "ui_task",
        updatedAt: "2026-02-20T11:00:30.000Z",
      },
    ],
    runLimit: 20,
    eventLimit: 20,
  });

  assert.equal(summary.totals.runsConsidered, 1);
  assert.equal(summary.totals.activeTaskBackedRuns, 1);
  assert.equal(summary.totals.approvalLinkedRuns, 1);
  assert.equal(summary.totals.uiTraceRuns, 1);
  assert.equal(summary.byStage.awaiting_approval, 1);

  const run = summary.recentRuns[0];
  assert.ok(run);
  assert.equal(run.runId, "run-pending-1");
  assert.equal(run.approvalStatus, "pending");
  assert.equal(run.activeTaskStage, "awaiting_approval");
  assert.equal(run.verificationState, null);
  assert.equal(summary.liveBridgeHealth.state, "unknown");
});

test("operator trace summary derives stage-aware bottleneck views", () => {
  const runs: RunListItem[] = [
    {
      runId: "run-await",
      sessionId: "session-await",
      status: "pending_approval",
      route: "ui-navigator-agent",
      updatedAt: "2026-02-20T11:00:00.000Z",
    },
    {
      runId: "run-verify",
      sessionId: "session-verify",
      status: "completed",
      route: "ui-navigator-agent",
      updatedAt: "2026-02-20T10:59:00.000Z",
    },
    {
      runId: "run-browser",
      sessionId: "session-browser",
      status: "running",
      route: "ui-navigator-agent",
      updatedAt: "2026-02-20T10:58:00.000Z",
    },
    {
      runId: "run-escalate",
      sessionId: "session-escalate",
      status: "completed",
      route: "live-agent",
      updatedAt: "2026-02-20T10:57:00.000Z",
    },
  ];

  const events: EventListItem[] = [
    {
      eventId: "event-await",
      sessionId: "session-await",
      runId: "run-await",
      type: "orchestrator.response",
      source: "ui-navigator-agent",
      createdAt: "2026-02-20T11:00:00.000Z",
      route: "ui-navigator-agent",
      status: "pending_approval",
      intent: "ui_task",
      traceSteps: 0,
      screenshotRefs: 0,
      verificationState: "blocked_pending_approval",
      verificationFailureClass: undefined,
      verificationSummary: "Waiting for approval before verification.",
      verifySteps: 0,
      approvalId: "approval-run-await",
      approvalStatus: "pending",
      hasVisualTesting: false,
      hasError: false,
    },
    {
      eventId: "event-verify",
      sessionId: "session-verify",
      runId: "run-verify",
      type: "orchestrator.response",
      source: "ui-navigator-agent",
      createdAt: "2026-02-20T10:59:00.000Z",
      route: "ui-navigator-agent",
      status: "completed",
      intent: "ui_task",
      traceSteps: 4,
      screenshotRefs: 2,
      verificationState: "unverified",
      verificationFailureClass: "browser_check_failed",
      verificationSummary: "Verification failed after browser run.",
      verifySteps: 1,
      approvalId: "approval-run-verify",
      approvalStatus: "approved",
      hasVisualTesting: true,
      hasError: false,
    },
    {
      eventId: "event-browser",
      sessionId: "session-browser",
      runId: "run-browser",
      type: "orchestrator.response",
      source: "ui-navigator-agent",
      createdAt: "2026-02-20T10:58:00.000Z",
      route: "ui-navigator-agent",
      status: "running",
      intent: "ui_task",
      traceSteps: 2,
      screenshotRefs: 1,
      verificationState: null,
      verificationFailureClass: undefined,
      verificationSummary: null,
      verifySteps: 0,
      approvalId: null,
      approvalStatus: null,
      hasVisualTesting: true,
      hasError: false,
    },
    {
      eventId: "event-escalate",
      sessionId: "session-escalate",
      runId: "run-escalate",
      type: "orchestrator.response",
      source: "live-agent",
      createdAt: "2026-02-20T10:57:00.000Z",
      route: "live-agent",
      status: "completed",
      intent: "conversation",
      traceSteps: 0,
      screenshotRefs: 0,
      verificationState: null,
      verificationFailureClass: undefined,
      verificationSummary: null,
      verifySteps: 0,
      approvalId: "approval-run-escalate",
      approvalStatus: "rejected",
      hasVisualTesting: false,
      hasError: false,
    },
  ];

  const approvals: ApprovalRecord[] = [
    {
      approvalId: "approval-run-await",
      sessionId: "session-await",
      runId: "run-await",
      status: "pending",
      decision: null,
      reason: "Awaiting operator approval",
      requestedAt: "2026-02-20T10:59:30.000Z",
      softDueAt: "2026-02-20T11:00:30.000Z",
      hardDueAt: "2026-02-20T11:03:30.000Z",
      resolvedAt: null,
      softReminderSentAt: null,
      auditLog: [],
      createdAt: "2026-02-20T10:59:30.000Z",
      updatedAt: "2026-02-20T10:59:30.000Z",
      metadata: null,
    },
    {
      approvalId: "approval-run-escalate",
      sessionId: "session-escalate",
      runId: "run-escalate",
      status: "rejected",
      decision: "rejected",
      reason: "Rejected by operator",
      requestedAt: "2026-02-20T10:56:30.000Z",
      softDueAt: "2026-02-20T10:57:30.000Z",
      hardDueAt: "2026-02-20T11:00:30.000Z",
      resolvedAt: "2026-02-20T10:57:45.000Z",
      softReminderSentAt: null,
      auditLog: [],
      createdAt: "2026-02-20T10:56:30.000Z",
      updatedAt: "2026-02-20T10:57:45.000Z",
      metadata: null,
    },
  ];

  const summary = buildOperatorTraceSummary({
    runs,
    events,
    approvals,
    activeTasks: [
      {
        taskId: "task-await",
        runId: "run-await",
        sessionId: "session-await",
        route: "ui-navigator-agent",
        status: "pending_approval",
        stage: "awaiting_approval",
        intent: "ui_task",
        updatedAt: "2026-02-20T11:00:05.000Z",
      },
    ],
    runLimit: 20,
    eventLimit: 20,
  });

  const awaitingApproval = summary.bottlenecks.find((item) => item.key === "awaiting_approval");
  const verificationFailed = summary.bottlenecks.find((item) => item.key === "verification_failed");
  const browserRunIncomplete = summary.bottlenecks.find((item) => item.key === "browser_run_incomplete");
  const escalationRequired = summary.bottlenecks.find((item) => item.key === "escalation_required");

  assert.ok(awaitingApproval);
  assert.ok(verificationFailed);
  assert.ok(browserRunIncomplete);
  assert.ok(escalationRequired);
  assert.equal(awaitingApproval?.count, 1);
  assert.equal(awaitingApproval?.stageBoundary, "awaiting_approval");
  assert.equal(awaitingApproval?.roleBoundary, "ui-navigator-agent");
  assert.equal(awaitingApproval?.verificationBoundary, "blocked_pending_approval");
  assert.equal(verificationFailed?.count, 1);
  assert.equal(verificationFailed?.verificationBoundary, "unverified");
  assert.equal(browserRunIncomplete?.count, 1);
  assert.equal(browserRunIncomplete?.stageBoundary, "running");
  assert.equal(escalationRequired?.count, 1);
  assert.equal(escalationRequired?.verificationBoundary, "rejected");
});

test("operator trace summary aggregates live bridge health telemetry", () => {
  const events: EventListItem[] = [
    {
      eventId: "event-lb-0",
      sessionId: "session-live",
      runId: "run-live-health",
      type: "live.bridge.connect_timeout",
      source: "gateway",
      createdAt: "2026-02-20T09:59:57.000Z",
    },
    {
      eventId: "event-lb-00",
      sessionId: "session-live",
      runId: "run-live-health",
      type: "live.bridge.health_ping_error",
      source: "gateway",
      createdAt: "2026-02-20T09:59:58.500Z",
    },
    {
      eventId: "event-lb-1",
      sessionId: "session-live",
      runId: "run-live-health",
      type: "live.bridge.health_degraded",
      source: "gateway",
      createdAt: "2026-02-20T10:00:00.000Z",
    },
    {
      eventId: "event-lb-2",
      sessionId: "session-live",
      runId: "run-live-health",
      type: "live.bridge.health_watchdog_reconnect",
      source: "gateway",
      createdAt: "2026-02-20T10:00:01.000Z",
    },
    {
      eventId: "event-lb-2b",
      sessionId: "session-live",
      runId: "run-live-health",
      type: "live.bridge.health_probe_started",
      source: "gateway",
      createdAt: "2026-02-20T10:00:01.100Z",
    },
    {
      eventId: "event-lb-2c",
      sessionId: "session-live",
      runId: "run-live-health",
      type: "live.bridge.health_ping_sent",
      source: "gateway",
      createdAt: "2026-02-20T10:00:01.200Z",
    },
    {
      eventId: "event-lb-2d",
      sessionId: "session-live",
      runId: "run-live-health",
      type: "live.bridge.health_pong",
      source: "gateway",
      createdAt: "2026-02-20T10:00:01.300Z",
    },
    {
      eventId: "event-lb-3",
      sessionId: "session-live",
      runId: "run-live-health",
      type: "live.bridge.health_recovered",
      source: "gateway",
      createdAt: "2026-02-20T10:00:02.000Z",
    },
    {
      eventId: "event-lb-4",
      sessionId: "session-live",
      runId: "run-live-health",
      type: "live.bridge.error",
      source: "gateway",
      createdAt: "2026-02-20T09:59:59.000Z",
    },
    {
      eventId: "event-lb-5",
      sessionId: "session-live",
      runId: "run-live-health",
      type: "live.bridge.unavailable",
      source: "gateway",
      createdAt: "2026-02-20T09:59:58.000Z",
    },
  ];

  const summary = buildOperatorTraceSummary({
    runs: [],
    events,
    approvals: [],
    activeTasks: [],
    runLimit: 20,
    eventLimit: 20,
  });

  assert.equal(summary.liveBridgeHealth.degradedEvents, 1);
  assert.equal(summary.liveBridgeHealth.watchdogReconnectEvents, 1);
  assert.equal(summary.liveBridgeHealth.recoveredEvents, 1);
  assert.equal(summary.liveBridgeHealth.bridgeErrorEvents, 1);
  assert.equal(summary.liveBridgeHealth.unavailableEvents, 1);
  assert.equal(summary.liveBridgeHealth.connectTimeoutEvents, 1);
  assert.equal(summary.liveBridgeHealth.probeStartedEvents, 1);
  assert.equal(summary.liveBridgeHealth.pingSentEvents, 1);
  assert.equal(summary.liveBridgeHealth.pongEvents, 1);
  assert.equal(summary.liveBridgeHealth.pingErrorEvents, 1);
  assert.equal(summary.liveBridgeHealth.lastEventType, "live.bridge.health_recovered");
  assert.equal(summary.liveBridgeHealth.lastEventAt, "2026-02-20T10:00:02.000Z");
  assert.equal(summary.liveBridgeHealth.state, "healthy");
});

test("operator trace summary marks live bridge as degraded when latest signal is ping error", () => {
  const events: EventListItem[] = [
    {
      eventId: "event-health-pong",
      sessionId: "session-live",
      runId: "run-live-health",
      type: "live.bridge.health_pong",
      source: "gateway",
      createdAt: "2026-02-20T10:00:01.000Z",
    },
    {
      eventId: "event-health-ping-error",
      sessionId: "session-live",
      runId: "run-live-health",
      type: "live.bridge.health_ping_error",
      source: "gateway",
      createdAt: "2026-02-20T10:00:02.000Z",
    },
  ];

  const summary = buildOperatorTraceSummary({
    runs: [],
    events,
    approvals: [],
    activeTasks: [],
    runLimit: 20,
    eventLimit: 20,
  });

  assert.equal(summary.liveBridgeHealth.pongEvents, 1);
  assert.equal(summary.liveBridgeHealth.pingErrorEvents, 1);
  assert.equal(summary.liveBridgeHealth.lastEventType, "live.bridge.health_ping_error");
  assert.equal(summary.liveBridgeHealth.state, "degraded");
});
