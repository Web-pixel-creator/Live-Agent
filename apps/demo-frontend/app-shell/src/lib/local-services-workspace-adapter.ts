import type { WorkspaceCase } from "@/data/workspace";
import {
  DEFAULT_LOCAL_SERVICES_SCENARIOS,
  mergeLocalServicesScenarioOverrides,
  parseLocalServicesScenarioList,
  type LocalServicesScenario,
} from "@/lib/local-services-scenarios";
import { fetchRuntimeApi } from "@/lib/runtime-api";

export const LOCAL_SERVICES_WORKSPACE_STORAGE_KEY = "liveDesk:localServicesPilotWorkspace:v1" as const;

export const LOCAL_SERVICES_WORKSPACE_ENDPOINTS = {
  workspace: "/v1/local-services/workspace",
  cases: "/v1/local-services/cases",
  caseByRef: "/v1/local-services/cases/:ref",
  caseDecision: "/v1/local-services/cases/:ref/decision",
  scenarios: "/v1/local-services/scenarios",
  pilotExport: "/v1/local-services/pilot/export",
  setupEvents: "/v1/local-services/setup/events",
} as const;

export type LocalServicesWorkspaceSnapshot = Record<string, unknown>;

export type LocalServicesOperatorDecision = {
  action: "approve" | "edit" | "reject" | "move" | "record";
  reason?: string;
  payload?: unknown;
  decidedAt?: string;
};

export type LocalServicesPilotExport = {
  title: string;
  generatedAt: string;
  storageKey: typeof LOCAL_SERVICES_WORKSPACE_STORAGE_KEY;
  humanText: string;
  jsonText: string;
};

export type LocalServicesWorkspaceAdapter = {
  listCases(): Promise<WorkspaceCase[]>;
  getCase(ref: string): Promise<WorkspaceCase | null>;
  readSnapshot(): Promise<LocalServicesWorkspaceSnapshot>;
  writeSnapshot(snapshot: LocalServicesWorkspaceSnapshot): Promise<void>;
  updateCaseDecision(ref: string, decision: LocalServicesOperatorDecision): Promise<void>;
  listScenarios(): Promise<LocalServicesScenario[]>;
  saveScenarioOverrides(scenarios: LocalServicesScenario[]): Promise<void>;
  recordSetupStep(stepId: string, payload: unknown): Promise<void>;
  exportPilotPacket(): Promise<LocalServicesPilotExport>;
};

export type LocalServicesStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type LocalServicesWorkspaceAdapterOptions = {
  cases: WorkspaceCase[];
  scenarios?: LocalServicesScenario[];
  snapshot?: LocalServicesWorkspaceSnapshot;
};

type BrowserLocalServicesWorkspaceAdapterOptions = LocalServicesWorkspaceAdapterOptions & {
  storage?: LocalServicesStorageLike | null;
  storageKey?: string;
};

