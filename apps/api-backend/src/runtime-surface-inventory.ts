import type { OrchestratorIntent } from "@mla/contracts";
import {
  getSkillsCatalogSnapshot,
  getSkillsRuntimeCatalogSnapshot,
  type SkillCatalogJudgeCategory,
  type SkillSource,
  type SkillTrustLevel,
  type SkillsCatalogSnapshot,
  type SkillsRuntimeCatalogSnapshot,
} from "@mla/skills";

export type RuntimeSurfaceAgentId =
  | "live-agent"
  | "storyteller-agent"
  | "ui-navigator-agent";

export type RuntimeSurfaceRouteSummary = {
  intent: OrchestratorIntent;
  route: RuntimeSurfaceAgentId;
  productSurface: "live_agent" | "creative_storyteller" | "ui_navigator";
  approvalBoundary: "none" | "operator_approval" | "protected_review" | "human_handoff";
  evidenceOutputs: string[];
  releaseCritical: boolean;
  operatorVisible: boolean;
};

export type RuntimeSurfaceAgentSummary = {
  agentId: RuntimeSurfaceAgentId;
  label: string;
  productSurface: "live_agent" | "creative_storyteller" | "ui_navigator";
  intents: OrchestratorIntent[];
  releaseCritical: boolean;
  operatorVisible: boolean;
  evidenceOutputs: string[];
};

export type RuntimeSurfaceControlPlaneSummary = {
  id: string;
  label: string;
  method: "GET" | "POST";
  path: string;
  category:
    | "runtime"
    | "skills"
    | "device_nodes"
    | "channels"
    | "governance"
    | "evidence";
  releaseCritical: boolean;
  operatorVisible: boolean;
};

export type RuntimeSurfaceEvidenceSummary = {
  id: string;
  label: string;
  owner: RuntimeSurfaceAgentId | "api-backend" | "operator-console";
  artifactKind: "summary" | "diagnostics" | "audit" | "trace" | "release";
  releaseCritical: boolean;
  operatorVisible: boolean;
};

export type RuntimeSurfaceUiCapabilitySummary = {
  id: string;
  label: string;
  category: "grounding" | "verification" | "browser_worker" | "safety";
  requiresApproval: boolean;
  evidenceOutputs: string[];
  releaseCritical: boolean;
  operatorVisible: boolean;
};

export type RuntimeSurfacePlaybookSummary = {
  id: string;
  kind: "persona" | "recipe";
  name: string;
  ready: boolean;
  tags: string[];
  agentIds: string[];
  recommendedSkillIds: string[];
  judgeCategory: SkillCatalogJudgeCategory | null;
};

export type RuntimeSurfaceSkillsAgentSummary = {
  agentId: RuntimeSurfaceAgentId;
  catalogPersonas: number;
  catalogRecipes: number;
  activeSkillCount: number;
  skippedSkillCount: number;
  securityBlockedCount: number;
  trustBlockedCount: number;
  sourcePrecedence: SkillSource[];
  allowedSources: SkillSource[];
  minTrustLevel: SkillTrustLevel;
  securityMode: string;
};

export type RuntimeSurfaceInventorySnapshot = {
  generatedAt: string;
  source: "repo_owned_runtime_surface_inventory";
  inventoryVersion: number;
  agents: RuntimeSurfaceAgentSummary[];
  routes: RuntimeSurfaceRouteSummary[];
  controlPlane: RuntimeSurfaceControlPlaneSummary[];
  evidence: RuntimeSurfaceEvidenceSummary[];
  uiCapabilities: RuntimeSurfaceUiCapabilitySummary[];
  playbooks: RuntimeSurfacePlaybookSummary[];
  skills: {
    catalog: Pick<
      SkillsCatalogSnapshot,
      "version" | "updatedAt" | "source" | "configPath" | "warnings"
    > & {
      personaCount: number;
      recipeCount: number;
      repoKnownSkillCount: number;
      activeSkillIdCount: number;
    };
    runtimeByAgent: RuntimeSurfaceSkillsAgentSummary[];
  };
  summary: {
    totalAgents: number;
    totalRoutes: number;
    totalControlPlaneSurfaces: number;
    totalEvidenceLanes: number;
    totalUiCapabilities: number;
    totalPlaybooks: number;
    totalReleaseCriticalEntries: number;
    totalOperatorVisibleEntries: number;
    totalRuntimeActiveSkills: number;
  };
};

