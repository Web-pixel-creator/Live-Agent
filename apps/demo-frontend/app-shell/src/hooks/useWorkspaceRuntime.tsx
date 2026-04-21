import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  edgeNodes,
  type EdgeNode,
  type NodeStatus,
} from "@/data/nodes";
import {
  parseSlaMinutes,
  pendingApprovals as mockPendingApprovals,
  workspaceCases,
  type CaseApproval,
  type CaseDocument,
  type CaseEvent,
  type WorkspaceCase,
} from "@/data/workspace";
import {
  fetchRuntimeDeviceNodes,
  mapRuntimeDeviceNode,
  type RuntimeDeviceNodeRecord,
} from "@/lib/runtime-device-nodes";
import { fetchRuntimeApi } from "@/lib/runtime-api";

export type CaseWikiStatus =
  | "active"
  | "waiting_on_customer"
  | "waiting_on_operator"
  | "blocked"
  | "resolved";

type RuntimeSessionRecord = {
  sessionId: string;
  userId?: string | null;
  mode?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type RuntimeCaseWikiOverview = {
  title: string;
  summary: string;
  status: CaseWikiStatus;
  customerGoal: string | null;
  currentStage: string | null;
  lastMeaningfulUpdateAt: string | null;
};

export type RuntimeCaseWikiEntity = {
  id: string;
  kind: string;
  label: string;
  role: string | null;
  description: string | null;
  sourceRefs: string[];
};

export type RuntimeCaseWikiTimelineEntry = {
  ts: string;
  kind: string | null;
  title: string;
  summary: string;
  sourceRefs: string[];
};

export type RuntimeCaseWikiQuestion = {
  id: string;
  question: string;
  priority: "low" | "medium" | "high";
  blocking: boolean;
  owner: string | null;
  suggestedNextStep: string | null;
  sourceRefs: string[];
};

export type RuntimeCaseWikiNextAction = {
  type: string;
  title: string;
  summary: string;
  owner: string | null;
  dueBy: string | null;
  blocking: boolean;
  relatedQuestionIds: string[];
  sourceRefs: string[];
};

export type RuntimeCaseWikiRemediationDraft = {
  kind: string;
  title: string;
  targetLabel: string | null;
  owner: string | null;
  dueBy: string | null;
  summary: string;
  body: string;
  checklist: string[];
  sourceRefs: string[];
};

export type RuntimeCaseWiki = {
  caseId: string;
  sessionId: string | null;
  generatedAt: string;
  overview: RuntimeCaseWikiOverview;
  entities: RuntimeCaseWikiEntity[];
  timeline: RuntimeCaseWikiTimelineEntry[];
  openQuestions: RuntimeCaseWikiQuestion[];
  recommendedNextAction: RuntimeCaseWikiNextAction | null;
  highlights: {
    topBlockingQuestion: RuntimeCaseWikiQuestion | null;
  };
  operatorPreviewPack?: {
    remediation?: {
      draft: RuntimeCaseWikiRemediationDraft | null;
    } | null;
    compliance?: {
      enforcement?: {
        exportReady?: boolean;
        status?: string;
      } | null;
    } | null;
  } | null;
  compliance?: {
    enforcement?: {
      exportReady?: boolean;
      status?: string;
      summary?: string;
    } | null;
  } | null;
  evidenceSignature?: {
    status?: string | null;
  } | null;
};

export type RuntimeGovernancePolicy = {
  source: string | null;
  complianceTemplate: string | null;
  requestedTemplateId: string | null;
  fallbackApplied: boolean;
  retentionPolicy: Record<string, number> | null;
  overrideVersion: number | null;
  overrideUpdatedAt: string | null;
};

type RuntimeOperatorQueueItemRecord = {
  caseId?: string | null;
  sessionId?: string | null;
  title?: string | null;
  meta?: string | null;
};

type PendingApproval = {
  caseRef: string;
  kind: string;
  source: "mock" | "runtime";
};

type WorkspaceRuntimeValue = {
  runtimeActive: boolean;
  cases: WorkspaceCase[];
  caseWikis: RuntimeCaseWiki[];
  deviceNodes: EdgeNode[];
  pendingApprovals: PendingApproval[];
  activeCaseCount: number;
  pendingApprovalCount: number;
  slaBurningCases: WorkspaceCase[];
  degradedInfraCases: WorkspaceCase[];
  defaultConsoleCaseRef: string | null;
  governancePolicy: RuntimeGovernancePolicy | null;
  operatorSummary: Record<string, unknown> | null;
  operatorQueue: Record<string, unknown> | null;
  runtimeDiagnostics: Record<string, unknown> | null;
  bootstrapDoctor: Record<string, unknown> | null;
  browserWorkers: Record<string, unknown> | null;
  getCaseByRef: (ref: string | null | undefined) => WorkspaceCase | undefined;
  getCaseWikiByRef: (ref: string | null | undefined) => RuntimeCaseWiki | undefined;
  addDraftCase: (value: WorkspaceCase) => void;
};

const WorkspaceRuntimeContext = createContext<WorkspaceRuntimeValue | null>(null);

const COUNTRY_CODE_FALLBACKS: Record<string, string> = {
  germany: "DE",
  canada: "CA",
  unitedkingdom: "GB",
  uk: "GB",
  britain: "GB",
  japan: "JP",
  usa: "US",
  us: "US",
  portugal: "PT",
  france: "FR",
  spain: "ES",
  italy: "IT",
  netherlands: "NL",
  india: "IN",
  china: "CN",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toArrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => isRecord(item)) : [];
}

function toOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toNumberRecord(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) {
    return null;
  }
  const entries = Object.entries(value).filter(([, entryValue]) =>
    typeof entryValue === "number" && Number.isFinite(entryValue),
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function formatUpdatedLabel(value: string | null | undefined): string {
  if (!value) {
    return "now";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "now";
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function normalizeWorkspaceStatus(
  status: CaseWikiStatus,
  nextAction: RuntimeCaseWikiNextAction | null,
): WorkspaceCase["status"] {
  if (status === "resolved") {
    return "resolved";
  }
  if (status === "waiting_on_customer") {
    return "awaiting_client";
  }
  if (
    status === "waiting_on_operator" ||
    status === "blocked" ||
    nextAction?.type === "approval_request" ||
    nextAction?.owner === "operator"
  ) {
    return "needs_action";
  }
  return "in_flight";
}

function extractCountryCode(texts: Array<string | null | undefined>, node: EdgeNode | null): string {
  if (node?.country) {
    return node.country;
  }
  for (const text of texts) {
    const normalized = toOptionalString(text);
    if (!normalized) {
      continue;
    }
    const direct = normalized.match(/\b([A-Z]{2})\b/);
    if (direct?.[1]) {
      return direct[1].toUpperCase();
    }
    const compact = normalized.toLowerCase().replace(/[^a-z]/g, "");
    for (const [needle, code] of Object.entries(COUNTRY_CODE_FALLBACKS)) {
      if (compact.includes(needle)) {
        return code;
      }
    }
  }
  return "US";
}

function collectSourceRefs(wiki: RuntimeCaseWiki): string[] {
  const refs = new Set<string>();
  const pushRefs = (items: string[] | null | undefined) => {
    if (!Array.isArray(items)) {
      return;
    }
    for (const item of items) {
      const ref = toOptionalString(item);
      if (ref) {
        refs.add(ref);
      }
    }
  };

  wiki.entities.forEach((item) => pushRefs(item.sourceRefs));
  wiki.timeline.forEach((item) => pushRefs(item.sourceRefs));
  wiki.openQuestions.forEach((item) => pushRefs(item.sourceRefs));
  pushRefs(wiki.recommendedNextAction?.sourceRefs);

  return [...refs];
}

function findSourceNode(deviceNodes: EdgeNode[], wiki: RuntimeCaseWiki): EdgeNode | null {
  const refs = collectSourceRefs(wiki);
  const explicit =
    deviceNodes.find((node) =>
      refs.some((ref) => ref.toLowerCase().includes(node.id.toLowerCase())),
    ) ?? null;
  if (explicit) {
    return explicit;
  }

  const countryCode = extractCountryCode(
    [
      wiki.overview.customerGoal,
      wiki.overview.summary,
      wiki.overview.currentStage,
      wiki.overview.title,
      ...wiki.entities
        .filter((item) => item.kind === "location")
        .flatMap((item) => [item.label, item.description]),
    ],
    null,
  );

  return deviceNodes.find((node) => node.country === countryCode) ?? null;
}

function findPersonLabel(wiki: RuntimeCaseWiki): string | null {
  const person = wiki.entities.find((item) => item.kind === "person" && item.label.trim().length > 0);
  return person?.label ?? null;
}

function summarizeQuestionAsDocument(question: RuntimeCaseWikiQuestion, fallbackIndex: number): string {
  const preferred = toOptionalString(question.suggestedNextStep) ?? question.question;
  const compact = preferred.replace(/\s+/g, " ").trim();
  if (compact.length <= 42) {
    return compact;
  }
  const shortened = compact.slice(0, 39).trimEnd();
  return shortened.length > 0 ? `${shortened}…` : `Missing item ${fallbackIndex + 1}`;
}

function buildDocuments(wiki: RuntimeCaseWiki): CaseDocument[] {
  const documentState = new Map<string, CaseDocument["state"]>();
  const questionText = wiki.openQuestions.map((item) => item.question.toLowerCase());

  for (const entity of wiki.entities) {
    if (entity.kind !== "document") {
      continue;
    }
    const label = entity.label.trim();
    if (!label) {
      continue;
    }
    const lowered = label.toLowerCase();
    const blocking = questionText.some((question) => question.includes(lowered));
    documentState.set(label, blocking ? "missing" : "ok");
  }

  if (documentState.size === 0) {
    wiki.openQuestions.slice(0, 4).forEach((question, index) => {
      documentState.set(
        summarizeQuestionAsDocument(question, index),
        question.blocking ? "missing" : "review",
      );
    });
  } else {
    wiki.openQuestions.forEach((question, index) => {
      const suggested = summarizeQuestionAsDocument(question, index);
      if (!documentState.has(suggested) && question.blocking) {
        documentState.set(suggested, "missing");
      }
    });
  }

  return [...documentState.entries()]
    .slice(0, 8)
    .map(([name, state]) => ({ name, state }));
}

function buildEvents(wiki: RuntimeCaseWiki): CaseEvent[] {
  const ordered = [...wiki.timeline].sort((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
  return ordered.map((item) => {
    const actor: CaseEvent["actor"] =
      item.kind === "operator_note" || item.sourceRefs.some((ref) => ref.toLowerCase().includes("operator"))
        ? "Operator"
        : item.kind === "approval"
          ? "Operator"
          : item.kind === "session"
            ? "Client"
            : item.kind === "workflow"
              ? "AI"
              : "System";
    return {
      at: item.ts,
      actor,
      title: item.title,
    };
  });
}

function buildApproval(wiki: RuntimeCaseWiki): CaseApproval | undefined {
  const nextAction = wiki.recommendedNextAction;
  const blockingQuestion = wiki.highlights.topBlockingQuestion;
  const needsApproval =
    nextAction?.type === "approval_request" ||
    wiki.overview.status === "waiting_on_operator" ||
    (blockingQuestion?.blocking === true && blockingQuestion.owner === "operator");
  if (!needsApproval) {
    return undefined;
  }

  const headlineText =
    toOptionalString(nextAction?.title) ??
    toOptionalString(blockingQuestion?.question) ??
    "Review the next operator action";
  const signalTone =
    wiki.compliance?.enforcement?.exportReady === false ? "rose" : "mint";
  const signatureTone =
    wiki.evidenceSignature?.status === "signed" ? "mint" : "slate";

  return {
    eyebrow: "Approval required · runtime",
    headline: {
      prefix: "",
      emphasis: headlineText,
      suffix: headlineText.endsWith("?") ? "" : "?",
    },
    draft:
      toOptionalString(wiki.operatorPreviewPack?.remediation?.draft?.body) ??
      toOptionalString(nextAction?.summary) ??
      toOptionalString(blockingQuestion?.suggestedNextStep) ??
      wiki.overview.summary,
    signals: [
      {
        label: nextAction?.owner === "customer" ? "Customer follow-up" : "Operator decision",
        tone: nextAction?.blocking ? "rose" : "violet",
      },
      {
        label:
          wiki.compliance?.enforcement?.exportReady === false
            ? "Compliance blocker"
            : "Compliance ready",
        tone: signalTone,
      },
      {
        label:
          wiki.evidenceSignature?.status === "signed"
            ? "Signed evidence"
            : "Unsigned evidence",
        tone: signatureTone,
      },
    ],
  };
}

function mapCaseWikiToWorkspaceCase(wiki: RuntimeCaseWiki, deviceNodes: EdgeNode[]): WorkspaceCase {
  const sourceNode = findSourceNode(deviceNodes, wiki);
  const status = normalizeWorkspaceStatus(wiki.overview.status, wiki.recommendedNextAction);
  const clientLabel =
    findPersonLabel(wiki) ??
    toOptionalString(wiki.overview.title) ??
    `Case ${wiki.caseId}`;
  const country = extractCountryCode(
    [
      sourceNode?.country,
      wiki.overview.customerGoal,
      wiki.overview.summary,
      ...wiki.entities
        .filter((item) => item.kind === "location")
        .flatMap((item) => [item.label, item.description]),
    ],
    sourceNode,
  );
  const owner =
    toOptionalString(wiki.recommendedNextAction?.owner) ??
    toOptionalString(wiki.highlights.topBlockingQuestion?.owner) ??
    "A. Petrova";

  return {
    ref: wiki.caseId,
    caseId: wiki.caseId,
    sessionId: wiki.sessionId,
    source: "runtime",
    client: clientLabel,
    email: `${wiki.caseId.toLowerCase()}@runtime-case.local`,
    phone: "+00 000 000 0000",
    visa:
      toOptionalString(wiki.overview.customerGoal) ??
      toOptionalString(wiki.overview.title) ??
      "Immigration intake",
    country,
    stage: toOptionalString(wiki.overview.currentStage) ?? "Case review",
    stageEnteredAt: wiki.generatedAt,
    owner,
    status,
    sla:
      toOptionalString(wiki.recommendedNextAction?.dueBy)
        ? "pending"
        : status === "resolved"
          ? "done"
          : "—",
    slaWarn:
      Boolean(
        wiki.recommendedNextAction?.dueBy &&
          Date.parse(wiki.recommendedNextAction.dueBy) - Date.now() < 60 * 60 * 1000,
      ) || status === "needs_action",
    updated:
      formatUpdatedLabel(
        wiki.overview.lastMeaningfulUpdateAt ?? wiki.generatedAt,
      ),
    events: buildEvents(wiki),
    approval: buildApproval(wiki),
    documents: buildDocuments(wiki),
    sourceNodeId: sourceNode?.id,
  };
}

async function fetchOperatorSummary(
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown> | null> {
  const response = await fetchRuntimeApi(
    "/v1/operator/summary",
    {
      headers: {
        "x-operator-role": "viewer",
      },
    },
    fetchImpl,
  );
  if (!response.ok) {
    throw new Error(`operator_summary_${response.status}`);
  }
  const payload = (await response.json()) as { data?: unknown };
  return isRecord(payload.data) ? payload.data : null;
}

async function fetchGovernancePolicy(
  fetchImpl: typeof fetch = fetch,
): Promise<RuntimeGovernancePolicy | null> {
  const response = await fetchRuntimeApi(
    "/v1/governance/policy",
    {
      headers: {
        "x-operator-role": "viewer",
      },
    },
    fetchImpl,
  );
  if (!response.ok) {
    throw new Error(`governance_policy_${response.status}`);
  }
  const payload = (await response.json()) as { data?: unknown };
  const data = isRecord(payload.data) ? payload.data : null;
  if (!data) {
    return null;
  }
  const profile = isRecord(data.profile) ? data.profile : null;
  const policy = isRecord(data.policy) ? data.policy : null;
  const override = isRecord(data.override) ? data.override : null;
  return {
    source: toOptionalString(data.source),
    complianceTemplate:
      toOptionalString(policy?.complianceTemplate) ??
      toOptionalString(profile?.id),
    requestedTemplateId: toOptionalString(profile?.requestedTemplateId),
    fallbackApplied: Boolean(profile?.fallbackApplied),
    retentionPolicy:
      toNumberRecord(policy?.retentionPolicy) ??
      toNumberRecord(profile?.retentionPolicy),
    overrideVersion: toOptionalNumber(override?.version),
    overrideUpdatedAt: toOptionalString(override?.updatedAt),
  };
}

async function fetchSessions(
  fetchImpl: typeof fetch = fetch,
): Promise<RuntimeSessionRecord[]> {
  const response = await fetchRuntimeApi(
    "/v1/sessions?limit=8",
    {
      headers: {
        "x-operator-role": "viewer",
      },
    },
    fetchImpl,
  );
  if (!response.ok) {
    throw new Error(`sessions_${response.status}`);
  }
  const payload = (await response.json()) as { data?: unknown };
  return toArrayOfRecords(payload.data)
    .map((item) => ({
      sessionId: toOptionalString(item.sessionId) ?? "",
      userId: toOptionalString(item.userId),
      mode: toOptionalString(item.mode),
      status: toOptionalString(item.status),
      createdAt: toOptionalString(item.createdAt),
      updatedAt: toOptionalString(item.updatedAt),
    }))
    .filter((item) => item.sessionId.length > 0);
}

async function fetchRuntimeCaseWiki(
  sessionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RuntimeCaseWiki | null> {
  const response = await fetchRuntimeApi(
    `/v1/runtime/case-wiki?sessionId=${encodeURIComponent(sessionId)}`,
    {
      headers: {
        "x-operator-role": "viewer",
      },
    },
    fetchImpl,
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`runtime_case_wiki_${response.status}`);
  }
  const payload = (await response.json()) as { data?: RuntimeCaseWiki };
  return isRecord(payload.data) ? (payload.data as RuntimeCaseWiki) : null;
}

function caseMatchesRef(candidate: WorkspaceCase, ref: string | null | undefined): boolean {
  if (!ref) {
    return false;
  }
  return candidate.ref === ref || candidate.caseId === ref || candidate.sessionId === ref;
}

function buildRuntimePendingApprovals(
  cases: WorkspaceCase[],
  operatorQueue: Record<string, unknown> | null,
): PendingApproval[] {
  const items = toArrayOfRecords(operatorQueue?.items);
  const fromQueue = items
    .map((item) => {
      const caseId = toOptionalString(item.caseId);
      const sessionId = toOptionalString(item.sessionId);
      const matched =
        cases.find((candidate) => caseMatchesRef(candidate, caseId) || caseMatchesRef(candidate, sessionId)) ??
        null;
      const caseRef = matched?.ref ?? caseId ?? sessionId;
      if (!caseRef) {
        return null;
      }
      return {
        caseRef,
        kind: toOptionalString(item.title) ?? toOptionalString(item.meta) ?? "Operator action",
        source: "runtime" as const,
      };
    })
    .filter((item): item is PendingApproval => item !== null);

  if (fromQueue.length > 0) {
    return fromQueue;
  }

  return cases
    .filter((item) => item.approval)
    .map((item) => ({
      caseRef: item.ref,
      kind: item.approval?.headline.emphasis ?? item.approval?.eyebrow ?? "Approval required",
      source: "runtime" as const,
    }));
}

export function WorkspaceRuntimeProvider({ children }: { children: ReactNode }) {
  const [draftCases, setDraftCases] = useState<WorkspaceCase[]>([]);

  const operatorSummaryQuery = useQuery({
    queryKey: ["app-shell", "operator-summary"],
    queryFn: () => fetchOperatorSummary(),
    staleTime: 30_000,
    retry: 1,
  });

  const governancePolicyQuery = useQuery({
    queryKey: ["app-shell", "governance-policy"],
    queryFn: () => fetchGovernancePolicy(),
    staleTime: 30_000,
    retry: 1,
  });

  const sessionsQuery = useQuery({
    queryKey: ["app-shell", "sessions"],
    queryFn: () => fetchSessions(),
    staleTime: 30_000,
    retry: 1,
  });

  const deviceNodesQuery = useQuery({
    queryKey: ["app-shell", "device-nodes"],
    queryFn: () => fetchRuntimeDeviceNodes(),
    staleTime: 30_000,
    retry: 1,
  });

  const caseWikisQuery = useQuery({
    queryKey: [
      "app-shell",
      "case-wikis",
      ...(sessionsQuery.data?.map((item) => item.sessionId) ?? []),
    ],
    enabled: (sessionsQuery.data?.length ?? 0) > 0,
    queryFn: async () => {
      const sessionIds = (sessionsQuery.data ?? []).map((item) => item.sessionId);
      const results = await Promise.all(
        sessionIds.map(async (sessionId) => {
          try {
            return await fetchRuntimeCaseWiki(sessionId);
          } catch {
            return null;
          }
        }),
      );
      return results.filter((item): item is RuntimeCaseWiki => item !== null);
    },
    staleTime: 30_000,
    retry: 1,
  });

  const runtimeDeviceNodes = useMemo(
    () =>
      Array.isArray(deviceNodesQuery.data)
        ? (deviceNodesQuery.data as RuntimeDeviceNodeRecord[]).map(mapRuntimeDeviceNode)
        : [],
    [deviceNodesQuery.data],
  );

  const deviceNodes = runtimeDeviceNodes.length > 0 ? runtimeDeviceNodes : edgeNodes;

  const runtimeCases = useMemo(
    () => (caseWikisQuery.data ?? []).map((wiki) => mapCaseWikiToWorkspaceCase(wiki, deviceNodes)),
    [caseWikisQuery.data, deviceNodes],
  );
  const caseWikis = caseWikisQuery.data ?? [];

  const runtimeActive = runtimeCases.length > 0 || operatorSummaryQuery.data !== null;
  const baseCases = runtimeCases.length > 0 ? runtimeCases : workspaceCases;
  const cases = useMemo(() => [...draftCases, ...baseCases], [draftCases, baseCases]);

  const governancePolicy = governancePolicyQuery.data;
  const operatorSummary = operatorSummaryQuery.data;
  const operatorQueue = isRecord(operatorSummary?.operatorQueue) ? operatorSummary.operatorQueue : null;
  const runtimeDiagnostics = isRecord(operatorSummary?.runtimeDiagnostics)
    ? operatorSummary.runtimeDiagnostics
    : null;
  const bootstrapDoctor = isRecord(operatorSummary?.bootstrapDoctor)
    ? operatorSummary.bootstrapDoctor
    : null;
  const browserWorkers = isRecord(operatorSummary?.browserWorkers)
    ? operatorSummary.browserWorkers
    : null;

  const pendingApprovals = useMemo(() => {
    if (!runtimeActive) {
      return mockPendingApprovals.map((item) => ({ ...item, source: "mock" as const }));
    }
    return buildRuntimePendingApprovals(cases, operatorQueue);
  }, [cases, operatorQueue, runtimeActive]);

  const activeCaseCount = useMemo(
    () => cases.filter((item) => item.status !== "resolved").length,
    [cases],
  );

  const pendingApprovalCount = pendingApprovals.length;

  const slaBurningCases = useMemo(
    () =>
      cases.filter((item) => {
        if (item.status !== "needs_action") {
          return false;
        }
        const minutes = parseSlaMinutes(item.sla);
        return minutes !== null && minutes < 60;
      }),
    [cases],
  );

  const nonHealthyNodeIds = useMemo(
    () => new Set(deviceNodes.filter((item) => item.status !== "healthy").map((item) => item.id)),
    [deviceNodes],
  );

  const degradedInfraCases = useMemo(
    () =>
      cases.filter(
        (item) =>
          item.status !== "resolved" &&
          Boolean(item.sourceNodeId) &&
          nonHealthyNodeIds.has(item.sourceNodeId ?? ""),
      ),
    [cases, nonHealthyNodeIds],
  );

  const defaultConsoleCaseRef = pendingApprovals[0]?.caseRef ?? cases[0]?.ref ?? null;

  const value = useMemo<WorkspaceRuntimeValue>(
    () => ({
      runtimeActive,
      cases,
      caseWikis,
      deviceNodes,
      pendingApprovals,
      activeCaseCount,
      pendingApprovalCount,
      slaBurningCases,
      degradedInfraCases,
      defaultConsoleCaseRef,
      governancePolicy,
      operatorSummary,
      operatorQueue,
      runtimeDiagnostics,
      bootstrapDoctor,
      browserWorkers,
      getCaseByRef: (ref) => cases.find((item) => caseMatchesRef(item, ref)),
      getCaseWikiByRef: (ref) =>
        caseWikis.find(
          (item) =>
            item.caseId === ref ||
            item.sessionId === ref,
        ),
      addDraftCase: (draft) => {
        setDraftCases((current) => [draft, ...current.filter((item) => !caseMatchesRef(item, draft.ref))]);
      },
    }),
    [
      activeCaseCount,
      bootstrapDoctor,
      browserWorkers,
      cases,
      caseWikis,
      defaultConsoleCaseRef,
      degradedInfraCases,
      deviceNodes,
      governancePolicy,
      operatorQueue,
      operatorSummary,
      pendingApprovalCount,
      pendingApprovals,
      runtimeActive,
      runtimeDiagnostics,
      slaBurningCases,
    ],
  );

  return (
    <WorkspaceRuntimeContext.Provider value={value}>
      {children}
    </WorkspaceRuntimeContext.Provider>
  );
}

export function useWorkspaceRuntime(): WorkspaceRuntimeValue {
  const value = useContext(WorkspaceRuntimeContext);
  if (!value) {
    throw new Error("useWorkspaceRuntime must be used inside WorkspaceRuntimeProvider");
  }
  return value;
}
