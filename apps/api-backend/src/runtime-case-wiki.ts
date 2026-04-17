import type {
  CaseWikiActionPack,
  CaseWikiActionPackItem,
  CaseWikiAuditEntry,
  CaseWiki,
  CaseWikiComplianceArtifactEntry,
  CaseWikiComplianceArtifactSummary,
  CaseWikiComplianceSummary,
  CaseWikiCostSummary,
  CaseWikiDetailBadge,
  CaseWikiDefaultFocus,
  CaseWikiDetailPack,
  CaseWikiDetailPackItem,
  CaseWikiEntity,
  CaseWikiEntityKind,
  CaseWikiNextAction,
  CaseWikiOpenQuestion,
  CaseWikiPriority,
  CaseWikiProof,
  CaseWikiProofStatus,
  CaseWikiHandoffPack,
  CaseWikiHandoffPackItem,
  CaseWikiFocusPack,
  CaseWikiFocusPackItem,
  CaseWikiOperatorPreviewPack,
  CaseWikiOperatorRemediationPreview,
  CaseWikiPreviewPack,
  CaseWikiRemediationDraft,
  CaseWikiWorkspacePack,
  CaseWikiRoutingActionId,
  CaseWikiRoutingCTA,
  CaseWikiRoutingLane,
  CaseWikiRoutingPack,
  CaseWikiRoutingPackItem,
  CaseWikiRoutingRoute,
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
import {
  buildRuntimeEvidenceSigningPosture,
  signEvidencePayload,
  type RuntimeEvidenceSignerConfig,
} from "./runtime-evidence-signer.js";
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
  evidenceSigner?: RuntimeEvidenceSignerConfig | null;
  costSummary?: CaseWikiCostSummary | null;
  compliance?: {
    templateId: "baseline" | "strict" | "regulated";
    requestedTemplateId: string;
    fallbackApplied: boolean;
    source: "template_default" | "tenant_override";
    controls: {
      piiRedactionLevel: "standard" | "high";
      crossTenantAdminOnly: boolean;
      approvalSlaEnforced: boolean;
      auditTrailRequired: boolean;
    };
    retention: {
      rawMediaDays: number;
      auditLogsDays: number;
      eventsDays: number;
      sessionsDays: number;
    };
  } | null;
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

type RuntimeCaseWikiArtifactRefSeed = {
  ref: string;
  source: CaseWikiComplianceArtifactEntry["source"];
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

function buildSourceRefs(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((item) => toNonEmptyString(item)).filter((item): item is string => Boolean(item)))];
}

function extractAdditionalSourceRefs(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }
  const sourceRefs = Array.isArray(value.sourceRefs)
    ? value.sourceRefs.map((item) => toNonEmptyString(item)).filter((item): item is string => Boolean(item))
    : [];
  const artifactRefs = Array.isArray(value.artifactRefs)
    ? value.artifactRefs.map((item) => toNonEmptyString(item)).filter((item): item is string => Boolean(item))
    : [];
  return buildSourceRefs([...sourceRefs, ...artifactRefs]);
}

function buildEventSourceRefs(event: EventListItem): string[] {
  return buildSourceRefs([
    ...buildSourceRef("event", event.eventId),
    ...extractAdditionalSourceRefs(event.payload),
    ...extractAdditionalSourceRefs(event.metadata),
  ]);
}

function isRawLikeSourceRef(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("artifact:raw:")) {
    return true;
  }
  const prefix = normalized.split(":", 1)[0] ?? normalized;
  return ["file", "screenshot", "video", "audio", "blob", "raw", "raw_media"].includes(prefix);
}

function isRedactedArtifactRef(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("artifact:redacted:") ||
    normalized.startsWith("artifact:sanitized:") ||
    /(^|[:/_-])(redacted|sanitized)([:/_.-]|$)/.test(normalized)
  );
}

function isSignedArtifactRef(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("artifact:signed:");
}

function pushArtifactRefSeed(
  target: RuntimeCaseWikiArtifactRefSeed[],
  seen: Set<string>,
  value: unknown,
  source: RuntimeCaseWikiArtifactRefSeed["source"],
  options: { allowAnyRef?: boolean } = {},
): void {
  const normalized = toNonEmptyString(value);
  if (!normalized) {
    return;
  }
  if (source === "source_ref" && !options.allowAnyRef && !isRawLikeSourceRef(normalized) && !isRedactedArtifactRef(normalized) && !isSignedArtifactRef(normalized)) {
    return;
  }
  const dedupeKey = `${source}:${normalized}`;
  if (seen.has(dedupeKey)) {
    return;
  }
  seen.add(dedupeKey);
  target.push({
    ref: normalized,
    source,
  });
}

function collectArtifactRefSeedsFromValue(
  value: unknown,
  target: RuntimeCaseWikiArtifactRefSeed[],
  seen: Set<string>,
  depth = 0,
): void {
  if (depth > 6 || value === null || value === undefined) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectArtifactRefSeedsFromValue(item, target, seen, depth + 1);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === "sourceRefs") {
      if (Array.isArray(entry)) {
        for (const item of entry) {
          pushArtifactRefSeed(target, seen, item, "source_ref");
        }
      } else {
        pushArtifactRefSeed(target, seen, entry, "source_ref");
      }
      continue;
    }

    if (key === "artifactRefs" || key === "evidenceRefs") {
      if (Array.isArray(entry)) {
        for (const item of entry) {
          pushArtifactRefSeed(target, seen, item, "artifact_ref", { allowAnyRef: true });
        }
      } else {
        pushArtifactRefSeed(target, seen, entry, "artifact_ref", { allowAnyRef: true });
      }
      continue;
    }

    if (
      key === "screenshotRefs" ||
      key === "actualScreenshotRefs" ||
      key === "traceArtifactRefs" ||
      key === "checkpointArtifactRefs" ||
      key === "resultArtifactRefs" ||
      key === "diff"
    ) {
      const seedSource =
        key === "traceArtifactRefs" || key === "checkpointArtifactRefs" || key === "resultArtifactRefs"
          ? "replay_artifact"
          : key === "diff"
            ? "artifact_ref"
            : "screenshot_ref";
      if (Array.isArray(entry)) {
        for (const item of entry) {
          pushArtifactRefSeed(target, seen, item, seedSource, { allowAnyRef: true });
        }
      } else {
        pushArtifactRefSeed(target, seen, entry, seedSource, { allowAnyRef: true });
      }
      continue;
    }

    if (key === "baseline" || key === "baselineScreenshotRef") {
      pushArtifactRefSeed(target, seen, entry, "screenshot_ref", { allowAnyRef: true });
      continue;
    }

    if (key === "latestCheckpointRef" || key === "latestResultRef" || key === "latestScreenshotRef") {
      pushArtifactRefSeed(target, seen, entry, "replay_artifact", { allowAnyRef: true });
      continue;
    }

    collectArtifactRefSeedsFromValue(entry, target, seen, depth + 1);
  }
}

function buildCaseWikiArtifactRefSeeds(params: {
  sourceRefs: string[];
  selectedEvents: EventListItem[];
  expectedSignatureStatus: "signed" | "unsigned";
}): RuntimeCaseWikiArtifactRefSeed[] {
  const seeds: RuntimeCaseWikiArtifactRefSeed[] = [];
  const seen = new Set<string>();

  for (const sourceRef of params.sourceRefs) {
    pushArtifactRefSeed(seeds, seen, sourceRef, "source_ref");
  }

  for (const event of params.selectedEvents) {
    collectArtifactRefSeedsFromValue(event.payload, seeds, seen);
    collectArtifactRefSeedsFromValue(event.metadata, seeds, seen);
  }

  if (params.expectedSignatureStatus === "signed") {
    pushArtifactRefSeed(seeds, seen, "case_wiki:evidence_signature", "case_wiki_signature", { allowAnyRef: true });
  }

  return seeds;
}

function buildCaseWikiArtifactPostureSummary(params: {
  sourceRefs: string[];
  selectedEvents: EventListItem[];
  expectedSignatureStatus: "signed" | "unsigned";
}): CaseWikiComplianceArtifactSummary {
  const seeds = buildCaseWikiArtifactRefSeeds(params);
  const items: CaseWikiComplianceArtifactEntry[] = [];
  const dedupe = new Map<string, CaseWikiComplianceArtifactEntry>();

  for (const seed of seeds) {
    let posture: CaseWikiComplianceArtifactEntry["posture"] | null = null;
    let blocking = false;
    let summary: string | null = null;

    if (seed.source === "case_wiki_signature") {
      posture = "signed";
      summary = "Repo-owned Case Wiki evidence signature is available for export.";
    } else if (isSignedArtifactRef(seed.ref)) {
      posture = "signed";
      summary = "Signed runtime artifact is available for export.";
    } else if (isRedactedArtifactRef(seed.ref)) {
      posture = "redacted";
      summary = "Redacted runtime artifact is available for operator-safe export.";
    } else if (
      isRawLikeSourceRef(seed.ref) ||
      seed.source === "artifact_ref" ||
      seed.source === "screenshot_ref" ||
      seed.source === "replay_artifact"
    ) {
      posture = "raw";
      blocking = true;
      summary = "Raw runtime artifact must be redacted before export.";
    }

    if (!posture || !summary) {
      continue;
    }

    const existing = dedupe.get(seed.ref);
    if (existing) {
      if (!existing.blocking && blocking) {
        existing.blocking = true;
        existing.posture = posture;
        existing.source = seed.source;
        existing.summary = summary;
      }
      continue;
    }

    dedupe.set(seed.ref, {
      ref: seed.ref,
      posture,
      source: seed.source,
      blocking,
      summary,
    });
  }

  const allItems = [...dedupe.values()].sort((left, right) => {
    const postureRank = new Map<CaseWikiComplianceArtifactEntry["posture"], number>([
      ["raw", 0],
      ["redacted", 1],
      ["signed", 2],
    ]);
    const leftRank = postureRank.get(left.posture) ?? 99;
    const rightRank = postureRank.get(right.posture) ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.ref.localeCompare(right.ref);
  });
  const ordered = allItems
    .slice(0, 12);

  return {
    totalArtifacts: allItems.length,
    rawArtifacts: allItems.filter((item) => item.posture === "raw").length,
    redactedArtifacts: allItems.filter((item) => item.posture === "redacted").length,
    signedArtifacts: allItems.filter((item) => item.posture === "signed").length,
    blockingArtifacts: allItems.filter((item) => item.blocking).length,
    blockingRefs: allItems.filter((item) => item.blocking).map((item) => item.ref).slice(0, 6),
    items: ordered,
  };
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
      sourceRefs: context.latestEvent ? buildEventSourceRefs(context.latestEvent) : [],
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
      sourceRefs: buildEventSourceRefs(event),
    };
  });
}