const RUNTIME_SURFACE_AGENT_SPECS: RuntimeSurfaceAgentSummary[] = [
  {
    agentId: "live-agent",
    label: "Live Agent",
    productSurface: "live_agent",
    intents: ["conversation", "translation", "negotiation", "research"],
    releaseCritical: true,
    operatorVisible: true,
    evidenceOutputs: ["summary", "trace", "operator_handoff"],
  },
  {
    agentId: "storyteller-agent",
    label: "Creative Storyteller",
    productSurface: "creative_storyteller",
    intents: ["story"],
    releaseCritical: false,
    operatorVisible: true,
    evidenceOutputs: ["story_summary", "media_job", "artifact"],
  },
  {
    agentId: "ui-navigator-agent",
    label: "UI Navigator",
    productSurface: "ui_navigator",
    intents: ["ui_task"],
    releaseCritical: true,
    operatorVisible: true,
    evidenceOutputs: ["verification", "trace", "replay_bundle"],
  },
];

const RUNTIME_SURFACE_ROUTE_SPECS: RuntimeSurfaceRouteSummary[] = [
  {
    intent: "conversation",
    route: "live-agent",
    productSurface: "live_agent",
    approvalBoundary: "none",
    evidenceOutputs: ["summary", "trace"],
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    intent: "translation",
    route: "live-agent",
    productSurface: "live_agent",
    approvalBoundary: "none",
    evidenceOutputs: ["summary", "trace"],
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    intent: "negotiation",
    route: "live-agent",
    productSurface: "live_agent",
    approvalBoundary: "operator_approval",
    evidenceOutputs: ["summary", "trace", "operator_handoff"],
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    intent: "research",
    route: "live-agent",
    productSurface: "live_agent",
    approvalBoundary: "none",
    evidenceOutputs: ["summary", "trace", "citations"],
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    intent: "story",
    route: "storyteller-agent",
    productSurface: "creative_storyteller",
    approvalBoundary: "none",
    evidenceOutputs: ["story_summary", "artifact", "media_job"],
    releaseCritical: false,
    operatorVisible: true,
  },
  {
    intent: "ui_task",
    route: "ui-navigator-agent",
    productSurface: "ui_navigator",
    approvalBoundary: "protected_review",
    evidenceOutputs: ["verification", "trace", "replay_bundle"],
    releaseCritical: true,
    operatorVisible: true,
  },
];

const RUNTIME_SURFACE_CONTROL_PLANE_SPECS: RuntimeSurfaceControlPlaneSummary[] = [
  {
    id: "runtime-diagnostics",
    label: "Runtime diagnostics",
    method: "GET",
    path: "/v1/runtime/diagnostics",
    category: "runtime",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "runtime-bootstrap-status",
    label: "Bootstrap doctor",
    method: "GET",
    path: "/v1/runtime/bootstrap-status",
    category: "runtime",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "runtime-surface",
    label: "Runtime surface inventory",
    method: "GET",
    path: "/v1/runtime/surface",
    category: "runtime",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "runtime-surface-readiness",
    label: "Runtime surface readiness",
    method: "GET",
    path: "/v1/runtime/surface/readiness",
    category: "runtime",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "runtime-auth-profiles",
    label: "Auth profiles",
    method: "GET",
    path: "/v1/runtime/auth-profiles",
    category: "runtime",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "runtime-auth-profile-rotate",
    label: "Rotate auth profile",
    method: "POST",
    path: "/v1/runtime/auth-profiles/rotate",
    category: "runtime",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "runtime-workflow-config",
    label: "Workflow config snapshot",
    method: "GET",
    path: "/v1/runtime/workflow-config",
    category: "runtime",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "runtime-workflow-override",
    label: "Workflow control-plane override",
    method: "POST",
    path: "/v1/runtime/workflow-control-plane-override",
    category: "runtime",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "runtime-browser-jobs",
    label: "Browser jobs",
    method: "GET",
    path: "/v1/runtime/browser-jobs",
    category: "runtime",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "runtime-fault-profiles",
    label: "Runtime fault profiles",
    method: "GET",
    path: "/v1/runtime/fault-profiles",
    category: "runtime",
    releaseCritical: false,
    operatorVisible: true,
  },
  {
    id: "skills-catalog",
    label: "Skills catalog",
    method: "GET",
    path: "/v1/skills/catalog",
    category: "skills",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "skills-personas",
    label: "Skills personas",
    method: "GET",
    path: "/v1/skills/personas",
    category: "skills",
    releaseCritical: false,
    operatorVisible: true,
  },
  {
    id: "skills-recipes",
    label: "Skills recipes",
    method: "GET",
    path: "/v1/skills/recipes",
    category: "skills",
    releaseCritical: false,
    operatorVisible: true,
  },
  {
    id: "device-nodes-index",
    label: "Device nodes",
    method: "GET",
    path: "/v1/device-nodes",
    category: "device_nodes",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "channels-session-resolve",
    label: "Channel session resolve",
    method: "GET",
    path: "/v1/channels/sessions/resolve",
    category: "channels",
    releaseCritical: false,
    operatorVisible: true,
  },
];

