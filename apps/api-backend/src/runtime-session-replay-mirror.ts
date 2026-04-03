import type {
  ApprovalRecord,
  EventListItem,
  RunListItem,
  SessionListItem,
} from "./firestore.js";
import type { RuntimeWorkflowControlPlaneSummary } from "./runtime-workflow-control-plane.js";

export type RuntimeSessionReplayState = "empty" | "active" | "awaiting_approval" | "verified";

type RuntimeSessionReplayNextOperatorActionTarget = {
  targetSurface:
    | "operator_session_ops"
    | "operator_workflow_control"
    | "operator_runtime_drills"
    | "operator_saved_view_approvals";
  targetLabel: string;
};

type RuntimeSessionReplayNextOperatorWorkspace =
  | "approvals"
  | "runtime";

type RuntimeSessionReplayStepPhase = "active" | "queued";
type RuntimeSessionReplayStepRunState = "runnable" | "blocked";
type RuntimeSessionReplayPrimaryStepActionMode = "openable" | "executable";
type RuntimeSessionReplayPrimaryStepSurfaceState = "primed" | "not_primed";
type RuntimeSessionReplayPrimaryRefreshDisposition =
  | "silent_rehydrate"
  | "reopen_then_refresh"
  | "reload_before_run";
type RuntimeSessionReplayPrimaryRefreshConfidence = "high" | "medium" | "low";
type RuntimeSessionReplayPrimaryRefreshEscalationReadiness = "ready" | "needs_prep";
type RuntimeSessionReplayPrimaryRefreshEscalationFallbackReadiness = "ready" | "needs_prep";

type RuntimeSessionReplayPrimaryRefreshAction = {
  label: string;
  action: "refresh_session_replay";
  ctaLabel: string;
  targetSurface: RuntimeSessionReplayNextOperatorActionTarget["targetSurface"];
  targetLabel: string;
  workspace: RuntimeSessionReplayNextOperatorWorkspace | null;
};

type RuntimeSessionReplayPrimaryRefreshEscalationTarget = {
  label: string;
  targetSurface: RuntimeSessionReplayNextOperatorActionTarget["targetSurface"];
  targetLabel: string;
  workspace: RuntimeSessionReplayNextOperatorWorkspace | null;
  stateLabel: string;
  mode: "inspect" | "recover" | "owner_handoff";
};

type RuntimeSessionReplayPrimaryRefreshEscalationCTA = {
  label: string;
  ctaLabel: string;
  targetSurface: RuntimeSessionReplayNextOperatorActionTarget["targetSurface"];
  targetLabel: string;
  workspace: RuntimeSessionReplayNextOperatorWorkspace | null;
};

type RuntimeSessionReplayPrimaryRefreshEscalationFallbackTarget = {
  label: string;
  targetSurface: RuntimeSessionReplayNextOperatorActionTarget["targetSurface"];
  targetLabel: string;
  workspace: RuntimeSessionReplayNextOperatorWorkspace | null;
  stateLabel: string;
};

type RuntimeSessionReplayPrimaryRefreshEscalationFallbackEscalationTarget = {
  label: string;
  targetSurface: RuntimeSessionReplayNextOperatorActionTarget["targetSurface"];
  targetLabel: string;
  workspace: RuntimeSessionReplayNextOperatorWorkspace | null;
  stateLabel: string;
  mode: "inspect" | "recover" | "owner_handoff";
};

type RuntimeSessionReplayPrimaryRefreshEscalationFallbackCTA = {
  label: string;
  ctaLabel: string;
  targetSurface: RuntimeSessionReplayNextOperatorActionTarget["targetSurface"];
  targetLabel: string;
  workspace: RuntimeSessionReplayNextOperatorWorkspace | null;
};

type RuntimeSessionReplayPrimaryRefreshEscalationFallbackEscalationCTA = {
  label: string;
  ctaLabel: string;
  targetSurface: RuntimeSessionReplayNextOperatorActionTarget["targetSurface"];
  targetLabel: string;
  workspace: RuntimeSessionReplayNextOperatorWorkspace | null;
};

type RuntimeSessionReplayPrimaryRefreshTargetState = {
  label: string;
  targetSurface: RuntimeSessionReplayNextOperatorActionTarget["targetSurface"];
  targetLabel: string;
  workspace: RuntimeSessionReplayNextOperatorWorkspace | null;
  stateLabel: string;
  refreshScope: "gate" | "boundary" | "proof" | "recovery";
};

type RuntimeSessionReplayPrimaryOperatorStep = {
  label: string;
  action: string | null;
  targetSurface: RuntimeSessionReplayNextOperatorActionTarget["targetSurface"];
  targetLabel: string;
  workspace: RuntimeSessionReplayNextOperatorWorkspace | null;
  ctaLabel: string;
  phase: RuntimeSessionReplayStepPhase;
  runState: RuntimeSessionReplayStepRunState;
  actionMode: RuntimeSessionReplayPrimaryStepActionMode;
  surfaceState: RuntimeSessionReplayPrimaryStepSurfaceState;
  needsRefresh: boolean;
  refreshDisposition: RuntimeSessionReplayPrimaryRefreshDisposition | null;
  refreshEvidenceHint: string | null;
  refreshOutcomeLabel: string | null;
  refreshConfidence: RuntimeSessionReplayPrimaryRefreshConfidence | null;
  refreshDetourHint: string | null;
  refreshEscalationHint: string | null;
  refreshEscalationTarget: RuntimeSessionReplayPrimaryRefreshEscalationTarget | null;
  refreshEscalationCTA: RuntimeSessionReplayPrimaryRefreshEscalationCTA | null;
  refreshEscalationReadiness: RuntimeSessionReplayPrimaryRefreshEscalationReadiness | null;
  refreshEscalationPrepHint: string | null;
  refreshEscalationOpenGuard: string | null;
  refreshEscalationFallbackTarget: RuntimeSessionReplayPrimaryRefreshEscalationFallbackTarget | null;
  refreshEscalationFallbackCTA: RuntimeSessionReplayPrimaryRefreshEscalationFallbackCTA | null;
  refreshEscalationFallbackReadiness: RuntimeSessionReplayPrimaryRefreshEscalationFallbackReadiness | null;
  refreshEscalationFallbackPrepHint: string | null;
  refreshEscalationFallbackOpenGuard: string | null;
  refreshEscalationFallbackOutcomeLabel: string | null;
  refreshEscalationFallbackConfidence: RuntimeSessionReplayPrimaryRefreshConfidence | null;
  refreshEscalationFallbackDetourHint: string | null;
  refreshEscalationFallbackEscalationHint: string | null;
  refreshEscalationFallbackEscalationTarget: RuntimeSessionReplayPrimaryRefreshEscalationFallbackEscalationTarget | null;
  refreshEscalationFallbackEscalationCTA: RuntimeSessionReplayPrimaryRefreshEscalationFallbackEscalationCTA | null;
  refreshEscalationFallbackEscalationReadiness: RuntimeSessionReplayPrimaryRefreshEscalationReadiness | null;
  refreshEscalationFallbackEscalationPrepHint: string | null;
  refreshEscalationFallbackEscalationOpenGuard: string | null;
  refreshAction: RuntimeSessionReplayPrimaryRefreshAction | null;
  refreshTargetState: RuntimeSessionReplayPrimaryRefreshTargetState | null;
};

type RuntimeSessionReplayStepProgress = {
  current: number;
  total: number;
  label: string;
};

type RuntimeSessionReplayStepPathEntry = {
  label: string;
  phase: RuntimeSessionReplayStepPhase;
  runState: RuntimeSessionReplayStepRunState;
};

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
      booking: {
        status: string | null;
        topic: string | null;
        selectedSlotLabel: string | null;
        summary: string | null;
      } | null;
      handoff: {
        kind: "handoff";
        scenario: string | null;
        status: string | null;
        intent: string | null;
        caseId: string | null;
        destinationCountry: string | null;
        assignedOwner: string | null;
        priority: string | null;
        summary: string | null;
        nextStep: string | null;
        ready: boolean | null;
      } | null;
      followUp: {
        kind: "follow_up";
        scenario: string | null;
        status: string | null;
        intent: string | null;
        caseId: string | null;
        destinationCountry: string | null;
        missingItemsCount: number | null;
        summary: string | null;
        nextStep: string | null;
        ready: boolean | null;
      } | null;
    };
    replay: {
      replayState: RuntimeSessionReplayState;
      replayReady: boolean;
      resumeReady: boolean;
      resumeBlockedBy: string | null;
      nextOperatorAction: string | null;
      nextOperatorActionLabel: string | null;
      nextOperatorActionTarget: RuntimeSessionReplayNextOperatorActionTarget | null;
      nextOperatorWorkspace: RuntimeSessionReplayNextOperatorWorkspace | null;
      nextOperatorChecklist: string[];
      nextOperatorRemainingSteps: string[];
      nextOperatorPrimaryStep: RuntimeSessionReplayPrimaryOperatorStep | null;
      nextOperatorStepProgress: RuntimeSessionReplayStepProgress | null;
      nextOperatorStepPath: RuntimeSessionReplayStepPathEntry[];
      latestVerifiedStage: string | null;
      boundaryOwner: {
        role: string | null;
        owner: string | null;
        sessionId: string | null;
        taskId: string | null;
        workflowRunId: string | null;
      } | null;
      approvalGate: {
        source: "session" | "workflow";
        status: string | null;
        approvalId: string | null;
        runId: string | null;
        reason: string | null;
        requestedAt: string | null;
        hardDueAt: string | null;
        pendingCount: number;
        action: string | null;
      } | null;
      currentHandoffState:
        | {
            kind: "booking";
            status: string | null;
            topic: string | null;
            selectedSlotLabel: string | null;
            summary: string | null;
          }
        | {
            kind: "handoff";
            status: string | null;
            intent: string | null;
            caseId: string | null;
            destinationCountry: string | null;
            nextStep: string | null;
            ready: boolean | null;
          }
        | {
            kind: "follow_up";
            status: string | null;
            intent: string | null;
            caseId: string | null;
            destinationCountry: string | null;
            nextStep: string | null;
            ready: boolean | null;
          }
        | null;
      workflowBoundarySummary: {
        kind: "booking" | "handoff" | "follow_up" | "workflow" | "session_only";
        stage: string | null;
        role: string | null;
        status: string | null;
        summary: string | null;
        nextStep: string | null;
        owner: string | null;
      } | null;
      latestProofPointer: {
        runId: string | null;
        summary: string | null;
        verifiedAt: string | null;
        route: string | null;
        intent: string | null;
        workflowStage: string | null;
      } | null;
      recoveryPathHint: {
        code: string;
        label: string;
        action: string | null;
      } | null;
      recoveryHandoff: {
        targetPanel: "operator_session_ops" | "operator_workflow_control" | "operator_runtime_drills";
        targetLabel: string;
        reason: string | null;
        action: string | null;
      } | null;
      recoveryDrill: {
        profileId: string | null;
        phase: "recovery";
        label: string;
        service: string | null;
        reason: string | null;
        action: string | null;
      } | null;
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
      latestVerifiedRoute: string | null;
      latestVerifiedIntent: string | null;
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
  latestVerifiedRoute: string | null;
  latestVerifiedIntent: string | null;
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

function maxTimestampMs(values: Array<string | null | undefined>): number {
  return values.reduce((max, value) => Math.max(max, toEpochMs(value)), 0);
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
    latestVerifiedRoute: latestVerifiedEvent ? toNonEmptyString(latestVerifiedEvent.route) : null,
    latestVerifiedIntent: latestVerifiedEvent ? toNonEmptyString(latestVerifiedEvent.intent) : null,
    bySource,
    byType,
    byRoute,
  };
}

