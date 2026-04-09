import type {
  CaseWiki,
  CaseWikiEntity,
  CaseWikiEntityKind,
  CaseWikiNextAction,
  CaseWikiOpenQuestion,
  CaseWikiPriority,
  CaseWikiProof,
  CaseWikiProofStatus,
  CaseWikiStatus,
  CaseWikiTimelineEntry,
  CaseWikiTimelineEntryKind,
} from "@mla/contracts";
import type {
  ApprovalRecord,
  EventListItem,
  RunListItem,
  SessionListItem,
} from "./firestore.js";
import type { RuntimeWorkflowControlPlaneSummary } from "./runtime-workflow-control-plane.js";

export type RuntimeCaseWikiBuilderParams = {
  sessions: SessionListItem[];
  runs: RunListItem[];
  approvals: ApprovalRecord[];
  recentEvents: EventListItem[];
  selectedEvents: EventListItem[];
  selectedSessionId?: string | null;
  workflowSummary?: RuntimeWorkflowControlPlaneSummary | null;
  userId?: string | null;
  now?: Date;
};

type RuntimeCaseWikiContext = {
  selectedSession: SessionListItem;
  selectedRun: RunListItem | null;
  selectedApproval: ApprovalRecord | null;
  selectedEvents: EventListItem[];
  latestEvent: EventListItem | null;
  workflowSummary: RuntimeWorkflowControlPlaneSummary | null;
  caseId: string;
  generatedAt: string;
  userId: string | null;
};

type RuntimeCaseWikiEntitySeed = {
  id: string;
  kind: CaseWikiEntityKind;
  label: string;
  role?: string | null;
  description?: string | null;
  confidence?: number | null;
  sourceRefs?: string[];
};

type RuntimeCaseWikiProofSeed = {
  id: string;
  statement: string;
  status: CaseWikiProofStatus;
  confidence?: number | null;
  evidenceSummary?: string | null;
  contradictionNote?: string | null;
  sourceRefs?: string[];
};

type RuntimeCaseWikiQuestionSeed = {
  id: string;
  question: string;
  priority: CaseWikiPriority;
  blocking: boolean;
  owner?: string | null;
  suggestedNextStep?: string | null;
  sourceRefs?: string[];
};

type RuntimeCaseWikiTimelineSeed = {
  id: string;
  kind: CaseWikiTimelineEntryKind;
  ts: string;
  title: string;
  summary: string;
  status?: string | null;
  sourceRefs?: string[];
};

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSentenceCase(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return value[0].toUpperCase() + value.slice(1);
}

function toReadableToken(value: string | null): string | null {
  const normalized = toNonEmptyString(value);
  if (!normalized) {
    return null;
  }
  return toSentenceCase(normalized.replace(/[_-]+/g, " "));
}

function sortDescByIso<T>(items: readonly T[], selector: (item: T) => string | null | undefined): T[] {
  return [...items].sort((left, right) => {
    const leftIso = selector(left) ?? "";
    const rightIso = selector(right) ?? "";
    if (leftIso === rightIso) {
      return 0;
    }
    return leftIso > rightIso ? -1 : 1;
  });
}

function buildSourceRef(prefix: string, value: string | null): string[] {
  const normalized = toNonEmptyString(value);
  return normalized ? [`${prefix}:${normalized}`] : [];
}

function deriveWorkflowSummary(
  selectedSessionId: string,
  workflowSummary: RuntimeWorkflowControlPlaneSummary | null | undefined,
): RuntimeWorkflowControlPlaneSummary | null {
  if (!workflowSummary) {
    return null;
  }
  if (workflowSummary.workflowSessionId === null) {
    return workflowSummary;
  }
  return workflowSummary.workflowSessionId === selectedSessionId ? workflowSummary : null;
}

function deriveSelectedSession(
  sessions: SessionListItem[],
  selectedSessionId: string | null,
): SessionListItem | null {
  const sortedSessions = sortDescByIso(sessions, (item) => item.updatedAt);
  if (selectedSessionId) {
    return sortedSessions.find((item) => item.sessionId === selectedSessionId) ?? null;
  }
  return sortedSessions[0] ?? null;
}