type ApiLocalServicesWorkspaceAdapterOptions = LocalServicesWorkspaceAdapterOptions & {
  fetchImpl?: typeof fetch;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readJsonRecord(raw: string | null): LocalServicesWorkspaceSnapshot {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function mergeCaseDecision(
  snapshot: LocalServicesWorkspaceSnapshot,
  ref: string,
  decision: LocalServicesOperatorDecision,
): LocalServicesWorkspaceSnapshot {
  const decisions = isRecord(snapshot.operatorDecisionByCaseRef)
    ? snapshot.operatorDecisionByCaseRef
    : {};

  return {
    ...snapshot,
    operatorDecisionByCaseRef: {
      ...decisions,
      [ref]: {
        ...decision,
        decidedAt: decision.decidedAt ?? new Date().toISOString(),
      },
    },
  };
}

function buildPilotExport(snapshot: LocalServicesWorkspaceSnapshot): LocalServicesPilotExport {
  const generatedAt = new Date().toISOString();
  const jsonText = JSON.stringify(
    {
      export_surface: "local_services_workspace_adapter",
      storage_key: LOCAL_SERVICES_WORKSPACE_STORAGE_KEY,
      generated_at: generatedAt,
      snapshot,
    },
    null,
    2,
  );

  return {
    title: "Local services workspace adapter export",
    generatedAt,
    storageKey: LOCAL_SERVICES_WORKSPACE_STORAGE_KEY,
    humanText: [
      "Local services workspace adapter export",
      `Storage key: ${LOCAL_SERVICES_WORKSPACE_STORAGE_KEY}`,
      "Manual execution rule: this adapter does not send outreach, dispatch masters, write CRM, sync analytics, bill, or mutate docs.",
      "",
      jsonText,
    ].join("\n"),
    jsonText,
  };
}

function endpointWithRef(template: string, ref: string): string {
  return template.replace(":ref", encodeURIComponent(ref));
}

async function readApiData(
  responsePromise: Promise<Response>,
  errorPrefix: string,
): Promise<unknown> {
  const response = await responsePromise;
  if (!response.ok) {
    throw new Error(`${errorPrefix}_${response.status}`);
  }
  const payload = (await response.json()) as { data?: unknown };
  return payload.data;
}

function snapshotFromApiData(data: unknown): LocalServicesWorkspaceSnapshot {
  if (!isRecord(data)) {
    return {};
  }
  return isRecord(data.snapshot) ? data.snapshot : {};
}

export function createStaticLocalServicesWorkspaceAdapter(
  options: LocalServicesWorkspaceAdapterOptions,
): LocalServicesWorkspaceAdapter {
  let snapshot = options.snapshot ?? {};
  let scenarios = options.scenarios ?? DEFAULT_LOCAL_SERVICES_SCENARIOS;

  return {
    async listCases() {
      return options.cases;
    },
    async getCase(ref) {
      return options.cases.find((caseValue) => caseValue.ref === ref) ?? null;
    },
    async readSnapshot() {
      return snapshot;
    },
    async writeSnapshot(nextSnapshot) {
      snapshot = nextSnapshot;
    },
    async updateCaseDecision(ref, decision) {
      snapshot = mergeCaseDecision(snapshot, ref, decision);
    },
    async listScenarios() {
      return scenarios;
    },
    async saveScenarioOverrides(nextScenarios) {
      scenarios = parseLocalServicesScenarioList(nextScenarios);
    },
    async recordSetupStep(stepId, payload) {
      const setupEvents = Array.isArray(snapshot.setupEvents) ? snapshot.setupEvents : [];
      snapshot = {
        ...snapshot,
        setupEvents: [
          ...setupEvents,
          {
            stepId,
            payload,
            recordedAt: new Date().toISOString(),
          },
        ],
      };
    },
    async exportPilotPacket() {
      return buildPilotExport(snapshot);
    },
  };
}

export function createBrowserLocalServicesWorkspaceAdapter(
  options: BrowserLocalServicesWorkspaceAdapterOptions,
): LocalServicesWorkspaceAdapter {
  const storage =
    options.storage ??
    (typeof window !== "undefined" ? window.localStorage : null);
  const storageKey = options.storageKey ?? LOCAL_SERVICES_WORKSPACE_STORAGE_KEY;
  const staticAdapter = createStaticLocalServicesWorkspaceAdapter(options);

  const readSnapshot = async () => {
    if (!storage) {
      return staticAdapter.readSnapshot();
    }
    return readJsonRecord(storage.getItem(storageKey));
  };

  const writeSnapshot = async (snapshot: LocalServicesWorkspaceSnapshot) => {
    if (!storage) {
      await staticAdapter.writeSnapshot(snapshot);
      return;
    }
    storage.setItem(storageKey, JSON.stringify(snapshot));
  };

  return {
    ...staticAdapter,
    readSnapshot,
    writeSnapshot,
    async listScenarios() {
      const snapshot = await readSnapshot();
      return mergeLocalServicesScenarioOverrides(
        options.scenarios ?? DEFAULT_LOCAL_SERVICES_SCENARIOS,
        snapshot.scenarioOverrides,
      );
    },
    async updateCaseDecision(ref, decision) {
      const snapshot = await readSnapshot();
      await writeSnapshot(mergeCaseDecision(snapshot, ref, decision));
    },
    async saveScenarioOverrides(scenarios) {
      const nextScenarios = parseLocalServicesScenarioList(scenarios);
      const snapshot = await readSnapshot();
      await writeSnapshot({
        ...snapshot,
        scenarioOverrides: nextScenarios,
      });
    },
    async recordSetupStep(stepId, payload) {
      const snapshot = await readSnapshot();
      const setupEvents = Array.isArray(snapshot.setupEvents) ? snapshot.setupEvents : [];
      await writeSnapshot({
        ...snapshot,
        setupEvents: [
          ...setupEvents,
          {
            stepId,
            payload,
            recordedAt: new Date().toISOString(),
          },
        ],
      });
    },
    async exportPilotPacket() {
      return buildPilotExport(await readSnapshot());
    },
  };
}

export function createApiLocalServicesWorkspaceAdapter(
  options: ApiLocalServicesWorkspaceAdapterOptions,
): LocalServicesWorkspaceAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async listCases() {
      const data = await readApiData(
        fetchRuntimeApi(LOCAL_SERVICES_WORKSPACE_ENDPOINTS.cases, undefined, fetchImpl),
        "local_services_cases",
      );
      return Array.isArray(data) ? (data as WorkspaceCase[]) : options.cases;
    },
    async getCase(ref) {
      const response = await fetchRuntimeApi(
        endpointWithRef(LOCAL_SERVICES_WORKSPACE_ENDPOINTS.caseByRef, ref),
        undefined,
        fetchImpl,
      );
      if (response.status === 404) {
        return options.cases.find((caseValue) => caseValue.ref === ref) ?? null;
      }
      if (!response.ok) {
        throw new Error(`local_services_case_${response.status}`);
      }
      const payload = (await response.json()) as { data?: unknown };
      return isRecord(payload.data) ? (payload.data as WorkspaceCase) : null;
    },
    async readSnapshot() {
      return snapshotFromApiData(
        await readApiData(
          fetchRuntimeApi(LOCAL_SERVICES_WORKSPACE_ENDPOINTS.workspace, undefined, fetchImpl),
          "local_services_workspace",
        ),
      );
    },
    async writeSnapshot(snapshot) {
      await readApiData(
        fetchRuntimeApi(
          LOCAL_SERVICES_WORKSPACE_ENDPOINTS.workspace,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ snapshot }),
          },
          fetchImpl,
        ),
        "local_services_workspace_write",
      );
    },
    async updateCaseDecision(ref, decision) {
      await readApiData(
        fetchRuntimeApi(
          endpointWithRef(LOCAL_SERVICES_WORKSPACE_ENDPOINTS.caseDecision, ref),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ decision }),
          },
          fetchImpl,
        ),
        "local_services_case_decision",
      );
    },
    async listScenarios() {
      const data = await readApiData(
        fetchRuntimeApi(LOCAL_SERVICES_WORKSPACE_ENDPOINTS.scenarios, undefined, fetchImpl),
        "local_services_scenarios",
      );
      const scenarioOverrides = isRecord(data) ? data.scenarioOverrides : undefined;
      return mergeLocalServicesScenarioOverrides(
        options.scenarios ?? DEFAULT_LOCAL_SERVICES_SCENARIOS,
        scenarioOverrides,
      );
    },
    async saveScenarioOverrides(scenarios) {
      const nextScenarios = parseLocalServicesScenarioList(scenarios);
      await readApiData(
        fetchRuntimeApi(
          LOCAL_SERVICES_WORKSPACE_ENDPOINTS.scenarios,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ scenarios: nextScenarios }),
          },
          fetchImpl,
        ),
        "local_services_scenarios_write",
      );
    },
    async recordSetupStep(stepId, payload) {
      await readApiData(
        fetchRuntimeApi(
          LOCAL_SERVICES_WORKSPACE_ENDPOINTS.setupEvents,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ stepId, payload }),
          },
          fetchImpl,
        ),
        "local_services_setup_event",
      );
    },
    async exportPilotPacket() {
      const data = await readApiData(
        fetchRuntimeApi(LOCAL_SERVICES_WORKSPACE_ENDPOINTS.pilotExport, undefined, fetchImpl),
        "local_services_pilot_export",
      );
      return isRecord(data) ? (data as LocalServicesPilotExport) : buildPilotExport({});
    },
  };
}