function buildWorkflowBookingSummary(workflowSummary: RuntimeWorkflowControlPlaneSummary | null) {
  if (!workflowSummary) {
    return null;
  }
  const hasBooking =
    workflowSummary.workflowBookingStatus !== null ||
    workflowSummary.workflowBookingTopic !== null ||
    workflowSummary.workflowBookingSelectedSlotLabel !== null ||
    workflowSummary.workflowBookingSummary !== null;
  if (!hasBooking) {
    return null;
  }
  return {
    status: workflowSummary.workflowBookingStatus,
    topic: workflowSummary.workflowBookingTopic,
    selectedSlotLabel: workflowSummary.workflowBookingSelectedSlotLabel,
    summary: workflowSummary.workflowBookingSummary,
  };
}

function buildWorkflowHandoffSummary(workflowSummary: RuntimeWorkflowControlPlaneSummary | null) {
  if (!workflowSummary) {
    return null;
  }
  const hasHandoff =
    workflowSummary.workflowHandoffStatus !== null ||
    workflowSummary.workflowHandoffIntent !== null ||
    workflowSummary.workflowHandoffCaseId !== null ||
    workflowSummary.workflowHandoffDestinationCountry !== null ||
    workflowSummary.workflowHandoffAssignedOwner !== null ||
    workflowSummary.workflowHandoffPriority !== null ||
    workflowSummary.workflowHandoffSummary !== null ||
    workflowSummary.workflowHandoffNextStep !== null ||
    workflowSummary.workflowHandoffReady !== null;
  if (!hasHandoff) {
    return null;
  }
  return {
    kind: "handoff" as const,
    scenario: workflowSummary.workflowHandoffScenario,
    status: workflowSummary.workflowHandoffStatus,
    intent: workflowSummary.workflowHandoffIntent,
    caseId: workflowSummary.workflowHandoffCaseId,
    destinationCountry: workflowSummary.workflowHandoffDestinationCountry,
    assignedOwner: workflowSummary.workflowHandoffAssignedOwner,
    priority: workflowSummary.workflowHandoffPriority,
    summary: workflowSummary.workflowHandoffSummary,
    nextStep: workflowSummary.workflowHandoffNextStep,
    ready: workflowSummary.workflowHandoffReady,
  };
}

function buildWorkflowFollowUpSummary(workflowSummary: RuntimeWorkflowControlPlaneSummary | null) {
  if (!workflowSummary) {
    return null;
  }
  const hasFollowUp =
    workflowSummary.workflowFollowUpStatus !== null ||
    workflowSummary.workflowFollowUpIntent !== null ||
    workflowSummary.workflowFollowUpCaseId !== null ||
    workflowSummary.workflowFollowUpDestinationCountry !== null ||
    workflowSummary.workflowFollowUpMissingItemsCount !== null ||
    workflowSummary.workflowFollowUpSummary !== null ||
    workflowSummary.workflowFollowUpNextStep !== null ||
    workflowSummary.workflowFollowUpReady !== null;
  if (!hasFollowUp) {
    return null;
  }
  return {
    kind: "follow_up" as const,
    scenario: workflowSummary.workflowFollowUpScenario,
    status: workflowSummary.workflowFollowUpStatus,
    intent: workflowSummary.workflowFollowUpIntent,
    caseId: workflowSummary.workflowFollowUpCaseId,
    destinationCountry: workflowSummary.workflowFollowUpDestinationCountry,
    missingItemsCount: workflowSummary.workflowFollowUpMissingItemsCount,
    summary: workflowSummary.workflowFollowUpSummary,
    nextStep: workflowSummary.workflowFollowUpNextStep,
    ready: workflowSummary.workflowFollowUpReady,
  };
}

function buildLatestProofPointer(params: {
  eventInsight: SessionEventInsight;
  workflowSummary: RuntimeWorkflowControlPlaneSummary | null;
}) {
  const hasPointer =
    params.eventInsight.latestVerifiedRunId !== null ||
    params.eventInsight.latestVerifiedSummary !== null ||
    params.eventInsight.latestVerifiedAt !== null;
  if (!hasPointer) {
    return null;
  }
  return {
    runId: params.eventInsight.latestVerifiedRunId,
    summary: params.eventInsight.latestVerifiedSummary,
    verifiedAt: params.eventInsight.latestVerifiedAt,
    route: params.eventInsight.latestVerifiedRoute,
    intent: params.eventInsight.latestVerifiedIntent,
    workflowStage: params.workflowSummary?.workflowCurrentStage ?? null,
  };
}

function buildWorkflowBoundarySummary(params: {
  selectedSession: SessionListItem | null;
  workflowLinked: boolean;
  workflowSummary: RuntimeWorkflowControlPlaneSummary | null;
  booking: ReturnType<typeof buildWorkflowBookingSummary>;
  handoff: ReturnType<typeof buildWorkflowHandoffSummary>;
  followUp: ReturnType<typeof buildWorkflowFollowUpSummary>;
  latestProofPointer: ReturnType<typeof buildLatestProofPointer>;
}) {
  const stage = params.workflowSummary?.workflowCurrentStage ?? null;
  const role = params.workflowSummary?.workflowActiveRole ?? null;
  if (params.handoff) {
    return {
      kind: "handoff" as const,
      stage,
      role,
      status: params.handoff.status,
      summary: params.handoff.summary,
      nextStep: params.handoff.nextStep,
      owner: params.handoff.assignedOwner,
    };
  }
  if (params.followUp) {
    const summary =
      params.followUp.summary ??
      (params.followUp.missingItemsCount !== null
        ? `${params.followUp.missingItemsCount} missing items remain before submission.`
        : null);
    return {
      kind: "follow_up" as const,
      stage,
      role,
      status: params.followUp.status,
      summary,
      nextStep: params.followUp.nextStep,
      owner: null,
    };
  }
  if (params.booking) {
    return {
      kind: "booking" as const,
      stage,
      role,
      status: params.booking.status,
      summary: params.booking.summary ?? params.booking.topic,
      nextStep:
        params.booking.status === "offered"
          ? "Confirm the offered booking slot."
          : "Continue from the confirmed booking boundary.",
      owner: null,
    };
  }
  if (params.workflowLinked && params.workflowSummary) {
    return {
      kind: "workflow" as const,
      stage,
      role,
      status: params.workflowSummary.workflowExecutionStatus,
      summary: params.workflowSummary.workflowReason,
      nextStep:
        params.latestProofPointer !== null
          ? "Reopen from the latest verified proof."
          : "Inspect the linked workflow boundary.",
      owner: null,
    };
  }
  if (params.selectedSession) {
    return {
      kind: "session_only" as const,
      stage: null,
      role: null,
      status: params.selectedSession.status,
      summary: "Workflow boundary is not linked to the selected session.",
      nextStep: "Inspect the selected session timeline.",
      owner: null,
    };
  }
  return null;
}

function buildBoundaryOwner(params: {
  selectedSessionId: string | null;
  workflowLinked: boolean;
  workflowSummary: RuntimeWorkflowControlPlaneSummary | null;
  workflowBoundarySummary: ReturnType<typeof buildWorkflowBoundarySummary>;
}) {
  const role = params.workflowSummary?.workflowActiveRole ?? null;
  const owner = params.workflowBoundarySummary?.owner ?? null;
  const sessionId = params.workflowLinked ? params.workflowSummary?.workflowSessionId ?? params.selectedSessionId : params.selectedSessionId;
  const taskId = params.workflowLinked ? params.workflowSummary?.workflowTaskId ?? null : null;
  const workflowRunId = params.workflowLinked ? params.workflowSummary?.workflowRunId ?? null : null;
  const hasOwner =
    role !== null ||
    owner !== null ||
    taskId !== null ||
    workflowRunId !== null ||
    (params.workflowLinked && sessionId !== null);
  if (!hasOwner) {
    return null;
  }
  return {
    role,
    owner,
    sessionId,
    taskId,
    workflowRunId,
  };
}

function buildCurrentHandoffState(params: {
  booking: ReturnType<typeof buildWorkflowBookingSummary>;
  handoff: ReturnType<typeof buildWorkflowHandoffSummary>;
  followUp: ReturnType<typeof buildWorkflowFollowUpSummary>;
}) {
  if (params.handoff) {
    return {
      kind: "handoff" as const,
      status: params.handoff.status,
      intent: params.handoff.intent,
      caseId: params.handoff.caseId,
      destinationCountry: params.handoff.destinationCountry,
      nextStep: params.handoff.nextStep,
      ready: params.handoff.ready,
    };
  }
  if (params.followUp) {
    return {
      kind: "follow_up" as const,
      status: params.followUp.status,
      intent: params.followUp.intent,
      caseId: params.followUp.caseId,
      destinationCountry: params.followUp.destinationCountry,
      nextStep: params.followUp.nextStep,
      ready: params.followUp.ready,
    };
  }
  if (params.booking) {
    return {
      kind: "booking" as const,
      status: params.booking.status,
      topic: params.booking.topic,
      selectedSlotLabel: params.booking.selectedSlotLabel,
      summary: params.booking.summary,
    };
  }
  return null;
}