function collectSelectedEvents(
  selectedSessionId: string,
  selectedEvents: EventListItem[],
  recentEvents: EventListItem[],
): EventListItem[] {
  const fromSelected = selectedEvents.filter((item) => item.sessionId === selectedSessionId);
  if (fromSelected.length > 0) {
    return sortDescByIso(fromSelected, (item) => item.createdAt);
  }
  return sortDescByIso(
    recentEvents.filter((item) => item.sessionId === selectedSessionId),
    (item) => item.createdAt,
  );
}

function deriveCaseId(params: {
  selectedSession: SessionListItem;
  workflowSummary: RuntimeWorkflowControlPlaneSummary | null;
}): string {
  const workflowCaseId =
    toNonEmptyString(params.workflowSummary?.workflowFollowUpCaseId) ??
    toNonEmptyString(params.workflowSummary?.workflowHandoffCaseId);
  if (workflowCaseId) {
    return workflowCaseId;
  }
  return params.selectedSession.sessionId;
}

function buildCustomerGoal(context: RuntimeCaseWikiContext): string | null {
  const bookingTopic = toNonEmptyString(context.workflowSummary?.workflowBookingTopic);
  if (bookingTopic) {
    return bookingTopic;
  }
  const followUpIntent = toReadableToken(context.workflowSummary?.workflowFollowUpIntent ?? null);
  if (followUpIntent) {
    return `${followUpIntent} follow-up`;
  }
  const handoffIntent = toReadableToken(context.workflowSummary?.workflowHandoffIntent ?? null);
  if (handoffIntent) {
    return `${handoffIntent} handoff`;
  }
  const latestIntent = toReadableToken(context.latestEvent?.intent ?? null);
  if (latestIntent) {
    return `${latestIntent} request`;
  }
  return null;
}

function deriveOverviewStatus(context: RuntimeCaseWikiContext): CaseWikiStatus {
  const latestApprovalStatus = toNonEmptyString(context.selectedApproval?.status);
  const workflowExecutionStatus = toNonEmptyString(context.workflowSummary?.workflowExecutionStatus)?.toLowerCase();
  const followUpStatus = toNonEmptyString(context.workflowSummary?.workflowFollowUpStatus)?.toLowerCase();
  const handoffStatus = toNonEmptyString(context.workflowSummary?.workflowHandoffStatus)?.toLowerCase();
  const missingItems = context.workflowSummary?.workflowFollowUpMissingItemsCount ?? null;

  if (
    latestApprovalStatus === "rejected" ||
    workflowExecutionStatus === "blocked" ||
    workflowExecutionStatus === "failed" ||
    followUpStatus === "blocked" ||
    handoffStatus === "blocked"
  ) {
    return "blocked";
  }
  if (
    followUpStatus === "submitted" ||
    followUpStatus === "resolved" ||
    followUpStatus === "completed" ||
    handoffStatus === "completed" ||
    handoffStatus === "resolved" ||
    (context.selectedSession.status === "closed" && latestApprovalStatus !== "pending" && !missingItems)
  ) {
    return "resolved";
  }
  if ((missingItems ?? 0) > 0) {
    return "waiting_on_customer";
  }
  if (latestApprovalStatus === "pending" || context.workflowSummary?.workflowActiveRole === "operator") {
    return "waiting_on_operator";
  }
  return "active";
}

function buildOverviewTitle(context: RuntimeCaseWikiContext): string {
  const destinationCountry =
    toNonEmptyString(context.workflowSummary?.workflowFollowUpDestinationCountry) ??
    toNonEmptyString(context.workflowSummary?.workflowHandoffDestinationCountry);
  if (destinationCountry) {
    return `Case ${context.caseId} for ${destinationCountry}`;
  }
  const routeLabel = toReadableToken(context.latestEvent?.route ?? context.workflowSummary?.workflowRoute ?? null);
  if (routeLabel) {
    return `Case ${context.caseId} (${routeLabel})`;
  }
  return `Case ${context.caseId}`;
}

