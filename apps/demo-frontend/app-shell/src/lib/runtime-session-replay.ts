import type { WorkspaceCase } from "../data/workspace";
import type { RuntimeCaseWiki } from "../hooks/useWorkspaceRuntime";
import { fetchRuntimeApi } from "./runtime-api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => toText(item))
        .filter((item): item is string => Boolean(item))
    : [];
}

function toFollowupPath(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      const item = asRecord(entry);
      if (!item) {
        return null;
      }
      const level = toText(item.level) ?? "path";
      const label = toText(item.label);
      const targetLabel = toText(item.targetLabel);
      const ctaLabel = toText(item.ctaLabel);
      const stateLabel = toText(item.stateLabel);
      const detail = [targetLabel, stateLabel, ctaLabel].filter(Boolean).join(" - ");
      if (!label) {
        return null;
      }
      return detail.length > 0 ? `${level}: ${label} (${detail})` : `${level}: ${label}`;
    })
    .filter((item): item is string => Boolean(item));
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "now";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "now";
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

export type RuntimeSessionReplaySummary = {
  generatedAt: string | null;
  sessionId: string | null;
  sessionStatus: string | null;
  workflowLinked: boolean | null;
  workflowExecutionStatus: string | null;
  workflowCurrentStage: string | null;
  workflowRoute: string | null;
  workflowIntent: string | null;
  replayState: string | null;
  resumeReady: boolean | null;
  resumeBlockedBy: string | null;
  nextOperatorAction: string | null;
  nextOperatorActionLabel: string | null;
  nextOperatorWorkspace: string | null;
  nextOperatorChecklist: string[];
  nextOperatorRemainingSteps: string[];
  nextOperatorStepProgressLabel: string | null;
  boundaryOwnerRole: string | null;
  boundaryOwnerName: string | null;
  boundaryOwnerSessionId: string | null;
  approvalGateStatus: string | null;
  approvalGateReason: string | null;
  approvalGatePendingCount: number | null;
  workflowBoundaryKind: string | null;
  workflowBoundarySummary: string | null;
  workflowBoundaryNextStep: string | null;
  workflowBoundaryOwner: string | null;
  latestProofSummary: string | null;
  latestProofVerifiedAt: string | null;
  latestProofRoute: string | null;
  latestProofIntent: string | null;
  latestProofContextSource: string | null;
  latestProofIngressSource: string | null;
  latestTurnContextSource: string | null;
  latestTurnIngressSource: string | null;
  latestVerifiedContextSource: string | null;
  latestVerifiedContextIngressSource: string | null;
  recoveryPathLabel: string | null;
  recoveryPathAction: string | null;
  recoveryHandoffTargetLabel: string | null;
  recoveryHandoffReason: string | null;
  liveTransportMode: string | null;
  liveTransportProvider: string | null;
  liveTransportBootstrapState: string | null;
  liveTransportEvidenceSource: string | null;
  liveTransportFallbackReason: string | null;
  liveTransportFirstAudioMs: number | null;
  liveTransportFirstOutputMs: number | null;
  primaryStepLabel: string | null;
  primaryStepCtaLabel: string | null;
  primaryStepTargetLabel: string | null;
  primaryStepActionMode: string | null;
  primaryStepSurfaceState: string | null;
  primaryStepNeedsRefresh: boolean | null;
  primaryStepRefreshDisposition: string | null;
  primaryStepRefreshEvidenceHint: string | null;
  primaryStepRefreshOutcomeLabel: string | null;
  primaryStepRefreshDetourHint: string | null;
  primaryStepRefreshCompatibility: string | null;
  primaryStepRefreshFollowupPath: string[];
  evidenceSignatureStatus: string | null;
};

