export type RuntimeArtifactIndexEntry = {
  category: string;
  label: string;
  description: string;
  relativePath: string;
  size: number;
  updatedAt: string;
  url: string;
};

export type RuntimeArtifactDocument = {
  entry: RuntimeArtifactIndexEntry;
  payload: unknown;
  raw: string;
};

export type RuntimeArtifactStructuredRow = {
  label: string;
  value: string;
};

export type RuntimeArtifactStructuredSection = {
  title: string;
  rows: RuntimeArtifactStructuredRow[];
};

export type RuntimeArtifactStructuredView = {
  headline: string;
  sections: RuntimeArtifactStructuredSection[];
};

export type RuntimeArtifactIssueSummary = {
  headline: string;
  rows: RuntimeArtifactStructuredRow[];
};

export type RuntimeArtifactIssue =
  | "compliance-blocker"
  | "export-posture"
  | "raw-artifact-blocker"
  | "signature-pending"
  | "unsigned-proof";

type RuntimeArtifactIssueConfig = {
  label: string;
  summary: string;
  relativePath: (typeof PINNED_RUNTIME_ARTIFACT_PATHS)[number];
  focusSectionTitle: string;
};

export const PINNED_RUNTIME_ARTIFACT_PATHS = [
  "release-evidence/report.json",
  "release-evidence/manifest.json",
  "release-evidence/runtime-proof-report.json",
  "demo-e2e/badge-details.json",
] as const;

export const RUNTIME_ARTIFACT_VIEW_PRESETS = {
  report: "release-evidence/report.json",
  manifest: "release-evidence/manifest.json",
  runtimeProof: "release-evidence/runtime-proof-report.json",
  badgeDetails: "demo-e2e/badge-details.json",
} as const;

