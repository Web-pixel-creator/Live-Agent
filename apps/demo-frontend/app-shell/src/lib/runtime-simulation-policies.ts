import {
  policySnapshots,
  type PolicySnapshot,
} from "../data/simulationRuns";
import type { RuntimeGovernancePolicy } from "../hooks/useWorkspaceRuntime";

const CURRENT_POLICY_ID = "policy-current";

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
    return summary.join(" · ");
  }
  const firstEntry = Object.entries(retentionPolicy).find(([, value]) => Number.isFinite(value));
  return firstEntry ? `${titleCase(firstEntry[0])} ${firstEntry[1]}d` : null;
}

function buildCurrentPolicyName(runtimePolicy: RuntimeGovernancePolicy, fallback: PolicySnapshot): string {
  const template = runtimePolicy.complianceTemplate;
  if (!template) {
    return fallback.name;
  }
  return `current · ${template}`;
}

function buildCurrentPolicyDescription(
  runtimePolicy: RuntimeGovernancePolicy,
): string {
  const template = runtimePolicy.complianceTemplate ?? "current";
  const source =
    runtimePolicy.source === "tenant_override"
      ? "tenant override"
      : runtimePolicy.source === "template_default"
        ? "template default"
        : "runtime governance";
  const retention = summarizeRetentionPolicy(runtimePolicy.retentionPolicy);
  const suffix = retention ? ` Retention: ${retention}.` : "";
  const requested =
    runtimePolicy.fallbackApplied && runtimePolicy.requestedTemplateId
      ? ` Requested ${runtimePolicy.requestedTemplateId}, fell back to ${template}.`
      : "";
  return `Live governance policy serving the operator desk. Template ${template} from ${source}.${requested}${suffix}`.trim();
}

function buildCurrentPolicyAuthor(runtimePolicy: RuntimeGovernancePolicy): string {
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

export function buildSimulationPolicySnapshots(
  runtimePolicy: RuntimeGovernancePolicy | null,
  seedPolicies: PolicySnapshot[] = policySnapshots,
): PolicySnapshot[] {
  if (!runtimePolicy) {
    return seedPolicies;
  }
  return seedPolicies.map((policy) => {
    if (policy.id !== CURRENT_POLICY_ID) {
      return policy;
    }
    return {
      ...policy,
      name: buildCurrentPolicyName(runtimePolicy, policy),
      description: buildCurrentPolicyDescription(runtimePolicy),
      authoredAt: runtimePolicy.overrideUpdatedAt ?? policy.authoredAt,
      author: buildCurrentPolicyAuthor(runtimePolicy),
      isLive: true,
    };
  });
}

export function findSimulationPolicy(
  policyId: string,
  policies: PolicySnapshot[] = policySnapshots,
): PolicySnapshot | undefined {
  return policies.find((policy) => policy.id === policyId);
}