export type SessionExportPayload = {
  exportedAt: string;
  case: {
    ref: string;
    caseId: string | null;
    sessionId: string | null;
    client: string;
    owner: string;
    stage: string;
    status: string;
    country: string;
    visa: string;
  };
  caseWiki: {
    generatedAt: string | null;
    summary: string | null;
    status: string | null;
    currentStage: string | null;
    customerGoal: string | null;
    blocker: string | null;
    nextAction: string | null;
    exportReady: boolean | null;
    complianceStatus: string | null;
    complianceSummary: string | null;
    evidenceSignatureStatus: string | null;
    remediationTitle: string | null;
    remediationSummary: string | null;
    sourceRefs: string[];
  };
  sessionReplay: RuntimeSessionReplaySummary | null;
  runtimeSurface: {
    status: string | null;
    latestCaseWikiContextSource: string | null;
    latestCaseWikiIngressSource: string | null;
    latestCaseWikiFocusId: string | null;
    latestCaseWikiBlocker: string | null;
    latestCaseWikiNextAction: string | null;
    latestCaseWikiRoute: string | null;
  };
};

export async function fetchRuntimeSessionReplay(
  sessionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown> | null> {
  const search = new URLSearchParams({
    sessionId,
    sessionLimit: "12",
    eventLimit: "120",
    runLimit: "120",
    approvalLimit: "120",
    recentEventLimit: "120",
  });
  const response = await fetchRuntimeApi(`/v1/runtime/session-replay?${search.toString()}`, {
    headers: {
      "x-operator-role": "viewer",
    },
  }, fetchImpl);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`runtime_session_replay_${response.status}`);
  }
  const payload = (await response.json()) as { data?: unknown };
  return asRecord(payload.data);
}