const RUNTIME_ARTIFACT_ISSUE_CONFIG: Record<RuntimeArtifactIssue, RuntimeArtifactIssueConfig> = {
  "compliance-blocker": {
    label: "Compliance blocker",
    summary:
      "Use the unified release report to inspect the current export posture and repo-owned blocker context.",
    relativePath: RUNTIME_ARTIFACT_VIEW_PRESETS.report,
    focusSectionTitle: "Critical statuses",
  },
  "export-posture": {
    label: "Export posture",
    summary:
      "Use the manifest view to inspect release-facing export posture and proof readiness for the current case.",
    relativePath: RUNTIME_ARTIFACT_VIEW_PRESETS.manifest,
    focusSectionTitle: "Runtime proof",
  },
  "raw-artifact-blocker": {
    label: "Raw artifact blocker",
    summary:
      "Use the manifest view to inspect which release evidence lane is still blocked by raw or unredacted artifact posture.",
    relativePath: RUNTIME_ARTIFACT_VIEW_PRESETS.manifest,
    focusSectionTitle: "Critical evidence",
  },
  "signature-pending": {
    label: "Signature pending",
    summary:
      "Use the runtime proof report to inspect the current signing state and downstream proof readiness.",
    relativePath: RUNTIME_ARTIFACT_VIEW_PRESETS.runtimeProof,
    focusSectionTitle: "Case Wiki",
  },
  "unsigned-proof": {
    label: "Unsigned proof",
    summary:
      "Use the runtime proof report to inspect missing proof publication or unsigned evidence state.",
    relativePath: RUNTIME_ARTIFACT_VIEW_PRESETS.runtimeProof,
    focusSectionTitle: "Case Wiki",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function formatScalar(value: unknown): string {
  const stringValue = asString(value);
  if (stringValue) {
    return stringValue;
  }
  const numberValue = asNumber(value);
  if (numberValue !== null) {
    return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(2);
  }
  const booleanValue = asBoolean(value);
  if (booleanValue !== null) {
    return booleanValue ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (isRecord(value)) {
    return `${Object.keys(value).length} keys`;
  }
  return "n/a";
}

function pickRow(label: string, value: unknown): RuntimeArtifactStructuredRow {
  return { label, value: formatScalar(value) };
}

function buildReportStructuredView(payload: Record<string, unknown>): RuntimeArtifactStructuredView {
  const statuses = asRecord(payload.statuses);
  const caseWikiIngress = asRecord(payload.caseWikiRuntimeSurfaceIngress);
  const caseWikiAdoption = asRecord(payload.caseWikiContextAdoption);
  const providerUsage = asRecord(payload.providerUsage);

  return {
    headline: "Unified release evidence report",
    sections: [
      {
        title: "Critical statuses",
        rows: [
          pickRow("Guardrails", statuses?.runtimeGuardrailsSignalPathsStatus),
          pickRow("Live transport", statuses?.liveTransportStatus),
          pickRow("Case Wiki routing", statuses?.caseWikiRoutingContextStatus),
          pickRow("Runtime ingress", statuses?.caseWikiRuntimeSurfaceIngressStatus),
          pickRow("Navigator flows", statuses?.navigatorVisaFlowsStatus),
        ],
      },
      {
        title: "Case Wiki ingress",
        rows: [
          pickRow("Observed", caseWikiIngress?.observed),
          pickRow("Context source", caseWikiIngress?.contextSource),
          pickRow("Ingress source", caseWikiIngress?.ingressSource),
          pickRow("Route", caseWikiIngress?.route),
          pickRow("Next action", caseWikiIngress?.nextAction),
        ],
      },
      {
        title: "Case Wiki adoption",
        rows: [
          pickRow("Status", caseWikiAdoption?.status),
          pickRow("Observed count", caseWikiAdoption?.observedCount),
          pickRow("Case Wiki seen", caseWikiAdoption?.caseWikiObservedCount),
          pickRow("Input-only", caseWikiAdoption?.inputOnlyObservedCount),
          pickRow("Adoption rate", caseWikiAdoption?.caseWikiRate),
        ],
      },
      {
        title: "Provider usage",
        rows: [
          pickRow("Status", providerUsage?.status),
          pickRow("Validated", providerUsage?.validated),
          pickRow("Entries", providerUsage?.entriesCount),
          pickRow("Primary entry", providerUsage?.primaryEntry),
          pickRow("Secondary providers", providerUsage?.activeSecondaryProviders),
        ],
      },
    ],
  };
}

function buildManifestStructuredView(payload: Record<string, unknown>): RuntimeArtifactStructuredView {
  const runtimeProof = asRecord(payload.runtimeProof);
  const submissionRefreshGate = asRecord(payload.submissionRefreshGate);
  const criticalStatuses = asRecord(payload.criticalEvidenceStatuses);
  const artifacts = asArray(payload.artifacts);

  return {
    headline: "Release evidence manifest",
    sections: [
      {
        title: "Runtime proof",
        rows: [
          pickRow("Status", runtimeProof?.status),
          pickRow("Ready for operator demo", runtimeProof?.readyForOperatorDemo),
          pickRow("Passed lanes", runtimeProof?.passedLanes),
          pickRow("Total lanes", runtimeProof?.totalLanes),
          pickRow("Blocker count", runtimeProof?.blockerCount),
        ],
      },
      {
        title: "Submission refresh gate",
        rows: [
          pickRow("Live API enabled", submissionRefreshGate?.liveApiEnabled),
          pickRow("Translation provider", submissionRefreshGate?.translationProvider),
          pickRow("Storyteller mode", submissionRefreshGate?.storytellerMediaMode),
          pickRow("UI executor forced sim", submissionRefreshGate?.uiExecutorForceSimulation),
          pickRow("Artifacts listed", artifacts.length),
        ],
      },
      {
        title: "Critical evidence",
        rows: [
          pickRow("Turn truncation", criticalStatuses?.turnTruncationStatus),
          pickRow("Case Wiki ingress", criticalStatuses?.caseWikiRuntimeSurfaceIngressStatus),
          pickRow("Context adoption", criticalStatuses?.caseWikiContextAdoptionStatus),
          pickRow("Browser worker recovery", criticalStatuses?.browserWorkerRecoveryStatus),
          pickRow("Device node updates", criticalStatuses?.deviceNodeUpdatesStatus),
        ],
      },
    ],
  };
}

function buildRuntimeProofStructuredView(payload: Record<string, unknown>): RuntimeArtifactStructuredView {
  const directLive = asRecord(payload.lanes ? asRecord(payload.lanes)?.directLive ?? null : payload.directLive);
  const caseWiki = asRecord(payload.lanes ? asRecord(payload.lanes)?.caseWiki ?? null : payload.caseWiki);
  const navigator = asRecord(payload.lanes ? asRecord(payload.lanes)?.navigator ?? null : payload.navigator);
  const blockers = asArray(payload.blockers);

  return {
    headline: "Runtime proof lanes",
    sections: [
      {
        title: "Overall",
        rows: [
          pickRow("Status", payload.status),
          pickRow("Ready", payload.readyForOperatorDemo),
          pickRow("Summary", payload.summary),
          pickRow("Lane groups", Object.keys(payload).filter((key) => ["directLive", "caseWiki", "navigator"].includes(key)).length),
          pickRow("Blockers", blockers.length),
        ],
      },
      {
        title: "Direct live",
        rows: [
          pickRow("Status", directLive?.status),
          pickRow("Freshness", directLive?.freshnessStatus),
          pickRow("Replay mode", directLive?.replayActiveMode),
          pickRow("First audio ms", directLive?.firstAudioMs),
          pickRow("Fallback events", directLive?.fallbackEventCount),
        ],
      },
      {
        title: "Case Wiki",
        rows: [
          pickRow("Status", caseWiki?.status),
          pickRow("Template", caseWiki?.templateId),
          pickRow("Routing ingress", caseWiki?.routingIngressSource),
          pickRow("Gateway ingress", caseWiki?.gatewayHydrationIngressSource),
          pickRow("Next action", caseWiki?.nextAction),
        ],
      },
      {
        title: "Navigator",
        rows: [
          pickRow("Status", navigator?.status),
          pickRow("Adapter mode", navigator?.adapterMode),
          pickRow("Total flows", navigator?.totalFlows),
          pickRow("Success rate", navigator?.successRate),
          pickRow("Resumed checkpoints", navigator?.resumedCheckpointCount),
        ],
      },
    ],
  };
}

function buildBadgeDetailsStructuredView(payload: Record<string, unknown>): RuntimeArtifactStructuredView {
  const badge = asRecord(payload.badge);
  const evidence = asRecord(payload.evidence);
  const liveTransport = asRecord(payload.liveTransport);

  return {
    headline: "Demo KPI badge details",
    sections: [
      {
        title: "Badge",
        rows: [
          pickRow("Label", badge?.label),
          pickRow("Message", badge?.message),
          pickRow("Color", badge?.color),
          pickRow("Checks", payload.checks),
          pickRow("Violations", asArray(payload.violations).length),
        ],
      },
      {
        title: "Transport & evidence",
        rows: [
          pickRow("Transport status", liveTransport?.status),
          pickRow("Transport runtime", liveTransport?.runtime),
          pickRow("Transport session", liveTransport?.session),
          pickRow("Runtime guardrails", asRecord(evidence?.runtimeGuardrailsSignalPaths)?.status),
          pickRow("Case Wiki routing", asRecord(evidence?.caseWikiRoutingContext)?.status),
        ],
      },
      {
        title: "Operator signals",
        rows: [
          pickRow("Turn truncation", asRecord(evidence?.operatorTurnTruncation)?.status),
          pickRow("Turn delete", asRecord(evidence?.operatorTurnDelete)?.status),
          pickRow("Damage control", asRecord(evidence?.operatorDamageControl)?.status),
          pickRow("Device nodes", asRecord(evidence?.deviceNodes)?.status),
          pickRow("Navigator flows", asRecord(evidence?.navigatorVisaFlows)?.status),
        ],
      },
    ],
  };
}

function buildComplianceBlockerIssueSummary(
  payload: Record<string, unknown>,
): RuntimeArtifactIssueSummary | null {
  const evidenceSignature = asRecord(payload.caseWikiEvidenceSignature);
  const compliance = asRecord(payload.caseWikiCompliance);
  const routing = asRecord(payload.caseWikiRoutingContext);

  return {
    headline: "Compliance blocker focus",
    rows: [
      pickRow("Signature status", evidenceSignature?.signatureStatus),
      pickRow("Overview status", evidenceSignature?.overviewStatus),
      pickRow("Blocker", routing?.blocker),
      pickRow("Next action", routing?.nextAction),
      pickRow(
        "Expected signature",
        asRecord(compliance?.evidenceSigning)?.expectedSignatureStatus ?? compliance?.expectedSignatureStatus,
      ),
    ],
  };
}

function buildExportPostureIssueSummary(
  payload: Record<string, unknown>,
): RuntimeArtifactIssueSummary | null {
  const runtimeProof = asRecord(payload.runtimeProof);
  const compliance = asRecord(payload.caseWikiCompliance);

  return {
    headline: "Export posture focus",
    rows: [
      pickRow("Runtime proof", runtimeProof?.status),
      pickRow("Case Wiki lane", runtimeProof?.caseWikiStatus),
      pickRow("Blocker count", runtimeProof?.blockerCount),
      pickRow("Expected signature", compliance?.expectedSignatureStatus),
      pickRow("Observed signature", compliance?.observedSignatureStatus),
    ],
  };
}

function buildRawArtifactBlockerIssueSummary(
  payload: Record<string, unknown>,
): RuntimeArtifactIssueSummary | null {
  const runtimeProof = asRecord(payload.runtimeProof);
  const compliance = asRecord(payload.caseWikiCompliance);

  return {
    headline: "Raw artifact blocker focus",
    rows: [
      pickRow("Case Wiki lane", runtimeProof?.caseWikiStatus),
      pickRow("Runtime proof", runtimeProof?.status),
      pickRow("Blocker count", runtimeProof?.blockerCount),
      pickRow("Raw media retention", compliance?.rawMediaDays),
      pickRow("Observed signature", compliance?.observedSignatureStatus),
    ],
  };
}

function buildProofIssueSummary(payload: Record<string, unknown>): RuntimeArtifactIssueSummary | null {
  const lanes = asRecord(payload.lanes);
  const caseWiki = asRecord(lanes?.caseWiki);
  if (!caseWiki) {
    return null;
  }
  return {
    headline: "Case Wiki proof focus",
    rows: [
      pickRow("Signature status", caseWiki.signatureStatus),
      pickRow("Signature kind", caseWiki.signatureKind),
      pickRow("Expected signature", caseWiki.expectedSignatureStatus),
      pickRow("Observed signature", caseWiki.observedSignatureStatus),
      pickRow("Blocker", caseWiki.blocker),
      pickRow("Next action", caseWiki.nextAction),
    ],
  };
}

function toArtifactIndexEntry(value: unknown): RuntimeArtifactIndexEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  const category = typeof value.category === "string" ? value.category.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const relativePath = typeof value.relativePath === "string" ? value.relativePath.trim() : "";
  const url = typeof value.url === "string" ? value.url.trim() : "";
  const size = typeof value.size === "number" && Number.isFinite(value.size) ? value.size : null;
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt.trim() : "";
  if (!category || !label || !relativePath || !url || size === null || !updatedAt) {
    return null;
  }
  return {
    category,
    label,
    description,
    relativePath,
    size,
    updatedAt,
    url,
  };
}

export async function fetchRuntimeArtifactIndex(
  fetchImpl: typeof fetch = fetch,
): Promise<RuntimeArtifactIndexEntry[]> {
  const response = await fetchImpl("/debug-artifacts/index.json", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`runtime_artifact_index_${response.status}`);
  }
  const payload = (await response.json()) as { items?: unknown };
  if (!Array.isArray(payload.items)) {
    return [];
  }
  return payload.items
    .map((item) => toArtifactIndexEntry(item))
    .filter((item): item is RuntimeArtifactIndexEntry => item !== null);
}

export async function fetchRuntimeArtifactDocument(
  entry: RuntimeArtifactIndexEntry,
  fetchImpl: typeof fetch = fetch,
): Promise<RuntimeArtifactDocument> {
  const response = await fetchImpl(entry.url, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`runtime_artifact_document_${response.status}`);
  }
  const raw = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = raw;
  }
  return {
    entry,
    payload,
    raw,
  };
}

