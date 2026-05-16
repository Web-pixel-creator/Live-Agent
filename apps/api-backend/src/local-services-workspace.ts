export const LOCAL_SERVICES_WORKSPACE_STORAGE_KEY = "liveDesk:localServicesPilotWorkspace:v1" as const;

export const LOCAL_SERVICES_SCENARIO_IDS = [
  "ac-repair-dispatch",
  "plumbing-emergency",
  "cleaning-quote-booking",
  "measurement-visit-booking",
] as const;

type LocalServicesScenarioId = (typeof LOCAL_SERVICES_SCENARIO_IDS)[number];

export type LocalServicesWorkspaceSnapshot = Record<string, unknown>;

export type LocalServicesOperatorDecision = {
  action: "approve" | "edit" | "reject" | "move" | "record";
  reason?: string;
  payload?: unknown;
  decidedAt?: string;
};

type LocalServicesSetupEvent = {
  stepId: string;
  payload: unknown;
  recordedAt: string;
};

type LocalServicesWorkspaceRecord = {
  tenantId: string;
  storageKey: typeof LOCAL_SERVICES_WORKSPACE_STORAGE_KEY;
  version: number;
  updatedAt: string;
  snapshot: LocalServicesWorkspaceSnapshot;
};

const workspaceByTenant = new Map<string, LocalServicesWorkspaceRecord>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function createEmptyRecord(tenantId: string): LocalServicesWorkspaceRecord {
  return {
    tenantId,
    storageKey: LOCAL_SERVICES_WORKSPACE_STORAGE_KEY,
    version: 1,
    updatedAt: nowIso(),
    snapshot: {},
  };
}

function getRecord(tenantId: string): LocalServicesWorkspaceRecord {
  const existing = workspaceByTenant.get(tenantId);
  if (existing) {
    return existing;
  }
  const next = createEmptyRecord(tenantId);
  workspaceByTenant.set(tenantId, next);
  return next;
}

function saveRecord(record: LocalServicesWorkspaceRecord): LocalServicesWorkspaceRecord {
  const next = {
    ...record,
    version: record.version + 1,
    updatedAt: nowIso(),
  };
  workspaceByTenant.set(next.tenantId, next);
  return next;
}

function normalizeScenarioOverrides(value: unknown): Record<string, unknown>[] {
  if (typeof value === "undefined" || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("scenarioOverrides must be an array");
  }
  const seen = new Set<string>();
  const normalized: Record<string, unknown>[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== "string") {
      throw new Error("each scenario override must be an object with an id");
    }
    if (!LOCAL_SERVICES_SCENARIO_IDS.includes(item.id as LocalServicesScenarioId)) {
      throw new Error(`unsupported scenario id: ${item.id}`);
    }
    if (seen.has(item.id)) {
      throw new Error(`duplicate scenario id: ${item.id}`);
    }
    seen.add(item.id);
    normalized.push(item);
  }
  return normalized;
}

function normalizeDecision(value: unknown): LocalServicesOperatorDecision {
  if (!isRecord(value)) {
    throw new Error("decision must be a JSON object");
  }
  const action = value.action;
  if (
    action !== "approve" &&
    action !== "edit" &&
    action !== "reject" &&
    action !== "move" &&
    action !== "record"
  ) {
    throw new Error("decision.action is not supported");
  }
  const decision: LocalServicesOperatorDecision = {
    action,
    decidedAt: typeof value.decidedAt === "string" ? value.decidedAt : nowIso(),
  };
  if (typeof value.reason === "string") {
    decision.reason = value.reason;
  }
  if ("payload" in value) {
    decision.payload = value.payload;
  }
  return decision;
}

export function readLocalServicesWorkspace(tenantId: string): LocalServicesWorkspaceRecord {
  return getRecord(tenantId);
}

export function writeLocalServicesWorkspace(
  tenantId: string,
  snapshot: unknown,
): LocalServicesWorkspaceRecord {
  if (!isRecord(snapshot)) {
    throw new Error("snapshot must be a JSON object");
  }
  normalizeScenarioOverrides(snapshot.scenarioOverrides);
  const current = getRecord(tenantId);
  return saveRecord({
    ...current,
    snapshot,
  });
}

export function listLocalServicesScenarioOverrides(tenantId: string): Record<string, unknown>[] {
  const current = getRecord(tenantId);
  return normalizeScenarioOverrides(current.snapshot.scenarioOverrides);
}

export function saveLocalServicesScenarioOverrides(
  tenantId: string,
  scenarios: unknown,
): LocalServicesWorkspaceRecord {
  const scenarioOverrides = normalizeScenarioOverrides(scenarios);
  const current = getRecord(tenantId);
  return saveRecord({
    ...current,
    snapshot: {
      ...current.snapshot,
      scenarioOverrides,
    },
  });
}

export function recordLocalServicesCaseDecision(
  tenantId: string,
  ref: string,
  decisionInput: unknown,
): LocalServicesWorkspaceRecord {
  const decision = normalizeDecision(decisionInput);
  const current = getRecord(tenantId);
  const decisions = isRecord(current.snapshot.operatorDecisionByCaseRef)
    ? current.snapshot.operatorDecisionByCaseRef
    : {};
  return saveRecord({
    ...current,
    snapshot: {
      ...current.snapshot,
      operatorDecisionByCaseRef: {
        ...decisions,
        [ref]: decision,
      },
    },
  });
}

export function recordLocalServicesSetupEvent(
  tenantId: string,
  stepId: unknown,
  payload: unknown,
): LocalServicesWorkspaceRecord {
  if (typeof stepId !== "string" || stepId.trim().length === 0) {
    throw new Error("stepId is required");
  }
  const current = getRecord(tenantId);
  const setupEvents = Array.isArray(current.snapshot.setupEvents)
    ? (current.snapshot.setupEvents as LocalServicesSetupEvent[])
    : [];
  return saveRecord({
    ...current,
    snapshot: {
      ...current.snapshot,
      setupEvents: [
        ...setupEvents,
        {
          stepId,
          payload,
          recordedAt: nowIso(),
        },
      ],
    },
  });
}

export function buildLocalServicesPilotExport(tenantId: string): {
  title: string;
  generatedAt: string;
  storageKey: typeof LOCAL_SERVICES_WORKSPACE_STORAGE_KEY;
  humanText: string;
  jsonText: string;
} {
  const record = getRecord(tenantId);
  const generatedAt = nowIso();
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_workspace_api",
      tenant_id: tenantId,
      storage_key: LOCAL_SERVICES_WORKSPACE_STORAGE_KEY,
      version: record.version,
      updated_at: record.updatedAt,
      generated_at: generatedAt,
      snapshot: record.snapshot,
    },
    null,
    2,
  );

  return {
    title: "Local services workspace API export",
    generatedAt,
    storageKey: LOCAL_SERVICES_WORKSPACE_STORAGE_KEY,
    humanText: [
      "Local services workspace API export",
      `Tenant: ${tenantId}`,
      `Storage key: ${LOCAL_SERVICES_WORKSPACE_STORAGE_KEY}`,
      "Manual execution rule: no outreach, dispatch, CRM write, billing, or customer send happens without operator approval.",
      "",
      jsonText,
    ].join("\n"),
    jsonText,
  };
}