function buildOverviewSummary(context: RuntimeCaseWikiContext): string {
  const parts: string[] = [];
  const summaryCandidates = [
    context.workflowSummary?.workflowFollowUpSummary,
    context.workflowSummary?.workflowHandoffSummary,
    context.workflowSummary?.workflowBookingSummary,
    context.latestEvent?.verificationSummary,
    context.selectedApproval?.reason,
  ];
  for (const candidate of summaryCandidates) {
    const normalized = toNonEmptyString(candidate);
    if (normalized) {
      parts.push(normalized);
      break;
    }
  }
  const missingItems = context.workflowSummary?.workflowFollowUpMissingItemsCount ?? null;
  if ((missingItems ?? 0) > 0) {
    parts.push(`${missingItems} required follow-up item${missingItems === 1 ? "" : "s"} still missing.`);
  }
  if (context.selectedApproval?.status === "pending") {
    parts.push("Operator approval is still pending.");
  } else if (context.selectedApproval?.status === "rejected") {
    parts.push("Latest operator approval rejected the current step.");
  }
  if (parts.length === 0) {
    const sessionMode = toReadableToken(context.selectedSession.mode);
    const sessionStatus = toReadableToken(context.selectedSession.status);
    return `${sessionMode ?? "Session"} is currently ${sessionStatus?.toLowerCase() ?? "active"}.`;
  }
  return parts.join(" ");
}

function buildMissingEvidenceSummary(context: RuntimeCaseWikiContext): string | null {
  const missingItems = context.workflowSummary?.workflowFollowUpMissingItemsCount ?? null;
  if ((missingItems ?? 0) > 0) {
    return `${missingItems} required follow-up item${missingItems === 1 ? "" : "s"} still missing.`;
  }
  return null;
}

function buildContradictionsSummary(context: RuntimeCaseWikiContext): string | null {
  if (context.selectedApproval?.status === "rejected") {
    return toNonEmptyString(context.selectedApproval.reason) ?? "Latest operator approval rejected the current step.";
  }
  return null;
}

function buildEntities(context: RuntimeCaseWikiContext): CaseWikiEntity[] {
  const entities: RuntimeCaseWikiEntitySeed[] = [
    {
      id: `case:${context.caseId}`,
      kind: "case",
      label: `Case ${context.caseId}`,
      role: "active_case",
      description:
        toNonEmptyString(context.workflowSummary?.workflowFollowUpSummary) ??
        toNonEmptyString(context.workflowSummary?.workflowHandoffSummary),
      confidence: 1,
      sourceRefs: buildSourceRef("case", context.caseId),
    },
  ];

  const destinationCountry =
    toNonEmptyString(context.workflowSummary?.workflowFollowUpDestinationCountry) ??
    toNonEmptyString(context.workflowSummary?.workflowHandoffDestinationCountry);
  if (destinationCountry) {
    entities.push({
      id: `location:${destinationCountry.toLowerCase()}`,
      kind: "location",
      label: destinationCountry,
      role: "destination_country",
      description: "Primary destination or jurisdiction for the active case.",
      confidence: 0.96,
      sourceRefs: ["workflow:control-plane"],
    });
  }

  const assignedOwner = toNonEmptyString(context.workflowSummary?.workflowHandoffAssignedOwner);
  if (assignedOwner) {
    entities.push({
      id: `person:${assignedOwner.toLowerCase()}`,
      kind: "person",
      label: assignedOwner,
      role: "assigned_owner",
      description: "Workflow owner currently associated with the handoff lane.",
      confidence: 0.9,
      sourceRefs: ["workflow:control-plane"],
    });
  }

  const route = toNonEmptyString(context.workflowSummary?.workflowRoute) ?? toNonEmptyString(context.latestEvent?.route);
  if (route) {
    entities.push({
      id: `system:${route}`,
      kind: "system",
      label: toReadableToken(route) ?? route,
      role: "active_route",
      description: "Current runtime route contributing the latest case evidence.",
      confidence: 0.88,
      sourceRefs: buildSourceRef("event", context.latestEvent?.eventId ?? null),
    });
  }

  const uniqueEntities = new Map<string, CaseWikiEntity>();
  for (const entity of entities) {
    uniqueEntities.set(entity.id, {
      id: entity.id,
      kind: entity.kind,
      label: entity.label,
      role: entity.role ?? null,
      description: entity.description ?? null,
      confidence: entity.confidence ?? null,
      sourceRefs: [...new Set(entity.sourceRefs ?? [])],
    });
  }
  return [...uniqueEntities.values()];
}