type RuntimeCaseWikiAuditSeed = {
  id: string;
  ts: string;
  actor?: string | null;
  source: CaseWikiAuditEntry["source"];
  action: string;
  field?: string | null;
  summary: string;
  reason?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  sourceRefs?: string[];
};

function normalizeAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return toNonEmptyString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function summarizeAuditAction(action: string): string {
  const normalized = toNonEmptyString(action);
  if (!normalized) {
    return "Case Wiki audit event recorded.";
  }
  return `${toSentenceCase(normalized.replace(/[_-]+/g, " "))}.`;
}

function buildApprovalAuditEntries(context: RuntimeCaseWikiContext): RuntimeCaseWikiAuditSeed[] {
  const approval = context.selectedApproval;
  if (!approval) {
    return [];
  }
  const auditEntries = sortDescByIso(approval.auditLog ?? [], (item) => item.ts);
  if (auditEntries.length === 0) {
    const action =
      approval.status === "approved"
        ? "decision_approved"
        : approval.status === "rejected"
          ? "decision_rejected"
          : approval.status === "pending"
            ? "pending_registered"
            : "approval_status_observed";
    return [
      {
        id: `audit:approval:${approval.approvalId}:status`,
        ts: approval.updatedAt,
        actor: "operator",
        source: "approval",
        action,
        field: "approval.status",
        summary:
          approval.status === "approved"
            ? "Operator approved the pending step."
            : approval.status === "rejected"
              ? "Operator rejected the pending step."
              : approval.status === "pending"
                ? "Approval registered for operator review."
                : "Approval status observed in the compiled case snapshot.",
        reason: toNonEmptyString(approval.reason),
        oldValue: approval.status === "pending" ? null : "pending",
        newValue: approval.status,
        sourceRefs: buildSourceRef("approval", approval.approvalId),
      },
    ];
  }

  return auditEntries.map((entry) => {
    const action = toNonEmptyString(entry.action) ?? "approval_updated";
    let field: string | null = "approval.status";
    let summary = summarizeAuditAction(action);
    let oldValue: string | null = null;
    let newValue: string | null = normalizeAuditValue(approval.status);

    if (action === "pending_registered") {
      summary = "Approval registered for operator review.";
      newValue = "pending";
    } else if (action === "decision_approved") {
      summary = "Operator approved the pending step.";
      oldValue = "pending";
      newValue = "approved";
    } else if (action === "decision_rejected") {
      summary = "Operator rejected the pending step.";
      oldValue = "pending";
      newValue = "rejected";
    } else if (action === "soft_timeout_reminder") {
      field = "approval.reminder";
      summary = "Soft-timeout reminder issued for pending approval.";
      newValue = "soft_timeout_sent";
    } else if (action === "hard_timeout_auto_reject") {
      summary = "Pending approval auto-rejected after the hard-timeout deadline.";
      oldValue = "pending";
      newValue = "rejected";
    }

    return {
      id: `audit:approval:${approval.approvalId}:${action}:${entry.ts}`,
      ts: entry.ts,
      actor: toNonEmptyString(entry.actor),
      source: "approval",
      action,
      field,
      summary,
      reason: toNonEmptyString(entry.reason),
      oldValue,
      newValue,
      sourceRefs: buildSourceRef("approval", approval.approvalId),
    };
  });
}

function buildOperatorNoteAuditEntries(context: RuntimeCaseWikiContext): RuntimeCaseWikiAuditSeed[] {
  return sortDescByIso(
    context.selectedEvents.filter((item) => isCaseWikiNoteEvent(item)),
    (item) => item.createdAt,
  ).map((event) => {
    const payload = isRecord(event.payload) ? event.payload : null;
    const note = toNonEmptyString(payload?.note) ?? "Operator note captured for the case.";
    const title = toNonEmptyString(payload?.title);
    const blocking = payload?.blocking === true;
    return {
      id: `audit:event:${event.eventId}`,
      ts: event.createdAt,
      actor: "operator",
      source: "operator_note",
      action: blocking ? "blocking_note_added" : "note_added",
      field: blocking ? "caseWiki.blockingQuestion" : "caseWiki.note",
      summary: title ? `${title}: ${note}` : note,
      reason: toNonEmptyString(payload?.suggestedNextStep),
      oldValue: null,
      newValue: note,
      sourceRefs: buildEventSourceRefs(event),
    };
  });
}

function buildWorkflowAuditEntry(context: RuntimeCaseWikiContext): RuntimeCaseWikiAuditSeed | null {
  if (!context.workflowSummary?.workflowUpdatedAt) {
    return null;
  }

  return {
    id: "audit:workflow:control-plane",
    ts: context.workflowSummary.workflowUpdatedAt,
    actor: "workflow-store",
    source: "workflow",
    action: "workflow_updated",
    field: "workflow.currentStage",
    summary:
      toNonEmptyString(context.workflowSummary.workflowFollowUpSummary) ??
      toNonEmptyString(context.workflowSummary.workflowHandoffSummary) ??
      toNonEmptyString(context.workflowSummary.workflowReason) ??
      "Workflow control plane refreshed the active case state.",
    reason: toNonEmptyString(context.workflowSummary.workflowExecutionStatus),
    oldValue: null,
    newValue:
      toNonEmptyString(context.workflowSummary.workflowCurrentStage) ??
      toNonEmptyString(context.workflowSummary.workflowExecutionStatus),
    sourceRefs: ["workflow:control-plane"],
  };
}

function buildRuntimeAuditEntry(context: RuntimeCaseWikiContext): RuntimeCaseWikiAuditSeed | null {
  if (!context.latestEvent) {
    return null;
  }
  const latestEvent = context.latestEvent;
  return {
    id: `audit:event:${latestEvent.eventId}:runtime`,
    ts: latestEvent.createdAt,
    actor: toNonEmptyString(latestEvent.source),
    source: "runtime",
    action: "runtime_event_observed",
    field:
      latestEvent.verificationState
        ? "runtime.verificationState"
        : latestEvent.status
          ? "runtime.status"
          : "runtime.event",
    summary:
      toNonEmptyString(latestEvent.verificationSummary) ??
      toNonEmptyString(latestEvent.liveTransportFallbackReason) ??
      `${toReadableToken(latestEvent.source) ?? "Runtime"} event recorded for the case.`,
    reason:
      toNonEmptyString(latestEvent.verificationFailureClass) ??
      toNonEmptyString(latestEvent.type) ??
      toNonEmptyString(latestEvent.status),
    oldValue: null,
    newValue:
      toNonEmptyString(latestEvent.verificationState) ??
      toNonEmptyString(latestEvent.status) ??
      toNonEmptyString(latestEvent.type),
    sourceRefs: buildEventSourceRefs(latestEvent),
  };
}

