import {
  policySnapshots,
  type PolicySnapshot,
} from "../data/simulationRuns";
import type {
  RuntimeGovernancePolicy,
  RuntimeGovernancePolicyUpdate,
  RuntimeGovernanceTemplateCatalog,
} from "../hooks/useWorkspaceRuntime";

const CURRENT_POLICY_ID = "policy-current";
const TEMPLATE_POLICY_PREFIX = "policy-template-";

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function summarizeRetentionPolicy(retentionPolicy: Record<string, number> | null): string | null {
  if (!retentionPolicy) {
    return null;
  }
  const preferredKeys = ["rawMediaDays", "signedEvidenceDays", "auditTrailDays"];
  const summary = preferredKeys
    .filter((key) => typeof retentionPolicy[key] === "number")
    .map((key) => `${titleCase(key.replace(/Days$/, ""))} ${retentionPolicy[key]}d`);
  if (summary.length > 0) {
    return summary.join(" \u00b7 ");
  }
  const firstEntry = Object.entries(retentionPolicy).find(([, value]) => Number.isFinite(value));
  return firstEntry ? `${titleCase(firstEntry[0])} ${firstEntry[1]}d` : null;
}

function buildRuntimeTemplatePolicyId(templateId: string): string {
  return `${TEMPLATE_POLICY_PREFIX}${templateId}`;
}

function parseRuntimeTemplatePolicyId(policyId: string): string | null {
  return policyId.startsWith(TEMPLATE_POLICY_PREFIX)
    ? policyId.slice(TEMPLATE_POLICY_PREFIX.length)
    : null;
}

function normalizeGovernanceSourceLabel(source: string | null): string {
  if (source === "tenant_override") {
    return "tenant override";
  }
  if (source === "template_default") {
    return "template default";
  }
  return "runtime governance";
}

function collectPolicyHistory(
  templateId: string | null,
  updates: RuntimeGovernancePolicyUpdate[],
): NonNullable<PolicySnapshot["runtimeGovernance"]>["history"] {
  if (!templateId) {
    return [];
  }
  return updates
    .filter((item) => item.complianceTemplate === templateId)
    .slice(0, 3)
    .map((item) => ({
      createdAt: item.createdAt,
      outcome: item.outcome,
      actorRole: item.actorRole,
      reason: item.reason,
      errorCode: item.errorCode,
      version: item.version,
    }));
}

function findLatestSuccessfulUpdate(
  templateId: string,
  updates: RuntimeGovernancePolicyUpdate[],
): RuntimeGovernancePolicyUpdate | null {
  return (
    updates.find(
      (item) =>
        item.complianceTemplate === templateId &&
        item.outcome?.toLowerCase() === "succeeded",
    ) ?? null
  );
}

function buildCurrentPolicyName(
  runtimePolicy: RuntimeGovernancePolicy,
  fallback?: PolicySnapshot,
): string {
  const template = runtimePolicy.complianceTemplate;
  if (!template) {
    return fallback?.name ?? "current";
  }
  return `current \u00b7 ${template}`;
}

function buildCurrentPolicyDescription(
  runtimePolicy: RuntimeGovernancePolicy,
): string {
  const template = runtimePolicy.complianceTemplate ?? "current";
  const source = normalizeGovernanceSourceLabel(runtimePolicy.source);
  const retention = summarizeRetentionPolicy(runtimePolicy.retentionPolicy);
  const suffix = retention ? ` Retention: ${retention}.` : "";
  const requested =
    runtimePolicy.fallbackApplied && runtimePolicy.requestedTemplateId
      ? ` Requested ${runtimePolicy.requestedTemplateId}, fell back to ${template}.`
      : "";
  return `Live governance policy serving the operator desk. Template ${template} from ${source}.${requested}${suffix}`.trim();
}

function buildCurrentPolicyAuthor(
  runtimePolicy: RuntimeGovernancePolicy,
  latestUpdate: RuntimeGovernancePolicyUpdate | null,
): string {
  if (latestUpdate?.actorRole && latestUpdate.version !== null) {
    return `${latestUpdate.actorRole} v${latestUpdate.version}`;
  }
  if (runtimePolicy.source === "tenant_override") {
    return runtimePolicy.overrideVersion !== null
      ? `tenant override v${runtimePolicy.overrideVersion}`
      : "tenant override";
  }
  if (runtimePolicy.source === "template_default") {
    return "template default";
  }
  return "governance runtime";
}