export function summarizeRuntimeArtifact(payload: unknown): {
  shape: string;
  count: string;
  topLevelKeys: string[];
} {
  if (Array.isArray(payload)) {
    return {
      shape: "array",
      count: `${payload.length} items`,
      topLevelKeys:
        payload.length > 0 && isRecord(payload[0]) ? Object.keys(payload[0]).slice(0, 6) : [],
    };
  }
  if (isRecord(payload)) {
    const keys = Object.keys(payload);
    return {
      shape: "object",
      count: `${keys.length} keys`,
      topLevelKeys: keys.slice(0, 8),
    };
  }
  return {
    shape: typeof payload,
    count: "scalar",
    topLevelKeys: [],
  };
}

export function isPinnedRuntimeArtifactPath(relativePath: string): boolean {
  return PINNED_RUNTIME_ARTIFACT_PATHS.includes(
    relativePath as (typeof PINNED_RUNTIME_ARTIFACT_PATHS)[number],
  );
}

export function buildRuntimeArtifactViewerPath(
  relativePath: string,
  options?: {
    caseRef?: string | null | undefined;
    issue?: RuntimeArtifactIssue | null | undefined;
  },
): string {
  const params = new URLSearchParams();
  params.set("artifact", relativePath);
  if (options?.caseRef && options.caseRef.trim().length > 0) {
    params.set("ref", options.caseRef.trim());
  }
  if (options?.issue) {
    params.set("issue", options.issue);
  }
  return `/app/console/runtime?${params.toString()}#artifact-viewer`;
}