function buildAuditLog(context: RuntimeCaseWikiContext): CaseWikiAuditEntry[] {
  const auditSeeds: RuntimeCaseWikiAuditSeed[] = [
    ...buildApprovalAuditEntries(context),
    ...buildOperatorNoteAuditEntries(context),
  ];
  const workflowEntry = buildWorkflowAuditEntry(context);
  if (workflowEntry) {
    auditSeeds.push(workflowEntry);
  }
  const runtimeEntry = buildRuntimeAuditEntry(context);
  if (runtimeEntry) {
    auditSeeds.push(runtimeEntry);
  }
  return sortDescByIso(auditSeeds, (item) => item.ts).map((entry) => ({
    id: entry.id,
    ts: entry.ts,
    actor: toNonEmptyString(entry.actor ?? null),
    source: entry.source,
    action: entry.action,
    field: toNonEmptyString(entry.field ?? null),
    summary: entry.summary,
    reason: toNonEmptyString(entry.reason ?? null),
    oldValue: toNonEmptyString(entry.oldValue ?? null),
    newValue: toNonEmptyString(entry.newValue ?? null),
    sourceRefs: [...new Set(entry.sourceRefs ?? [])],
  }));
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
      sourceRefs: buildEventSourceRefs(context.latestEvent),
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
      sourceRefs: buildEventSourceRefs(context.latestEvent),
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
      sourceRefs: buildEventSourceRefs(event),
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

function sentenceCaseCaseWikiRoutingValue(value: string | null | undefined): string | null {
  const text = toNonEmptyString(value ?? null);
  if (!text) {
    return null;
  }
  return text
    .split(/[_\s-]+/u)
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join(" ");
}

function deriveCaseWikiRoutingLane(
  actionType: CaseWikiNextAction["type"] | null,
  owner: string | null,
  approvalRequired: boolean,
): CaseWikiRoutingLane {
  if (approvalRequired) {
    return "approval_queue";
  }
  if (actionType === "document_request" || owner === "customer") {
    return "customer_followup";
  }
  if (actionType === "workflow_resume") {
    return "workflow_resume";
  }
  if (actionType === "ui_task") {
    return "ui_task";
  }
  if (actionType === "live_followup") {
    return "live_followup";
  }
  return "operator_followup";
}

function buildCaseWikiRoutingCTA(params: {
  lane: CaseWikiRoutingLane;
  route: CaseWikiRoutingRoute;
  nextAction: CaseWikiNextAction | null;
  focusLabel: string;
}): CaseWikiRoutingCTA {
  const owner = toNonEmptyString(params.route.owner ?? null) ?? "operator";
  const dueBy = toNonEmptyString(params.route.dueBy ?? null);
  const nextActionTitle = toNonEmptyString(params.nextAction?.title ?? null);
  let actionId: CaseWikiRoutingActionId = "refresh_summary";
  let label = "Inspect operator follow-up";
  let hint = "Refresh operator state, confirm the blocker, and decide the next handoff.";
  switch (params.lane) {
    case "approval_queue":
      actionId = "open_workflow_control";
      label = "Review approval queue";
      hint = "Open workflow control, review the protected step, and confirm whether approval can be granted.";
      break;
    case "customer_followup":
      actionId = "run_negotiation";
      label = "Prepare customer follow-up";
      hint = "Use the live follow-up lane to request the missing proof and attach the focused refs.";
      break;
    case "workflow_resume":
      actionId = "open_workflow_control";
      label = "Resume workflow control";
      hint = "Open workflow control, verify the blocker is cleared, and continue the queued step.";
      break;
    case "ui_task":
      actionId = "run_ui_task";
      label = "Run UI task";
      hint = "Launch the UI executor with the focused proof or question context and verify the protected action.";
      break;
    case "live_followup":
      actionId = "run_negotiation";
      label = "Run live follow-up";
      hint = "Reopen the live follow-up lane and carry the focused handoff into the next conversation.";
      break;
    default:
      break;
  }
  const summary = [
    label,
    owner ? `owner: ${owner}` : null,
    params.route.approvalRequired === true ? "approval-ready" : null,
    params.focusLabel ? `focus: ${params.focusLabel}` : null,
    dueBy ? `due: ${dueBy}` : null,
    nextActionTitle ? `next: ${nextActionTitle}` : null,
  ].filter((item): item is string => Boolean(item)).join(" | ");
  return {
    actionId,
    label,
    hint,
    owner,
    lane: params.lane,
    approvalRequired: params.route.approvalRequired,
    blocking: params.route.blocking,
    summary,
  };
}

function buildCaseWikiRoutingPack(params: {
  evidencePack: {
    proofs: CaseWikiProof[];
    questions: CaseWikiOpenQuestion[];
    sourceRefs: string[];
  };
  recommendedNextAction: CaseWikiNextAction | null;
}): CaseWikiRoutingPack {
  const nextAction = params.recommendedNextAction;
  const sharedRelatedQuestionIds = Array.isArray(nextAction?.relatedQuestionIds) ? nextAction.relatedQuestionIds : [];
  const sharedFallbackRefs = Array.isArray(nextAction?.sourceRefs) && nextAction.sourceRefs.length > 0
    ? nextAction.sourceRefs
    : params.evidencePack.sourceRefs;
  const buildProofItem = (proof: CaseWikiProof): CaseWikiRoutingPackItem => {
    const owner = toNonEmptyString(nextAction?.owner ?? null) ?? "operator";
    const priority: CaseWikiPriority =
      proof.status === "missing" || proof.status === "contradicted"
        ? "high"
        : proof.status === "pending"
          ? "medium"
          : "low";
    const approvalRequired = nextAction?.type === "approval_request";
    const lane = deriveCaseWikiRoutingLane(nextAction?.type ?? null, owner, approvalRequired);
    const route: CaseWikiRoutingRoute = {
      lane,
      owner,
      priority,
      status: proof.status,
      blocking: nextAction?.blocking === true,
      approvalRequired,
      dueBy: toNonEmptyString(nextAction?.dueBy ?? null),
      summary: [
        sentenceCaseCaseWikiRoutingValue(lane),
        owner ? `owner: ${owner}` : null,
        priority ? `priority: ${sentenceCaseCaseWikiRoutingValue(priority)}` : null,
        nextAction?.blocking === true ? "blocking" : "non-blocking",
        approvalRequired ? "approval-ready" : null,
      ].filter((item): item is string => Boolean(item)).join(" | "),
    };
    return {
      focusKind: "proof",
      focusId: proof.id,
      focusLabel: proof.statement,
      route,
      cta: buildCaseWikiRoutingCTA({
        lane,
        route,
        nextAction,
        focusLabel: proof.statement,
      }),
      sourceRefs: proof.sourceRefs.length > 0 ? proof.sourceRefs : sharedFallbackRefs,
      relatedQuestionIds: sharedRelatedQuestionIds,
      nextAction,
    };
  };
  const buildQuestionItem = (question: CaseWikiOpenQuestion): CaseWikiRoutingPackItem => {
    const owner =
      toNonEmptyString(nextAction?.owner ?? null) ??
      toNonEmptyString(question.owner ?? null) ??
      "operator";
    const approvalRequired =
      nextAction?.type === "approval_request" ||
      (question.blocking === true && owner === "operator");
    const lane = deriveCaseWikiRoutingLane(nextAction?.type ?? null, owner, approvalRequired);
    const route: CaseWikiRoutingRoute = {
      lane,
      owner,
      priority: question.priority,
      status: question.blocking ? "open" : "monitored",
      blocking: question.blocking,
      approvalRequired,
      dueBy: toNonEmptyString(nextAction?.dueBy ?? null),
      summary: [
        sentenceCaseCaseWikiRoutingValue(lane),
        owner ? `owner: ${owner}` : null,
        question.priority ? `priority: ${sentenceCaseCaseWikiRoutingValue(question.priority)}` : null,
        question.blocking ? "blocking" : "non-blocking",
        approvalRequired ? "approval-ready" : null,
      ].filter((item): item is string => Boolean(item)).join(" | "),
    };
    return {
      focusKind: "question",
      focusId: question.id,
      focusLabel: question.question,
      route,
      cta: buildCaseWikiRoutingCTA({
        lane,
        route,
        nextAction,
        focusLabel: question.question,
      }),
      sourceRefs: question.sourceRefs.length > 0 ? question.sourceRefs : sharedFallbackRefs,
      relatedQuestionIds: sharedRelatedQuestionIds,
      nextAction,
    };
  };
  return {
    proofs: params.evidencePack.proofs.map((item) => buildProofItem(item)),
    questions: params.evidencePack.questions.map((item) => buildQuestionItem(item)),
  };
}

function buildCaseWikiHandoffSourceRefsLabel(
  sourceRefs: string[],
  limit = 4,
): string | null {
  const refs = sourceRefs
    .map((item) => toNonEmptyString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, limit);
  return refs.length > 0 ? refs.join(", ") : null;
}

function buildCaseWikiHandoffPack(params: {
  evidencePack: {
    proofs: CaseWikiProof[];
    questions: CaseWikiOpenQuestion[];
    sourceRefs: string[];
  };
  recommendedNextAction: CaseWikiNextAction | null;
}): CaseWikiHandoffPack {
  const nextAction = params.recommendedNextAction;
  const nextActionLabel =
    toNonEmptyString(nextAction?.title ?? null) ??
    toNonEmptyString(nextAction?.summary ?? null) ??
    sentenceCaseCaseWikiRoutingValue(nextAction?.type ?? null);
  const sharedFallbackRefs = Array.isArray(nextAction?.sourceRefs) && nextAction.sourceRefs.length > 0
    ? nextAction.sourceRefs
    : params.evidencePack.sourceRefs;
  const buildProofItem = (proof: CaseWikiProof): CaseWikiHandoffPackItem => {
    const sourceRefs = proof.sourceRefs.length > 0 ? proof.sourceRefs : sharedFallbackRefs;
    const refsLabel = buildCaseWikiHandoffSourceRefsLabel(sourceRefs);
    return {
      focusKind: "proof",
      focusId: proof.id,
      focusLabel: proof.statement,
      handoff: [
        `Focus proof: ${proof.statement}`,
        toNonEmptyString(proof.evidenceSummary) ? `Evidence: ${toNonEmptyString(proof.evidenceSummary)}` : null,
        toNonEmptyString(proof.contradictionNote) ? `Watch: ${toNonEmptyString(proof.contradictionNote)}` : null,
        nextActionLabel ? `Next: ${nextActionLabel}` : null,
        refsLabel ? `Refs: ${refsLabel}` : null,
      ].filter((item): item is string => Boolean(item)).join("\n"),
      detail: {
        status: proof.status,
        confidence: Number.isFinite(Number(proof.confidence)) ? Number(proof.confidence) : null,
        evidenceSummary: toNonEmptyString(proof.evidenceSummary),
        contradictionNote: toNonEmptyString(proof.contradictionNote),
        priority: null,
        blocking: nextAction?.blocking === true,
        owner: toNonEmptyString(nextAction?.owner ?? null),
        suggestedNextStep: null,
      },
      sourceRefs,
      nextAction,
    };
  };
  const buildQuestionItem = (question: CaseWikiOpenQuestion): CaseWikiHandoffPackItem => {
    const sourceRefs = question.sourceRefs.length > 0 ? question.sourceRefs : sharedFallbackRefs;
    const refsLabel = buildCaseWikiHandoffSourceRefsLabel(sourceRefs);
    return {
      focusKind: "question",
      focusId: question.id,
      focusLabel: question.question,
      handoff: [
        `Focus question: ${question.question}`,
        toNonEmptyString(question.suggestedNextStep) ? `Resolve: ${toNonEmptyString(question.suggestedNextStep)}` : null,
        toNonEmptyString(question.owner ?? null) ? `Owner: ${toNonEmptyString(question.owner ?? null)}` : null,
        nextActionLabel ? `Next: ${nextActionLabel}` : null,
        refsLabel ? `Refs: ${refsLabel}` : null,
      ].filter((item): item is string => Boolean(item)).join("\n"),
      detail: {
        status: question.blocking ? "open" : "monitored",
        confidence: null,
        evidenceSummary: null,
        contradictionNote: null,
        priority: question.priority,
        blocking: question.blocking,
        owner: toNonEmptyString(question.owner ?? null),
        suggestedNextStep: toNonEmptyString(question.suggestedNextStep),
      },
      sourceRefs,
      nextAction,
    };
  };
  return {
    proofs: params.evidencePack.proofs.map((item) => buildProofItem(item)),
    questions: params.evidencePack.questions.map((item) => buildQuestionItem(item)),
  };
}

function buildCaseWikiDetailPack(params: {
  evidencePack: {
    proofs: CaseWikiProof[];
    questions: CaseWikiOpenQuestion[];
    sourceRefs: string[];
  };
}): CaseWikiDetailPack {
  const sharedFallbackRefs = params.evidencePack.sourceRefs;
  const buildProofBadges = (proof: CaseWikiProof, sourceRefs: string[]): CaseWikiDetailBadge[] => {
    const badges: CaseWikiDetailBadge[] = [];
    const status = toNonEmptyString(proof.status);
    const confidence = Number.isFinite(Number(proof.confidence)) ? `${Math.round(Number(proof.confidence) * 100)}%` : null;
    if (status) {
      const normalizedStatus = status.trim().toLowerCase();
      badges.push({
        tone:
          normalizedStatus === "confirmed"
            ? "ok"
            : normalizedStatus.includes("missing") || normalizedStatus.includes("contrad")
              ? "watch"
              : "neutral",
        label: sentenceCaseCaseWikiRoutingValue(status) ?? status,
      });
    }
    if (confidence) {
      badges.push({
        tone: "neutral",
        label: `confidence ${confidence}`,
      });
    }
    badges.push({
      tone: sourceRefs.length > 0 ? "ok" : "neutral",
      label: `refs ${sourceRefs.length}`,
    });
    return badges;
  };
  const buildQuestionBadges = (question: CaseWikiOpenQuestion, sourceRefs: string[]): CaseWikiDetailBadge[] => {
    const badges: CaseWikiDetailBadge[] = [];
    const priority = toNonEmptyString(question.priority);
    const owner = toNonEmptyString(question.owner ?? null);
    if (priority) {
      badges.push({
        tone: priority.trim().toLowerCase() === "high" ? "watch" : "neutral",
        label: sentenceCaseCaseWikiRoutingValue(priority) ?? priority,
      });
    }
    if (question.blocking === true) {
      badges.push({
        tone: "watch",
        label: "Blocking",
      });
    }
    if (owner) {
      badges.push({
        tone: "ok",
        label: `owner ${owner}`,
      });
    }
    badges.push({
      tone: sourceRefs.length > 0 ? "ok" : "neutral",
      label: `refs ${sourceRefs.length}`,
    });
    return badges;
  };
  const buildProofItem = (proof: CaseWikiProof): CaseWikiDetailPackItem => {
    const sourceRefs = proof.sourceRefs.length > 0 ? proof.sourceRefs : sharedFallbackRefs;
    const refsLabel = buildCaseWikiHandoffSourceRefsLabel(sourceRefs);
    const status = sentenceCaseCaseWikiRoutingValue(proof.status);
    const confidence = Number.isFinite(Number(proof.confidence)) ? `${Math.round(Number(proof.confidence) * 100)}%` : null;
    return {
      focusKind: "proof",
      focusId: proof.id,
      focusLabel: proof.statement,
      title: proof.statement,
      meta: [
        status,
        confidence ? `confidence ${confidence}` : null,
        refsLabel ? `refs: ${refsLabel}` : null,
      ].filter((item): item is string => Boolean(item)).join(" | "),
      body:
        [
          toNonEmptyString(proof.evidenceSummary),
          toNonEmptyString(proof.contradictionNote),
        ].filter((item): item is string => Boolean(item)).join("\n") ||
        "No extra proof context.",
      badges: buildProofBadges(proof, sourceRefs),
      sourceRefs,
    };
  };
  const buildQuestionItem = (question: CaseWikiOpenQuestion): CaseWikiDetailPackItem => {
    const sourceRefs = question.sourceRefs.length > 0 ? question.sourceRefs : sharedFallbackRefs;
    const refsLabel = buildCaseWikiHandoffSourceRefsLabel(sourceRefs);
    const priority = sentenceCaseCaseWikiRoutingValue(question.priority);
    const owner = toNonEmptyString(question.owner ?? null);
    return {
      focusKind: "question",
      focusId: question.id,
      focusLabel: question.question,
      title: question.question,
      meta: [
        priority,
        question.blocking === true ? "Blocking" : null,
        owner ? `owner: ${owner}` : null,
        refsLabel ? `refs: ${refsLabel}` : null,
      ].filter((item): item is string => Boolean(item)).join(" | "),
      body:
        [toNonEmptyString(question.suggestedNextStep)].filter((item): item is string => Boolean(item)).join("\n") ||
        "No extra question context.",
      badges: buildQuestionBadges(question, sourceRefs),
      sourceRefs,
    };
  };
  return {
    proofs: params.evidencePack.proofs.map((item) => buildProofItem(item)),
    questions: params.evidencePack.questions.map((item) => buildQuestionItem(item)),
  };
}

function buildCaseWikiActionPack(params: {
  evidencePack: {
    proofs: CaseWikiProof[];
    questions: CaseWikiOpenQuestion[];
    sourceRefs: string[];
  };
  handoffPack: CaseWikiHandoffPack;
  detailPack: CaseWikiDetailPack;
  recommendedNextAction: CaseWikiNextAction | null;
}): CaseWikiActionPack {
  const sharedFallbackRefs = params.evidencePack.sourceRefs;
  const buildRefsText = (prefix: "Proof" | "Question", title: string, refs: string[]): string | null =>
    refs.length > 0 ? [`${prefix} refs: ${title}`, ...refs].join("\n") : null;
  const buildHandoffText = (
    prefix: "Proof" | "Question",
    title: string,
    meta: string | null,
    body: string | null,
    handoff: string | null,
  ): string =>
    [
      `${prefix} handoff: ${title}`,
      meta,
      body,
      handoff,
    ].filter((item): item is string => Boolean(item)).join("\n");
  const buildRemediationDraft = (params: {
    title: string;
    focusLabel: string;
    detailBody: string | null;
    handoff: string | null;
    sourceRefs: string[];
    nextAction: CaseWikiNextAction | null;
    ownerHint?: string | null;
  }): CaseWikiRemediationDraft => {
    const nextActionType = params.nextAction?.type ?? null;
    const nextActionTitle =
      toNonEmptyString(params.nextAction?.title ?? null) ??
      toNonEmptyString(params.nextAction?.summary ?? null) ??
      params.title;
    const nextActionSummary = toNonEmptyString(params.nextAction?.summary ?? null);
    const owner = toNonEmptyString(params.nextAction?.owner ?? params.ownerHint ?? null);
    const dueBy = toNonEmptyString(params.nextAction?.dueBy ?? null);
    const sourceRefs = [...new Set(params.sourceRefs)];
    const refsLabel = buildCaseWikiHandoffSourceRefsLabel(sourceRefs);
    const detailBody = toNonEmptyString(params.detailBody);
    const handoff = toNonEmptyString(params.handoff);
    const focusLabel = toNonEmptyString(params.focusLabel) ?? params.title;

    if (nextActionType === "approval_request") {
      return {
        kind: "approval_brief",
        actionType: nextActionType,
        title: nextActionTitle,
        targetLabel: "approval_queue",
        owner: owner ?? "operator",
        dueBy,
        summary: `Prepare an approval brief for ${focusLabel} before opening the protected step.`,
        body: [
          `Approval brief: ${nextActionTitle}`,
          `Focus: ${focusLabel}`,
          detailBody ? `Blocking context: ${detailBody}` : null,
          nextActionSummary ? `Requested decision path: ${nextActionSummary}` : null,
          refsLabel ? `Source refs: ${refsLabel}` : null,
        ].filter((item): item is string => Boolean(item)).join("\n"),
        checklist: [
          "Review the focused blocker or proof.",
          "Open workflow control on the protected step.",
          "Capture the approval decision and reason.",
          "Refresh Case Wiki after the decision.",
        ],
        sourceRefs,
      };
    }

    if (nextActionType === "document_request" || nextActionType === "live_followup") {
      return {
        kind: "customer_message",
        actionType: nextActionType,
        title: nextActionTitle,
        targetLabel: "customer",
        owner: owner ?? "operator",
        dueBy,
        summary: `Send a customer-ready follow-up for ${focusLabel} and request the next required update.`,
        body: [
          `Subject: ${nextActionTitle}`,
          "",
          "Hello,",
          "",
          "We are following up on your case.",
          detailBody ? `Current blocker: ${detailBody}` : `Current blocker: ${focusLabel}.`,
          nextActionSummary ? `Requested next step: ${nextActionSummary}` : null,
          "Please reply with the requested update so we can continue.",
          "",
          "Regards,",
          "Operations team",
        ].filter((item): item is string => Boolean(item)).join("\n"),
        checklist: [
          "Verify the blocker is still current.",
          "Attach the latest source refs before sending.",
          "Send through the live or customer follow-up lane.",
          "Log the response back into Case Wiki.",
        ],
        sourceRefs,
      };
    }

    if (nextActionType === "workflow_resume") {
      return {
        kind: "workflow_resume",
        actionType: nextActionType,
        title: nextActionTitle,
        targetLabel: owner ?? "operator",
        owner: owner ?? "operator",
        dueBy,
        summary: `Resume workflow follow-through for ${focusLabel} with the compiled case context attached.`,
        body: [
          `Workflow resume brief: ${nextActionTitle}`,
          `Focus: ${focusLabel}`,
          detailBody ? `Current context: ${detailBody}` : null,
          nextActionSummary ? `Next step: ${nextActionSummary}` : null,
          handoff ? `Handoff: ${handoff}` : null,
          refsLabel ? `Source refs: ${refsLabel}` : null,
        ].filter((item): item is string => Boolean(item)).join("\n"),
        checklist: [
          "Confirm the blocker is cleared or actively owned.",
          "Resume the queued workflow step in control plane.",
          "Verify the next operator workspace after resume.",
          "Refresh the compiled case snapshot.",
        ],
        sourceRefs,
      };
    }

    return {
      kind: "operator_brief",
      actionType: nextActionType,
      title: nextActionTitle,
      targetLabel: owner ?? "operator",
      owner: owner ?? "operator",
      dueBy,
      summary: `Hand off ${focusLabel} to the next operator lane with focused case evidence attached.`,
      body: [
        `Operator brief: ${nextActionTitle}`,
        `Focus: ${focusLabel}`,
        detailBody ? `Current context: ${detailBody}` : null,
        nextActionSummary ? `Recommended next step: ${nextActionSummary}` : null,
        handoff ? `Handoff: ${handoff}` : null,
        refsLabel ? `Source refs: ${refsLabel}` : null,
      ].filter((item): item is string => Boolean(item)).join("\n"),
      checklist: [
        "Review the focused proof or question.",
        "Carry the handoff into the next operator action.",
        "Keep the source refs attached to the case note or export.",
        "Refresh Case Wiki after the action completes.",
      ],
      sourceRefs,
    };
  };
  const buildProofItem = (proof: CaseWikiProof): CaseWikiActionPackItem => {
    const handoffPackItem = params.handoffPack.proofs.find((item) => item.focusId === proof.id) ?? null;
    const detailPackItem = params.detailPack.proofs.find((item) => item.focusId === proof.id) ?? null;
    const title =
      toNonEmptyString(detailPackItem?.title) ??
      toNonEmptyString(detailPackItem?.focusLabel) ??
      proof.statement;
    const refs =
      (detailPackItem?.sourceRefs.length ?? 0) > 0
        ? detailPackItem?.sourceRefs ?? []
        : (handoffPackItem?.sourceRefs.length ?? 0) > 0
          ? handoffPackItem?.sourceRefs ?? []
          : proof.sourceRefs.length > 0
            ? proof.sourceRefs
            : sharedFallbackRefs;
    return {
      focusKind: "proof",
      focusId: proof.id,
      focusLabel: proof.statement,
      title,
      handoffText: buildHandoffText(
        "Proof",
        title,
        toNonEmptyString(detailPackItem?.meta ?? null),
        toNonEmptyString(detailPackItem?.body ?? null),
        toNonEmptyString(handoffPackItem?.handoff ?? null),
      ),
      refs,
      refsText: buildRefsText("Proof", title, refs),
      focusSummary: toNonEmptyString(proof.statement),
      remediationDraft: buildRemediationDraft({
        title,
        focusLabel: proof.statement,
        detailBody: toNonEmptyString(detailPackItem?.body ?? null),
        handoff: toNonEmptyString(handoffPackItem?.handoff ?? null),
        sourceRefs: refs,
        nextAction: isRecord(handoffPackItem?.nextAction) ? handoffPackItem.nextAction : params.recommendedNextAction,
      }),
    };
  };
  const buildQuestionItem = (question: CaseWikiOpenQuestion): CaseWikiActionPackItem => {
    const handoffPackItem = params.handoffPack.questions.find((item) => item.focusId === question.id) ?? null;
    const detailPackItem = params.detailPack.questions.find((item) => item.focusId === question.id) ?? null;
    const title =
      toNonEmptyString(detailPackItem?.title) ??
      toNonEmptyString(detailPackItem?.focusLabel) ??
      question.question;
    const refs =
      (detailPackItem?.sourceRefs.length ?? 0) > 0
        ? detailPackItem?.sourceRefs ?? []
        : (handoffPackItem?.sourceRefs.length ?? 0) > 0
          ? handoffPackItem?.sourceRefs ?? []
          : question.sourceRefs.length > 0
            ? question.sourceRefs
            : sharedFallbackRefs;
    return {
      focusKind: "question",
      focusId: question.id,
      focusLabel: question.question,
      title,
      handoffText: buildHandoffText(
        "Question",
        title,
        toNonEmptyString(detailPackItem?.meta ?? null),
        toNonEmptyString(detailPackItem?.body ?? null),
        toNonEmptyString(handoffPackItem?.handoff ?? null),
      ),
      refs,
      refsText: buildRefsText("Question", title, refs),
      focusSummary: toNonEmptyString(question.question),
      remediationDraft: buildRemediationDraft({
        title,
        focusLabel: question.question,
        detailBody: toNonEmptyString(detailPackItem?.body ?? null) ?? toNonEmptyString(question.suggestedNextStep),
        handoff: toNonEmptyString(handoffPackItem?.handoff ?? null),
        sourceRefs: refs,
        nextAction: isRecord(handoffPackItem?.nextAction) ? handoffPackItem.nextAction : params.recommendedNextAction,
        ownerHint: toNonEmptyString(question.owner ?? null),
      }),
    };
  };
  return {
    proofs: params.evidencePack.proofs.map((item) => buildProofItem(item)),
    questions: params.evidencePack.questions.map((item) => buildQuestionItem(item)),
  };
}

function buildCaseWikiFocusPack(params: {
  evidencePack: {
    proofs: CaseWikiProof[];
    questions: CaseWikiOpenQuestion[];
    sourceRefs: string[];
  };
  handoffPack: CaseWikiHandoffPack;
}): CaseWikiFocusPack {
  const sharedFallbackRefs = params.evidencePack.sourceRefs;
  const buildChipTitle = (lines: Array<string | null>): string | null => {
    const normalized = lines.filter((item): item is string => Boolean(item));
    return normalized.length > 0 ? normalized.join("\n") : null;
  };
  const buildDrilldown = (parts: Array<string | null>): string | null => {
    const normalized = parts.filter((item): item is string => Boolean(item));
    return normalized.length > 0 ? normalized.join(" | ") : null;
  };
  const buildProofItem = (proof: CaseWikiProof): CaseWikiFocusPackItem => {
    const handoffPackItem = params.handoffPack.proofs.find((item) => item.focusId === proof.id) ?? null;
    const sourceRefs =
      proof.sourceRefs.length > 0
        ? proof.sourceRefs
        : (handoffPackItem?.sourceRefs.length ?? 0) > 0
          ? handoffPackItem?.sourceRefs ?? []
          : sharedFallbackRefs;
    const refsLabel = sourceRefs.length > 0 ? `Refs: ${sourceRefs.join(", ")}` : null;
    return {
      focusKind: "proof",
      focusId: proof.id,
      focusLabel: proof.statement,
      chipTitle: buildChipTitle([
        proof.statement,
        toNonEmptyString(proof.evidenceSummary),
        toNonEmptyString(proof.contradictionNote),
        refsLabel,
      ]),
      focusSummary: toNonEmptyString(proof.statement),
      drilldown: buildDrilldown([
        proof.statement,
        toNonEmptyString(proof.evidenceSummary),
        toNonEmptyString(proof.contradictionNote),
      ]),
      handoffPreview: toNonEmptyString(handoffPackItem?.handoff ?? null),
    };
  };
  const buildQuestionItem = (question: CaseWikiOpenQuestion): CaseWikiFocusPackItem => {
    const handoffPackItem = params.handoffPack.questions.find((item) => item.focusId === question.id) ?? null;
    const sourceRefs =
      question.sourceRefs.length > 0
        ? question.sourceRefs
        : (handoffPackItem?.sourceRefs.length ?? 0) > 0
          ? handoffPackItem?.sourceRefs ?? []
          : sharedFallbackRefs;
    const refsLabel = sourceRefs.length > 0 ? `Refs: ${sourceRefs.join(", ")}` : null;
    return {
      focusKind: "question",
      focusId: question.id,
      focusLabel: question.question,
      chipTitle: buildChipTitle([
        question.question,
        toNonEmptyString(question.suggestedNextStep),
        toNonEmptyString(question.owner ?? null) ? `Owner: ${toNonEmptyString(question.owner ?? null)}` : null,
        refsLabel,
      ]),
      focusSummary: toNonEmptyString(question.question),
      drilldown: buildDrilldown([
        question.question,
        toNonEmptyString(question.suggestedNextStep),
        toNonEmptyString(question.owner ?? null),
      ]),
      handoffPreview: toNonEmptyString(handoffPackItem?.handoff ?? null),
    };
  };
  return {
    proofs: params.evidencePack.proofs.map((item) => buildProofItem(item)),
    questions: params.evidencePack.questions.map((item) => buildQuestionItem(item)),
  };
}

function buildCaseWikiDefaultFocus(params: {
  highlights: {
    topProof: CaseWikiProof | null;
    topBlockingQuestion: CaseWikiOpenQuestion | null;
  };
  evidencePack: {
    proofs: CaseWikiProof[];
    questions: CaseWikiOpenQuestion[];
  };
  focusPack: CaseWikiFocusPack;
}): CaseWikiDefaultFocus | null {
  const buildFallbackFocus = (
    kind: "proof" | "question",
    item: CaseWikiProof | CaseWikiOpenQuestion | null,
    source: CaseWikiDefaultFocus["source"],
  ): CaseWikiDefaultFocus | null => {
    if (!item) {
      return null;
    }
    const focusId = toNonEmptyString(item.id);
    if (!focusId) {
      return null;
    }
    const focusPackItems = kind === "proof" ? params.focusPack.proofs : params.focusPack.questions;
    const focusPackItem = focusPackItems.find((candidate) => candidate.focusId === focusId);
    if (focusPackItem) {
      return { ...focusPackItem, source };
    }
    if (kind === "proof") {
      const proof = item as CaseWikiProof;
      return {
        focusKind: "proof",
        focusId,
        focusLabel: proof.statement,
        chipTitle: null,
        focusSummary: toNonEmptyString(proof.statement),
        drilldown: [proof.statement, toNonEmptyString(proof.evidenceSummary), toNonEmptyString(proof.contradictionNote)]
          .filter((part): part is string => Boolean(part))
          .join(" | ") || null,
        handoffPreview: null,
        source,
      };
    }
    const question = item as CaseWikiOpenQuestion;
    return {
      focusKind: "question",
      focusId,
      focusLabel: question.question,
      chipTitle: null,
      focusSummary: toNonEmptyString(question.question),
      drilldown: [question.question, toNonEmptyString(question.suggestedNextStep), toNonEmptyString(question.owner)]
        .filter((part): part is string => Boolean(part))
        .join(" | ") || null,
      handoffPreview: null,
      source,
    };
  };
  const resolveById = (
    kind: "proof" | "question",
    focusId: string | null | undefined,
    source: CaseWikiDefaultFocus["source"],
  ): CaseWikiDefaultFocus | null => {
    const normalizedFocusId = toNonEmptyString(focusId);
    if (!normalizedFocusId) {
      return null;
    }
    const items = kind === "proof" ? params.evidencePack.proofs : params.evidencePack.questions;
    const item = items.find((candidate) => candidate.id === normalizedFocusId) ?? null;
    return buildFallbackFocus(kind, item, source);
  };
  const resolveFirst = (
    kind: "proof" | "question",
    source: CaseWikiDefaultFocus["source"],
  ): CaseWikiDefaultFocus | null => {
    const focusPackItems = kind === "proof" ? params.focusPack.proofs : params.focusPack.questions;
    const focusPackItem = focusPackItems[0];
    if (focusPackItem) {
      return { ...focusPackItem, source };
    }
    const items = kind === "proof" ? params.evidencePack.proofs : params.evidencePack.questions;
    return buildFallbackFocus(kind, items[0] ?? null, "evidencePack");
  };
  return (
    resolveById("question", params.highlights.topBlockingQuestion?.id, "highlight") ??
    resolveFirst("question", "focusPack") ??
    resolveById("proof", params.highlights.topProof?.id, "highlight") ??
    resolveFirst("proof", "focusPack")
  );
}

function buildCaseWikiPreviewPack(params: {
  evidencePack: {
    proofs: CaseWikiProof[];
    entities: CaseWikiEntity[];
    questions: CaseWikiOpenQuestion[];
    sourceRefs: string[];
  };
  recommendedNextAction: CaseWikiNextAction | null;
}): CaseWikiPreviewPack {
  const proofsSummary =
    params.evidencePack.proofs
      .slice(0, 3)
      .map((item) => {
        const status = toNonEmptyString(item.status);
        return [status ? `[${status}]` : null, item.statement].filter((part): part is string => Boolean(part)).join(" ");
      })
      .filter((item) => item.length > 0)
      .join(" | ") || null;
  const questionsSummary =
    params.evidencePack.questions
      .slice(0, 3)
      .map((item) => {
        const priority = toNonEmptyString(item.priority);
        return [priority ? `[${priority}]` : null, item.question].filter((part): part is string => Boolean(part)).join(" ");
      })
      .filter((item) => item.length > 0)
      .join(" | ") || null;
  const nextAction = params.recommendedNextAction;
  const nextActionLabel =
    toNonEmptyString(nextAction?.title ?? null) ??
    toNonEmptyString(nextAction?.summary ?? null) ??
    sentenceCaseCaseWikiRoutingValue(nextAction?.type ?? null);
  const handoffRefs =
    Array.isArray(nextAction?.sourceRefs) && nextAction.sourceRefs.length > 0
      ? nextAction.sourceRefs
      : params.evidencePack.sourceRefs;
  const handoffRefsLabel = buildCaseWikiHandoffSourceRefsLabel(handoffRefs, 4);
  return {
    packValue:
      [
        params.evidencePack.proofs.length > 0 ? `${params.evidencePack.proofs.length} proofs` : null,
        params.evidencePack.entities.length > 0 ? `${params.evidencePack.entities.length} entities` : null,
        params.evidencePack.questions.length > 0 ? `${params.evidencePack.questions.length} questions` : null,
      ].filter((item): item is string => Boolean(item)).join(" | ") || null,
    refsValue:
      params.evidencePack.sourceRefs.length > 0
        ? params.evidencePack.sourceRefs.join(" | ")
        : null,
    proofsSummary,
    questionsSummary,
    drilldownValue: [proofsSummary, questionsSummary].filter((item): item is string => Boolean(item)).join(" | ") || null,
    handoffValue: [nextActionLabel, handoffRefsLabel ? `refs: ${handoffRefsLabel}` : null]
      .filter((item): item is string => Boolean(item))
      .join(" | ") || null,
  };
}

function buildCaseWikiWorkspaceStatusText(status: CaseWikiStatus): string {
  switch (status) {
    case "resolved":
      return "Resolved";
    case "blocked":
      return "Blocked";
    case "waiting_on_customer":
      return "Waiting on customer";
    case "waiting_on_operator":
      return "Waiting on operator";
    case "active":
      return "Active";
    default:
      return "Awaiting compiled memory";
  }
}

function buildCaseWikiWorkspaceQuestionsValue(questions: CaseWikiOpenQuestion[]): string | null {
  const items = questions
    .slice(0, 2)
    .map((item) =>
      [toNonEmptyString(item.priority), toNonEmptyString(item.question)]
        .filter((value): value is string => Boolean(value))
        .map((value, index) => (index === 0 ? `[${value}]` : value))
        .join(" "),
    )
    .filter((value): value is string => Boolean(value));
  return items.length > 0 ? items.join(" | ") : null;
}

function buildCaseWikiWorkspaceTimelineValue(timeline: CaseWikiTimelineEntry[]): string | null {
  const items = timeline
    .slice(0, 2)
    .map((item) =>
      [toNonEmptyString(item.kind), toNonEmptyString(item.title)]
        .filter((value): value is string => Boolean(value))
        .map((value, index) => (index === 0 ? `[${value}]` : value))
        .join(" "),
    )
    .filter((value): value is string => Boolean(value));
  return items.length > 0 ? items.join(" | ") : null;
}

function formatCompactNumber(value: number, digits: number): string {
  const normalized = Math.max(0, value);
  const fixed = normalized.toFixed(digits);
  return fixed.replace(/\.?0+$/, "");
}

function buildCaseWikiWorkspaceCostValue(costSummary: CaseWikiCostSummary | null | undefined): string | null {
  if (!costSummary) {
    return null;
  }
  const parts: string[] = [];
  if (costSummary.pricingConfigured && costSummary.totalUsd > 0) {
    const digits = costSummary.totalUsd >= 1 ? 2 : costSummary.totalUsd >= 0.1 ? 3 : 4;
    parts.push(`$${formatCompactNumber(costSummary.totalUsd, digits)}`);
  }
  if (costSummary.totalTokens > 0) {
    parts.push(`${costSummary.totalTokens} tokens`);
  }
  if (costSummary.liveMinutes > 0) {
    parts.push(`live ${formatCompactNumber(costSummary.liveMinutes, 1)}m`);
  }
  if (costSummary.uiExecutorMinutes > 0) {
    parts.push(`ui ${formatCompactNumber(costSummary.uiExecutorMinutes, 1)}m`);
  }
  if (costSummary.storageMb > 0) {
    parts.push(`${formatCompactNumber(costSummary.storageMb, 2)} MB`);
  }
  return parts.join(" | ") || null;
}

function buildCaseWikiWorkspacePack(params: {
  overview: {
    title: string;
    summary: string;
    status: CaseWikiStatus;
    customerGoal: string | null;
    currentStage: string | null;
    missingEvidenceSummary: string | null;
    contradictionsSummary: string | null;
  };
  highlights: {
    topProof: CaseWikiProof | null;
    topEntity: CaseWikiEntity | null;
    topBlockingQuestion: CaseWikiOpenQuestion | null;
  };
  evidencePack: {
    proofs: CaseWikiProof[];
    entities: CaseWikiEntity[];
    questions: CaseWikiOpenQuestion[];
    sourceRefs: string[];
  };
  openQuestions: CaseWikiOpenQuestion[];
  timeline: CaseWikiTimelineEntry[];
  focusPack: CaseWikiFocusPack;
  previewPack: CaseWikiPreviewPack;
  recommendedNextAction: CaseWikiNextAction | null;
  costSummary?: CaseWikiCostSummary | null;
}): CaseWikiWorkspacePack {
  const nextActionType = sentenceCaseCaseWikiRoutingValue(params.recommendedNextAction?.type ?? null);
  const proofStatus = sentenceCaseCaseWikiRoutingValue(params.highlights.topProof?.status ?? null);
  const defaultFocus = buildCaseWikiDefaultFocus({
    highlights: params.highlights,
    evidencePack: params.evidencePack,
    focusPack: params.focusPack,
  });
  return {
    defaultFocus,
    statusValue: [
      buildCaseWikiWorkspaceStatusText(params.overview.status),
      toNonEmptyString(params.overview.currentStage),
    ].filter((item): item is string => Boolean(item)).join(" | ") || null,
    summaryValue:
      toNonEmptyString(params.overview.summary) ??
      toNonEmptyString(params.overview.title) ??
      toNonEmptyString(params.overview.customerGoal) ??
      toNonEmptyString(params.overview.missingEvidenceSummary) ??
      null,
    blockerValue:
      toNonEmptyString(params.highlights.topBlockingQuestion?.question ?? null) ??
      toNonEmptyString(params.overview.missingEvidenceSummary) ??
      toNonEmptyString(params.overview.contradictionsSummary) ??
      null,
    nextActionValue:
      toNonEmptyString(params.recommendedNextAction?.title ?? null) ??
      toNonEmptyString(params.recommendedNextAction?.summary ?? null) ??
      nextActionType,
    proofTitle: toNonEmptyString(params.highlights.topProof?.statement ?? null),
    proofSummary:
      toNonEmptyString(params.highlights.topProof?.evidenceSummary ?? null) ??
      toNonEmptyString(params.highlights.topProof?.contradictionNote ?? null) ??
      proofStatus,
    entityTitle: toNonEmptyString(params.highlights.topEntity?.label ?? null),
    entitySummary:
      [
        toNonEmptyString(params.highlights.topEntity?.role ?? null),
        toNonEmptyString(params.highlights.topEntity?.description ?? null),
      ].filter((item): item is string => Boolean(item)).join(" | ") || null,
    packValue:
      toNonEmptyString(params.previewPack.packValue) ??
      ([
        params.evidencePack.proofs.length > 0 ? `${params.evidencePack.proofs.length} proofs` : null,
        params.evidencePack.entities.length > 0 ? `${params.evidencePack.entities.length} entities` : null,
        params.evidencePack.questions.length > 0 ? `${params.evidencePack.questions.length} questions` : null,
      ].filter((item): item is string => Boolean(item)).join(" | ") || null),
    refsValue:
      toNonEmptyString(params.previewPack.refsValue) ??
      (params.evidencePack.sourceRefs.length > 0 ? params.evidencePack.sourceRefs.join(" | ") : null),
    questionsValue:
      toNonEmptyString(params.previewPack.questionsSummary) ??
      buildCaseWikiWorkspaceQuestionsValue(params.openQuestions),
    timelineValue: buildCaseWikiWorkspaceTimelineValue(params.timeline),
    drilldownValue: toNonEmptyString(params.previewPack.drilldownValue),
    handoffValue: toNonEmptyString(params.previewPack.handoffValue),
    costValue: buildCaseWikiWorkspaceCostValue(params.costSummary ?? null),
    costSummary: params.costSummary ?? null,
  };
}

function buildCaseWikiComplianceEnforcement(params: {
  piiRedactionLevel: "standard" | "high";
  expectedSignatureStatus: "signed" | "unsigned";
  sourceRefs: string[];
  selectedEvents: EventListItem[];
}): CaseWikiComplianceSummary["enforcement"] {
  const artifactPosture = buildCaseWikiArtifactPostureSummary({
    sourceRefs: params.sourceRefs,
    selectedEvents: params.selectedEvents,
    expectedSignatureStatus: params.expectedSignatureStatus,
  });
  const rawRefs = artifactPosture.blockingRefs.slice(0, 6);
  const redactionRequired = params.piiRedactionLevel === "high";
  const redactionSatisfied = !redactionRequired || artifactPosture.rawArtifacts === 0;
  const signingRequired = params.expectedSignatureStatus === "signed";
  const observedSignatureStatus = params.expectedSignatureStatus;
  const signatureSatisfied = !signingRequired || observedSignatureStatus === "signed";
  const blockingReasons: string[] = [];

  if (!redactionSatisfied) {
    blockingReasons.push("raw_like_source_refs_detected");
  }
  if (!signatureSatisfied) {
    blockingReasons.push("case_wiki_signature_missing");
  }

  const status =
    blockingReasons.length > 0
      ? "fail"
      : artifactPosture.rawArtifacts > 0
        ? "warn"
        : "pass";
  const snapshotMode = artifactPosture.rawArtifacts > 0 ? "raw_ref_review" : "compiled_operator_safe";
  const exportReady = blockingReasons.length === 0;

  return {
    status,
    snapshotMode,
    rawRefCount: artifactPosture.rawArtifacts,
    rawRefsPreview: rawRefs,
    redactionRequired,
    redactionSatisfied,
    signingRequired,
    observedSignatureStatus,
    signatureSatisfied,
    exportReady,
    blockingReasons,
    artifactPosture,
    summary: [
      `status=${status}`,
      `snapshot=${snapshotMode}`,
      `redaction=${redactionSatisfied ? "ok" : "blocked"}`,
      `signing=${signatureSatisfied ? observedSignatureStatus : "blocked"}`,
      `export=${exportReady ? "ready" : "blocked"}`,
      `rawRefs=${artifactPosture.rawArtifacts}`,
      `artifacts=${artifactPosture.totalArtifacts}`,
      `redacted=${artifactPosture.redactedArtifacts}`,
      `signed=${artifactPosture.signedArtifacts}`,
    ].join(" | "),
  };
}

function buildCaseWikiComplianceSummary(
  compliance:
    | RuntimeCaseWikiBuilderParams["compliance"]
    | null
    | undefined,
  evidenceSigner: RuntimeEvidenceSignerConfig | null | undefined,
  sourceRefs: string[],
  selectedEvents: EventListItem[],
): CaseWikiComplianceSummary {
  const posture = buildRuntimeEvidenceSigningPosture(evidenceSigner);
  const templateId = compliance?.templateId ?? "baseline";
  const requestedTemplateId = toNonEmptyString(compliance?.requestedTemplateId) ?? templateId;
  const source = compliance?.source ?? "template_default";
  const controls = {
    piiRedactionLevel: compliance?.controls.piiRedactionLevel ?? "standard",
    crossTenantAdminOnly: compliance?.controls.crossTenantAdminOnly ?? true,
    approvalSlaEnforced: compliance?.controls.approvalSlaEnforced ?? true,
    auditTrailRequired: compliance?.controls.auditTrailRequired ?? true,
  };
  const retention = {
    rawMediaDays: Math.max(1, Math.floor(Number(compliance?.retention.rawMediaDays ?? 7) || 7)),
    auditLogsDays: Math.max(1, Math.floor(Number(compliance?.retention.auditLogsDays ?? 365) || 365)),
    eventsDays: Math.max(1, Math.floor(Number(compliance?.retention.eventsDays ?? 365) || 365)),
    sessionsDays: Math.max(1, Math.floor(Number(compliance?.retention.sessionsDays ?? 90) || 90)),
  };
  const enforcement = buildCaseWikiComplianceEnforcement({
    piiRedactionLevel: controls.piiRedactionLevel,
    expectedSignatureStatus: posture.expectedSignatureStatus,
    sourceRefs,
    selectedEvents,
  });

  return {
    templateId,
    requestedTemplateId,
    fallbackApplied: compliance?.fallbackApplied === true,
    source,
    controls,
    retention,
    evidenceSigning: {
      enabled: posture.enabled,
      keyState: posture.keyState,
      expectedSignatureStatus: posture.expectedSignatureStatus,
      signerId: posture.signerId,
      keyId: posture.keyId,
    },
    enforcement,
    summary: [
      `template=${templateId}`,
      requestedTemplateId !== templateId ? `requested=${requestedTemplateId}` : null,
      source === "tenant_override" ? "tenant_override" : "template_default",
      `pii=${controls.piiRedactionLevel}`,
      `rawMedia=${retention.rawMediaDays}d`,
      `audit=${controls.auditTrailRequired ? "required" : "optional"}`,
      `signing=${posture.expectedSignatureStatus}`,
      `enforcement=${enforcement.status}`,
    ]
      .filter((item): item is string => Boolean(item))
      .join(" | "),
  };
}

function buildCaseWikiOperatorPreviewPack(params: {
  caseId: string;
  sessionId: string;
  generatedAt: string;
  compliance: CaseWikiComplianceSummary;
  overview: {
    title: string;
    summary: string;
    status: CaseWikiStatus;
    customerGoal: string | null;
    currentStage: string | null;
    missingEvidenceSummary: string | null;
    contradictionsSummary: string | null;
  };
  evidencePack: {
    proofs: CaseWikiProof[];
    entities: CaseWikiEntity[];
    questions: CaseWikiOpenQuestion[];
    sourceRefs: string[];
  };
  highlights: {
    topProof: CaseWikiProof | null;
    topEntity: CaseWikiEntity | null;
  };
  handoffPack: CaseWikiHandoffPack;
  detailPack: CaseWikiDetailPack;
  actionPack: CaseWikiActionPack;
  previewPack: CaseWikiPreviewPack;
  recommendedNextAction: CaseWikiNextAction | null;
  counts: {
    entities: number;
    proofs: number;
    openQuestions: number;
    timeline: number;
  };
  openQuestions: CaseWikiOpenQuestion[];
  timeline: CaseWikiTimelineEntry[];
  auditLog: CaseWikiAuditEntry[];
}): CaseWikiOperatorPreviewPack {
  const remediationItem =
    params.actionPack.questions.find((item) => item.remediationDraft !== null) ??
    params.actionPack.proofs.find((item) => item.remediationDraft !== null) ??
    null;
  const nextActionPreview = params.recommendedNextAction
    ? {
        type: params.recommendedNextAction.type,
        title: toNonEmptyString(params.recommendedNextAction.title),
        owner: toNonEmptyString(params.recommendedNextAction.owner ?? null),
        summary: toNonEmptyString(params.recommendedNextAction.summary),
      }
    : null;
  return {
    overview: {
      caseId: params.caseId,
      sessionId: params.sessionId,
      schemaVersion: 1,
      generatedAt: params.generatedAt,
      overview: {
        title: toNonEmptyString(params.overview.title),
        status: params.overview.status,
        currentStage: toNonEmptyString(params.overview.currentStage),
        customerGoal: toNonEmptyString(params.overview.customerGoal),
        summary: toNonEmptyString(params.overview.summary),
        missingEvidenceSummary: toNonEmptyString(params.overview.missingEvidenceSummary),
        contradictionsSummary: toNonEmptyString(params.overview.contradictionsSummary),
      },
      recommendedNextAction: nextActionPreview,
      counts: { ...params.counts },
    },
    evidence: {
      topProof: params.highlights.topProof
        ? {
            status: params.highlights.topProof.status,
            statement: toNonEmptyString(params.highlights.topProof.statement),
            evidenceSummary: toNonEmptyString(params.highlights.topProof.evidenceSummary),
            contradictionNote: toNonEmptyString(params.highlights.topProof.contradictionNote),
            sourceRefs: Array.isArray(params.highlights.topProof.sourceRefs)
              ? params.highlights.topProof.sourceRefs
              : [],
          }
        : null,
      topEntity: params.highlights.topEntity
        ? {
            kind: params.highlights.topEntity.kind,
            label: toNonEmptyString(params.highlights.topEntity.label),
            role: toNonEmptyString(params.highlights.topEntity.role),
            summary:
              [
                toNonEmptyString(params.highlights.topEntity.role),
                toNonEmptyString(params.highlights.topEntity.description),
              ].filter((item): item is string => Boolean(item)).join(" | ") || null,
            sourceRefs: Array.isArray(params.highlights.topEntity.sourceRefs)
              ? params.highlights.topEntity.sourceRefs
              : [],
          }
        : null,
      evidencePack: {
        proofs: params.evidencePack.proofs,
        entities: params.evidencePack.entities,
        questions: params.evidencePack.questions,
        sourceRefs: params.evidencePack.sourceRefs,
      },
      previewPack: params.previewPack,
      handoffPack: params.handoffPack,
      detailPack: params.detailPack,
      recommendedNextAction: nextActionPreview,
    },
    questions: {
      totalQuestions: params.openQuestions.length,
      blockingQuestions: params.openQuestions.filter((item) => item.blocking === true).length,
      items: params.openQuestions.slice(0, 6).map((item) => ({
        id: toNonEmptyString(item.id),
        priority: item.priority,
        blocking: item.blocking === true,
        owner: toNonEmptyString(item.owner ?? null),
        question: toNonEmptyString(item.question),
        suggestedNextStep: toNonEmptyString(item.suggestedNextStep ?? null),
        sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs : [],
      })),
    },
    remediation: {
      focusKind: remediationItem?.focusKind ?? null,
      focusId: toNonEmptyString(remediationItem?.focusId ?? null),
      focusLabel: toNonEmptyString(remediationItem?.focusLabel ?? null),
      draft: remediationItem?.remediationDraft ?? null,
    } satisfies CaseWikiOperatorRemediationPreview,
    timeline: {
      totalEntries: params.timeline.length,
      latestEntries: params.timeline.slice(0, 6).map((item) => ({
        ts: toNonEmptyString(item.ts),
        kind: item.kind,
        title: toNonEmptyString(item.title),
        summary: toNonEmptyString(item.summary),
        status: toNonEmptyString(item.status ?? null),
        sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs : [],
      })),
    },
    audit: {
      totalEntries: params.auditLog.length,
      latestEntries: params.auditLog.slice(0, 6).map((item) => ({
        id: toNonEmptyString(item.id),
        ts: toNonEmptyString(item.ts),
        actor: toNonEmptyString(item.actor ?? null),
        source: item.source,
        action: toNonEmptyString(item.action),
        field: toNonEmptyString(item.field ?? null),
        summary: toNonEmptyString(item.summary),
        reason: toNonEmptyString(item.reason ?? null),
        oldValue: toNonEmptyString(item.oldValue ?? null),
        newValue: toNonEmptyString(item.newValue ?? null),
        sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs : [],
      })),
    },
    compliance: params.compliance,
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
  const auditLog = buildAuditLog(context);
  const proofs = buildProofs(context);
  const openQuestions = buildOpenQuestions(context);
  const recommendedNextAction = buildRecommendedNextAction(context, openQuestions);
  const evidencePack = buildEvidencePack({
    proofs,
    entities,
    openQuestions,
  });
  const complianceSourceRefs = buildSourceRefs([
    ...evidencePack.sourceRefs,
    ...timeline.flatMap((item) => item.sourceRefs ?? []),
    ...auditLog.flatMap((item) => item.sourceRefs ?? []),
    ...(recommendedNextAction?.sourceRefs ?? []),
  ]);
  const compliance = buildCaseWikiComplianceSummary(
    params.compliance,
    params.evidenceSigner,
    complianceSourceRefs,
    context.selectedEvents,
  );
  const handoffPack = buildCaseWikiHandoffPack({
    evidencePack,
    recommendedNextAction,
  });
  const detailPack = buildCaseWikiDetailPack({
    evidencePack,
  });
  const routingPack = buildCaseWikiRoutingPack({
    evidencePack,
    recommendedNextAction,
  });
  const actionPack = buildCaseWikiActionPack({
    evidencePack,
    handoffPack,
    detailPack,
    recommendedNextAction,
  });
  const focusPack = buildCaseWikiFocusPack({
    evidencePack,
    handoffPack,
  });
  const previewPack = buildCaseWikiPreviewPack({
    evidencePack,
    recommendedNextAction,
  });
  const highlights = {
    topProof: selectTopProof(proofs),
    topEntity: selectTopEntity(entities),
    topBlockingQuestion: selectTopBlockingQuestion(openQuestions),
  };
  const overview = {
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
  };
  const workspacePack = buildCaseWikiWorkspacePack({
    overview,
    highlights,
    evidencePack,
    openQuestions,
    timeline,
    focusPack,
    previewPack,
    recommendedNextAction,
    costSummary: params.costSummary ?? null,
  });
  const operatorPreviewPack = buildCaseWikiOperatorPreviewPack({
    caseId: context.caseId,
    sessionId: context.selectedSession.sessionId,
    generatedAt: context.generatedAt,
    compliance,
    overview,
    evidencePack,
    highlights,
    handoffPack,
    detailPack,
    actionPack,
    previewPack,
    recommendedNextAction,
    counts: {
      entities: entities.length,
      proofs: proofs.length,
      openQuestions: openQuestions.length,
      timeline: timeline.length,
    },
    openQuestions,
    timeline,
    auditLog,
  });

  const unsignedWiki: Omit<CaseWiki, "evidenceSignature"> = {
    schemaVersion: 1,
    caseId: context.caseId,
    sessionId: context.selectedSession.sessionId,
    userId: context.userId,
    generatedAt: context.generatedAt,
    overview,
    highlights,
    evidencePack,
    compliance,
    handoffPack,
    detailPack,
    routingPack,
    actionPack,
    focusPack,
    previewPack,
    workspacePack,
    operatorPreviewPack,
    entities,
    timeline,
    auditLog,
    proofs,
    openQuestions,
    recommendedNextAction,
  };

  return {
    ...unsignedWiki,
    evidenceSignature: signEvidencePayload(unsignedWiki, {
      enabled: false,
      privateKeyPem: null,
      keyId: null,
      signerId: "api-backend",
      ...params.evidenceSigner,
      signedAt: params.evidenceSigner?.signedAt ?? context.generatedAt,
    }),
  };
}
