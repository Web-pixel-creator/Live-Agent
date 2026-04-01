import type {
  ApprovalRecord,
  EventListItem,
  RunListItem,
  SessionListItem,
} from "./firestore.js";
import type { RuntimeWorkflowControlPlaneSummary } from "./runtime-workflow-control-plane.js";

export type RuntimeSessionReplayState = "empty" | "active" | "awaiting_approval" | "verified";

export type RuntimeSessionReplayCompactEntry = {
  sessionId: string;
  mode: string;
  status: string;
  version: number;
  lastMutationId: string | null;
  updatedAt: string;
  selected: boolean;
  runCount: number;
  approvalCount: number;
  latestRunId: string | null;
  latestRoute: string | null;
  latestIntent: string | null;
  latestStatus: string | null;
  latestEventType: string | null;
  latestEventAt: string | null;
  latestVerificationState: string | null;
  latestApprovalStatus: string | null;
  replayState: RuntimeSessionReplayState;
};

export type RuntimeSessionReplaySnapshot = {
  generatedAt: string;
  source: "repo_owned_runtime_session_replay";
  mirrorVersion: 1;
  selectedSessionId: string | null;
  workflowAvailable: boolean;
  summary: {
    totalSessions: number;
    activeSessions: number;
    pausedSessions: number;
    closedSessions: number;
    sessionsWithReplay: number;
    sessionsAwaitingApproval: number;
    sessionsWithVerifiedProof: number;
    selectedSessionEventCount: number;
    selectedSessionRunCount: number;
    selectedSessionApprovalCount: number;
  };
  sessions: RuntimeSessionReplayCompactEntry[];
  selectedSession: {
    foundInSessionIndex: boolean;
    session: SessionListItem | null;
    workflow: {
      linked: boolean;
      workflowExecutionStatus: string | null;
      workflowCurrentStage: string | null;
      workflowActiveRole: string | null;
      workflowRunId: string | null;
      workflowSessionId: string | null;
      workflowTaskId: string | null;
      workflowIntent: string | null;
      workflowRoute: string | null;
      workflowReason: string | null;
      workflowUpdatedAt: string | null;
    };
    replay: {
      replayState: RuntimeSessionReplayState;
      replayReady: boolean;
      eventCount: number;
      runCount: number;
      approvalCount: number;
      pendingApprovalCount: number;
      traceSteps: number;
      screenshotRefs: number;
      verifySteps: number;
      verifiedRuns: number;
      partiallyVerifiedRuns: number;
      unverifiedRuns: number;
      latestRunId: string | null;
      latestRoute: string | null;
      latestIntent: string | null;
      latestStatus: string | null;
      latestEventType: string | null;
      latestEventAt: string | null;
      latestVerificationState: string | null;
      latestVerificationFailureClass: string | null;
      latestVerificationSummary: string | null;
      latestVerifiedRunId: string | null;
      latestVerifiedSummary: string | null;
      latestVerifiedAt: string | null;
      bySource: Record<string, number>;
      byType: Record<string, number>;
      byRoute: Record<string, number>;
    };
  };
};