function buildTemplatePolicyDescription(params: {
  templateId: string;
  templateDescription: string;
  runtimePolicy: RuntimeGovernancePolicy;
  latestUpdate: RuntimeGovernancePolicyUpdate | null;
}): string {
  const { templateId, templateDescription, runtimePolicy, latestUpdate } = params;
  const latestLine = latestUpdate
    ? ` Latest ${latestUpdate.outcome ?? "observed"} change v${latestUpdate.version ?? "?"} by ${latestUpdate.actorRole ?? "operator"}.`
    : "";
  const activeLine =
    runtimePolicy.complianceTemplate === templateId
      ? " This template is already live."
      : " Promote to live to apply it to the operator desk.";
  return `${templateDescription}${activeLine}${latestLine}`.trim();
}

function buildRuntimeTemplatePolicies(
  runtimePolicy: RuntimeGovernancePolicy,
  templateCatalog: RuntimeGovernanceTemplateCatalog | null,
  updates: RuntimeGovernancePolicyUpdate[],
): PolicySnapshot[] {
  if (!templateCatalog || templateCatalog.availableTemplates.length === 0) {
    return [];
  }
  return templateCatalog.availableTemplates
    .filter((template) => template.id !== runtimePolicy.complianceTemplate)
    .map((template) => {
      const latestUpdate = findLatestSuccessfulUpdate(template.id, updates);
      const authoredAt =
        latestUpdate?.createdAt ??
        runtimePolicy.overrideUpdatedAt ??
        new Date().toISOString();
      return {
        id: buildRuntimeTemplatePolicyId(template.id),
        name: template.id,
        description: buildTemplatePolicyDescription({
          templateId: template.id,
          templateDescription: template.description,
          runtimePolicy,
          latestUpdate,
        }),
        authoredAt,
        author:
          latestUpdate?.actorRole && latestUpdate.version !== null
            ? `${latestUpdate.actorRole} v${latestUpdate.version}`
            : "governance template",
        isLive: false,
        runtimeGovernance: {
          templateId: template.id,
          tenantId: runtimePolicy.tenantId,
          source: templateCatalog.source,
          promoteable: true,
          version: runtimePolicy.overrideVersion,
          history: collectPolicyHistory(template.id, updates),
        },
      } satisfies PolicySnapshot;
    });
}

export function buildSimulationPolicySnapshots(
  runtimePolicy: RuntimeGovernancePolicy | null,
  templateCatalog: RuntimeGovernanceTemplateCatalog | null = null,
  updates: RuntimeGovernancePolicyUpdate[] = [],
  seedPolicies: PolicySnapshot[] = policySnapshots,
): PolicySnapshot[] {
  if (!runtimePolicy) {
    return seedPolicies;
  }

  const fallbackCurrent =
    seedPolicies.find((policy) => policy.id === CURRENT_POLICY_ID) ?? seedPolicies[0];
  const latestCurrentUpdate = runtimePolicy.complianceTemplate
    ? findLatestSuccessfulUpdate(runtimePolicy.complianceTemplate, updates)
    : null;
  const currentSnapshot: PolicySnapshot = {
    ...(fallbackCurrent ?? {
      id: CURRENT_POLICY_ID,
      name: "current",
      description: "Live governance policy serving the operator desk.",
      authoredAt: runtimePolicy.overrideUpdatedAt ?? new Date().toISOString(),
      author: "governance runtime",
      isLive: true,
    }),
    id: CURRENT_POLICY_ID,
    name: buildCurrentPolicyName(runtimePolicy, fallbackCurrent),
    description: buildCurrentPolicyDescription(runtimePolicy),
    authoredAt:
      latestCurrentUpdate?.createdAt ??
      runtimePolicy.overrideUpdatedAt ??
      fallbackCurrent?.authoredAt ??
      new Date().toISOString(),
    author: buildCurrentPolicyAuthor(runtimePolicy, latestCurrentUpdate),
    isLive: true,
    runtimeGovernance: {
      templateId: runtimePolicy.complianceTemplate,
      tenantId: runtimePolicy.tenantId,
      source: runtimePolicy.source,
      promoteable: false,
      version: runtimePolicy.overrideVersion,
      history: collectPolicyHistory(runtimePolicy.complianceTemplate, updates),
    },
  };

  const runtimeTemplates = buildRuntimeTemplatePolicies(
    runtimePolicy,
    templateCatalog,
    updates,
  );
  if (runtimeTemplates.length > 0) {
    return [currentSnapshot, ...runtimeTemplates];
  }

  return seedPolicies.map((policy) =>
    policy.id === CURRENT_POLICY_ID ? currentSnapshot : policy,
  );
}

export function findSimulationPolicy(
  policyId: string,
  policies: PolicySnapshot[] = policySnapshots,
): PolicySnapshot | undefined {
  const direct = policies.find((policy) => policy.id === policyId);
  if (direct) {
    return direct;
  }
  const templateId = parseRuntimeTemplatePolicyId(policyId);
  if (!templateId) {
    return undefined;
  }
  return policies.find((policy) => policy.runtimeGovernance?.templateId === templateId);
}