function isCaseWikiNoteEvent(event: EventListItem): boolean {
  if (event.type === "operator.note") {
    return true;
  }
  const payload = isRecord(event.payload) ? event.payload : null;
  const metadata = isRecord(event.metadata) ? event.metadata : null;
  return payload?.kind === "case_wiki_note" || metadata?.kind === "case_wiki_note";
}

function buildOperatorNoteTimelineEntries(context: RuntimeCaseWikiContext): RuntimeCaseWikiTimelineSeed[] {
  return sortDescByIso(
    context.selectedEvents.filter((item) => isCaseWikiNoteEvent(item)),
    (item) => item.createdAt,
  ).map((event) => {
    const payload = isRecord(event.payload) ? event.payload : null;
    const title = toNonEmptyString(payload?.title) ?? "Operator note";
    const note = toNonEmptyString(payload?.note) ?? "Operator note captured for the case.";
    const priority = toNonEmptyString(payload?.priority);
    return {
      id: `event:${event.eventId}`,
      kind: "operator_note",
      ts: event.createdAt,
      title,
      summary: note,
      status: priority ?? event.status ?? null,
      sourceRefs: buildSourceRef("event", event.eventId),
    };
  });
}

function buildTimeline(context: RuntimeCaseWikiContext): CaseWikiTimelineEntry[] {
  const timelineSeeds: RuntimeCaseWikiTimelineSeed[] = [];

  timelineSeeds.push({
    id: `session:${context.selectedSession.sessionId}`,
    kind: "session",
    ts: context.selectedSession.updatedAt,
    title: `Session ${context.selectedSession.status}`,
    summary:
      toNonEmptyString(context.latestEvent?.verificationSummary) ??
      `Latest ${context.selectedSession.mode} session state recorded for this case.`,
    status: context.selectedSession.status,
    sourceRefs: buildSourceRef("session", context.selectedSession.sessionId),
  });

  if (context.selectedRun) {
    timelineSeeds.push({
      id: `run:${context.selectedRun.runId}`,
      kind: "task",
      ts: context.selectedRun.updatedAt,
      title: `Run ${context.selectedRun.runId}`,
      summary: `${toReadableToken(context.selectedRun.route ?? null) ?? "Workflow"} is ${context.selectedRun.status}.`,
      status: context.selectedRun.status,
      sourceRefs: buildSourceRef("run", context.selectedRun.runId),
    });
  }

  if (context.workflowSummary?.workflowUpdatedAt) {
    timelineSeeds.push({
      id: "workflow:control-plane",
      kind: "workflow",
      ts: context.workflowSummary.workflowUpdatedAt,
      title: `Workflow ${toReadableToken(context.workflowSummary.workflowExecutionStatus ?? null) ?? "update"}`,
      summary:
        toNonEmptyString(context.workflowSummary.workflowFollowUpSummary) ??
        toNonEmptyString(context.workflowSummary.workflowHandoffSummary) ??
        toNonEmptyString(context.workflowSummary.workflowReason) ??
        "Workflow control plane recorded a new case state.",
      status: context.workflowSummary.workflowExecutionStatus,
      sourceRefs: ["workflow:control-plane"],
    });
  }

  if (context.latestEvent) {
    timelineSeeds.push({
      id: `event:${context.latestEvent.eventId}`,
      kind: "system",
      ts: context.latestEvent.createdAt,
      title: `${toReadableToken(context.latestEvent.source) ?? "Runtime"} event`,
      summary:
        toNonEmptyString(context.latestEvent.verificationSummary) ??
        toNonEmptyString(context.latestEvent.liveTransportFallbackReason) ??
        `${toReadableToken(context.latestEvent.route ?? null) ?? "Route"} reported ${
          toReadableToken(context.latestEvent.status ?? null)?.toLowerCase() ?? "an update"
        }.`,
      status: context.latestEvent.status ?? null,
      sourceRefs: buildSourceRef("event", context.latestEvent.eventId),
    });
  }

  for (const approval of sortDescByIso(
    context.selectedApproval ? [context.selectedApproval] : [],
    (item) => item.updatedAt,
  )) {
    timelineSeeds.push({
      id: `approval:${approval.approvalId}`,
      kind: "approval",
      ts: approval.updatedAt,
      title: `Approval ${approval.status}`,
      summary: toNonEmptyString(approval.reason) ?? "Operator approval state changed.",
      status: approval.status,
      sourceRefs: buildSourceRef("approval", approval.approvalId),
    });
  }

  timelineSeeds.push(...buildOperatorNoteTimelineEntries(context));

  return sortDescByIso(timelineSeeds, (item) => item.ts).map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    ts: entry.ts,
    title: entry.title,
    summary: entry.summary,
    status: entry.status ?? null,
    sourceRefs: [...new Set(entry.sourceRefs ?? [])],
  }));
}