const RUNTIME_SURFACE_EVIDENCE_SPECS: RuntimeSurfaceEvidenceSummary[] = [
  {
    id: "operator-summary",
    label: "Operator summary",
    owner: "live-agent",
    artifactKind: "summary",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "runtime-diagnostics-evidence",
    label: "Runtime diagnostics evidence",
    owner: "api-backend",
    artifactKind: "diagnostics",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "bootstrap-doctor-evidence",
    label: "Bootstrap doctor evidence",
    owner: "api-backend",
    artifactKind: "diagnostics",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "operator-trace-summary",
    label: "Operator trace summary",
    owner: "operator-console",
    artifactKind: "trace",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "ui-replay-bundle",
    label: "UI replay bundle",
    owner: "ui-navigator-agent",
    artifactKind: "trace",
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "release-artifacts",
    label: "Release readiness artifacts",
    owner: "api-backend",
    artifactKind: "release",
    releaseCritical: true,
    operatorVisible: true,
  },
];

const RUNTIME_SURFACE_UI_CAPABILITIES: RuntimeSurfaceUiCapabilitySummary[] = [
  {
    id: "ui-grounding",
    label: "Stable grounding and ref resolution",
    category: "grounding",
    requiresApproval: false,
    evidenceOutputs: ["trace", "verification"],
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "ui-post-action-verification",
    label: "Post-action verification",
    category: "verification",
    requiresApproval: false,
    evidenceOutputs: ["verification", "replay_bundle"],
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "ui-browser-worker",
    label: "Browser worker and resumable jobs",
    category: "browser_worker",
    requiresApproval: true,
    evidenceOutputs: ["trace", "replay_bundle"],
    releaseCritical: true,
    operatorVisible: true,
  },
  {
    id: "ui-safety-controls",
    label: "Sandbox and approval controls",
    category: "safety",
    requiresApproval: true,
    evidenceOutputs: ["diagnostics", "audit"],
    releaseCritical: true,
    operatorVisible: true,
  },
];

function summarizePlaybooks(snapshot: SkillsCatalogSnapshot): RuntimeSurfacePlaybookSummary[] {
  const personas = snapshot.personas.map<RuntimeSurfacePlaybookSummary>((persona) => ({
    id: persona.id,
    kind: "persona",
    name: persona.name,
    ready: persona.ready,
    tags: persona.tags,
    agentIds: persona.agentIds,
    recommendedSkillIds: persona.recommendedSkillIds,
    judgeCategory: null,
  }));
  const recipes = snapshot.recipes.map<RuntimeSurfacePlaybookSummary>((recipe) => ({
    id: recipe.id,
    kind: "recipe",
    name: recipe.name,
    ready: recipe.ready,
    tags: recipe.tags,
    agentIds: recipe.agentId ? [recipe.agentId] : [],
    recommendedSkillIds: recipe.recommendedSkillIds,
    judgeCategory: recipe.judgeCategory,
  }));
  return [...personas, ...recipes];
}

function summarizeSkillsRuntime(
  agentId: RuntimeSurfaceAgentId,
  snapshot: SkillsRuntimeCatalogSnapshot,
): RuntimeSurfaceSkillsAgentSummary {
  return {
    agentId,
    catalogPersonas: snapshot.catalog.personas.length,
    catalogRecipes: snapshot.catalog.recipes.length,
    activeSkillCount: snapshot.runtimeSummary.activeCount,
    skippedSkillCount: snapshot.runtimeSummary.skippedCount,
    securityBlockedCount: snapshot.runtimeSummary.securityBlockedCount,
    trustBlockedCount: snapshot.runtimeSummary.trustBlockedCount,
    sourcePrecedence: snapshot.runtimeSummary.sourcePrecedence,
    allowedSources: snapshot.runtimeSummary.allowedSources,
    minTrustLevel: snapshot.runtimeSummary.minTrustLevel,
    securityMode: snapshot.runtimeSummary.securityMode,
  };
}

function countReleaseCriticalEntries(snapshot: {
  agents: RuntimeSurfaceAgentSummary[];
  routes: RuntimeSurfaceRouteSummary[];
  controlPlane: RuntimeSurfaceControlPlaneSummary[];
  evidence: RuntimeSurfaceEvidenceSummary[];
  uiCapabilities: RuntimeSurfaceUiCapabilitySummary[];
}): number {
  return [
    ...snapshot.agents,
    ...snapshot.routes,
    ...snapshot.controlPlane,
    ...snapshot.evidence,
    ...snapshot.uiCapabilities,
  ].filter((item) => item.releaseCritical).length;
}