function buildResumeMetadata(params: {
  selectedSessionId: string | null;
  selectedSession: SessionListItem | null;
  replayState: RuntimeSessionReplayState;
  pendingApprovalCount: number;
  workflowLinked: boolean;
  workflowSummary: RuntimeWorkflowControlPlaneSummary | null;
  latestProofPointer: ReturnType<typeof buildLatestProofPointer>;
  currentHandoffState: ReturnType<typeof buildCurrentHandoffState>;
}) {
  if (!params.selectedSessionId || !params.selectedSession) {
    return {
      resumeReady: false,
      resumeBlockedBy: "session_missing",
      nextOperatorAction: "inspect_session",
    };
  }
  if (params.pendingApprovalCount > 0) {
    return {
      resumeReady: false,
      resumeBlockedBy: "approval_pending",
      nextOperatorAction: "resolve_approval",
    };
  }
  if (params.workflowLinked && params.workflowSummary?.workflowExecutionStatus === "pending_approval") {
    return {
      resumeReady: false,
      resumeBlockedBy: "workflow_pending_approval",
      nextOperatorAction: "resolve_workflow_approval",
    };
  }
  if (params.workflowLinked && params.workflowSummary?.workflowExecutionStatus === "running") {
    return {
      resumeReady: false,
      resumeBlockedBy: "workflow_active",
      nextOperatorAction: "observe_live_work",
    };
  }
  if (params.workflowLinked && params.workflowSummary?.workflowExecutionStatus === "failed") {
    return {
      resumeReady: false,
      resumeBlockedBy: "workflow_failed",
      nextOperatorAction: "plan_recovery_drill",
    };
  }
  if (params.replayState === "empty") {
    return {
      resumeReady: false,
      resumeBlockedBy: "replay_unavailable",
      nextOperatorAction: params.workflowLinked ? "inspect_workflow_boundary" : "inspect_session",
    };
  }
  if (params.selectedSession.status === "closed" && params.latestProofPointer === null) {
    return {
      resumeReady: false,
      resumeBlockedBy: "session_closed",
      nextOperatorAction: "inspect_session",
    };
  }
  if (params.currentHandoffState?.kind === "handoff") {
    return {
      resumeReady: true,
      resumeBlockedBy: null,
      nextOperatorAction: params.currentHandoffState.ready ? "resume_handoff" : "inspect_handoff",
    };
  }
  if (params.currentHandoffState?.kind === "follow_up") {
    return {
      resumeReady: true,
      resumeBlockedBy: null,
      nextOperatorAction: params.currentHandoffState.ready ? "resume_follow_up" : "inspect_follow_up",
    };
  }
  if (params.currentHandoffState?.kind === "booking") {
    return {
      resumeReady: true,
      resumeBlockedBy: null,
      nextOperatorAction:
        params.currentHandoffState.status === "offered" ? "confirm_booking" : "resume_booking",
    };
  }
  if (params.latestProofPointer) {
    return {
      resumeReady: true,
      resumeBlockedBy: null,
      nextOperatorAction: "resume_from_latest_proof",
    };
  }
  return {
    resumeReady: true,
    resumeBlockedBy: null,
    nextOperatorAction: "resume_session",
  };
}

function buildNextOperatorActionLabel(action: string | null) {
  switch (action) {
    case "inspect_session":
      return "Inspect session";
    case "resolve_approval":
      return "Resolve approval";
    case "resolve_workflow_approval":
      return "Resolve workflow approval";
    case "observe_live_work":
      return "Observe live workflow";
    case "inspect_workflow_boundary":
      return "Inspect workflow boundary";
    case "plan_recovery_drill":
      return "Plan recovery drill";
    case "inspect_handoff":
      return "Inspect handoff";
    case "resume_handoff":
      return "Resume handoff";
    case "inspect_follow_up":
      return "Inspect follow-up";
    case "resume_follow_up":
      return "Resume follow-up";
    case "confirm_booking":
      return "Confirm booking";
    case "resume_booking":
      return "Resume booking";
    case "resume_from_latest_proof":
      return "Resume from latest proof";
    case "resume_session":
      return "Resume session";
    default:
      return null;
  }
}

function buildNextOperatorActionTarget(action: string | null): RuntimeSessionReplayNextOperatorActionTarget | null {
  switch (action) {
    case "resolve_approval":
    case "resolve_workflow_approval":
      return {
        targetSurface: "operator_saved_view_approvals",
        targetLabel: "Approvals",
      };
    case "observe_live_work":
    case "inspect_workflow_boundary":
      return {
        targetSurface: "operator_workflow_control",
        targetLabel: "Workflow Control",
      };
    case "plan_recovery_drill":
      return {
        targetSurface: "operator_runtime_drills",
        targetLabel: "Runtime Drill Runner",
      };
    case "inspect_session":
    case "inspect_handoff":
    case "resume_handoff":
    case "inspect_follow_up":
    case "resume_follow_up":
    case "confirm_booking":
    case "resume_booking":
    case "resume_from_latest_proof":
    case "resume_session":
      return {
        targetSurface: "operator_session_ops",
        targetLabel: "Operator Session Ops",
      };
    default:
      return null;
  }
}

function buildNextOperatorWorkspace(action: string | null): RuntimeSessionReplayNextOperatorWorkspace | null {
  switch (action) {
    case "resolve_approval":
    case "resolve_workflow_approval":
      return "approvals";
    case "observe_live_work":
    case "inspect_workflow_boundary":
    case "plan_recovery_drill":
    case "inspect_session":
    case "inspect_handoff":
    case "resume_handoff":
    case "inspect_follow_up":
    case "resume_follow_up":
    case "confirm_booking":
    case "resume_booking":
    case "resume_from_latest_proof":
    case "resume_session":
      return "runtime";
    default:
      return null;
  }
}

function buildNextOperatorPrimaryStepActionMode(
  action: string | null,
): RuntimeSessionReplayPrimaryStepActionMode {
  switch (action) {
    case "plan_recovery_drill":
      return "executable";
    default:
      return "openable";
  }
}

function buildNextOperatorPrimaryStepSurfaceState(params: {
  nextOperatorActionTarget: RuntimeSessionReplayNextOperatorActionTarget | null;
  approvalGate: ReturnType<typeof buildApprovalGate>;
  workflowBoundarySummary: ReturnType<typeof buildWorkflowBoundarySummary>;
  recoveryDrill: ReturnType<typeof buildRecoveryDrill>;
  currentHandoffState: ReturnType<typeof buildCurrentHandoffState>;
  latestProofPointer: ReturnType<typeof buildLatestProofPointer>;
  selectedSessionId: string | null;
  selectedSessionFound: boolean;
}): RuntimeSessionReplayPrimaryStepSurfaceState {
  switch (params.nextOperatorActionTarget?.targetSurface) {
    case "operator_saved_view_approvals":
      return params.approvalGate?.pendingCount && params.approvalGate.pendingCount > 0 ? "primed" : "not_primed";
    case "operator_workflow_control":
      return params.workflowBoundarySummary ? "primed" : "not_primed";
    case "operator_runtime_drills":
      return params.recoveryDrill ? "primed" : "not_primed";
    case "operator_session_ops":
      return params.selectedSessionFound &&
        (params.currentHandoffState !== null || params.latestProofPointer !== null || params.workflowBoundarySummary !== null)
        ? "primed"
        : params.selectedSessionId
          ? "not_primed"
          : "not_primed";
    default:
      return "not_primed";
  }
}

function buildNextOperatorPrimaryStepNeedsRefresh(params: {
  surfaceState: RuntimeSessionReplayPrimaryStepSurfaceState;
  nextOperatorActionTarget: RuntimeSessionReplayNextOperatorActionTarget | null;
  selectedSession: SessionListItem | null;
  latestSelectedRun: RunListItem | null;
  latestSelectedApproval: ApprovalRecord | null;
  selectedEventInsight: SessionEventInsight;
  workflowSummary: RuntimeWorkflowControlPlaneSummary | null;
  latestProofPointer: ReturnType<typeof buildLatestProofPointer>;
}): boolean {
  if (params.surfaceState !== "primed") {
    return false;
  }
  switch (params.nextOperatorActionTarget?.targetSurface) {
    case "operator_saved_view_approvals": {
      const baselineMs = maxTimestampMs([
        params.selectedSession?.updatedAt ?? null,
        params.latestSelectedRun?.updatedAt ?? null,
        params.selectedEventInsight.latestEventAt,
        params.workflowSummary?.workflowUpdatedAt ?? null,
        params.latestProofPointer?.verifiedAt ?? null,
      ]);
      const surfaceAnchorMs = maxTimestampMs([
        params.latestSelectedApproval?.updatedAt ?? null,
      ]);
      return surfaceAnchorMs > 0 && baselineMs > surfaceAnchorMs;
    }
    case "operator_session_ops": {
      if (params.latestProofPointer?.verifiedAt === null) {
        return false;
      }
      const baselineMs = maxTimestampMs([
        params.selectedSession?.updatedAt ?? null,
        params.latestSelectedRun?.updatedAt ?? null,
        params.latestSelectedApproval?.updatedAt ?? null,
        params.selectedEventInsight.latestEventAt,
        params.workflowSummary?.workflowUpdatedAt ?? null,
      ]);
      const surfaceAnchorMs = maxTimestampMs([
        params.latestProofPointer?.verifiedAt ?? null,
      ]);
      return surfaceAnchorMs > 0 && baselineMs > surfaceAnchorMs;
    }
    case "operator_workflow_control":
    case "operator_runtime_drills":
    default:
      return false;
  }
}

function buildNextOperatorPrimaryStepRefreshAction(params: {
  needsRefresh: boolean;
  nextOperatorActionTarget: RuntimeSessionReplayNextOperatorActionTarget | null;
}): RuntimeSessionReplayPrimaryRefreshAction | null {
  if (!params.needsRefresh) {
    return null;
  }
  const staleTargetLabel =
    params.nextOperatorActionTarget?.targetLabel ??
    (params.nextOperatorActionTarget?.targetSurface === "operator_saved_view_approvals"
      ? "Approvals"
      : params.nextOperatorActionTarget?.targetSurface === "operator_workflow_control"
        ? "Workflow Control"
        : params.nextOperatorActionTarget?.targetSurface === "operator_runtime_drills"
          ? "Runtime Drill Runner"
          : "Operator Session Ops");
  return {
    label: `Refresh replay before reopening ${staleTargetLabel}.`,
    action: "refresh_session_replay",
    ctaLabel: "Refresh first",
    targetSurface: "operator_session_ops",
    targetLabel: "Operator Session Ops",
    workspace: "runtime",
  };
}

