import type { ApprovalRecord, EventListItem, RunListItem } from "./firestore.js";

type ActiveTaskSnapshot = {
  taskId: string;
  runId: string | null;
  sessionId: string | null;
  route: string | null;
  status: string | null;
  stage: string | null;
  intent: string | null;
  updatedAt: string;
};

type RunSeed = {
  runId: string;
  sessionId: string;
  route: string | null;
  status: string;
  intent: string | null;
  updatedAt: string;
  source: "run_registry" | "active_task" | "approval";
  taskId: string | null;
  taskStatus: string | null;
  taskStage: string | null;
};

export type OperatorTraceRunSummary = {
  runId: string;
  sessionId: string;
  route: string | null;
  status: string;
  intent: string | null;
  updatedAt: string;
  source: RunSeed["source"];
  activeTaskId: string | null;
  activeTaskStatus: string | null;
  activeTaskStage: string | null;
  eventCount: number;
  lastEventType: string | null;
  lastEventSource: string | null;
  lastEventAt: string | null;
  traceId: string | null;
  traceSteps: number;
  screenshotRefs: number;
  approvalId: string | null;
  approvalStatus: string | null;
  delegatedRoute: string | null;
  hasVisualTesting: boolean;
  hasError: boolean;
};

export type OperatorTraceSummary = {
  generatedAt: string;
  totals: {
    runsConsidered: number;
    eventsConsidered: number;
    uiTraceRuns: number;
    approvalLinkedRuns: number;
    delegatedRuns: number;
    visualTestingRuns: number;
    errorRuns: number;
    traceSteps: number;
    screenshotRefs: number;
    activeTaskBackedRuns: number;
  };
  liveBridgeHealth: {
    degradedEvents: number;
    recoveredEvents: number;
    watchdogReconnectEvents: number;
    bridgeErrorEvents: number;
    unavailableEvents: number;
    lastEventType: string | null;
    lastEventAt: string | null;
    state: "healthy" | "degraded" | "unknown";
  };
  byRoute: Record<string, number>;
  byStatus: Record<string, number>;
  recentRuns: OperatorTraceRunSummary[];
  recentEvents: Array<{
    eventId: string;
    createdAt: string;
    sessionId: string;
    runId: string | null;
    type: string;
    source: string;
    route: string | null;
    status: string | null;
    intent: string | null;
    traceSteps: number;
    screenshotRefs: number;
    approvalId: string | null;
    delegatedRoute: string | null;
    hasVisualTesting: boolean;
    hasError: boolean;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  return normalized;
}

function toNonNegativeInt(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }
  return fallback;
}

