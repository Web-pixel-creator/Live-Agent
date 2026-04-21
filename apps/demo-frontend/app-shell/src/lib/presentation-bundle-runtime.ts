import type { WorkspaceCase } from "../data/workspace";
import {
  buildPresentationBundleIndexEntry,
  type BundleCounterfactualRow,
  type BundleEvidence,
  type BundleTimelinePhase,
  type BundleTimelineStep,
  type PresentationBundle,
  type PresentationBundleIndexEntry,
} from "../data/presentationBundles";

export type RuntimePresentationCaseWiki = {
  caseId: string;
  sessionId: string | null;
  generatedAt: string;
  overview: {
    title: string;
    summary: string;
    status: "active" | "waiting_on_customer" | "waiting_on_operator" | "blocked" | "resolved";
    customerGoal: string | null;
    currentStage: string | null;
    lastMeaningfulUpdateAt: string | null;
  };
  highlights: {
    topProof?: {
      id: string;
      statement: string;
      status: string;
      confidence: number | null;
      evidenceSummary: string | null;
      contradictionNote: string | null;
      sourceRefs: string[];
    } | null;
    topEntity?: {
      id: string;
      kind: string;
      label: string;
      role: string | null;
      description: string | null;
      sourceRefs: string[];
    } | null;
    topBlockingQuestion?: {
      id: string;
      question: string;
      priority: "low" | "medium" | "high";
      blocking: boolean;
      owner: string | null;
      suggestedNextStep: string | null;
      sourceRefs: string[];
    } | null;
  };
  entities: Array<{
    id: string;
    kind: string;
    label: string;
    role: string | null;
    description: string | null;
    sourceRefs: string[];
  }>;
  timeline: Array<{
    ts: string;
    kind: string | null;
    title: string;
    summary: string;
    sourceRefs: string[];
  }>;
  proofs: Array<{
    id: string;
    statement: string;
    status: string;
    confidence: number | null;
    evidenceSummary: string | null;
    contradictionNote: string | null;
    sourceRefs: string[];
  }>;
  openQuestions: Array<{
    id: string;
    question: string;
    priority: "low" | "medium" | "high";
    blocking: boolean;
    owner: string | null;
    suggestedNextStep: string | null;
    sourceRefs: string[];
  }>;
  recommendedNextAction: {
    type: string;
    title: string;
    summary: string;
    owner: string | null;
    dueBy: string | null;
    blocking: boolean;
    relatedQuestionIds: string[];
    sourceRefs: string[];
  } | null;
  compliance?: {
    templateId?: string | null;
    enforcement?: {
      exportReady?: boolean;
      status?: string;
      blockingReasons?: string[];
      artifactPosture?: {
        totalItems?: number;
        rawCount?: number;
        redactedCount?: number;
        signedCount?: number;
        blockingRefs?: string[];
        items?: Array<{
          ref: string;
          posture: "raw" | "redacted" | "signed";
          source: string;
        }>;
      } | null;
      remediation?: {
        primaryAction?: {
          title?: string;
          summary?: string;
          blockingRef?: string | null;
          operatorActionLabel?: string;
          requiredPosture?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
  evidenceSignature?: {
    status?: "signed" | "unsigned" | null;
    payloadHash?: string | null;
    signedAt?: string | null;
    signerId?: string | null;
  } | null;
};

export type RuntimePresentationSessionReplay = {
  evidenceSignature?: {
    status?: "signed" | "unsigned" | null;
    payloadHash?: string | null;
    signedAt?: string | null;
  } | null;
  selectedSession?: {
    workflow?: {
      workflowRoute?: string | null;
      workflowIntent?: string | null;
      workflowCurrentStage?: string | null;
      workflowHandoffStatus?: string | null;
      workflowFollowUpStatus?: string | null;
    } | null;
    replay?: {
      latestVerifiedSummary?: string | null;
      latestVerifiedStage?: string | null;
      latestProofPointer?: {
        runId?: string | null;
        summary?: string | null;
        verifiedAt?: string | null;
        route?: string | null;
        intent?: string | null;
        contextSource?: string | null;
        ingressSource?: string | null;
        workflowStage?: string | null;
      } | null;
      liveTransport?: {
        mode?: string | null;
        status?: string | null;
        fallbackEventCount?: number | null;
        firstAudioMs?: number | null;
        firstOutputMs?: number | null;
      } | null;
    } | null;
  } | null;
};

function toOptionalString(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function sentenceCase(value: string | null | undefined): string | null {
  const normalized = toOptionalString(value);
  if (!normalized) {
    return null;
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function readableToken(value: string | null | undefined): string | null {
  const normalized = toOptionalString(value);
  if (!normalized) {
    return null;
  }
  return sentenceCase(normalized.replace(/[_-]+/g, " "));
}

function compactHash(value: string | null | undefined): string | null {
  const normalized = toOptionalString(value);
  if (!normalized) {
    return null;
  }
  if (normalized.length <= 22) {
    return normalized;
  }
  return `${normalized.slice(0, 18)}…${normalized.slice(-6)}`;
}

function findPersonLabel(
  wiki: RuntimePresentationCaseWiki,
  fallbackCase?: WorkspaceCase | null,
): string {
  const person =
    wiki.entities.find((item) => item.kind === "person" && item.label.trim().length > 0)?.label ??
    fallbackCase?.client ??
    readableToken(wiki.overview.title) ??
    wiki.caseId;
  return person;
}

function resolveOutcomeTone(
  wiki: RuntimePresentationCaseWiki,
): PresentationBundle["outcomeTone"] {
  if (wiki.overview.status === "resolved" && wiki.compliance?.enforcement?.exportReady !== false) {
    return "mint";
  }
  if (
    wiki.overview.status === "blocked" ||
    wiki.compliance?.enforcement?.exportReady === false
  ) {
    return "rose";
  }
  return "amber";
}

function resolveOutcomeLabel(
  wiki: RuntimePresentationCaseWiki,
  tone: PresentationBundle["outcomeTone"],
): string {
  if (wiki.overview.status === "resolved") {
    return wiki.compliance?.enforcement?.exportReady === false
      ? "Resolved · export blocked"
      : "Resolved · export ready";
  }
  if (tone === "rose") {
    return "Blocked · operator review";
  }
  if (wiki.overview.status === "waiting_on_customer") {
    return "Pending · customer follow-up";
  }
  if (wiki.overview.status === "waiting_on_operator") {
    return "Pending · operator approval";
  }
  return "Active · next action ready";
}

function resolveTitle(
  wiki: RuntimePresentationCaseWiki,
  tone: PresentationBundle["outcomeTone"],
  subject: string,
): Pick<PresentationBundle, "titleLead" | "titleItalic"> {
  if (wiki.overview.status === "resolved") {
    return { titleLead: "Closing the loop for", titleItalic: subject };
  }
  if (tone === "rose") {
    return { titleLead: "Holding a risky action for", titleItalic: subject };
  }
  if (wiki.overview.status === "waiting_on_customer") {
    return { titleLead: "Chasing the missing proof for", titleItalic: subject };
  }
  if (wiki.overview.status === "waiting_on_operator") {
    return { titleLead: "Bringing an approval to", titleItalic: subject };
  }
  return { titleLead: "Moving the case for", titleItalic: subject };
}

function formatDuration(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) {
    return "—";
  }
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return "—";
  }
  const totalSeconds = Math.max(1, Math.round((end - start) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}h`;
  }
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

function formatMarker(fromIso: string | null, currentIso: string): string {
  const start = fromIso ? Date.parse(fromIso) : Number.NaN;
  const current = Date.parse(currentIso);
  if (Number.isNaN(start) || Number.isNaN(current) || current < start) {
    return "t+0s";
  }
  return `t+${formatDuration(fromIso, current)}`;
}

function resolvePhase(
  item: RuntimePresentationCaseWiki["timeline"][number],
  index: number,
  total: number,
): BundleTimelinePhase {
  const haystack = `${item.kind ?? ""} ${item.title} ${item.summary}`.toLowerCase();
  if (/(approval|handoff|remediation|resolved|sent|dispatch|follow-up|follow up|export|signature)/.test(haystack)) {
    return "resolution";
  }
  if (/(gap|missing|review|risk|blocked|detect|verification|proof|compliance)/.test(haystack)) {
    return "detection";
  }
  if (index <= 1 || index < Math.ceil(total / 3)) {
    return "intake";
  }
  if (index >= Math.floor((total * 2) / 3)) {
    return "resolution";
  }
  return "detection";
}

function resolveActor(item: RuntimePresentationCaseWiki["timeline"][number]): BundleTimelineStep["actor"] {
  const refs = item.sourceRefs.map((entry) => entry.toLowerCase());
  if (item.kind === "operator_note" || refs.some((entry) => entry.includes("operator"))) {
    return "Operator";
  }
  if (item.kind === "approval") {
    return "Operator";
  }
  if (item.kind === "session") {
    return "Client";
  }
  if (item.kind === "workflow") {
    return "AI";
  }
  return "System";
}

function buildTimeline(wiki: RuntimePresentationCaseWiki): BundleTimelineStep[] {
  const ordered = [...wiki.timeline].sort((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
  const startIso = ordered[0]?.ts ?? wiki.generatedAt;
  return ordered.slice(0, 7).map((item, index, items) => ({
    marker: formatMarker(startIso, item.ts),
    stage: item.title,
    actor: resolveActor(item),
    note: item.summary,
    phase: resolvePhase(item, index, items.length),
  }));
}

function addEvidenceItem(target: BundleEvidence[], item: BundleEvidence | null): void {
  if (!item || target.length >= 5) {
    return;
  }
  if (target.some((entry) => entry.kind === item.kind && entry.title === item.title)) {
    return;
  }
  target.push(item);
}

function summarizeArtifactPosture(wiki: RuntimePresentationCaseWiki): string | null {
  const posture = wiki.compliance?.enforcement?.artifactPosture;
  if (!posture) {
    return null;
  }
  const parts = [
    typeof posture.totalItems === "number" ? `${posture.totalItems} tracked artifacts` : null,
    typeof posture.rawCount === "number" ? `${posture.rawCount} raw` : null,
    typeof posture.redactedCount === "number" ? `${posture.redactedCount} redacted` : null,
    typeof posture.signedCount === "number" ? `${posture.signedCount} signed` : null,
  ].filter((entry): entry is string => Boolean(entry));
  if (parts.length === 0) {
    return null;
  }
  return parts.join(" · ");
}

function extractSourceNodeId(
  wiki: RuntimePresentationCaseWiki,
  fallbackCase?: WorkspaceCase | null,
): string | null {
  if (fallbackCase?.sourceNodeId) {
    return fallbackCase.sourceNodeId;
  }
  const refs = [
    ...wiki.timeline.flatMap((item) => item.sourceRefs),
    ...wiki.entities.flatMap((item) => item.sourceRefs),
    ...wiki.proofs.flatMap((item) => item.sourceRefs),
  ];
  for (const ref of refs) {
    const match = ref.match(/(NODE-[A-Z0-9-]+)/i);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }
  return null;
}

function buildEvidence(
  wiki: RuntimePresentationCaseWiki,
  replay: RuntimePresentationSessionReplay | null,
  fallbackCase?: WorkspaceCase | null,
): BundleEvidence[] {
  const evidence: BundleEvidence[] = [];
  const country = toOptionalString(fallbackCase?.country);
  for (const entity of wiki.entities.filter((item) => item.kind === "document").slice(0, 2)) {
    addEvidenceItem(evidence, {
      title: entity.label,
      kind: "Document",
      contribution:
        toOptionalString(entity.description) ??
        "Compiled as a repo-owned document source inside Case Wiki.",
      country,
      tag: entity.sourceRefs[0] ?? undefined,
    });
  }
  for (const proof of wiki.proofs.slice(0, 2)) {
    addEvidenceItem(evidence, {
      title: sentenceCase(proof.statement) ?? "Compiled proof",
      kind: "Signal",
      contribution:
        toOptionalString(proof.evidenceSummary) ??
        toOptionalString(proof.contradictionNote) ??
        `Proof posture is ${proof.status}.`,
      tag: proof.sourceRefs[0] ?? undefined,
    });
  }
  const artifactSummary = summarizeArtifactPosture(wiki);
  if (artifactSummary) {
    addEvidenceItem(evidence, {
      title: "Artifact posture",
      kind: "External check",
      contribution: artifactSummary,
      tag: sentenceCase(wiki.compliance?.enforcement?.status) ?? undefined,
    });
  }
  const signatureHash =
    compactHash(replay?.evidenceSignature?.payloadHash) ??
    compactHash(wiki.evidenceSignature?.payloadHash);
  if (signatureHash) {
    addEvidenceItem(evidence, {
      title: "Evidence signature",
      kind: "External check",
      contribution:
        wiki.evidenceSignature?.status === "signed"
          ? "Compiled replay and Case Wiki evidence carry a signed envelope."
          : "Compiled evidence remains unsigned, so export posture stays explicit.",
      tag: signatureHash,
    });
  }
  const nodeId = extractSourceNodeId(wiki, fallbackCase);
  const liveTransport = replay?.selectedSession?.replay?.liveTransport;
  if (nodeId || liveTransport) {
    const telemetryBits = [
      nodeId ? `${nodeId} observed` : null,
      toOptionalString(liveTransport?.status) ?? toOptionalString(liveTransport?.mode),
      typeof liveTransport?.fallbackEventCount === "number"
        ? `${liveTransport.fallbackEventCount} fallback events`
        : null,
    ].filter((entry): entry is string => Boolean(entry));
    addEvidenceItem(evidence, {
      title: nodeId ? `${nodeId} telemetry` : "Runtime transport telemetry",
      kind: "Node telemetry",
      contribution:
        telemetryBits.length > 0
          ? telemetryBits.join(" · ")
          : "Transport and capture posture stayed attached to the replay snapshot.",
      tag: nodeId ?? undefined,
    });
  }
  if (evidence.length === 0) {
    addEvidenceItem(evidence, {
      title: "Compiled case summary",
      kind: "Signal",
      contribution: wiki.overview.summary,
      tag: wiki.caseId,
    });
  }
  return evidence;
}

function buildCounterfactualRows(
  wiki: RuntimePresentationCaseWiki,
  replay: RuntimePresentationSessionReplay | null,
): BundleCounterfactualRow[] {
  const blockingCount = wiki.openQuestions.filter((item) => item.blocking).length;
  const signatureStatus = wiki.evidenceSignature?.status === "signed" ? "signed" : "unsigned";
  const exportPosture = wiki.compliance?.enforcement?.exportReady === false ? "blocked" : "ready";
  const proofContext =
    toOptionalString(replay?.selectedSession?.replay?.latestProofPointer?.contextSource) ??
    "compiled case wiki";
  return [
    {
      label: "Open blockers",
      withDesk: String(blockingCount),
      withoutDesk: "manual inbox triage",
      direction: "better",
    },
    {
      label: "Next action clarity",
      withDesk: toOptionalString(wiki.recommendedNextAction?.title) ?? "resolved",
      withoutDesk: "operator synthesis",
      direction: "better",
    },
    {
      label: "Evidence posture",
      withDesk: `${signatureStatus} · ${exportPosture}`,
      withoutDesk: "notes + screenshots",
      direction: "better",
    },
    {
      label: "Proof provenance",
      withDesk: proofContext,
      withoutDesk: "not preserved",
      direction: "better",
    },
  ];
}

function buildVerdict(
  wiki: RuntimePresentationCaseWiki,
  replay: RuntimePresentationSessionReplay | null,
): string {
  const lines = [
    toOptionalString(wiki.overview.summary),
    toOptionalString(wiki.recommendedNextAction?.summary),
    wiki.compliance?.enforcement?.exportReady === false
      ? sentenceCase(wiki.compliance?.enforcement?.blockingReasons?.[0]) ??
        "Compliance enforcement is still blocking export and handoff."
      : null,
    toOptionalString(replay?.selectedSession?.replay?.latestVerifiedSummary),
  ].filter((entry): entry is string => Boolean(entry));
  return lines[0] ?? "Repo-owned case evidence is ready for review.";
}

function buildDecisionSummary(
  wiki: RuntimePresentationCaseWiki,
  replay: RuntimePresentationSessionReplay | null,
): string {
  const parts = [
    toOptionalString(wiki.overview.summary),
    toOptionalString(wiki.recommendedNextAction?.summary),
    toOptionalString(replay?.selectedSession?.replay?.latestVerifiedSummary),
  ].filter((entry): entry is string => Boolean(entry));
  return parts.join(" ");
}

function buildDecisionChanges(
  wiki: RuntimePresentationCaseWiki,
  replay: RuntimePresentationSessionReplay | null,
): PresentationBundle["decision"]["changes"] {
  const changes: PresentationBundle["decision"]["changes"] = [];
  if (wiki.recommendedNextAction) {
    changes.push({
      kind: wiki.recommendedNextAction.blocking ? "changed" : "added",
      label: wiki.recommendedNextAction.title,
      detail: wiki.recommendedNextAction.summary,
    });
  }
  const remediation = wiki.compliance?.enforcement?.remediation?.primaryAction;
  if (remediation?.title) {
    changes.push({
      kind: "added",
      label: remediation.title,
      detail: remediation.summary ?? remediation.operatorActionLabel,
    });
  }
  const ingressSource = toOptionalString(
    replay?.selectedSession?.replay?.latestProofPointer?.ingressSource,
  );
  if (ingressSource) {
    changes.push({
      kind: "added",
      label: "Context ingress",
      detail: readableToken(ingressSource) ?? ingressSource,
    });
  }
  if (changes.length === 0) {
    changes.push({
      kind: "changed",
      label: "Compiled memory",
      detail: "Case Wiki and replay remained aligned across the selected session.",
    });
  }
  return changes.slice(0, 3);
}

function resolveConfidence(
  wiki: RuntimePresentationCaseWiki,
  tone: PresentationBundle["outcomeTone"],
): number {
  const proofConfidence = wiki.highlights.topProof?.confidence ?? wiki.proofs[0]?.confidence;
  if (typeof proofConfidence === "number" && Number.isFinite(proofConfidence)) {
    return Math.max(40, Math.min(99, Math.round(proofConfidence)));
  }
  if (tone === "mint") {
    return 91;
  }
  if (tone === "rose") {
    return 78;
  }
  return 84;
}

function resolveKicker(wiki: RuntimePresentationCaseWiki): string {
  return `Runtime case · ${toOptionalString(wiki.overview.currentStage) ?? readableToken(wiki.overview.status) ?? "case review"}`;
}

function resolvePolicyHash(
  wiki: RuntimePresentationCaseWiki,
  replay: RuntimePresentationSessionReplay | null,
): string {
  return (
    compactHash(replay?.evidenceSignature?.payloadHash) ??
    compactHash(wiki.evidenceSignature?.payloadHash) ??
    `case-wiki/${toOptionalString(wiki.compliance?.templateId) ?? "baseline"}`
  );
}

function resolveCounterfactualQuote(tone: PresentationBundle["outcomeTone"]): string {
  if (tone === "mint") {
    return "A clean case is one where the operator can point to the trail and move on.";
  }
  if (tone === "rose") {
    return "Stopping early is the right outcome when the evidence is not ready to travel.";
  }
  return "The desk earns trust by making the next safe action explicit before the operator has to improvise.";
}

export function buildRuntimePresentationBundle(params: {
  wiki: RuntimePresentationCaseWiki;
  replay?: RuntimePresentationSessionReplay | null;
  fallbackCase?: WorkspaceCase | null;
}): PresentationBundle {
  const { wiki, replay = null, fallbackCase = null } = params;
  const tone = resolveOutcomeTone(wiki);
  const subject = findPersonLabel(wiki, fallbackCase);
  const { titleLead, titleItalic } = resolveTitle(wiki, tone, subject);
  const timeline = buildTimeline(wiki);
  const firstTimelineTs = wiki.timeline[0]?.ts ?? wiki.generatedAt;
  const lastTimelineTs = wiki.timeline[wiki.timeline.length - 1]?.ts ?? wiki.generatedAt;
  const operator =
    toOptionalString(wiki.recommendedNextAction?.owner) ??
    toOptionalString(wiki.highlights.topBlockingQuestion?.owner) ??
    fallbackCase?.owner ??
    "Operator";

  return {
    id: wiki.caseId,
    source: "runtime",
    runtimeSource: {
      caseId: wiki.caseId,
      sessionId: wiki.sessionId,
    },
    caseRef: wiki.caseId,
    policyHash: resolvePolicyHash(wiki, replay),
    generatedAt: wiki.generatedAt,
    kicker: resolveKicker(wiki),
    titleLead,
    titleItalic,
    verdict: buildVerdict(wiki, replay),
    operator,
    duration: formatDuration(firstTimelineTs, lastTimelineTs),
    outcomeTone: tone,
    confidence: resolveConfidence(wiki, tone),
    outcomeLabel: resolveOutcomeLabel(wiki, tone),
    timelineLead:
      "Every turn below comes from the same compiled case memory and replay evidence the operator is using live.",
    decisionLead:
      "The decision block keeps the next safe action, the governing posture, and the latest verified proof in one read.",
    evidenceLead:
      "These artifacts are derived from repo-owned Case Wiki, replay, and compliance posture rather than hand-authored demo notes.",
    counterfactualLead:
      "This is the value of the desk in one glance: fewer hidden blockers, clearer next action, and preserved proof provenance.",
    timeline,
    decision: {
      question:
        toOptionalString(wiki.highlights.topBlockingQuestion?.question) ??
        toOptionalString(wiki.recommendedNextAction?.title) ??
        `What is the next safe action for ${wiki.caseId}?`,
      summary: buildDecisionSummary(wiki, replay),
      policyName:
        toOptionalString(replay?.selectedSession?.workflow?.workflowRoute) ??
        `Case Wiki · ${toOptionalString(wiki.compliance?.templateId) ?? "baseline"}`,
      policyDescription:
        toOptionalString(replay?.selectedSession?.replay?.latestVerifiedStage) ??
        toOptionalString(wiki.overview.currentStage) ??
        "Compiled memory, replay, and compliance posture remain aligned for this case.",
      changes: buildDecisionChanges(wiki, replay),
    },
    evidence: buildEvidence(wiki, replay, fallbackCase),
    counterfactual: {
      pullQuote: resolveCounterfactualQuote(tone),
      rows: buildCounterfactualRows(wiki, replay),
    },
  };
}

export function buildRuntimePresentationBundles(params: {
  caseWikis: RuntimePresentationCaseWiki[];
  cases?: WorkspaceCase[];
  replaysBySessionId?: Record<string, RuntimePresentationSessionReplay | null | undefined>;
}): PresentationBundle[] {
  const caseLookup = new Map<string, WorkspaceCase>();
  for (const item of params.cases ?? []) {
    caseLookup.set(item.ref, item);
    if (item.caseId) {
      caseLookup.set(item.caseId, item);
    }
    if (item.sessionId) {
      caseLookup.set(item.sessionId, item);
    }
  }
  return [...params.caseWikis]
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
    .map((wiki) =>
      buildRuntimePresentationBundle({
        wiki,
        replay: wiki.sessionId ? params.replaysBySessionId?.[wiki.sessionId] ?? null : null,
        fallbackCase:
          (wiki.sessionId ? caseLookup.get(wiki.sessionId) : null) ??
          caseLookup.get(wiki.caseId) ??
          null,
      }),
    );
}

export function buildPresentationBundleIndex(
  bundles: PresentationBundle[],
): PresentationBundleIndexEntry[] {
  return bundles.map(buildPresentationBundleIndexEntry);
}

export function matchesPresentationBundleRef(
  bundle: PresentationBundle,
  ref: string | null | undefined,
): boolean {
  const normalized = toOptionalString(ref);
  if (!normalized) {
    return false;
  }
  return (
    bundle.id === normalized ||
    bundle.caseRef === normalized ||
    bundle.runtimeSource?.caseId === normalized ||
    bundle.runtimeSource?.sessionId === normalized
  );
}