function countOperatorVisibleEntries(snapshot: {
  agents: RuntimeSurfaceAgentSummary[];
  routes: RuntimeSurfaceRouteSummary[];
  controlPlane: RuntimeSurfaceControlPlaneSummary[];
  evidence: RuntimeSurfaceEvidenceSummary[];
  uiCapabilities: RuntimeSurfaceUiCapabilitySummary[];
}): number {
  return [
    ...snapshot.agents,
    ...snapshot.routes,
    ...snapshot.controlPlane,
    ...snapshot.evidence,
    ...snapshot.uiCapabilities,
  ].filter((item) => item.operatorVisible).length;
}

export async function buildRuntimeSurfaceInventorySnapshot(params?: {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): Promise<RuntimeSurfaceInventorySnapshot> {
  const env = params?.env ?? process.env;
  const cwd = params?.cwd ?? process.cwd();
  const catalog = await getSkillsCatalogSnapshot({ env, cwd });
  const runtimeCatalogs = await Promise.all(
    RUNTIME_SURFACE_AGENT_SPECS.map(async (agent) => ({
      agentId: agent.agentId,
      snapshot: await getSkillsRuntimeCatalogSnapshot({
        agentId: agent.agentId,
        env,
        cwd,
      }),
    })),
  );
  const playbooks = summarizePlaybooks(catalog);
  const runtimeByAgent = runtimeCatalogs.map(({ agentId, snapshot }) =>
    summarizeSkillsRuntime(agentId, snapshot),
  );
  const totalRuntimeActiveSkills = runtimeByAgent.reduce(
    (sum, item) => sum + item.activeSkillCount,
    0,
  );

  const snapshot: RuntimeSurfaceInventorySnapshot = {
    generatedAt: new Date().toISOString(),
    source: "repo_owned_runtime_surface_inventory",
    inventoryVersion: 1,
    agents: RUNTIME_SURFACE_AGENT_SPECS,
    routes: RUNTIME_SURFACE_ROUTE_SPECS,
    controlPlane: RUNTIME_SURFACE_CONTROL_PLANE_SPECS,
    evidence: RUNTIME_SURFACE_EVIDENCE_SPECS,
    uiCapabilities: RUNTIME_SURFACE_UI_CAPABILITIES,
    playbooks,
    skills: {
      catalog: {
        version: catalog.version,
        updatedAt: catalog.updatedAt,
        source: catalog.source,
        configPath: catalog.configPath,
        warnings: catalog.warnings,
        personaCount: catalog.personas.length,
        recipeCount: catalog.recipes.length,
        repoKnownSkillCount: catalog.repoKnownSkillIds.length,
        activeSkillIdCount: catalog.activeSkillIds.length,
      },
      runtimeByAgent,
    },
    summary: {
      totalAgents: RUNTIME_SURFACE_AGENT_SPECS.length,
      totalRoutes: RUNTIME_SURFACE_ROUTE_SPECS.length,
      totalControlPlaneSurfaces: RUNTIME_SURFACE_CONTROL_PLANE_SPECS.length,
      totalEvidenceLanes: RUNTIME_SURFACE_EVIDENCE_SPECS.length,
      totalUiCapabilities: RUNTIME_SURFACE_UI_CAPABILITIES.length,
      totalPlaybooks: playbooks.length,
      totalReleaseCriticalEntries: countReleaseCriticalEntries({
        agents: RUNTIME_SURFACE_AGENT_SPECS,
        routes: RUNTIME_SURFACE_ROUTE_SPECS,
        controlPlane: RUNTIME_SURFACE_CONTROL_PLANE_SPECS,
        evidence: RUNTIME_SURFACE_EVIDENCE_SPECS,
        uiCapabilities: RUNTIME_SURFACE_UI_CAPABILITIES,
      }),
      totalOperatorVisibleEntries: countOperatorVisibleEntries({
        agents: RUNTIME_SURFACE_AGENT_SPECS,
        routes: RUNTIME_SURFACE_ROUTE_SPECS,
        controlPlane: RUNTIME_SURFACE_CONTROL_PLANE_SPECS,
        evidence: RUNTIME_SURFACE_EVIDENCE_SPECS,
        uiCapabilities: RUNTIME_SURFACE_UI_CAPABILITIES,
      }),
      totalRuntimeActiveSkills,
    },
  };

  return snapshot;
}