type SessionEventInsight = {
  eventCount: number;
  runCount: number;
  traceSteps: number;
  screenshotRefs: number;
  verifySteps: number;
  verifiedRuns: number;
  partiallyVerifiedRuns: number;
  unverifiedRuns: number;
  latestRunId: string | null;
  latestRoute: string | null;
  latestIntent: string | null;
  latestStatus: string | null;
  latestEventType: string | null;
  latestEventAt: string | null;
  latestVerificationState: string | null;
  latestVerificationFailureClass: string | null;
  latestVerificationSummary: string | null;
  latestVerifiedRunId: string | null;
  latestVerifiedSummary: string | null;
  latestVerifiedAt: string | null;
  bySource: Record<string, number>;
  byType: Record<string, number>;
  byRoute: Record<string, number>;
};

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toEpochMs(value: string | null | undefined): number {
  if (typeof value !== "string") {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNonNegativeInt(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function incrementCounter(record: Record<string, number>, key: string | null): void {
  const normalized = toNonEmptyString(key) ?? "unknown";
  record[normalized] = (record[normalized] ?? 0) + 1;
}

function sortByUpdatedAtDesc<T extends { updatedAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => toEpochMs(right.updatedAt) - toEpochMs(left.updatedAt));
}

function sortEventsDesc(items: EventListItem[]): EventListItem[] {
  return [...items].sort((left, right) => toEpochMs(right.createdAt) - toEpochMs(left.createdAt));
}

function buildSessionEventInsight(events: EventListItem[]): SessionEventInsight {
  const orderedEvents = sortEventsDesc(events);
  const latestEvent = orderedEvents[0] ?? null;
  const latestVerifiedEvent =
    orderedEvents.find((item) => toNonEmptyString(item.verificationState) === "verified") ?? null;
  const bySource: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byRoute: Record<string, number> = {};
  const runVerification = new Map<
    string,
    {
      verificationState: string | null;
    }
  >();

  let traceSteps = 0;
  let screenshotRefs = 0;
  let verifySteps = 0;

  for (const event of orderedEvents) {
    incrementCounter(bySource, event.source);
    incrementCounter(byType, event.type);
    incrementCounter(byRoute, event.route ?? null);
    traceSteps += toNonNegativeInt(event.traceSteps);
    screenshotRefs += toNonNegativeInt(event.screenshotRefs);
    verifySteps += toNonNegativeInt(event.verifySteps);

    const runId = toNonEmptyString(event.runId);
    if (!runId || runVerification.has(runId)) {
      continue;
    }
    runVerification.set(runId, {
      verificationState: toNonEmptyString(event.verificationState),
    });
  }

  let verifiedRuns = 0;
  let partiallyVerifiedRuns = 0;
  let unverifiedRuns = 0;
  for (const run of runVerification.values()) {
    if (run.verificationState === "verified") {
      verifiedRuns += 1;
    } else if (run.verificationState === "partially_verified") {
      partiallyVerifiedRuns += 1;
    } else if (run.verificationState === "unverified") {
      unverifiedRuns += 1;
    }
  }

  return {
    eventCount: orderedEvents.length,
    runCount: runVerification.size,
    traceSteps,
    screenshotRefs,
    verifySteps,
    verifiedRuns,
    partiallyVerifiedRuns,
    unverifiedRuns,
    latestRunId: latestEvent ? toNonEmptyString(latestEvent.runId) : null,
    latestRoute: latestEvent ? toNonEmptyString(latestEvent.route) : null,
    latestIntent: latestEvent ? toNonEmptyString(latestEvent.intent) : null,
    latestStatus: latestEvent ? toNonEmptyString(latestEvent.status) : null,
    latestEventType: latestEvent ? latestEvent.type : null,
    latestEventAt: latestEvent ? latestEvent.createdAt : null,
    latestVerificationState: latestEvent ? toNonEmptyString(latestEvent.verificationState) : null,
    latestVerificationFailureClass: latestEvent ? toNonEmptyString(latestEvent.verificationFailureClass) : null,
    latestVerificationSummary: latestEvent ? toNonEmptyString(latestEvent.verificationSummary) : null,
    latestVerifiedRunId: latestVerifiedEvent ? toNonEmptyString(latestVerifiedEvent.runId) : null,
    latestVerifiedSummary: latestVerifiedEvent ? toNonEmptyString(latestVerifiedEvent.verificationSummary) : null,
    latestVerifiedAt: latestVerifiedEvent ? latestVerifiedEvent.createdAt : null,
    bySource,
    byType,
    byRoute,
  };
}

function buildReplayState(params: {
  verifiedRuns: number;
  pendingApprovalCount: number;
  runCount: number;
  eventCount: number;
}): RuntimeSessionReplayState {
  if (params.verifiedRuns > 0) {
    return "verified";
  }
  if (params.pendingApprovalCount > 0) {
    return "awaiting_approval";
  }
  if (params.runCount > 0 || params.eventCount > 0) {
    return "active";
  }
  return "empty";
}

function mapBySessionId<T extends { sessionId: string }>(items: T[]): Map<string, T[]> {
  const mapped = new Map<string, T[]>();
  for (const item of items) {
    const bucket = mapped.get(item.sessionId) ?? [];
    bucket.push(item);
    mapped.set(item.sessionId, bucket);
  }
  return mapped;
}

function latestRunForSession(runs: RunListItem[]): RunListItem | null {
  return sortByUpdatedAtDesc(runs)[0] ?? null;
}

function latestApprovalForSession(approvals: ApprovalRecord[]): ApprovalRecord | null {
  return [...approvals].sort((left, right) => toEpochMs(right.updatedAt) - toEpochMs(left.updatedAt))[0] ?? null;
}

function buildCompactEntry(params: {
  session: SessionListItem;
  selected: boolean;
  runs: RunListItem[];
  approvals: ApprovalRecord[];
  eventInsight: SessionEventInsight;
}): RuntimeSessionReplayCompactEntry {
  const latestRun = latestRunForSession(params.runs);
  const latestApproval = latestApprovalForSession(params.approvals);
  const pendingApprovalCount = params.approvals.filter((item) => item.status === "pending").length;
  const replayState = buildReplayState({
    verifiedRuns: params.eventInsight.verifiedRuns,
    pendingApprovalCount,
    runCount: params.runs.length || params.eventInsight.runCount,
    eventCount: params.eventInsight.eventCount,
  });

  return {
    sessionId: params.session.sessionId,
    mode: params.session.mode,
    status: params.session.status,
    version: params.session.version,
    lastMutationId: params.session.lastMutationId,
    updatedAt: params.session.updatedAt,
    selected: params.selected,
    runCount: params.runs.length || params.eventInsight.runCount,
    approvalCount: params.approvals.length,
    latestRunId: params.eventInsight.latestRunId ?? latestRun?.runId ?? null,
    latestRoute: params.eventInsight.latestRoute ?? latestRun?.route ?? null,
    latestIntent: params.eventInsight.latestIntent,
    latestStatus: params.eventInsight.latestStatus ?? latestRun?.status ?? null,
    latestEventType: params.eventInsight.latestEventType,
    latestEventAt: params.eventInsight.latestEventAt,
    latestVerificationState: params.eventInsight.latestVerificationState,
    latestApprovalStatus: latestApproval?.status ?? null,
    replayState,
  };
}

export function buildRuntimeSessionReplayMirrorSnapshot(params: {
  sessions: SessionListItem[];
  runs: RunListItem[];
  approvals: ApprovalRecord[];
  recentEvents: EventListItem[];
  selectedEvents: EventListItem[];
  selectedSessionId?: string | null;
  workflowSummary?: RuntimeWorkflowControlPlaneSummary | null;
}): RuntimeSessionReplaySnapshot {
  const sessions = sortByUpdatedAtDesc(params.sessions);
  const selectedSessionId = toNonEmptyString(params.selectedSessionId) ?? sessions[0]?.sessionId ?? null;
  const workflowSummary = params.workflowSummary ?? null;
  const runsBySession = mapBySessionId(params.runs.filter((item) => toNonEmptyString(item.sessionId) !== null));
  const approvalsBySession = mapBySessionId(
    params.approvals.filter((item) => toNonEmptyString(item.sessionId) !== null),
  );
  const recentEventsBySession = mapBySessionId(
    params.recentEvents.filter((item) => toNonEmptyString(item.sessionId) !== null),
  );
  const selectedEventInsight = buildSessionEventInsight(
    selectedSessionId
      ? params.selectedEvents.filter((item) => item.sessionId === selectedSessionId)
      : [],
  );

  const sessionEntries = sessions.map((session) => {
    const eventInsight =
      session.sessionId === selectedSessionId
        ? selectedEventInsight
        : buildSessionEventInsight(recentEventsBySession.get(session.sessionId) ?? []);
    return buildCompactEntry({
      session,
      selected: session.sessionId === selectedSessionId,
      runs: runsBySession.get(session.sessionId) ?? [],
      approvals: approvalsBySession.get(session.sessionId) ?? [],
      eventInsight,
    });
  });

  const selectedSession = sessions.find((item) => item.sessionId === selectedSessionId) ?? null;
  const selectedRuns = selectedSessionId ? runsBySession.get(selectedSessionId) ?? [] : [];
  const selectedApprovals = selectedSessionId ? approvalsBySession.get(selectedSessionId) ?? [] : [];
  const latestSelectedRun = latestRunForSession(selectedRuns);
  const latestSelectedApproval = latestApprovalForSession(selectedApprovals);
  const pendingApprovalCount = selectedApprovals.filter((item) => item.status === "pending").length;
  const selectedReplayState = buildReplayState({
    verifiedRuns: selectedEventInsight.verifiedRuns,
    pendingApprovalCount,
    runCount: selectedRuns.length || selectedEventInsight.runCount,
    eventCount: selectedEventInsight.eventCount,
  });
  const workflowLinked =
    selectedSessionId !== null && workflowSummary?.workflowSessionId === selectedSessionId;

  return {
    generatedAt: new Date().toISOString(),
    source: "repo_owned_runtime_session_replay",
    mirrorVersion: 1,
    selectedSessionId,
    workflowAvailable: workflowSummary !== null,
    summary: {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((item) => item.status === "active").length,
      pausedSessions: sessions.filter((item) => item.status === "paused").length,
      closedSessions: sessions.filter((item) => item.status === "closed").length,
      sessionsWithReplay: sessionEntries.filter((item) => item.replayState !== "empty").length,
      sessionsAwaitingApproval: sessionEntries.filter((item) => item.replayState === "awaiting_approval").length,
      sessionsWithVerifiedProof: sessionEntries.filter((item) => item.replayState === "verified").length,
      selectedSessionEventCount: selectedEventInsight.eventCount,
      selectedSessionRunCount: selectedRuns.length || selectedEventInsight.runCount,
      selectedSessionApprovalCount: selectedApprovals.length,
    },
    sessions: sessionEntries,
    selectedSession: {
      foundInSessionIndex: selectedSession !== null,
      session: selectedSession,
      workflow: {
        linked: workflowLinked,
        workflowExecutionStatus: workflowSummary?.workflowExecutionStatus ?? null,
        workflowCurrentStage: workflowSummary?.workflowCurrentStage ?? null,
        workflowActiveRole: workflowSummary?.workflowActiveRole ?? null,
        workflowRunId: workflowSummary?.workflowRunId ?? null,
        workflowSessionId: workflowSummary?.workflowSessionId ?? null,
        workflowTaskId: workflowSummary?.workflowTaskId ?? null,
        workflowIntent: workflowSummary?.workflowIntent ?? null,
        workflowRoute: workflowSummary?.workflowRoute ?? null,
        workflowReason: workflowSummary?.workflowReason ?? null,
        workflowUpdatedAt: workflowSummary?.workflowUpdatedAt ?? null,
      },
      replay: {
        replayState: selectedReplayState,
        replayReady: selectedReplayState !== "empty",
        eventCount: selectedEventInsight.eventCount,
        runCount: selectedRuns.length || selectedEventInsight.runCount,
        approvalCount: selectedApprovals.length,
        pendingApprovalCount,
        traceSteps: selectedEventInsight.traceSteps,
        screenshotRefs: selectedEventInsight.screenshotRefs,
        verifySteps: selectedEventInsight.verifySteps,
        verifiedRuns: selectedEventInsight.verifiedRuns,
        partiallyVerifiedRuns: selectedEventInsight.partiallyVerifiedRuns,
        unverifiedRuns: selectedEventInsight.unverifiedRuns,
        latestRunId: selectedEventInsight.latestRunId ?? latestSelectedRun?.runId ?? null,
        latestRoute: selectedEventInsight.latestRoute ?? latestSelectedRun?.route ?? null,
        latestIntent: selectedEventInsight.latestIntent,
        latestStatus: selectedEventInsight.latestStatus ?? latestSelectedRun?.status ?? null,
        latestEventType: selectedEventInsight.latestEventType,
        latestEventAt: selectedEventInsight.latestEventAt,
        latestVerificationState: selectedEventInsight.latestVerificationState,
        latestVerificationFailureClass: selectedEventInsight.latestVerificationFailureClass,
        latestVerificationSummary:
          selectedEventInsight.latestVerificationSummary ??
          toNonEmptyString(latestSelectedApproval?.reason),
        latestVerifiedRunId: selectedEventInsight.latestVerifiedRunId,
        latestVerifiedSummary: selectedEventInsight.latestVerifiedSummary,
        latestVerifiedAt: selectedEventInsight.latestVerifiedAt,
        bySource: selectedEventInsight.bySource,
        byType: selectedEventInsight.byType,
        byRoute: selectedEventInsight.byRoute,
      },
    },
  };
}
