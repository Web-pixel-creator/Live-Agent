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
  assert.equal(summary.byRoute["ui-navigator-agent"], 1);
  assert.equal(summary.byStatus.completed, 2);
  assert.equal(summary.liveBridgeHealth.state, "unknown");
  assert.equal(summary.liveBridgeHealth.degradedEvents, 0);
  assert.equal(summary.liveBridgeHealth.recoveredEvents, 0);

  const uiRun = summary.recentRuns.find((item) => item.runId === "run-ui-1");
  assert.ok(uiRun);
  assert.equal(uiRun?.traceId, "trace-ui-1");
  assert.equal(uiRun?.approvalStatus, "approved");
  assert.equal(uiRun?.traceSteps, 3);
  assert.equal(uiRun?.screenshotRefs, 2);
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

  const run = summary.recentRuns[0];
  assert.ok(run);
  assert.equal(run.runId, "run-pending-1");
  assert.equal(run.approvalStatus, "pending");
  assert.equal(run.activeTaskStage, "awaiting_approval");
  assert.equal(summary.liveBridgeHealth.state, "unknown");
});

test("operator trace summary aggregates live bridge health telemetry", () => {
  const events: EventListItem[] = [
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
  assert.equal(summary.liveBridgeHealth.lastEventType, "live.bridge.health_recovered");
  assert.equal(summary.liveBridgeHealth.lastEventAt, "2026-02-20T10:00:02.000Z");
  assert.equal(summary.liveBridgeHealth.state, "healthy");
});