function buildProofs(context: RuntimeCaseWikiContext): CaseWikiProof[] {
  const proofs: RuntimeCaseWikiProofSeed[] = [];
  const missingItems = context.workflowSummary?.workflowFollowUpMissingItemsCount ?? null;

  if ((missingItems ?? 0) > 0) {
    proofs.push({
      id: "proof:followup-completeness",
      statement: "Follow-up package is complete.",
      status: "missing",
      confidence: 0.92,
      evidenceSummary: `${missingItems} required follow-up item${missingItems === 1 ? "" : "s"} still missing.`,
      contradictionNote: null,
      sourceRefs: ["workflow:control-plane"],
    });
  }

  if (context.workflowSummary?.workflowHandoffReady === true) {
    proofs.push({
      id: "proof:handoff-ready",
      statement: "Handoff package is ready for transfer.",
      status: "confirmed",
      confidence: 0.94,
      evidenceSummary:
        toNonEmptyString(context.workflowSummary.workflowHandoffSummary) ?? "Workflow marked the handoff as ready.",
      contradictionNote: null,
      sourceRefs: ["workflow:control-plane"],
    });
  }

  if (context.selectedApproval) {
    const approvalStatus = context.selectedApproval.status;
    proofs.push({
      id: `proof:approval:${context.selectedApproval.approvalId}`,
      statement: "Current operator approval is cleared.",
      status:
        approvalStatus === "approved"
          ? "confirmed"
          : approvalStatus === "rejected"
            ? "contradicted"
            : "pending",
      confidence: 0.95,
      evidenceSummary: toNonEmptyString(context.selectedApproval.reason),
      contradictionNote:
        approvalStatus === "rejected"
          ? toNonEmptyString(context.selectedApproval.reason) ?? "Latest approval rejected the current step."
          : null,
      sourceRefs: buildSourceRef("approval", context.selectedApproval.approvalId),
    });
  }

  if (context.latestEvent?.verificationState === "verified") {
    proofs.push({
      id: `proof:event:${context.latestEvent.eventId}`,
      statement: "Latest runtime verification passed.",
      status: "confirmed",
      confidence: 0.86,
      evidenceSummary:
        toNonEmptyString(context.latestEvent.verificationSummary) ?? "Runtime marked the latest event as verified.",
      contradictionNote: null,
      sourceRefs: buildSourceRef("event", context.latestEvent.eventId),
    });
  }

  return proofs.map((proof) => ({
    id: proof.id,
    statement: proof.statement,
    status: proof.status,
    confidence: proof.confidence ?? null,
    evidenceSummary: proof.evidenceSummary ?? null,
    contradictionNote: proof.contradictionNote ?? null,
    sourceRefs: [...new Set(proof.sourceRefs ?? [])],
  }));
}