function toEpochMs(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

function incrementCounter(record: Record<string, number>, key: string): void {
  const normalized = key.trim().length > 0 ? key : "unknown";
  record[normalized] = (record[normalized] ?? 0) + 1;
}

function normalizeActiveTask(value: unknown): ActiveTaskSnapshot | null {
  const typed = asRecord(value);
  if (!typed) {
    return null;
  }
  const taskId = toNonEmptyString(typed.taskId);
  if (!taskId) {
    return null;
  }

  return {
    taskId,
    runId: toNonEmptyString(typed.runId),
    sessionId: toNonEmptyString(typed.sessionId),
    route: toNonEmptyString(typed.route),
    status: toNonEmptyString(typed.status),
    stage: toNonEmptyString(typed.stage),
    intent: toNonEmptyString(typed.intent),
    updatedAt: toNonEmptyString(typed.updatedAt) ?? new Date().toISOString(),
  };
}

function buildRunSeeds(params: {
  runs: RunListItem[];
  activeTasks: unknown[];
  approvals: ApprovalRecord[];
}): RunSeed[] {
  const byRun = new Map<string, RunSeed>();

  for (const run of params.runs) {
    if (!toNonEmptyString(run.runId) || !toNonEmptyString(run.sessionId)) {
      continue;
    }
    byRun.set(run.runId, {
      runId: run.runId,
      sessionId: run.sessionId,
      route: toNonEmptyString(run.route),
      status: toNonEmptyString(run.status) ?? "unknown",
      intent: null,
      updatedAt: toNonEmptyString(run.updatedAt) ?? new Date().toISOString(),
      source: "run_registry",
      taskId: null,
      taskStatus: null,
      taskStage: null,
    });
  }

  const activeTasks = params.activeTasks
    .map((item) => normalizeActiveTask(item))
    .filter((item): item is ActiveTaskSnapshot => item !== null);
  for (const task of activeTasks) {
    const runId = task.runId ?? `task:${task.taskId}`;
    const sessionId = task.sessionId ?? `task-session:${task.taskId}`;
    const existing = byRun.get(runId);
    const shouldReplace = !existing || toEpochMs(task.updatedAt) >= toEpochMs(existing.updatedAt);
    if (!shouldReplace) {
      continue;
    }
    byRun.set(runId, {
      runId,
      sessionId: existing?.sessionId ?? sessionId,
      route: task.route ?? existing?.route ?? null,
      status: task.status ?? existing?.status ?? "unknown",
      intent: task.intent ?? existing?.intent ?? null,
      updatedAt: task.updatedAt,
      source: "active_task",
      taskId: task.taskId,
      taskStatus: task.status,
      taskStage: task.stage,
    });
  }

  for (const approval of params.approvals) {
    const runId = toNonEmptyString(approval.runId);
    const sessionId = toNonEmptyString(approval.sessionId);
    if (!runId || !sessionId || byRun.has(runId)) {
      continue;
    }
    byRun.set(runId, {
      runId,
      sessionId,
      route: null,
      status: "pending_approval",
      intent: "ui_task",
      updatedAt: approval.updatedAt,
      source: "approval",
      taskId: null,
      taskStatus: null,
      taskStage: "awaiting_approval",
    });
  }

  return Array.from(byRun.values()).sort((left, right) => toEpochMs(right.updatedAt) - toEpochMs(left.updatedAt));
}

export function buildOperatorTraceSummary(params: {
  runs: RunListItem[];
  events: EventListItem[];
  approvals: ApprovalRecord[];
  activeTasks: unknown[];
  runLimit: number;
  eventLimit: number;
}): OperatorTraceSummary {
  const approvalsByRun = new Map<string, ApprovalRecord>();
  for (const approval of params.approvals) {
    const runId = toNonEmptyString(approval.runId);
    if (!runId) {
      continue;
    }
    const existing = approvalsByRun.get(runId);
    if (!existing || toEpochMs(approval.updatedAt) > toEpochMs(existing.updatedAt)) {
      approvalsByRun.set(runId, approval);
    }
  }

  const eventsByRun = new Map<string, EventListItem[]>();
  const recentEvents = [...params.events]
    .sort((left, right) => toEpochMs(right.createdAt) - toEpochMs(left.createdAt))
    .slice(0, params.eventLimit);
  for (const event of recentEvents) {
    const runId = toNonEmptyString(event.runId);
    if (!runId) {
      continue;
    }
    const bucket = eventsByRun.get(runId) ?? [];
    bucket.push(event);
    eventsByRun.set(runId, bucket);
  }

  const runSeeds = buildRunSeeds({
    runs: params.runs,
    activeTasks: params.activeTasks,
    approvals: params.approvals,
  }).slice(0, params.runLimit);

  const routeStats: Record<string, number> = {};
  const statusStats: Record<string, number> = {};
  const runSummaries: OperatorTraceRunSummary[] = [];

  let uiTraceRuns = 0;
  let approvalLinkedRuns = 0;
  let delegatedRuns = 0;
  let visualTestingRuns = 0;
  let errorRuns = 0;
  let traceStepsTotal = 0;
  let screenshotRefsTotal = 0;
  let activeTaskBackedRuns = 0;
  let liveBridgeDegradedEvents = 0;
  let liveBridgeRecoveredEvents = 0;
  let liveBridgeWatchdogReconnectEvents = 0;
  let liveBridgeErrorEvents = 0;
  let liveBridgeUnavailableEvents = 0;
  let liveBridgeLastEventType: string | null = null;
  let liveBridgeLastEventAt: string | null = null;

  for (const event of recentEvents) {
    const eventType = toNonEmptyString(event.type);
    if (!eventType) {
      continue;
    }
    if (eventType === "live.bridge.health_degraded") {
      liveBridgeDegradedEvents += 1;
    } else if (eventType === "live.bridge.health_recovered") {
      liveBridgeRecoveredEvents += 1;
    } else if (eventType === "live.bridge.health_watchdog_reconnect") {
      liveBridgeWatchdogReconnectEvents += 1;
    } else if (eventType === "live.bridge.error") {
      liveBridgeErrorEvents += 1;
    } else if (eventType === "live.bridge.unavailable") {
      liveBridgeUnavailableEvents += 1;
    } else {
      continue;
    }

    if (!liveBridgeLastEventAt || toEpochMs(event.createdAt) > toEpochMs(liveBridgeLastEventAt)) {
      liveBridgeLastEventType = eventType;
      liveBridgeLastEventAt = event.createdAt;
    }
  }

  const liveBridgeState: "healthy" | "degraded" | "unknown" =
    liveBridgeLastEventType === "live.bridge.health_recovered"
      ? "healthy"
      : liveBridgeLastEventType === "live.bridge.health_degraded" ||
          liveBridgeLastEventType === "live.bridge.health_watchdog_reconnect" ||
          liveBridgeLastEventType === "live.bridge.error" ||
          liveBridgeLastEventType === "live.bridge.unavailable"
        ? "degraded"
        : "unknown";

  for (const run of runSeeds) {
    const runEvents = (eventsByRun.get(run.runId) ?? []).sort(
      (left, right) => toEpochMs(right.createdAt) - toEpochMs(left.createdAt),
    );
    const latestEvent = runEvents[0] ?? null;
    const approval = approvalsByRun.get(run.runId);

    let traceSteps = 0;
    let screenshotRefs = 0;
    let delegatedRoute: string | null = null;
    let hasVisualTesting = false;
    let hasError = run.status === "failed";
    let traceId: string | null = null;
    let intent = run.intent;
    let approvalId: string | null = null;
    let approvalStatus: string | null = null;

    for (const event of runEvents) {
      traceSteps += toNonNegativeInt(event.traceSteps, 0);
      screenshotRefs += toNonNegativeInt(event.screenshotRefs, 0);
      if (!delegatedRoute && toNonEmptyString(event.delegatedRoute)) {
        delegatedRoute = event.delegatedRoute ?? null;
      }
      if (!traceId && toNonEmptyString(event.traceId)) {
        traceId = event.traceId ?? null;
      }
      if (!intent && toNonEmptyString(event.intent)) {
        intent = event.intent ?? null;
      }
      if (!approvalId && toNonEmptyString(event.approvalId)) {
        approvalId = event.approvalId ?? null;
      }
      if (!approvalStatus && toNonEmptyString(event.approvalStatus)) {
        approvalStatus = event.approvalStatus ?? null;
      }
      if (event.hasVisualTesting === true) {
        hasVisualTesting = true;
      }
      if (event.hasError === true || event.status === "failed") {
        hasError = true;
      }
    }

    if (!approvalId && approval) {
      approvalId = approval.approvalId;
      approvalStatus = approval.status;
    } else if (approval && !approvalStatus) {
      approvalStatus = approval.status;
    }

    const route = run.route ?? (latestEvent?.route ?? null);
    const status = run.status || latestEvent?.status || "unknown";
    const summary: OperatorTraceRunSummary = {
      runId: run.runId,
      sessionId: run.sessionId,
      route,
      status,
      intent,
      updatedAt: run.updatedAt,
      source: run.source,
      activeTaskId: run.taskId,
      activeTaskStatus: run.taskStatus,
      activeTaskStage: run.taskStage,
      eventCount: runEvents.length,
      lastEventType: latestEvent?.type ?? null,
      lastEventSource: latestEvent?.source ?? null,
      lastEventAt: latestEvent?.createdAt ?? null,
      traceId,
      traceSteps,
      screenshotRefs,
      approvalId,
      approvalStatus,
      delegatedRoute,
      hasVisualTesting,
      hasError,
    };
    runSummaries.push(summary);

    incrementCounter(routeStats, route ?? "unknown");
    incrementCounter(statusStats, status);
    if (run.source === "active_task") {
      activeTaskBackedRuns += 1;
    }
    if (route === "ui-navigator-agent" || intent === "ui_task" || traceSteps > 0 || screenshotRefs > 0) {
      uiTraceRuns += 1;
    }
    if (approvalId) {
      approvalLinkedRuns += 1;
    }
    if (delegatedRoute) {
      delegatedRuns += 1;
    }
    if (hasVisualTesting) {
      visualTestingRuns += 1;
    }
    if (hasError) {
      errorRuns += 1;
    }
    traceStepsTotal += traceSteps;
    screenshotRefsTotal += screenshotRefs;
  }

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      runsConsidered: runSummaries.length,
      eventsConsidered: recentEvents.length,
      uiTraceRuns,
      approvalLinkedRuns,
      delegatedRuns,
      visualTestingRuns,
      errorRuns,
      traceSteps: traceStepsTotal,
      screenshotRefs: screenshotRefsTotal,
      activeTaskBackedRuns,
    },
    liveBridgeHealth: {
      degradedEvents: liveBridgeDegradedEvents,
      recoveredEvents: liveBridgeRecoveredEvents,
      watchdogReconnectEvents: liveBridgeWatchdogReconnectEvents,
      bridgeErrorEvents: liveBridgeErrorEvents,
      unavailableEvents: liveBridgeUnavailableEvents,
      lastEventType: liveBridgeLastEventType,
      lastEventAt: liveBridgeLastEventAt,
      state: liveBridgeState,
    },
    byRoute: routeStats,
    byStatus: statusStats,
    recentRuns: runSummaries,
    recentEvents: recentEvents.map((event) => ({
      eventId: event.eventId,
      createdAt: event.createdAt,
      sessionId: event.sessionId,
      runId: event.runId ?? null,
      type: event.type,
      source: event.source,
      route: event.route ?? null,
      status: event.status ?? null,
      intent: event.intent ?? null,
      traceSteps: toNonNegativeInt(event.traceSteps, 0),
      screenshotRefs: toNonNegativeInt(event.screenshotRefs, 0),
      approvalId: event.approvalId ?? null,
      delegatedRoute: event.delegatedRoute ?? null,
      hasVisualTesting: event.hasVisualTesting === true,
      hasError: event.hasError === true,
    })),
  };
}
