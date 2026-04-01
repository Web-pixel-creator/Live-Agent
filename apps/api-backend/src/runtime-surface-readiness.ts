import {
  getSkillsCatalogSnapshot,
  getSkillsRuntimeCatalogSnapshot,
  type SkillsCatalogSnapshot,
  type SkillsRuntimeSummary,
} from "@mla/skills";
import type { DeviceNodeRecord } from "./firestore.js";
import { buildRuntimeBootstrapDoctorSnapshot } from "./runtime-bootstrap-doctor.js";
import { buildRuntimeDiagnosticsSummary } from "./runtime-diagnostics-summary.js";
import {
  buildRuntimeSurfaceInventorySnapshot,
  type RuntimeSurfaceInventorySnapshot,
} from "./runtime-surface-inventory.js";

type RuntimeSurfaceReadinessStatus = "ready" | "degraded" | "critical";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return null;
}

function toNonNegativeInt(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function buildSkillsSummary(params: {
  catalog: SkillsCatalogSnapshot;
  runtimeSummaries: SkillsRuntimeSummary[];
  inventory: RuntimeSurfaceInventorySnapshot;
}) {
  const runtimeReadyAgents = params.runtimeSummaries.filter(
    (item) => item.enabled && item.activeCount >= 0,
  ).length;
  const totalActiveSkills = params.runtimeSummaries.reduce(
    (sum, item) => sum + item.activeCount,
    0,
  );
  return {
    catalogSource: params.catalog.source,
    configPath: params.catalog.configPath,
    warnings: params.catalog.warnings,
    repoKnownSkillCount: params.catalog.repoKnownSkillIds.length,
    personaCount: params.catalog.personas.length,
    recipeCount: params.catalog.recipes.length,
    runtimeReadyAgents,
    runtimeAgentTotal: params.runtimeSummaries.length,
    totalActiveSkills,
    activePlaybooks: params.inventory.playbooks.filter((item) => item.ready).length,
  };
}

function buildEvidenceSummary(diagnostics: Record<string, unknown>) {
  const gateway = isRecord(diagnostics.gateway) ? diagnostics.gateway : null;
  const validatedFlags = [
    gateway ? toBoolean(gateway.turnTruncationValidated) : null,
    gateway ? toBoolean(gateway.turnDeleteValidated) : null,
    gateway ? toBoolean(gateway.damageControlValidated) : null,
    gateway ? toBoolean(gateway.agentUsageValidated) : null,
  ];
  const validatedCount = validatedFlags.filter((item) => item === true).length;
  return {
    validatedCount,
    totalChecks: validatedFlags.length,
    fullyValidated: validatedCount === validatedFlags.length,
  };
}

function buildDegradedReasons(params: {
  bootstrap: Record<string, unknown>;
  diagnostics: Record<string, unknown>;
}): string[] {
  const reasons: string[] = [];
  const checks = Array.isArray(params.bootstrap.checks)
    ? params.bootstrap.checks.filter((item) => isRecord(item))
    : [];
  for (const check of checks) {
    const status = toNonEmptyString(check.status);
    if (status !== "warn" && status !== "fail") {
      continue;
    }
    const title = toNonEmptyString(check.title) ?? "bootstrap_check";
    const message = toNonEmptyString(check.message) ?? "Bootstrap warning";
    reasons.push(`${title}: ${message}`);
  }
  const signals = Array.isArray(params.diagnostics.activeSignals)
    ? params.diagnostics.activeSignals.filter((item) => isRecord(item))
    : [];
  for (const signal of signals) {
    const message = toNonEmptyString(signal.message);
    if (message) {
      reasons.push(message);
    }
  }
  return Array.from(new Set(reasons)).slice(0, 12);
}

function resolveStatus(params: {
  bootstrapStatus: string | null;
  diagnosticsStatus: string | null;
  degradedReasons: string[];
}): RuntimeSurfaceReadinessStatus {
  if (params.bootstrapStatus === "critical" || params.diagnosticsStatus === "critical") {
    return "critical";
  }
  if (
    params.bootstrapStatus === "degraded" ||
    params.diagnosticsStatus === "degraded" ||
    params.degradedReasons.length > 0
  ) {
    return "degraded";
  }
  return "ready";
}

export async function buildRuntimeSurfaceReadinessSnapshot(params: {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  services: Array<Record<string, unknown>>;
  deviceNodes: DeviceNodeRecord[];
}): Promise<Record<string, unknown>> {
  const env = params.env ?? process.env;
  const cwd = params.cwd ?? process.cwd();
  const inventory = await buildRuntimeSurfaceInventorySnapshot({ env, cwd });
  const catalog = await getSkillsCatalogSnapshot({ env, cwd });
  const runtimeCatalogs = await Promise.all([
    getSkillsRuntimeCatalogSnapshot({ agentId: "live-agent", env, cwd }),
    getSkillsRuntimeCatalogSnapshot({ agentId: "storyteller-agent", env, cwd }),
    getSkillsRuntimeCatalogSnapshot({ agentId: "ui-navigator-agent", env, cwd }),
  ]);
  const runtimeSummaries = runtimeCatalogs.map((item) => item.runtimeSummary);

  const bootstrap = buildRuntimeBootstrapDoctorSnapshot({
    env,
    cwd,
    services: params.services,
    deviceNodes: params.deviceNodes,
  });
  const diagnostics = buildRuntimeDiagnosticsSummary({
    services: params.services,
    skillsCatalog: catalog,
    skillsRuntimeSummary: runtimeCatalogs[0]?.runtimeSummary ?? null,
  });

  const degradedReasons = buildDegradedReasons({
    bootstrap,
    diagnostics,
  });
  const bootstrapStatus = toNonEmptyString(bootstrap.status);
  const diagnosticsStatus = toNonEmptyString(diagnostics.status);
  const status = resolveStatus({
    bootstrapStatus,
    diagnosticsStatus,
    degradedReasons,
  });
  const servicesCoverage = isRecord(diagnostics.servicesCoverage)
    ? diagnostics.servicesCoverage
    : {};
  const bootstrapSummary = isRecord(bootstrap.summary) ? bootstrap.summary : {};
  const skills = buildSkillsSummary({
    catalog,
    runtimeSummaries,
    inventory,
  });
  const evidence = buildEvidenceSummary(diagnostics);

  return {
    generatedAt: new Date().toISOString(),
    source: "repo_owned_runtime_surface_readiness",
    status,
    safeToRun: status !== "critical" && toBoolean(diagnostics.validated) !== false,
    bootstrapStatus,
    diagnosticsStatus,
    topIssue:
      degradedReasons[0] ??
      toNonEmptyString(isRecord(bootstrapSummary.topCheck) ? bootstrapSummary.topCheck.message : null) ??
      null,
    degradedReasons,
    summary: {
      providers: isRecord(bootstrapSummary.providers)
        ? {
            primaryReady: toNonNegativeInt(bootstrapSummary.providers.primaryReady),
            primaryMissing: toNonNegativeInt(bootstrapSummary.providers.primaryMissing),
            secondaryConfigured: toNonNegativeInt(bootstrapSummary.providers.secondaryConfigured),
          }
        : {
            primaryReady: 0,
            primaryMissing: 0,
            secondaryConfigured: 0,
          },
      authProfiles: isRecord(bootstrapSummary.authProfiles)
        ? {
            total: toNonNegativeInt(bootstrapSummary.authProfiles.total),
            ready: toNonNegativeInt(bootstrapSummary.authProfiles.ready),
            warnings: toNonNegativeInt(bootstrapSummary.authProfiles.warnings),
          }
        : {
            total: 0,
            ready: 0,
            warnings: 0,
          },
      deviceNodes: isRecord(bootstrapSummary.deviceNodes)
        ? {
            total: toNonNegativeInt(bootstrapSummary.deviceNodes.total),
            ready: toNonNegativeInt(bootstrapSummary.deviceNodes.ready),
            online: toNonNegativeInt(bootstrapSummary.deviceNodes.online),
            trusted: toNonNegativeInt(bootstrapSummary.deviceNodes.trusted),
          }
        : {
            total: 0,
            ready: 0,
            online: 0,
            trusted: 0,
          },
      services: {
        total: toNonNegativeInt(servicesCoverage.total),
        healthy: toNonNegativeInt(servicesCoverage.healthy),
        ready: toNonNegativeInt(servicesCoverage.ready),
        draining: toNonNegativeInt(servicesCoverage.draining),
        runtimeVisible: toNonNegativeInt(servicesCoverage.runtimeVisible),
      },
      skills,
      evidence,
      workflow: isRecord(diagnostics.orchestrator)
        ? {
            sourcePath: toNonEmptyString(diagnostics.orchestrator.workflowSourcePath),
            usingLastKnownGood: toBoolean(diagnostics.orchestrator.workflowUsingLastKnownGood),
            currentStage: toNonEmptyString(diagnostics.orchestrator.workflowCurrentStage),
            activeRole: toNonEmptyString(diagnostics.orchestrator.workflowActiveRole),
            route: toNonEmptyString(diagnostics.orchestrator.workflowRoute),
            controlPlaneOverrideActive: toBoolean(
              diagnostics.orchestrator.workflowControlPlaneOverrideActive,
            ),
          }
        : {
            sourcePath: null,
            usingLastKnownGood: null,
            currentStage: null,
            activeRole: null,
            route: null,
            controlPlaneOverrideActive: null,
          },
      uiExecutor: isRecord(diagnostics.uiExecutor)
        ? {
            sandboxMode: toNonEmptyString(diagnostics.uiExecutor.sandboxMode),
            sandboxNetworkPolicy: toNonEmptyString(diagnostics.uiExecutor.sandboxNetworkPolicy),
            browserWorkerEnabled: toBoolean(diagnostics.uiExecutor.browserWorkerEnabled),
            strictPlaywright: toBoolean(diagnostics.uiExecutor.strictPlaywright),
            forceSimulation: toBoolean(diagnostics.uiExecutor.forceSimulation),
          }
        : {
            sandboxMode: null,
            sandboxNetworkPolicy: null,
            browserWorkerEnabled: null,
            strictPlaywright: null,
            forceSimulation: null,
          },
    },
    inventorySummary: inventory.summary,
  };
}