export function buildRuntimeSessionReplaySummary(
  snapshot: unknown,
): RuntimeSessionReplaySummary | null {
  const root = asRecord(snapshot);
  if (!root) {
    return null;
  }
  const selectedSession = asRecord(root.selectedSession);
  const session = asRecord(selectedSession?.session);
  const workflow = asRecord(selectedSession?.workflow);
  const replay = asRecord(selectedSession?.replay);
  if (!workflow && !replay && !session) {
    return null;
  }

  const boundaryOwner = asRecord(replay?.boundaryOwner);
  const approvalGate = asRecord(replay?.approvalGate);
  const workflowBoundarySummary = asRecord(replay?.workflowBoundarySummary);
  const latestProofPointer = asRecord(replay?.latestProofPointer);
  const recoveryPathHint = asRecord(replay?.recoveryPathHint);
  const recoveryHandoff = asRecord(replay?.recoveryHandoff);
  const liveTransport = asRecord(replay?.liveTransport);
  const primaryStep = asRecord(replay?.nextOperatorPrimaryStep);
  const stepProgress = asRecord(replay?.nextOperatorStepProgress);
  const refreshState = asRecord(primaryStep?.refreshState);
  const refreshCompatibility = asRecord(refreshState?.compatibility);
  const evidenceSignature = asRecord(root.evidenceSignature);

  return {
    generatedAt: toText(root.generatedAt),
    sessionId: toText(root.selectedSessionId) ?? toText(session?.sessionId),
    sessionStatus: toText(session?.status),
    workflowLinked: toBoolean(workflow?.linked),
    workflowExecutionStatus: toText(workflow?.workflowExecutionStatus),
    workflowCurrentStage: toText(workflow?.workflowCurrentStage),
    workflowRoute: toText(workflow?.workflowRoute),
    workflowIntent: toText(workflow?.workflowIntent),
    replayState: toText(replay?.replayState),
    resumeReady: toBoolean(replay?.resumeReady),
    resumeBlockedBy: toText(replay?.resumeBlockedBy),
    nextOperatorAction: toText(replay?.nextOperatorAction),
    nextOperatorActionLabel: toText(replay?.nextOperatorActionLabel),
    nextOperatorWorkspace: toText(replay?.nextOperatorWorkspace),
    nextOperatorChecklist: toStringArray(replay?.nextOperatorChecklist),
    nextOperatorRemainingSteps: toStringArray(replay?.nextOperatorRemainingSteps),
    nextOperatorStepProgressLabel: toText(stepProgress?.label),
    boundaryOwnerRole: toText(boundaryOwner?.role),
    boundaryOwnerName: toText(boundaryOwner?.owner),
    boundaryOwnerSessionId: toText(boundaryOwner?.sessionId),
    approvalGateStatus: toText(approvalGate?.status),
    approvalGateReason: toText(approvalGate?.reason),
    approvalGatePendingCount: toNumber(approvalGate?.pendingCount),
    workflowBoundaryKind: toText(workflowBoundarySummary?.kind),
    workflowBoundarySummary: toText(workflowBoundarySummary?.summary),
    workflowBoundaryNextStep: toText(workflowBoundarySummary?.nextStep),
    workflowBoundaryOwner: toText(workflowBoundarySummary?.owner),
    latestProofSummary: toText(latestProofPointer?.summary),
    latestProofVerifiedAt: toText(latestProofPointer?.verifiedAt),
    latestProofRoute: toText(latestProofPointer?.route),
    latestProofIntent: toText(latestProofPointer?.intent),
    latestProofContextSource: toText(latestProofPointer?.contextSource),
    latestProofIngressSource: toText(latestProofPointer?.ingressSource),
    latestTurnContextSource: toText(replay?.latestContextSource),
    latestTurnIngressSource: toText(replay?.latestContextIngressSource),
    latestVerifiedContextSource: toText(replay?.latestVerifiedContextSource),
    latestVerifiedContextIngressSource: toText(replay?.latestVerifiedContextIngressSource),
    recoveryPathLabel: toText(recoveryPathHint?.label),
    recoveryPathAction: toText(recoveryPathHint?.action),
    recoveryHandoffTargetLabel: toText(recoveryHandoff?.targetLabel),
    recoveryHandoffReason: toText(recoveryHandoff?.reason),
    liveTransportMode: toText(liveTransport?.activeMode),
    liveTransportProvider: toText(liveTransport?.provider),
    liveTransportBootstrapState: toText(liveTransport?.bootstrapState),
    liveTransportEvidenceSource: toText(liveTransport?.evidenceSource),
    liveTransportFallbackReason: toText(liveTransport?.fallbackReason),
    liveTransportFirstAudioMs: toNumber(liveTransport?.firstAudioMs),
    liveTransportFirstOutputMs: toNumber(liveTransport?.firstOutputMs),
    primaryStepLabel: toText(primaryStep?.label),
    primaryStepCtaLabel: toText(primaryStep?.ctaLabel),
    primaryStepTargetLabel: toText(primaryStep?.targetLabel),
    primaryStepActionMode: toText(primaryStep?.actionMode),
    primaryStepSurfaceState: toText(primaryStep?.surfaceState),
    primaryStepNeedsRefresh: toBoolean(primaryStep?.needsRefresh),
    primaryStepRefreshDisposition:
      toText(refreshState?.disposition) ?? toText(primaryStep?.refreshDisposition),
    primaryStepRefreshEvidenceHint:
      toText(refreshState?.evidenceHint) ?? toText(primaryStep?.refreshEvidenceHint),
    primaryStepRefreshOutcomeLabel:
      toText(refreshState?.outcomeLabel) ?? toText(primaryStep?.refreshOutcomeLabel),
    primaryStepRefreshDetourHint:
      toText(refreshState?.detourHint) ?? toText(primaryStep?.refreshDetourHint),
    primaryStepRefreshCompatibility:
      toText(refreshCompatibility?.legacyProjection) ?? toText(primaryStep?.legacyProjection),
    primaryStepRefreshFollowupPath: toFollowupPath(refreshState?.followupPath),
    evidenceSignatureStatus: toText(evidenceSignature?.status),
  };
}

function collectCaseWikiRefs(wiki: RuntimeCaseWiki | undefined): string[] {
  if (!wiki) {
    return [];
  }
  const refs = new Set<string>();
  const pushRefs = (items: string[] | null | undefined) => {
    if (!Array.isArray(items)) {
      return;
    }
    for (const item of items) {
      const ref = toText(item);
      if (ref) {
        refs.add(ref);
      }
    }
  };
  pushRefs(wiki.recommendedNextAction?.sourceRefs);
  pushRefs(wiki.highlights.topBlockingQuestion?.sourceRefs);
  wiki.openQuestions.forEach((item) => pushRefs(item.sourceRefs));
  wiki.timeline.forEach((item) => pushRefs(item.sourceRefs));
  wiki.entities.forEach((item) => pushRefs(item.sourceRefs));
  return [...refs].slice(0, 16);
}