export function createHybridLocalServicesWorkspaceAdapter(
  options: BrowserLocalServicesWorkspaceAdapterOptions & ApiLocalServicesWorkspaceAdapterOptions,
): LocalServicesWorkspaceAdapter {
  const browserAdapter = createBrowserLocalServicesWorkspaceAdapter(options);
  const apiAdapter = createApiLocalServicesWorkspaceAdapter(options);

  return {
    async listCases() {
      try {
        return await apiAdapter.listCases();
      } catch {
        return browserAdapter.listCases();
      }
    },
    async getCase(ref) {
      try {
        return await apiAdapter.getCase(ref);
      } catch {
        return browserAdapter.getCase(ref);
      }
    },
    async readSnapshot() {
      try {
        return await apiAdapter.readSnapshot();
      } catch {
        return browserAdapter.readSnapshot();
      }
    },
    async writeSnapshot(snapshot) {
      await browserAdapter.writeSnapshot(snapshot);
      try {
        await apiAdapter.writeSnapshot(snapshot);
      } catch {
        // Browser-local fallback remains the source for offline demos.
      }
    },
    async updateCaseDecision(ref, decision) {
      await browserAdapter.updateCaseDecision(ref, decision);
      try {
        await apiAdapter.updateCaseDecision(ref, decision);
      } catch {
        // Operator decisions remain in browser-local fallback when API is unavailable.
      }
    },
    async listScenarios() {
      try {
        return await apiAdapter.listScenarios();
      } catch {
        return browserAdapter.listScenarios();
      }
    },
    async saveScenarioOverrides(scenarios) {
      await browserAdapter.saveScenarioOverrides(scenarios);
      try {
        await apiAdapter.saveScenarioOverrides(scenarios);
      } catch {
        // Scenario overrides are still recoverable from browser-local workspace state.
      }
    },
    async recordSetupStep(stepId, payload) {
      await browserAdapter.recordSetupStep(stepId, payload);
      try {
        await apiAdapter.recordSetupStep(stepId, payload);
      } catch {
        // Setup evidence remains browser-local during offline demos.
      }
    },
    async exportPilotPacket() {
      try {
        return await apiAdapter.exportPilotPacket();
      } catch {
        return browserAdapter.exportPilotPacket();
      }
    },
  };
}