function buildOpenQuestions(context: RuntimeCaseWikiContext): CaseWikiOpenQuestion[] {
  const questions: RuntimeCaseWikiQuestionSeed[] = [];
  const missingItems = context.workflowSummary?.workflowFollowUpMissingItemsCount ?? null;

  if ((missingItems ?? 0) > 0) {
    questions.push({
      id: "question:missing-followup-items",
      question: `Which ${missingItems} missing follow-up item${missingItems === 1 ? "" : "s"} should the customer send next?`,
      priority: "high",
      blocking: true,
      owner: "customer",
      suggestedNextStep:
        toNonEmptyString(context.workflowSummary?.workflowFollowUpNextStep) ??
        "Request the missing follow-up materials from the customer.",
      sourceRefs: ["workflow:control-plane"],
    });
  }

  if (context.selectedApproval?.status === "pending") {
    questions.push({
      id: `question:approval:${context.selectedApproval.approvalId}`,
      question: "Who should resolve the pending operator approval?",
      priority: "high",
      blocking: true,
      owner: "operator",
      suggestedNextStep: toNonEmptyString(context.selectedApproval.reason) ?? "Review the pending approval and decide.",
      sourceRefs: buildSourceRef("approval", context.selectedApproval.approvalId),
    });
  }

  const workflowNextStep =
    toNonEmptyString(context.workflowSummary?.workflowFollowUpNextStep) ??
    toNonEmptyString(context.workflowSummary?.workflowHandoffNextStep);
  if (workflowNextStep && questions.length === 0) {
    questions.push({
      id: "question:next-step-confirmation",
      question: "Is the recommended workflow next step still correct?",
      priority: "medium",
      blocking: false,
      owner: toNonEmptyString(context.workflowSummary?.workflowActiveRole) ?? "operator",
      suggestedNextStep: workflowNextStep,
      sourceRefs: ["workflow:control-plane"],
    });
  }

  const operatorNoteQuestions = sortDescByIso(
    context.selectedEvents.filter((item) => isCaseWikiNoteEvent(item)),
    (item) => item.createdAt,
  );
  for (const event of operatorNoteQuestions) {
    const payload = isRecord(event.payload) ? event.payload : null;
    if (!payload || payload.blocking !== true) {
      continue;
    }
    const note = toNonEmptyString(payload.note);
    if (!note) {
      continue;
    }
    questions.push({
      id: `question:event:${event.eventId}`,
      question: note,
      priority:
        payload.priority === "low" || payload.priority === "high" || payload.priority === "medium"
          ? payload.priority
          : "medium",
      blocking: true,
      owner: toNonEmptyString(payload.owner) ?? "operator",
      suggestedNextStep: toNonEmptyString(payload.suggestedNextStep),
      sourceRefs: buildSourceRef("event", event.eventId),
    });
  }

  return questions.map((question) => ({
    id: question.id,
    question: question.question,
    priority: question.priority,
    blocking: question.blocking,
    owner: question.owner ?? null,
    suggestedNextStep: question.suggestedNextStep ?? null,
    sourceRefs: [...new Set(question.sourceRefs ?? [])],
  }));
}