function buildNextOperatorPrimaryStepRefreshDisposition(params: {
  needsRefresh: boolean;
  nextOperatorActionTarget: RuntimeSessionReplayNextOperatorActionTarget | null;
}): RuntimeSessionReplayPrimaryRefreshDisposition | null {
  if (!params.needsRefresh) {
    return null;
  }
  switch (params.nextOperatorActionTarget?.targetSurface) {
    case "operator_saved_view_approvals":
    case "operator_workflow_control":
      return "reopen_then_refresh";
    case "operator_runtime_drills":
      return "reload_before_run";
    case "operator_session_ops":
    default:
      return "silent_rehydrate";
  }
}

function buildNextOperatorPrimaryStepRefreshEvidenceHint(params: {
  needsRefresh: boolean;
  nextOperatorActionTarget: RuntimeSessionReplayNextOperatorActionTarget | null;
  currentHandoffState: ReturnType<typeof buildCurrentHandoffState>;
  latestProofPointer: ReturnType<typeof buildLatestProofPointer>;
}): string | null {
  if (!params.needsRefresh) {
    return null;
  }
  switch (params.nextOperatorActionTarget?.targetSurface) {
    case "operator_saved_view_approvals":
      return "Recheck the latest approval gate evidence.";
    case "operator_workflow_control":
      return "Recheck the latest workflow boundary evidence.";
    case "operator_runtime_drills":
      return "Recheck the latest recovery drill evidence.";
    case "operator_session_ops":
    default:
      return params.currentHandoffState || params.latestProofPointer
        ? "Recheck the latest proof pointer before reopening the session path."
        : "Recheck the latest replay evidence before reopening the session path.";
  }
}

function buildNextOperatorPrimaryStepRefreshOutcomeLabel(params: {
  needsRefresh: boolean;
  nextOperatorActionTarget: RuntimeSessionReplayNextOperatorActionTarget | null;
  currentHandoffState: ReturnType<typeof buildCurrentHandoffState>;
  latestProofPointer: ReturnType<typeof buildLatestProofPointer>;
}): string | null {
  if (!params.needsRefresh) {
    return null;
  }
  switch (params.nextOperatorActionTarget?.targetSurface) {
    case "operator_saved_view_approvals":
      return "Approval gate is current again.";
    case "operator_workflow_control":
      return "Workflow boundary is current again.";
    case "operator_runtime_drills":
      return "Recovery drill state is current again.";
    case "operator_session_ops":
    default:
      return params.currentHandoffState || params.latestProofPointer
        ? "Proof pointer is current again."
        : "Replay state is current again.";
  }
}

function buildNextOperatorPrimaryStepRefreshConfidence(params: {
  needsRefresh: boolean;
  nextOperatorActionTarget: RuntimeSessionReplayNextOperatorActionTarget | null;
}): RuntimeSessionReplayPrimaryRefreshConfidence | null {
  if (!params.needsRefresh) {
    return null;
  }
  switch (params.nextOperatorActionTarget?.targetSurface) {
    case "operator_session_ops":
      return "high";
    case "operator_saved_view_approvals":
    case "operator_workflow_control":
      return "medium";
    case "operator_runtime_drills":
    default:
      return "low";
  }
}