export function buildSessionExportPayload(params: {
  caseValue: WorkspaceCase;
  wiki: RuntimeCaseWiki | undefined;
  replaySummary: RuntimeSessionReplaySummary | null;
  runtimeDiagnostics: Record<string, unknown> | null;
}): SessionExportPayload {
  const diagnostics = asRecord(params.runtimeDiagnostics);
  const orchestrator = asRecord(diagnostics?.orchestrator);
  const routingContext = asRecord(orchestrator?.latestCaseWikiRoutingContext);
  const blocker = params.wiki?.highlights.topBlockingQuestion?.question ?? null;
  const nextAction = params.wiki?.recommendedNextAction
    ? `${params.wiki.recommendedNextAction.title} - ${params.wiki.recommendedNextAction.summary}`
    : null;

  return {
    exportedAt: new Date().toISOString(),
    case: {
      ref: params.caseValue.ref,
      caseId: params.caseValue.caseId ?? null,
      sessionId: params.caseValue.sessionId ?? null,
      client: params.caseValue.client,
      owner: params.caseValue.owner,
      stage: params.caseValue.stage,
      status: params.caseValue.status,
      country: params.caseValue.country,
      visa: params.caseValue.visa,
    },
    caseWiki: {
      generatedAt: params.wiki?.generatedAt ?? null,
      summary: params.wiki?.overview.summary ?? null,
      status: params.wiki?.overview.status ?? null,
      currentStage: params.wiki?.overview.currentStage ?? null,
      customerGoal: params.wiki?.overview.customerGoal ?? null,
      blocker,
      nextAction,
      exportReady: params.wiki?.compliance?.enforcement?.exportReady ?? null,
      complianceStatus: params.wiki?.compliance?.enforcement?.status ?? null,
      complianceSummary:
        params.wiki?.compliance?.enforcement?.summary ??
        params.wiki?.operatorPreviewPack?.remediation?.draft?.summary ??
        null,
      evidenceSignatureStatus: params.wiki?.evidenceSignature?.status ?? null,
      remediationTitle: params.wiki?.operatorPreviewPack?.remediation?.draft?.title ?? null,
      remediationSummary: params.wiki?.operatorPreviewPack?.remediation?.draft?.summary ?? null,
      sourceRefs: collectCaseWikiRefs(params.wiki),
    },
    sessionReplay: params.replaySummary,
    runtimeSurface: {
      status: toText(diagnostics?.status),
      latestCaseWikiContextSource: toText(routingContext?.contextSource),
      latestCaseWikiIngressSource: toText(routingContext?.ingressSource),
      latestCaseWikiFocusId: toText(routingContext?.focusId),
      latestCaseWikiBlocker: toText(routingContext?.blocker),
      latestCaseWikiNextAction: toText(routingContext?.nextAction),
      latestCaseWikiRoute: toText(routingContext?.route),
    },
  };
}