function buildRecommendedNextAction(context: RuntimeCaseWikiContext, openQuestions: CaseWikiOpenQuestion[]): CaseWikiNextAction | null {
  const missingItems = context.workflowSummary?.workflowFollowUpMissingItemsCount ?? null;
  if (context.selectedApproval?.status === "pending") {
    return {
      type: "approval_request",
      title: "Resolve pending approval",
      summary:
        toNonEmptyString(context.selectedApproval.reason) ?? "Pending approval is currently blocking the case.",
      owner: "operator",
      dueBy: context.selectedApproval.hardDueAt,
      blocking: true,
      relatedQuestionIds: openQuestions
        .filter((item) => item.id === `question:approval:${context.selectedApproval?.approvalId}`)
        .map((item) => item.id),
      sourceRefs: buildSourceRef("approval", context.selectedApproval.approvalId),
    };
  }
  if ((missingItems ?? 0) > 0) {
    return {
      type: "document_request",
      title: "Request missing follow-up items",
      summary:
        toNonEmptyString(context.workflowSummary?.workflowFollowUpNextStep) ??
        `${missingItems} required follow-up item${missingItems === 1 ? "" : "s"} still need customer input.`,
      owner: "customer",
      dueBy: null,
      blocking: true,
      relatedQuestionIds: openQuestions
        .filter((item) => item.id === "question:missing-followup-items")
        .map((item) => item.id),
      sourceRefs: ["workflow:control-plane"],
    };
  }
  const workflowNextStep =
    toNonEmptyString(context.workflowSummary?.workflowFollowUpNextStep) ??
    toNonEmptyString(context.workflowSummary?.workflowHandoffNextStep);
  if (workflowNextStep) {
    return {
      type: "workflow_resume",
      title: "Resume workflow follow-through",
      summary: workflowNextStep,
      owner: toNonEmptyString(context.workflowSummary?.workflowActiveRole),
      dueBy: null,
      blocking: false,
      relatedQuestionIds: openQuestions.map((item) => item.id),
      sourceRefs: ["workflow:control-plane"],
    };
  }
  if (context.selectedSession.mode === "live") {
    return {
      type: "live_followup",
      title: "Continue live case follow-up",
      summary: "Re-open the live lane and confirm the next customer-facing step.",
      owner: "operator",
      dueBy: null,
      blocking: false,
      relatedQuestionIds: openQuestions.map((item) => item.id),
      sourceRefs: buildSourceRef("session", context.selectedSession.sessionId),
    };
  }
  return {
    type: "operator_followup",
    title: "Review the latest case evidence",
    summary: "Inspect the compiled case state and confirm the next operator action.",
    owner: "operator",
    dueBy: null,
    blocking: false,
    relatedQuestionIds: openQuestions.map((item) => item.id),
    sourceRefs: buildSourceRef("session", context.selectedSession.sessionId),
  };
}

function selectTopProof(proofs: CaseWikiProof[]): CaseWikiProof | null {
  return (
    proofs.find((item) => item.status === "missing") ??
    proofs.find((item) => item.status === "confirmed") ??
    proofs[0] ??
    null
  );
}

function selectTopEntity(entities: CaseWikiEntity[]): CaseWikiEntity | null {
  return entities.find((item) => toNonEmptyString(item.kind) !== "case") ?? entities[0] ?? null;
}

function selectTopBlockingQuestion(openQuestions: CaseWikiOpenQuestion[]): CaseWikiOpenQuestion | null {
  return openQuestions.find((item) => item.blocking === true) ?? openQuestions[0] ?? null;
}

function buildEvidencePack(params: {
  proofs: CaseWikiProof[];
  entities: CaseWikiEntity[];
  openQuestions: CaseWikiOpenQuestion[];
}) {
  const proofPriority = new Map<CaseWikiProofStatus, number>([
    ["missing", 0],
    ["contradicted", 1],
    ["pending", 2],
    ["confirmed", 3],
  ]);
  const questionPriority = new Map<CaseWikiPriority, number>([
    ["high", 0],
    ["medium", 1],
    ["low", 2],
  ]);
  const proofs = [...params.proofs]
    .sort((left, right) => {
      const leftScore = proofPriority.get(left.status) ?? 99;
      const rightScore = proofPriority.get(right.status) ?? 99;
      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }
      return (right.confidence ?? 0) - (left.confidence ?? 0);
    })
    .slice(0, 3);
  const entities = [...params.entities]
    .sort((left, right) => {
      const leftCase = toNonEmptyString(left.kind) === "case" ? 1 : 0;
      const rightCase = toNonEmptyString(right.kind) === "case" ? 1 : 0;
      if (leftCase !== rightCase) {
        return leftCase - rightCase;
      }
      return (right.confidence ?? 0) - (left.confidence ?? 0);
    })
    .slice(0, 3);
  const questions = [...params.openQuestions]
    .sort((left, right) => {
      if (left.blocking !== right.blocking) {
        return left.blocking ? -1 : 1;
      }
      const leftScore = questionPriority.get(left.priority) ?? 99;
      const rightScore = questionPriority.get(right.priority) ?? 99;
      return leftScore - rightScore;
    })
    .slice(0, 3);
  const sourceRefs = [...new Set([
    ...proofs.flatMap((item) => item.sourceRefs ?? []),
    ...entities.flatMap((item) => item.sourceRefs ?? []),
    ...questions.flatMap((item) => item.sourceRefs ?? []),
  ])].slice(0, 12);
  return {
    proofs,
    entities,
    questions,
    sourceRefs,
  };
}