function buildNextOperatorPrimaryStepRefreshDetourHint(params: {
  needsRefresh: boolean;
  nextOperatorActionTarget: RuntimeSessionReplayNextOperatorActionTarget | null;
}): string | null {
  if (!params.needsRefresh) {
    return null;
  }
  switch (params.nextOperatorActionTarget?.targetSurface) {
    case "operator_saved_view_approvals":
      return "If the gate still looks stale after refresh, stay in Approvals and inspect the pending gate before resuming.";
    case "operator_workflow_control":
      return "If the boundary still looks stale after refresh, jump to Runtime Drill Runner before retrying the workflow path.";
    case "operator_runtime_drills":
      return "If recovery state is still stale after refresh, reopen Workflow Control before rerunning the drill.";
    case "operator_session_ops":
    default:
      return "If the proof pointer still looks stale after refresh, stay in Session Ops and inspect the latest proof before resuming.";
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationHint(params: {
  needsRefresh: boolean;
  nextOperatorActionTarget: RuntimeSessionReplayNextOperatorActionTarget | null;
}): string | null {
  if (!params.needsRefresh) {
    return null;
  }
  switch (params.nextOperatorActionTarget?.targetSurface) {
    case "operator_saved_view_approvals":
      return "Escalate through Workflow Control if the approval gate still blocks after the refresh detour.";
    case "operator_workflow_control":
      return "Escalate through Runtime Drill Runner if the workflow boundary still blocks after refresh.";
    case "operator_runtime_drills":
      return "Escalate to the workflow owner if recovery still fails after the refresh and drill rerun.";
    case "operator_session_ops":
    default:
      return null;
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationTarget(params: {
  needsRefresh: boolean;
  nextOperatorActionTarget: RuntimeSessionReplayNextOperatorActionTarget | null;
}): RuntimeSessionReplayPrimaryRefreshEscalationTarget | null {
  if (!params.needsRefresh) {
    return null;
  }
  switch (params.nextOperatorActionTarget?.targetSurface) {
    case "operator_saved_view_approvals":
      return {
        label: "Workflow Control | approval escalation",
        targetSurface: "operator_workflow_control",
        targetLabel: "Workflow Control",
        workspace: "runtime",
        stateLabel: "approval escalation",
        mode: "inspect",
      };
    case "operator_workflow_control":
      return {
        label: "Runtime Drill Runner | recovery escalation",
        targetSurface: "operator_runtime_drills",
        targetLabel: "Runtime Drill Runner",
        workspace: "runtime",
        stateLabel: "recovery escalation",
        mode: "recover",
      };
    case "operator_runtime_drills":
      return {
        label: "Workflow Control | workflow owner escalation",
        targetSurface: "operator_workflow_control",
        targetLabel: "Workflow Control",
        workspace: "runtime",
        stateLabel: "workflow owner escalation",
        mode: "owner_handoff",
      };
    case "operator_session_ops":
    default:
      return null;
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationCTA(params: {
  needsRefresh: boolean;
  refreshEscalationTarget: RuntimeSessionReplayPrimaryRefreshEscalationTarget | null;
}): RuntimeSessionReplayPrimaryRefreshEscalationCTA | null {
  if (!params.needsRefresh || !params.refreshEscalationTarget) {
    return null;
  }
  switch (params.refreshEscalationTarget.mode) {
    case "inspect":
      return {
        label: "Open Workflow Control for approval escalation.",
        ctaLabel: "Inspect escalation path",
        targetSurface: params.refreshEscalationTarget.targetSurface,
        targetLabel: params.refreshEscalationTarget.targetLabel,
        workspace: params.refreshEscalationTarget.workspace,
      };
    case "recover":
      return {
        label: "Open Runtime Drill Runner for the recovery escalation.",
        ctaLabel: "Recover after refresh",
        targetSurface: params.refreshEscalationTarget.targetSurface,
        targetLabel: params.refreshEscalationTarget.targetLabel,
        workspace: params.refreshEscalationTarget.workspace,
      };
    case "owner_handoff":
      return {
        label: "Open Workflow Control for the workflow owner handoff.",
        ctaLabel: "Hand off after refresh",
        targetSurface: params.refreshEscalationTarget.targetSurface,
        targetLabel: params.refreshEscalationTarget.targetLabel,
        workspace: params.refreshEscalationTarget.workspace,
      };
    default:
      return null;
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationReadiness(params: {
  needsRefresh: boolean;
  refreshEscalationTarget: RuntimeSessionReplayPrimaryRefreshEscalationTarget | null;
  workflowSummary: RuntimeWorkflowControlPlaneSummary | null;
  currentHandoffState: ReturnType<typeof buildCurrentHandoffState>;
  recoveryDrill: ReturnType<typeof buildRecoveryDrill>;
}): RuntimeSessionReplayPrimaryRefreshEscalationReadiness | null {
  if (!params.needsRefresh || !params.refreshEscalationTarget) {
    return null;
  }
  switch (params.refreshEscalationTarget.targetSurface) {
    case "operator_workflow_control":
      return params.workflowSummary || params.currentHandoffState ? "ready" : "needs_prep";
    case "operator_runtime_drills":
      return params.recoveryDrill ? "ready" : "needs_prep";
    case "operator_session_ops":
    case "operator_saved_view_approvals":
    default:
      return "needs_prep";
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationPrepHint(params: {
  needsRefresh: boolean;
  refreshEscalationTarget: RuntimeSessionReplayPrimaryRefreshEscalationTarget | null;
  refreshEscalationReadiness: RuntimeSessionReplayPrimaryRefreshEscalationReadiness | null;
}): string | null {
  if (
    !params.needsRefresh ||
    !params.refreshEscalationTarget ||
    params.refreshEscalationReadiness !== "needs_prep"
  ) {
    return null;
  }
  switch (params.refreshEscalationTarget.targetSurface) {
    case "operator_workflow_control":
      return "Load the linked workflow boundary before escalating through Workflow Control.";
    case "operator_runtime_drills":
      return "Load the repo-owned recovery drill before escalating through Runtime Drill Runner.";
    default:
      return "Prepare the escalation surface before reopening it.";
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationOpenGuard(params: {
  needsRefresh: boolean;
  refreshEscalationTarget: RuntimeSessionReplayPrimaryRefreshEscalationTarget | null;
  refreshEscalationReadiness: RuntimeSessionReplayPrimaryRefreshEscalationReadiness | null;
}): string | null {
  if (
    !params.needsRefresh ||
    !params.refreshEscalationTarget ||
    params.refreshEscalationReadiness !== "needs_prep"
  ) {
    return null;
  }
  switch (params.refreshEscalationTarget.targetSurface) {
    case "operator_workflow_control":
      return "Open once a linked workflow boundary or workflow owner handoff is loaded.";
    case "operator_runtime_drills":
      return "Open once the repo-owned recovery drill is loaded.";
    default:
      return "Open once the escalation surface is prepared.";
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationFallbackTarget(params: {
  needsRefresh: boolean;
  refreshEscalationTarget: RuntimeSessionReplayPrimaryRefreshEscalationTarget | null;
  refreshEscalationReadiness: RuntimeSessionReplayPrimaryRefreshEscalationReadiness | null;
}): RuntimeSessionReplayPrimaryRefreshEscalationFallbackTarget | null {
  if (
    !params.needsRefresh ||
    !params.refreshEscalationTarget ||
    params.refreshEscalationReadiness !== "needs_prep"
  ) {
    return null;
  }
  switch (params.refreshEscalationTarget.targetSurface) {
    case "operator_workflow_control":
      return params.refreshEscalationTarget.mode === "inspect"
        ? {
            label: "Approvals | gate fallback",
            targetSurface: "operator_saved_view_approvals",
            targetLabel: "Approvals",
            workspace: "approvals",
            stateLabel: "gate fallback",
          }
        : {
            label: "Operator Session Ops | handoff fallback",
            targetSurface: "operator_session_ops",
            targetLabel: "Operator Session Ops",
            workspace: "runtime",
            stateLabel: "handoff fallback",
          };
    case "operator_runtime_drills":
      return {
        label: "Workflow Control | boundary fallback",
        targetSurface: "operator_workflow_control",
        targetLabel: "Workflow Control",
        workspace: "runtime",
        stateLabel: "boundary fallback",
      };
    default:
      return {
        label: "Operator Session Ops | replay fallback",
        targetSurface: "operator_session_ops",
        targetLabel: "Operator Session Ops",
        workspace: "runtime",
        stateLabel: "replay fallback",
      };
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationFallbackCTA(params: {
  needsRefresh: boolean;
  refreshEscalationFallbackTarget: RuntimeSessionReplayPrimaryRefreshEscalationFallbackTarget | null;
}): RuntimeSessionReplayPrimaryRefreshEscalationFallbackCTA | null {
  if (!params.needsRefresh || !params.refreshEscalationFallbackTarget) {
    return null;
  }
  switch (params.refreshEscalationFallbackTarget.targetSurface) {
    case "operator_saved_view_approvals":
      return {
        label: "Open Approvals for the gate fallback.",
        ctaLabel: "Open gate fallback",
        targetSurface: params.refreshEscalationFallbackTarget.targetSurface,
        targetLabel: params.refreshEscalationFallbackTarget.targetLabel,
        workspace: params.refreshEscalationFallbackTarget.workspace,
      };
    case "operator_workflow_control":
      return {
        label: "Open Workflow Control for the boundary fallback.",
        ctaLabel: "Inspect boundary fallback",
        targetSurface: params.refreshEscalationFallbackTarget.targetSurface,
        targetLabel: params.refreshEscalationFallbackTarget.targetLabel,
        workspace: params.refreshEscalationFallbackTarget.workspace,
      };
    case "operator_session_ops":
    default:
      return {
        label: "Open Operator Session Ops for the replay fallback.",
        ctaLabel: "Open replay fallback",
        targetSurface: params.refreshEscalationFallbackTarget.targetSurface,
        targetLabel: params.refreshEscalationFallbackTarget.targetLabel,
        workspace: params.refreshEscalationFallbackTarget.workspace,
      };
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationFallbackReadiness(params: {
  needsRefresh: boolean;
  refreshEscalationFallbackTarget: RuntimeSessionReplayPrimaryRefreshEscalationFallbackTarget | null;
  approvalGate: ReturnType<typeof buildApprovalGate>;
  workflowSummary: RuntimeWorkflowControlPlaneSummary | null;
  currentHandoffState: ReturnType<typeof buildCurrentHandoffState>;
}): RuntimeSessionReplayPrimaryRefreshEscalationFallbackReadiness | null {
  if (!params.needsRefresh || !params.refreshEscalationFallbackTarget) {
    return null;
  }
  switch (params.refreshEscalationFallbackTarget.targetSurface) {
    case "operator_saved_view_approvals":
      return params.approvalGate ? "ready" : "needs_prep";
    case "operator_workflow_control":
      return params.workflowSummary || params.currentHandoffState ? "ready" : "needs_prep";
    case "operator_session_ops":
    default:
      return "ready";
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationFallbackPrepHint(params: {
  needsRefresh: boolean;
  refreshEscalationFallbackTarget: RuntimeSessionReplayPrimaryRefreshEscalationFallbackTarget | null;
  refreshEscalationFallbackReadiness: RuntimeSessionReplayPrimaryRefreshEscalationFallbackReadiness | null;
}): string | null {
  if (
    !params.needsRefresh ||
    !params.refreshEscalationFallbackTarget ||
    params.refreshEscalationFallbackReadiness !== "needs_prep"
  ) {
    return null;
  }
  switch (params.refreshEscalationFallbackTarget.targetSurface) {
    case "operator_saved_view_approvals":
      return "Load the current approval gate before opening the gate fallback.";
    case "operator_workflow_control":
      return "Load the linked workflow boundary or workflow owner handoff before opening the boundary fallback.";
    case "operator_session_ops":
    default:
      return "Load the latest replay handoff before opening the replay fallback.";
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationFallbackOpenGuard(params: {
  needsRefresh: boolean;
  refreshEscalationFallbackTarget: RuntimeSessionReplayPrimaryRefreshEscalationFallbackTarget | null;
  refreshEscalationFallbackReadiness: RuntimeSessionReplayPrimaryRefreshEscalationFallbackReadiness | null;
}): string | null {
  if (
    !params.needsRefresh ||
    !params.refreshEscalationFallbackTarget ||
    params.refreshEscalationFallbackReadiness !== "needs_prep"
  ) {
    return null;
  }
  switch (params.refreshEscalationFallbackTarget.targetSurface) {
    case "operator_saved_view_approvals":
      return "Open once the current approval gate is loaded.";
    case "operator_workflow_control":
      return "Open once a linked workflow boundary or workflow owner handoff is loaded.";
    case "operator_session_ops":
    default:
      return "Open once the latest replay handoff is loaded.";
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationFallbackOutcomeLabel(params: {
  needsRefresh: boolean;
  refreshEscalationFallbackTarget: RuntimeSessionReplayPrimaryRefreshEscalationFallbackTarget | null;
}): string | null {
  if (!params.needsRefresh || !params.refreshEscalationFallbackTarget) {
    return null;
  }
  switch (params.refreshEscalationFallbackTarget.targetSurface) {
    case "operator_saved_view_approvals":
      return "Approval gate fallback is open.";
    case "operator_workflow_control":
      return "Boundary fallback is open.";
    case "operator_session_ops":
    default:
      return "Replay fallback is open.";
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationFallbackConfidence(params: {
  needsRefresh: boolean;
  refreshEscalationFallbackTarget: RuntimeSessionReplayPrimaryRefreshEscalationFallbackTarget | null;
}): RuntimeSessionReplayPrimaryRefreshConfidence | null {
  if (!params.needsRefresh || !params.refreshEscalationFallbackTarget) {
    return null;
  }
  switch (params.refreshEscalationFallbackTarget.targetSurface) {
    case "operator_saved_view_approvals":
      return "high";
    case "operator_workflow_control":
      return "medium";
    case "operator_session_ops":
    default:
      return "low";
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationFallbackDetourHint(params: {
  needsRefresh: boolean;
  refreshEscalationFallbackTarget: RuntimeSessionReplayPrimaryRefreshEscalationFallbackTarget | null;
}): string | null {
  if (!params.needsRefresh || !params.refreshEscalationFallbackTarget) {
    return null;
  }
  switch (params.refreshEscalationFallbackTarget.targetSurface) {
    case "operator_saved_view_approvals":
      return "Use boundary review if the gate fallback still does not resolve ownership.";
    case "operator_workflow_control":
      return "Use owner handoff if the boundary fallback still does not clear the workflow edge.";
    case "operator_session_ops":
    default:
      return "Use manual follow-through if the replay fallback still does not restore the session path.";
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationFallbackEscalationHint(params: {
  needsRefresh: boolean;
  refreshEscalationFallbackTarget: RuntimeSessionReplayPrimaryRefreshEscalationFallbackTarget | null;
}): string | null {
  if (!params.needsRefresh || !params.refreshEscalationFallbackTarget) {
    return null;
  }
  switch (params.refreshEscalationFallbackTarget.targetSurface) {
    case "operator_saved_view_approvals":
      return "Escalate to boundary review if the gate fallback still does not resolve ownership.";
    case "operator_workflow_control":
      return "Escalate to owner handoff if the boundary fallback still does not clear the workflow edge.";
    case "operator_session_ops":
    default:
      return "Escalate to manual handoff if the replay fallback still does not restore the session path.";
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationFallbackEscalationTarget(params: {
  needsRefresh: boolean;
  refreshEscalationFallbackTarget: RuntimeSessionReplayPrimaryRefreshEscalationFallbackTarget | null;
}): RuntimeSessionReplayPrimaryRefreshEscalationFallbackEscalationTarget | null {
  if (!params.needsRefresh || !params.refreshEscalationFallbackTarget) {
    return null;
  }
  switch (params.refreshEscalationFallbackTarget.targetSurface) {
    case "operator_saved_view_approvals":
      return {
        label: "Workflow Control | boundary review",
        targetSurface: "operator_workflow_control",
        targetLabel: "Workflow Control",
        workspace: "runtime",
        stateLabel: "boundary review",
        mode: "inspect",
      };
    case "operator_workflow_control":
      return {
        label: "Workflow Control | owner handoff",
        targetSurface: "operator_workflow_control",
        targetLabel: "Workflow Control",
        workspace: "runtime",
        stateLabel: "owner handoff",
        mode: "owner_handoff",
      };
    case "operator_session_ops":
    default:
      return {
        label: "Operator Session Ops | manual handoff",
        targetSurface: "operator_session_ops",
        targetLabel: "Operator Session Ops",
        workspace: "runtime",
        stateLabel: "manual handoff",
        mode: "owner_handoff",
      };
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationFallbackEscalationCTA(params: {
  needsRefresh: boolean;
  refreshEscalationFallbackEscalationTarget: RuntimeSessionReplayPrimaryRefreshEscalationFallbackEscalationTarget | null;
}): RuntimeSessionReplayPrimaryRefreshEscalationFallbackEscalationCTA | null {
  if (!params.needsRefresh || !params.refreshEscalationFallbackEscalationTarget) {
    return null;
  }
  switch (params.refreshEscalationFallbackEscalationTarget.mode) {
    case "inspect":
      return {
        label: "Open Workflow Control for the fallback boundary review.",
        ctaLabel: "Inspect fallback escalation",
        targetSurface: params.refreshEscalationFallbackEscalationTarget.targetSurface,
        targetLabel: params.refreshEscalationFallbackEscalationTarget.targetLabel,
        workspace: params.refreshEscalationFallbackEscalationTarget.workspace,
      };
    case "recover":
      return {
        label: "Open Runtime Drill Runner for the fallback recovery escalation.",
        ctaLabel: "Recover after fallback",
        targetSurface: params.refreshEscalationFallbackEscalationTarget.targetSurface,
        targetLabel: params.refreshEscalationFallbackEscalationTarget.targetLabel,
        workspace: params.refreshEscalationFallbackEscalationTarget.workspace,
      };
    case "owner_handoff":
      return {
        label:
          params.refreshEscalationFallbackEscalationTarget.targetSurface === "operator_workflow_control"
            ? "Open Workflow Control for the fallback owner handoff."
            : "Open Operator Session Ops for the fallback manual handoff.",
        ctaLabel: "Hand off after fallback",
        targetSurface: params.refreshEscalationFallbackEscalationTarget.targetSurface,
        targetLabel: params.refreshEscalationFallbackEscalationTarget.targetLabel,
        workspace: params.refreshEscalationFallbackEscalationTarget.workspace,
      };
    default:
      return null;
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationFallbackEscalationReadiness(params: {
  needsRefresh: boolean;
  refreshEscalationFallbackEscalationTarget: RuntimeSessionReplayPrimaryRefreshEscalationFallbackEscalationTarget | null;
  workflowSummary: RuntimeWorkflowControlPlaneSummary | null;
  currentHandoffState: ReturnType<typeof buildCurrentHandoffState>;
}): RuntimeSessionReplayPrimaryRefreshEscalationReadiness | null {
  if (!params.needsRefresh || !params.refreshEscalationFallbackEscalationTarget) {
    return null;
  }
  switch (params.refreshEscalationFallbackEscalationTarget.targetSurface) {
    case "operator_workflow_control":
      return params.workflowSummary || params.currentHandoffState ? "ready" : "needs_prep";
    case "operator_session_ops":
      return params.currentHandoffState ? "ready" : "needs_prep";
    case "operator_runtime_drills":
    case "operator_saved_view_approvals":
    default:
      return "needs_prep";
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationFallbackEscalationPrepHint(params: {
  needsRefresh: boolean;
  refreshEscalationFallbackEscalationTarget: RuntimeSessionReplayPrimaryRefreshEscalationFallbackEscalationTarget | null;
  refreshEscalationFallbackEscalationReadiness: RuntimeSessionReplayPrimaryRefreshEscalationReadiness | null;
}): string | null {
  if (
    !params.needsRefresh ||
    !params.refreshEscalationFallbackEscalationTarget ||
    params.refreshEscalationFallbackEscalationReadiness !== "needs_prep"
  ) {
    return null;
  }
  switch (params.refreshEscalationFallbackEscalationTarget.targetSurface) {
    case "operator_workflow_control":
      return "Load the linked workflow boundary or workflow owner handoff before opening the fallback escalation.";
    case "operator_runtime_drills":
      return "Load the repo-owned recovery drill before opening the fallback recovery escalation.";
    case "operator_session_ops":
    default:
      return "Load the latest replay handoff before opening the fallback manual handoff.";
  }
}

function buildNextOperatorPrimaryStepRefreshEscalationFallbackEscalationOpenGuard(params: {
  needsRefresh: boolean;
  refreshEscalationFallbackEscalationTarget: RuntimeSessionReplayPrimaryRefreshEscalationFallbackEscalationTarget | null;
  refreshEscalationFallbackEscalationReadiness: RuntimeSessionReplayPrimaryRefreshEscalationReadiness | null;
}): string | null {
  if (
    !params.needsRefresh ||
    !params.refreshEscalationFallbackEscalationTarget ||
    params.refreshEscalationFallbackEscalationReadiness !== "needs_prep"
  ) {
    return null;
  }
  switch (params.refreshEscalationFallbackEscalationTarget.targetSurface) {
    case "operator_workflow_control":
      return "Open once a linked workflow boundary or workflow owner handoff is loaded.";
    case "operator_runtime_drills":
      return "Open once the repo-owned recovery drill is loaded.";
    case "operator_session_ops":
    default:
      return "Open once the latest replay handoff is loaded.";
  }
}

function buildNextOperatorPrimaryStepRefreshTargetState(params: {
  needsRefresh: boolean;
  nextOperatorActionTarget: RuntimeSessionReplayNextOperatorActionTarget | null;
  nextOperatorWorkspace: RuntimeSessionReplayNextOperatorWorkspace | null;
  currentHandoffState: ReturnType<typeof buildCurrentHandoffState>;
  latestProofPointer: ReturnType<typeof buildLatestProofPointer>;
}): RuntimeSessionReplayPrimaryRefreshTargetState | null {
  if (!params.needsRefresh) {
    return null;
  }
  const targetSurface = params.nextOperatorActionTarget?.targetSurface ?? "operator_session_ops";
  const targetLabel =
    params.nextOperatorActionTarget?.targetLabel ??
    (targetSurface === "operator_saved_view_approvals"
      ? "Approvals"
      : targetSurface === "operator_workflow_control"
        ? "Workflow Control"
        : targetSurface === "operator_runtime_drills"
          ? "Runtime Drill Runner"
          : "Operator Session Ops");
  const stateLabel =
    targetSurface === "operator_saved_view_approvals"
      ? "latest gate state"
      : targetSurface === "operator_workflow_control"
        ? "latest boundary state"
        : targetSurface === "operator_runtime_drills"
          ? "latest recovery state"
          : params.currentHandoffState || params.latestProofPointer
          ? "latest proof state"
            : "latest replay state";
  const refreshScope =
    targetSurface === "operator_saved_view_approvals"
      ? "gate"
      : targetSurface === "operator_workflow_control"
        ? "boundary"
        : targetSurface === "operator_runtime_drills"
          ? "recovery"
          : "proof";
  return {
    label: `${targetLabel} | ${stateLabel}`,
    targetSurface,
    targetLabel,
    workspace: params.nextOperatorWorkspace,
    stateLabel,
    refreshScope,
  };
}

function buildApprovalGate(params: {
  latestSelectedApproval: ApprovalRecord | null;
  pendingApprovalCount: number;
  workflowLinked: boolean;
  workflowSummary: RuntimeWorkflowControlPlaneSummary | null;
  resumeMetadata: ReturnType<typeof buildResumeMetadata>;
}) {
  if (params.pendingApprovalCount > 0 && params.latestSelectedApproval) {
    return {
      source: "session" as const,
      status: params.latestSelectedApproval.status,
      approvalId: params.latestSelectedApproval.approvalId,
      runId: params.latestSelectedApproval.runId,
      reason: params.latestSelectedApproval.reason,
      requestedAt: params.latestSelectedApproval.requestedAt,
      hardDueAt: params.latestSelectedApproval.hardDueAt,
      pendingCount: params.pendingApprovalCount,
      action: params.resumeMetadata.nextOperatorAction,
    };
  }
  if (params.workflowLinked && params.workflowSummary?.workflowExecutionStatus === "pending_approval") {
    return {
      source: "workflow" as const,
      status: params.workflowSummary.workflowExecutionStatus,
      approvalId: null,
      runId: params.workflowSummary.workflowRunId ?? null,
      reason: params.workflowSummary.workflowReason ?? null,
      requestedAt: params.workflowSummary.workflowUpdatedAt ?? null,
      hardDueAt: null,
      pendingCount: Math.max(1, params.pendingApprovalCount),
      action: params.resumeMetadata.nextOperatorAction,
    };
  }
  return null;
}

function buildRecoveryPathHint(params: {
  resumeMetadata: ReturnType<typeof buildResumeMetadata>;
  currentHandoffState: ReturnType<typeof buildCurrentHandoffState>;
  latestProofPointer: ReturnType<typeof buildLatestProofPointer>;
}) {
  if (params.resumeMetadata.resumeBlockedBy === "session_missing") {
    return {
      code: "session_missing",
      label: "Load a tracked session before attempting resume.",
      action: "inspect_session",
    };
  }
  if (params.resumeMetadata.resumeBlockedBy === "approval_pending") {
    return {
      code: "approval_pending",
      label: "Resolve the pending approval, then reopen the selected session.",
      action: "resolve_approval",
    };
  }
  if (params.resumeMetadata.resumeBlockedBy === "workflow_pending_approval") {
    return {
      code: "workflow_pending_approval",
      label: "Resolve the linked workflow approval before resuming replay.",
      action: "resolve_workflow_approval",
    };
  }
  if (params.resumeMetadata.resumeBlockedBy === "workflow_active") {
    return {
      code: "workflow_active",
      label: "Wait for the active workflow boundary to settle, or inspect the live workflow first.",
      action: "observe_live_work",
    };
  }
  if (params.resumeMetadata.resumeBlockedBy === "workflow_failed") {
    return {
      code: "workflow_failed",
      label: "Plan the workflow recovery drill before resuming the linked boundary.",
      action: "plan_recovery_drill",
    };
  }
  if (params.resumeMetadata.resumeBlockedBy === "replay_unavailable") {
    return {
      code: "replay_unavailable",
      label: "Replay evidence is empty; inspect the workflow boundary before resuming.",
      action: "inspect_workflow_boundary",
    };
  }
  if (params.resumeMetadata.resumeBlockedBy === "session_closed") {
    return {
      code: "session_closed",
      label: "This session is closed and has no verified proof pointer yet.",
      action: "inspect_session",
    };
  }
  if (params.currentHandoffState?.kind === "handoff") {
    return {
      code: "resume_handoff",
      label: "Resume from the handoff boundary and transfer the prepared case pack.",
      action: params.resumeMetadata.nextOperatorAction,
    };
  }
  if (params.currentHandoffState?.kind === "follow_up") {
    return {
      code: "resume_follow_up",
      label: "Resume from the follow-up boundary and continue the draft or submission path.",
      action: params.resumeMetadata.nextOperatorAction,
    };
  }
  if (params.currentHandoffState?.kind === "booking") {
    return {
      code: "resume_booking",
      label: "Resume from the booking boundary and confirm or continue the offered slot.",
      action: params.resumeMetadata.nextOperatorAction,
    };
  }
  if (params.latestProofPointer) {
    return {
      code: "resume_from_latest_proof",
      label: "Resume from the latest verified proof and continue the next protected step.",
      action: params.resumeMetadata.nextOperatorAction,
    };
  }
  return {
    code: "resume_session",
    label: "Resume the selected session from the current workflow boundary.",
    action: params.resumeMetadata.nextOperatorAction,
  };
}

function buildRecoveryDrill(params: {
  resumeMetadata: ReturnType<typeof buildResumeMetadata>;
  workflowSummary: RuntimeWorkflowControlPlaneSummary | null;
  workflowBoundarySummary: ReturnType<typeof buildWorkflowBoundarySummary>;
}) {
  if (params.resumeMetadata.resumeBlockedBy !== "workflow_failed") {
    return null;
  }
  return {
    profileId: "orchestrator-last-known-good",
    phase: "recovery" as const,
    label: "Workflow recovery drill",
    service: "orchestrator",
    reason:
      params.workflowBoundarySummary?.summary ??
      params.workflowSummary?.workflowReason ??
      "Workflow failure needs a repo-owned recovery drill before replay can resume.",
    action: "plan_recovery_drill",
  };
}

function buildRecoveryHandoff(params: {
  resumeMetadata: ReturnType<typeof buildResumeMetadata>;
  workflowSummary: RuntimeWorkflowControlPlaneSummary | null;
  workflowBoundarySummary: ReturnType<typeof buildWorkflowBoundarySummary>;
}) {
  if (params.workflowSummary?.workflowExecutionStatus === "failed") {
    return {
      targetPanel: "operator_runtime_drills" as const,
      targetLabel: "Runtime Drill Runner",
      reason:
        params.workflowBoundarySummary?.summary ??
        "The workflow boundary failed and may need a recovery drill before replay continues.",
      action: "plan_recovery_drill",
    };
  }
  if (
    params.resumeMetadata.resumeBlockedBy === "workflow_pending_approval" ||
    params.resumeMetadata.resumeBlockedBy === "workflow_active"
  ) {
    return {
      targetPanel: "operator_workflow_control" as const,
      targetLabel: "Workflow Control",
      reason:
        params.workflowBoundarySummary?.summary ??
        "Workflow control still owns this boundary and should be inspected first.",
      action: params.resumeMetadata.nextOperatorAction,
    };
  }
  return {
    targetPanel: "operator_session_ops" as const,
    targetLabel: "Operator Session Ops",
    reason:
      params.workflowBoundarySummary?.nextStep ??
      params.workflowBoundarySummary?.summary ??
      "Keep the selected session loaded while you resolve replay.",
    action: params.resumeMetadata.nextOperatorAction,
  };
}

function buildNextOperatorChecklist(params: {
  resumeMetadata: ReturnType<typeof buildResumeMetadata>;
  currentHandoffState: ReturnType<typeof buildCurrentHandoffState>;
  latestProofPointer: ReturnType<typeof buildLatestProofPointer>;
}) {
  if (params.resumeMetadata.resumeBlockedBy === "approval_pending") {
    return [
      "Open the Approvals workspace.",
      "Resolve the pending approval.",
      "Reload replay for the selected session.",
    ];
  }
  if (params.resumeMetadata.resumeBlockedBy === "workflow_pending_approval") {
    return [
      "Open the Approvals workspace.",
      "Resolve the workflow approval gate.",
      "Return to runtime replay and reload the boundary.",
    ];
  }
  if (params.resumeMetadata.resumeBlockedBy === "workflow_active") {
    return [
      "Open Workflow Control.",
      "Inspect the live workflow boundary.",
      "Reload replay after the boundary settles.",
    ];
  }
  if (params.resumeMetadata.resumeBlockedBy === "workflow_failed") {
    return [
      "Open Runtime Drill Runner.",
      "Run the workflow recovery drill.",
      "Return to Session Ops and reload replay.",
    ];
  }
  if (params.currentHandoffState?.kind === "handoff") {
    return [
      "Open Session Ops.",
      params.currentHandoffState.ready ? "Resume the handoff package." : "Inspect the handoff boundary.",
      "Confirm the transfer summary.",
    ];
  }
  if (params.currentHandoffState?.kind === "follow_up") {
    return [
      "Open Session Ops.",
      params.currentHandoffState.ready ? "Resume the follow-up path." : "Inspect the follow-up boundary.",
      "Verify the next protected step.",
    ];
  }
  if (params.currentHandoffState?.kind === "booking") {
    return [
      "Open Session Ops.",
      params.currentHandoffState.status === "offered" ? "Confirm the offered booking slot." : "Resume the booking boundary.",
      "Reload the booking boundary after confirmation.",
    ];
  }
  if (params.latestProofPointer) {
    return [
      "Open Session Ops.",
      "Resume from the latest proof.",
      "Continue the next protected step.",
    ];
  }
  return [
    "Open Session Ops.",
    "Inspect the selected session.",
    "Resume the current workflow boundary.",
  ];
}

function buildNextOperatorPrimaryStep(params: {
  resumeMetadata: ReturnType<typeof buildResumeMetadata>;
  nextOperatorActionTarget: RuntimeSessionReplayNextOperatorActionTarget | null;
  nextOperatorWorkspace: RuntimeSessionReplayNextOperatorWorkspace | null;
  nextOperatorChecklist: string[];
  approvalGate: ReturnType<typeof buildApprovalGate>;
  workflowBoundarySummary: ReturnType<typeof buildWorkflowBoundarySummary>;
  recoveryDrill: ReturnType<typeof buildRecoveryDrill>;
  currentHandoffState: ReturnType<typeof buildCurrentHandoffState>;
  latestProofPointer: ReturnType<typeof buildLatestProofPointer>;
  selectedSession: SessionListItem | null;
  latestSelectedRun: RunListItem | null;
  latestSelectedApproval: ApprovalRecord | null;
  selectedEventInsight: SessionEventInsight;
  workflowSummary: RuntimeWorkflowControlPlaneSummary | null;
  selectedSessionId: string | null;
  selectedSessionFound: boolean;
}): RuntimeSessionReplayPrimaryOperatorStep | null {
  if (!params.nextOperatorActionTarget) {
    return null;
  }
  const actionMode = buildNextOperatorPrimaryStepActionMode(params.resumeMetadata.nextOperatorAction);
  const surfaceState = buildNextOperatorPrimaryStepSurfaceState({
    nextOperatorActionTarget: params.nextOperatorActionTarget,
    approvalGate: params.approvalGate,
    workflowBoundarySummary: params.workflowBoundarySummary,
    recoveryDrill: params.recoveryDrill,
    currentHandoffState: params.currentHandoffState,
    latestProofPointer: params.latestProofPointer,
      selectedSessionId: params.selectedSessionId,
      selectedSessionFound: params.selectedSessionFound,
    });
  const needsRefresh = buildNextOperatorPrimaryStepNeedsRefresh({
    surfaceState,
    nextOperatorActionTarget: params.nextOperatorActionTarget,
    selectedSession: params.selectedSession,
    latestSelectedRun: params.latestSelectedRun,
    latestSelectedApproval: params.latestSelectedApproval,
    selectedEventInsight: params.selectedEventInsight,
    workflowSummary: params.workflowSummary,
    latestProofPointer: params.latestProofPointer,
  });
  const refreshAction = buildNextOperatorPrimaryStepRefreshAction({
    needsRefresh,
    nextOperatorActionTarget: params.nextOperatorActionTarget,
  });
  const refreshDisposition = buildNextOperatorPrimaryStepRefreshDisposition({
    needsRefresh,
    nextOperatorActionTarget: params.nextOperatorActionTarget,
  });
  const refreshEvidenceHint = buildNextOperatorPrimaryStepRefreshEvidenceHint({
    needsRefresh,
    nextOperatorActionTarget: params.nextOperatorActionTarget,
    currentHandoffState: params.currentHandoffState,
    latestProofPointer: params.latestProofPointer,
  });
  const refreshOutcomeLabel = buildNextOperatorPrimaryStepRefreshOutcomeLabel({
    needsRefresh,
    nextOperatorActionTarget: params.nextOperatorActionTarget,
    currentHandoffState: params.currentHandoffState,
    latestProofPointer: params.latestProofPointer,
  });
  const refreshConfidence = buildNextOperatorPrimaryStepRefreshConfidence({
    needsRefresh,
    nextOperatorActionTarget: params.nextOperatorActionTarget,
  });
  const refreshDetourHint = buildNextOperatorPrimaryStepRefreshDetourHint({
    needsRefresh,
    nextOperatorActionTarget: params.nextOperatorActionTarget,
  });
  const refreshEscalationHint = buildNextOperatorPrimaryStepRefreshEscalationHint({
    needsRefresh,
    nextOperatorActionTarget: params.nextOperatorActionTarget,
  });
  const refreshEscalationTarget = buildNextOperatorPrimaryStepRefreshEscalationTarget({
    needsRefresh,
    nextOperatorActionTarget: params.nextOperatorActionTarget,
  });
  const refreshEscalationCTA = buildNextOperatorPrimaryStepRefreshEscalationCTA({
    needsRefresh,
    refreshEscalationTarget,
  });
  const refreshEscalationReadiness = buildNextOperatorPrimaryStepRefreshEscalationReadiness({
    needsRefresh,
    refreshEscalationTarget,
    workflowSummary: params.workflowSummary,
    currentHandoffState: params.currentHandoffState,
    recoveryDrill: params.recoveryDrill,
  });
  const refreshEscalationPrepHint = buildNextOperatorPrimaryStepRefreshEscalationPrepHint({
    needsRefresh,
    refreshEscalationTarget,
    refreshEscalationReadiness,
  });
  const refreshEscalationOpenGuard = buildNextOperatorPrimaryStepRefreshEscalationOpenGuard({
    needsRefresh,
    refreshEscalationTarget,
    refreshEscalationReadiness,
  });
  const refreshEscalationFallbackTarget =
    buildNextOperatorPrimaryStepRefreshEscalationFallbackTarget({
      needsRefresh,
      refreshEscalationTarget,
      refreshEscalationReadiness,
    });
  const refreshEscalationFallbackCTA = buildNextOperatorPrimaryStepRefreshEscalationFallbackCTA({
    needsRefresh,
    refreshEscalationFallbackTarget,
  });
  const refreshEscalationFallbackReadiness =
    buildNextOperatorPrimaryStepRefreshEscalationFallbackReadiness({
      needsRefresh,
      refreshEscalationFallbackTarget,
      approvalGate: params.approvalGate,
      workflowSummary: params.workflowSummary,
      currentHandoffState: params.currentHandoffState,
    });
  const refreshEscalationFallbackPrepHint =
    buildNextOperatorPrimaryStepRefreshEscalationFallbackPrepHint({
      needsRefresh,
      refreshEscalationFallbackTarget,
      refreshEscalationFallbackReadiness,
    });
  const refreshEscalationFallbackOpenGuard =
    buildNextOperatorPrimaryStepRefreshEscalationFallbackOpenGuard({
      needsRefresh,
      refreshEscalationFallbackTarget,
      refreshEscalationFallbackReadiness,
    });
  const refreshEscalationFallbackOutcomeLabel =
    buildNextOperatorPrimaryStepRefreshEscalationFallbackOutcomeLabel({
      needsRefresh,
      refreshEscalationFallbackTarget,
    });
  const refreshEscalationFallbackConfidence =
    buildNextOperatorPrimaryStepRefreshEscalationFallbackConfidence({
      needsRefresh,
      refreshEscalationFallbackTarget,
    });
  const refreshEscalationFallbackDetourHint =
    buildNextOperatorPrimaryStepRefreshEscalationFallbackDetourHint({
      needsRefresh,
      refreshEscalationFallbackTarget,
    });
  const refreshEscalationFallbackEscalationHint =
    buildNextOperatorPrimaryStepRefreshEscalationFallbackEscalationHint({
      needsRefresh,
      refreshEscalationFallbackTarget,
    });
  const refreshEscalationFallbackEscalationTarget =
    buildNextOperatorPrimaryStepRefreshEscalationFallbackEscalationTarget({
      needsRefresh,
      refreshEscalationFallbackTarget,
    });
  const refreshEscalationFallbackEscalationCTA =
    buildNextOperatorPrimaryStepRefreshEscalationFallbackEscalationCTA({
      needsRefresh,
      refreshEscalationFallbackEscalationTarget,
    });
  const refreshEscalationFallbackEscalationReadiness =
    buildNextOperatorPrimaryStepRefreshEscalationFallbackEscalationReadiness({
      needsRefresh,
      refreshEscalationFallbackEscalationTarget,
      workflowSummary: params.workflowSummary,
      currentHandoffState: params.currentHandoffState,
    });
  const refreshEscalationFallbackEscalationPrepHint =
    buildNextOperatorPrimaryStepRefreshEscalationFallbackEscalationPrepHint({
      needsRefresh,
      refreshEscalationFallbackEscalationTarget,
      refreshEscalationFallbackEscalationReadiness,
    });
  const refreshEscalationFallbackEscalationOpenGuard =
    buildNextOperatorPrimaryStepRefreshEscalationFallbackEscalationOpenGuard({
      needsRefresh,
      refreshEscalationFallbackEscalationTarget,
      refreshEscalationFallbackEscalationReadiness,
    });
  const refreshTargetState = buildNextOperatorPrimaryStepRefreshTargetState({
    needsRefresh,
    nextOperatorActionTarget: params.nextOperatorActionTarget,
    nextOperatorWorkspace: params.nextOperatorWorkspace,
    currentHandoffState: params.currentHandoffState,
    latestProofPointer: params.latestProofPointer,
  });
  return {
    label: params.nextOperatorChecklist[0] ?? "Open the next operator surface.",
    action: params.resumeMetadata.nextOperatorAction,
    targetSurface: params.nextOperatorActionTarget.targetSurface,
    targetLabel: params.nextOperatorActionTarget.targetLabel,
    workspace: params.nextOperatorWorkspace,
    ctaLabel: actionMode === "executable" ? "Run first step" : "Open first step",
    phase: "active",
    runState: "runnable",
    actionMode,
    surfaceState,
    needsRefresh,
    refreshDisposition,
    refreshEvidenceHint,
    refreshOutcomeLabel,
    refreshConfidence,
    refreshDetourHint,
    refreshEscalationHint,
    refreshEscalationTarget,
    refreshEscalationCTA,
    refreshEscalationReadiness,
    refreshEscalationPrepHint,
    refreshEscalationOpenGuard,
    refreshEscalationFallbackTarget,
    refreshEscalationFallbackCTA,
    refreshEscalationFallbackReadiness,
    refreshEscalationFallbackPrepHint,
    refreshEscalationFallbackOpenGuard,
    refreshEscalationFallbackOutcomeLabel,
    refreshEscalationFallbackConfidence,
    refreshEscalationFallbackDetourHint,
    refreshEscalationFallbackEscalationHint,
    refreshEscalationFallbackEscalationTarget,
    refreshEscalationFallbackEscalationCTA,
    refreshEscalationFallbackEscalationReadiness,
    refreshEscalationFallbackEscalationPrepHint,
    refreshEscalationFallbackEscalationOpenGuard,
    refreshAction,
    refreshTargetState,
  } satisfies RuntimeSessionReplayPrimaryOperatorStep;
}

function buildNextOperatorRemainingSteps(nextOperatorChecklist: string[]) {
  return nextOperatorChecklist.slice(1);
}

function buildNextOperatorStepProgress(nextOperatorChecklist: string[]): RuntimeSessionReplayStepProgress | null {
  const total = nextOperatorChecklist.length;
  if (total < 1) {
    return null;
  }
  return {
    current: 1,
    total,
    label: `1/${total}`,
  } satisfies RuntimeSessionReplayStepProgress;
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

function buildNextOperatorStepPath(nextOperatorChecklist: string[]): RuntimeSessionReplayStepPathEntry[] {
  return nextOperatorChecklist.map((label, index) => ({
    label,
    phase: index === 0 ? "active" : "queued",
    runState: index === 0 ? "runnable" : "blocked",
  }));
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
  const workflowBooking = buildWorkflowBookingSummary(workflowSummary);
  const workflowHandoff = buildWorkflowHandoffSummary(workflowSummary);
  const workflowFollowUp = buildWorkflowFollowUpSummary(workflowSummary);
  const latestProofPointer = buildLatestProofPointer({
    eventInsight: selectedEventInsight,
    workflowSummary,
  });
  const currentHandoffState = buildCurrentHandoffState({
    booking: workflowBooking,
    handoff: workflowHandoff,
    followUp: workflowFollowUp,
  });
  const resumeMetadata = buildResumeMetadata({
    selectedSessionId,
    selectedSession,
    replayState: selectedReplayState,
    pendingApprovalCount,
    workflowLinked,
    workflowSummary,
    latestProofPointer,
    currentHandoffState,
  });
  const workflowBoundarySummary = buildWorkflowBoundarySummary({
    selectedSession,
    workflowLinked,
    workflowSummary,
    booking: workflowBooking,
    handoff: workflowHandoff,
    followUp: workflowFollowUp,
    latestProofPointer,
  });
  const recoveryPathHint = buildRecoveryPathHint({
    resumeMetadata,
    currentHandoffState,
    latestProofPointer,
  });
  const nextOperatorActionLabel = buildNextOperatorActionLabel(resumeMetadata.nextOperatorAction);
  const nextOperatorActionTarget = buildNextOperatorActionTarget(resumeMetadata.nextOperatorAction);
  const nextOperatorWorkspace = buildNextOperatorWorkspace(resumeMetadata.nextOperatorAction);
  const nextOperatorChecklist = buildNextOperatorChecklist({
    resumeMetadata,
    currentHandoffState,
    latestProofPointer,
  });
  const nextOperatorRemainingSteps = buildNextOperatorRemainingSteps(nextOperatorChecklist);
  const nextOperatorStepProgress = buildNextOperatorStepProgress(nextOperatorChecklist);
  const nextOperatorStepPath = buildNextOperatorStepPath(nextOperatorChecklist);
  const boundaryOwner = buildBoundaryOwner({
    selectedSessionId,
    workflowLinked,
    workflowSummary,
    workflowBoundarySummary,
  });
  const approvalGate = buildApprovalGate({
    latestSelectedApproval,
    pendingApprovalCount,
    workflowLinked,
    workflowSummary,
    resumeMetadata,
  });
  const recoveryHandoff = buildRecoveryHandoff({
    resumeMetadata,
    workflowSummary,
    workflowBoundarySummary,
  });
  const recoveryDrill = buildRecoveryDrill({
    resumeMetadata,
    workflowSummary,
    workflowBoundarySummary,
  });
  const nextOperatorPrimaryStep = buildNextOperatorPrimaryStep({
    resumeMetadata,
    nextOperatorActionTarget,
    nextOperatorWorkspace,
    nextOperatorChecklist,
    approvalGate,
    workflowBoundarySummary,
    recoveryDrill,
    currentHandoffState,
    latestProofPointer,
    selectedSession,
    latestSelectedRun,
    latestSelectedApproval,
    selectedEventInsight,
    workflowSummary,
    selectedSessionId,
    selectedSessionFound: selectedSession !== null,
  });

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
        booking: workflowBooking,
        handoff: workflowHandoff,
        followUp: workflowFollowUp,
      },
      replay: {
        replayState: selectedReplayState,
        replayReady: selectedReplayState !== "empty",
        resumeReady: resumeMetadata.resumeReady,
        resumeBlockedBy: resumeMetadata.resumeBlockedBy,
        nextOperatorAction: resumeMetadata.nextOperatorAction,
        nextOperatorActionLabel,
        nextOperatorActionTarget,
        nextOperatorWorkspace,
        nextOperatorChecklist,
        nextOperatorRemainingSteps,
        nextOperatorPrimaryStep,
        nextOperatorStepProgress,
        nextOperatorStepPath,
        latestVerifiedStage: latestProofPointer?.workflowStage ?? null,
        boundaryOwner,
        approvalGate,
        currentHandoffState,
        workflowBoundarySummary,
        latestProofPointer,
        recoveryPathHint,
        recoveryHandoff,
        recoveryDrill,
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
        latestVerifiedRoute: selectedEventInsight.latestVerifiedRoute,
        latestVerifiedIntent: selectedEventInsight.latestVerifiedIntent,
        bySource: selectedEventInsight.bySource,
        byType: selectedEventInsight.byType,
        byRoute: selectedEventInsight.byRoute,
      },
    },
  };
}