export function getRuntimeArtifactIssueConfig(
  issue: string | null | undefined,
): RuntimeArtifactIssueConfig | null {
  if (!issue) {
    return null;
  }
  return RUNTIME_ARTIFACT_ISSUE_CONFIG[issue as RuntimeArtifactIssue] ?? null;
}

export function getRuntimeArtifactIssueFocusSectionTitle(
  issue: string | null | undefined,
): string | null {
  return getRuntimeArtifactIssueConfig(issue)?.focusSectionTitle ?? null;
}

export function buildRuntimeArtifactIssueSummary(
  entry: RuntimeArtifactIndexEntry | null | undefined,
  payload: unknown,
  issue: string | null | undefined,
): RuntimeArtifactIssueSummary | null {
  if (!entry || !isRecord(payload) || !issue) {
    return null;
  }

  switch (issue as RuntimeArtifactIssue) {
    case "compliance-blocker":
      return buildComplianceBlockerIssueSummary(payload);
    case "export-posture":
      return buildExportPostureIssueSummary(payload);
    case "raw-artifact-blocker":
      return buildRawArtifactBlockerIssueSummary(payload);
    case "signature-pending":
    case "unsigned-proof":
      return buildProofIssueSummary(payload);
    default:
      return null;
  }
}

export function buildRuntimeArtifactIssueViewerPath(
  issue: RuntimeArtifactIssue,
  options?: { caseRef?: string | null | undefined },
): string {
  const config = getRuntimeArtifactIssueConfig(issue);
  return buildRuntimeArtifactViewerPath(
    config?.relativePath ?? RUNTIME_ARTIFACT_VIEW_PRESETS.report,
    {
      caseRef: options?.caseRef,
      issue,
    },
  );
}

export function buildRuntimeArtifactStructuredView(
  entry: RuntimeArtifactIndexEntry | null | undefined,
  payload: unknown,
): RuntimeArtifactStructuredView | null {
  if (!entry || !isRecord(payload)) {
    return null;
  }
  switch (entry.relativePath) {
    case "release-evidence/report.json":
      return buildReportStructuredView(payload);
    case "release-evidence/manifest.json":
      return buildManifestStructuredView(payload);
    case "release-evidence/runtime-proof-report.json":
      return buildRuntimeProofStructuredView(payload);
    case "demo-e2e/badge-details.json":
      return buildBadgeDetailsStructuredView(payload);
    default:
      return null;
  }
}