function buildContext(params: RuntimeCaseWikiBuilderParams): RuntimeCaseWikiContext | null {
  const requestedSessionId = toNonEmptyString(params.selectedSessionId ?? null);
  const selectedSession = deriveSelectedSession(params.sessions, requestedSessionId);
  if (!selectedSession) {
    return null;
  }

  const selectedRun =
    sortDescByIso(
      params.runs.filter((item) => item.sessionId === selectedSession.sessionId),
      (item) => item.updatedAt,
    )[0] ?? null;
  const selectedApproval =
    sortDescByIso(
      params.approvals.filter((item) => item.sessionId === selectedSession.sessionId),
      (item) => item.updatedAt,
    )[0] ?? null;
  const selectedEvents = collectSelectedEvents(selectedSession.sessionId, params.selectedEvents, params.recentEvents);
  const latestEvent = selectedEvents[0] ?? null;
  const workflowSummary = deriveWorkflowSummary(selectedSession.sessionId, params.workflowSummary ?? null);

  return {
    selectedSession,
    selectedRun,
    selectedApproval,
    selectedEvents,
    latestEvent,
    workflowSummary,
    caseId: deriveCaseId({
      selectedSession,
      workflowSummary,
    }),
    generatedAt: (params.now ?? new Date()).toISOString(),
    userId: toNonEmptyString(params.userId ?? null),
  };
}

export function buildRuntimeCaseWiki(params: RuntimeCaseWikiBuilderParams): CaseWiki | null {
  const context = buildContext(params);
  if (!context) {
    return null;
  }

  const entities = buildEntities(context);
  const timeline = buildTimeline(context);
  const proofs = buildProofs(context);
  const openQuestions = buildOpenQuestions(context);
  const recommendedNextAction = buildRecommendedNextAction(context, openQuestions);
  const evidencePack = buildEvidencePack({
    proofs,
    entities,
    openQuestions,
  });

  return {
    schemaVersion: 1,
    caseId: context.caseId,
    sessionId: context.selectedSession.sessionId,
    userId: context.userId,
    generatedAt: context.generatedAt,
    overview: {
      title: buildOverviewTitle(context),
      summary: buildOverviewSummary(context),
      status: deriveOverviewStatus(context),
      customerGoal: buildCustomerGoal(context),
      currentStage:
        toNonEmptyString(context.workflowSummary?.workflowCurrentStage) ??
        toNonEmptyString(context.latestEvent?.route ?? null) ??
        toNonEmptyString(context.latestEvent?.intent ?? null) ??
        context.selectedSession.mode,
      lastMeaningfulUpdateAt:
        sortDescByIso(
          [
            context.selectedSession.updatedAt,
            context.selectedRun?.updatedAt ?? null,
            context.selectedApproval?.updatedAt ?? null,
            context.latestEvent?.createdAt ?? null,
            context.workflowSummary?.workflowUpdatedAt ?? null,
          ].filter((item): item is string => Boolean(item)),
          (item) => item,
        )[0] ?? null,
      activeLanguage: null,
      missingEvidenceSummary: buildMissingEvidenceSummary(context),
      contradictionsSummary: buildContradictionsSummary(context),
    },
    highlights: {
      topProof: selectTopProof(proofs),
      topEntity: selectTopEntity(entities),
      topBlockingQuestion: selectTopBlockingQuestion(openQuestions),
    },
    evidencePack,
    entities,
    timeline,
    proofs,
    openQuestions,
    recommendedNextAction,
  };
}