export function buildSessionExportMarkdown(payload: SessionExportPayload): string {
  const lines: string[] = [
    "# Session Export",
    "",
    "## Case",
    `- Ref: ${payload.case.ref}`,
    `- Client: ${payload.case.client}`,
    `- Owner: ${payload.case.owner}`,
    `- Stage: ${payload.case.stage}`,
    `- Status: ${payload.case.status}`,
    `- Country: ${payload.case.country}`,
    `- Visa: ${payload.case.visa}`,
  ];

  if (payload.case.caseId) {
    lines.push(`- Case ID: ${payload.case.caseId}`);
  }
  if (payload.case.sessionId) {
    lines.push(`- Session ID: ${payload.case.sessionId}`);
  }

  lines.push(
    "",
    "## Case Wiki",
    `- Generated: ${formatTimestamp(payload.caseWiki.generatedAt)}`,
    `- Status: ${payload.caseWiki.status ?? "unknown"}`,
    `- Current stage: ${payload.caseWiki.currentStage ?? "unknown"}`,
    `- Customer goal: ${payload.caseWiki.customerGoal ?? "not published"}`,
    `- Export ready: ${payload.caseWiki.exportReady === true ? "yes" : payload.caseWiki.exportReady === false ? "no" : "unknown"}`,
    `- Compliance status: ${payload.caseWiki.complianceStatus ?? "unknown"}`,
    `- Evidence signature: ${payload.caseWiki.evidenceSignatureStatus ?? "unknown"}`,
  );

  if (payload.caseWiki.summary) {
    lines.push(`- Summary: ${payload.caseWiki.summary}`);
  }
  if (payload.caseWiki.blocker) {
    lines.push(`- Blocker: ${payload.caseWiki.blocker}`);
  }
  if (payload.caseWiki.nextAction) {
    lines.push(`- Next action: ${payload.caseWiki.nextAction}`);
  }
  if (payload.caseWiki.complianceSummary) {
    lines.push(`- Compliance summary: ${payload.caseWiki.complianceSummary}`);
  }
  if (payload.caseWiki.remediationTitle || payload.caseWiki.remediationSummary) {
    lines.push(
      `- Remediation: ${payload.caseWiki.remediationTitle ?? "draft"} - ${payload.caseWiki.remediationSummary ?? "pending"}`,
    );
  }
  if (payload.caseWiki.sourceRefs.length > 0) {
    lines.push("", "### Source refs");
    for (const ref of payload.caseWiki.sourceRefs) {
      lines.push(`- ${ref}`);
    }
  }

  lines.push("", "## Session Boundary");
  if (payload.sessionReplay) {
    lines.push(
      `- Replay state: ${payload.sessionReplay.replayState ?? "unknown"}`,
      `- Resume ready: ${
        payload.sessionReplay.resumeReady === true
          ? "yes"
          : payload.sessionReplay.resumeReady === false
            ? "no"
            : "unknown"
      }`,
      `- Workflow stage: ${payload.sessionReplay.workflowCurrentStage ?? "unknown"}`,
      `- Workflow route: ${payload.sessionReplay.workflowRoute ?? "unknown"}`,
      `- Next operator action: ${payload.sessionReplay.nextOperatorActionLabel ?? payload.sessionReplay.nextOperatorAction ?? "unknown"}`,
      `- Boundary summary: ${payload.sessionReplay.workflowBoundarySummary ?? "not published"}`,
      `- Boundary owner: ${payload.sessionReplay.boundaryOwnerName ?? payload.sessionReplay.boundaryOwnerRole ?? "unknown"}`,
      `- Approval gate: ${payload.sessionReplay.approvalGateStatus ?? "clear"}`,
      `- Latest proof: ${payload.sessionReplay.latestProofSummary ?? "not published"}`,
      `- Proof context: ${payload.sessionReplay.latestProofContextSource ?? "unknown"} via ${payload.sessionReplay.latestProofIngressSource ?? "unknown"}`,
      `- Turn context: ${payload.sessionReplay.latestTurnContextSource ?? "unknown"} via ${payload.sessionReplay.latestTurnIngressSource ?? "unknown"}`,
      `- Recovery path: ${payload.sessionReplay.recoveryPathLabel ?? "not published"}`,
    );
    if (payload.sessionReplay.nextOperatorChecklist.length > 0) {
      lines.push("", "### Next operator checklist");
      for (const item of payload.sessionReplay.nextOperatorChecklist) {
        lines.push(`- ${item}`);
      }
    }
    if (payload.sessionReplay.primaryStepNeedsRefresh && payload.sessionReplay.primaryStepRefreshFollowupPath.length > 0) {
      lines.push("", "### After refresh");
      for (const item of payload.sessionReplay.primaryStepRefreshFollowupPath) {
        lines.push(`- ${item}`);
      }
    }
  } else {
    lines.push("- Session replay is not hydrated for this case.");
  }

  lines.push(
    "",
    "## Runtime Surface",
    `- Status: ${payload.runtimeSurface.status ?? "unknown"}`,
    `- Latest Case Wiki ingress: ${payload.runtimeSurface.latestCaseWikiContextSource ?? "unknown"} via ${payload.runtimeSurface.latestCaseWikiIngressSource ?? "unknown"}`,
    `- Latest Case Wiki route: ${payload.runtimeSurface.latestCaseWikiRoute ?? "unknown"}`,
    `- Latest blocker: ${payload.runtimeSurface.latestCaseWikiBlocker ?? "none"}`,
    `- Latest next action: ${payload.runtimeSurface.latestCaseWikiNextAction ?? "none"}`,
  );

  return `${lines.join("\n")}\n`;
}
