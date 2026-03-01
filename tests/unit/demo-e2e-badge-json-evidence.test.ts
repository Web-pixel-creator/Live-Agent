import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const badgeScriptPath = resolve(process.cwd(), "scripts", "demo-e2e-badge-json.mjs");

function runBadgeGenerator(params: {
  policy: Record<string, unknown>;
  summary: Record<string, unknown>;
}): { exitCode: number; details: Record<string, unknown>; badge: Record<string, unknown> } {
  const tempDir = mkdtempSync(join(tmpdir(), "mla-badge-evidence-"));
  try {
    const policyPath = join(tempDir, "policy-check.json");
    const summaryPath = join(tempDir, "summary.json");
    const badgePath = join(tempDir, "badge.json");
    const detailsPath = join(tempDir, "badge-details.json");

    writeFileSync(policyPath, `${JSON.stringify(params.policy, null, 2)}\n`, "utf8");
    writeFileSync(summaryPath, `${JSON.stringify(params.summary, null, 2)}\n`, "utf8");

    const result = spawnSync(
      process.execPath,
      [
        badgeScriptPath,
        "--policy",
        policyPath,
        "--summary",
        summaryPath,
        "--output",
        badgePath,
        "--detailsOutput",
        detailsPath,
      ],
      { encoding: "utf8" },
    );

    const exitCode = result.status ?? 1;
    const badge = JSON.parse(readFileSync(badgePath, "utf8")) as Record<string, unknown>;
    const details = JSON.parse(readFileSync(detailsPath, "utf8")) as Record<string, unknown>;
    return {
      exitCode,
      details,
      badge,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test("demo-e2e badge details include operator turn truncation/delete evidence blocks", () => {
  const result = runBadgeGenerator({
    policy: {
      ok: true,
      checks: 205,
      violations: [],
    },
    summary: {
      generatedAt: "2026-02-26T00:00:00.000Z",
      kpis: {
        gatewayWsRoundTripMs: 37,
        operatorTurnTruncationSummaryValidated: true,
        operatorTurnTruncationExpectedEventSeen: true,
        operatorTurnTruncationTotal: 1,
        operatorTurnTruncationUniqueRuns: 1,
        operatorTurnTruncationUniqueSessions: 1,
        operatorTurnTruncationLatestSeenAt: "2026-02-26T00:00:00.000Z",
        operatorTurnTruncationLatestTurnId: "turn-truncate-demo",
        operatorTurnTruncationLatestReason: "demo_truncate_checkpoint",
        operatorTurnDeleteSummaryValidated: true,
        operatorTurnDeleteExpectedEventSeen: true,
        operatorTurnDeleteTotal: 1,
        operatorTurnDeleteUniqueRuns: 1,
        operatorTurnDeleteUniqueSessions: 1,
        operatorTurnDeleteLatestSeenAt: "2026-02-26T00:00:00.000Z",
        operatorTurnDeleteLatestTurnId: "turn-delete-demo",
        operatorTurnDeleteLatestReason: "demo_delete_checkpoint",
        operatorTurnDeleteLatestScope: "session_local",
        damageControlDiagnosticsValidated: true,
        damageControlEnabled: true,
        damageControlVerdict: "ask",
        damageControlSource: "file",
        damageControlMatchedRuleCount: 2,
        damageControlMatchRuleIds: ["requires_approval_sensitive_action", "allow_search_docs"],
        operatorDamageControlSummaryValidated: true,
        operatorDamageControlTotal: 1,
        operatorDamageControlUniqueRuns: 1,
        operatorDamageControlUniqueSessions: 1,
        operatorDamageControlMatchedRuleCountTotal: 2,
        operatorDamageControlAllowCount: 0,
        operatorDamageControlAskCount: 1,
        operatorDamageControlBlockCount: 0,
        operatorDamageControlLatestVerdict: "ask",
        operatorDamageControlLatestSource: "file",
        operatorDamageControlLatestMatchedRuleCount: 2,
        operatorDamageControlLatestSeenAt: "2026-02-26T00:00:00.000Z",
        governancePolicyLifecycleValidated: true,
        governancePolicyOperatorActionSeen: true,
        governancePolicyOverrideTenantSeen: true,
        governancePolicyIdempotencyReplayOutcome: "idempotent_replay",
        governancePolicyVersionConflictCode: "API_GOVERNANCE_POLICY_VERSION_CONFLICT",
        governancePolicyIdempotencyConflictCode: "API_GOVERNANCE_POLICY_IDEMPOTENCY_CONFLICT",
        governancePolicyTenantScopeForbiddenCode: "API_TENANT_SCOPE_FORBIDDEN",
        governancePolicySummaryTemplateId: "strict",
        governancePolicySummarySource: "tenant_override",
        governancePolicyComplianceTemplate: "strict",
        governancePolicyOverridesTotal: 1,
        skillsRegistryLifecycleValidated: true,
        skillsRegistryIndexHasSkill: true,
        skillsRegistryRegistryHasSkill: true,
        skillsRegistryCreateOutcome: "created",
        skillsRegistryReplayOutcome: "idempotent_replay",
        skillsRegistryVersionConflictCode: "API_SKILL_REGISTRY_VERSION_CONFLICT",
        skillsRegistryPluginInvalidPermissionCode: "API_SKILL_PLUGIN_PERMISSION_INVALID",
        skillsRegistryIndexTotal: 1,
        skillsRegistryTotal: 1,
        operatorDeviceNodeLookupValidated: true,
        operatorDeviceNodeVersionConflictValidated: true,
        operatorDeviceNodeHealthSummaryValidated: true,
        operatorDeviceNodeLookupStatus: "degraded",
        operatorDeviceNodeLookupVersion: 3,
        operatorDeviceNodeUpdatedVersion: 2,
        operatorDeviceNodeVersionConflictStatusCode: 409,
        operatorDeviceNodeVersionConflictCode: "API_DEVICE_NODE_VERSION_CONFLICT",
        operatorDeviceNodeUpdatesTotal: 2,
        operatorDeviceNodeUpdatesHasUpsert: true,
        operatorDeviceNodeUpdatesHasHeartbeat: true,
        operatorDeviceNodeUpdatesApiValidated: true,
        operatorDeviceNodeUpdatesValidated: true,
        operatorDeviceNodeSummaryTotal: 1,
        operatorDeviceNodeSummaryDegraded: 1,
        operatorDeviceNodeSummaryStale: 0,
        operatorDeviceNodeSummaryMissingHeartbeat: 0,
        operatorDeviceNodeSummaryRecentContainsLookup: true,
      },
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.badge.message, "pass | 205 checks | 37ms ws");
  const evidence = result.details.evidence as Record<string, unknown>;
  assert.ok(evidence && typeof evidence === "object");
  const turnTruncation = evidence.operatorTurnTruncation as Record<string, unknown>;
  const turnDelete = evidence.operatorTurnDelete as Record<string, unknown>;
  const damageControl = evidence.damageControl as Record<string, unknown>;
  const operatorDamageControl = evidence.operatorDamageControl as Record<string, unknown>;
  const governancePolicy = evidence.governancePolicy as Record<string, unknown>;
  const skillsRegistry = evidence.skillsRegistry as Record<string, unknown>;
  const deviceNodes = evidence.deviceNodes as Record<string, unknown>;
  assert.equal(turnTruncation.status, "pass");
  assert.equal(turnDelete.status, "pass");
  assert.equal(damageControl.status, "pass");
  assert.equal(operatorDamageControl.status, "pass");
  assert.equal(governancePolicy.status, "pass");
  assert.equal(skillsRegistry.status, "pass");
  assert.equal(deviceNodes.status, "pass");
  assert.equal(turnTruncation.latestTurnId, "turn-truncate-demo");
  assert.equal(turnDelete.latestTurnId, "turn-delete-demo");
  assert.equal(turnDelete.latestScope, "session_local");
  assert.equal(damageControl.verdict, "ask");
  assert.equal(damageControl.source, "file");
  assert.deepEqual(damageControl.matchedRuleIds, ["requires_approval_sensitive_action", "allow_search_docs"]);
  const operatorDamageControlLatest = operatorDamageControl.latest as Record<string, unknown>;
  assert.equal(operatorDamageControlLatest.verdict, "ask");
  assert.equal(operatorDamageControlLatest.source, "file");
  assert.equal(governancePolicy.summaryTemplateId, "strict");
  assert.equal(governancePolicy.summarySource, "tenant_override");
  assert.equal(governancePolicy.complianceTemplate, "strict");
  assert.equal(governancePolicy.overridesTotal, 1);
  assert.equal(skillsRegistry.createOutcome, "created");
  assert.equal(skillsRegistry.replayOutcome, "idempotent_replay");
  assert.equal(skillsRegistry.indexTotal, 1);
  assert.equal(skillsRegistry.registryTotal, 1);
  assert.equal(deviceNodes.lookupStatus, "degraded");
  assert.equal(deviceNodes.lookupVersion, 3);
  assert.equal(deviceNodes.updatedVersion, 2);
  assert.equal(deviceNodes.versionConflictStatusCode, 409);
  assert.equal(deviceNodes.versionConflictCode, "API_DEVICE_NODE_VERSION_CONFLICT");
  assert.equal(deviceNodes.updatesTotal, 2);
  assert.equal(deviceNodes.updatesHasUpsert, true);
  assert.equal(deviceNodes.updatesHasHeartbeat, true);
  assert.equal(deviceNodes.updatesApiValidated, true);
  assert.equal(deviceNodes.updatesValidated, true);
  assert.equal(deviceNodes.summaryTotal, 1);
  assert.equal(deviceNodes.summaryDegraded, 1);
  assert.equal(deviceNodes.summaryRecentContainsLookup, true);
});

test("demo-e2e badge details marks operator turn delete evidence as failed when checkpoint is missing", () => {
  const result = runBadgeGenerator({
    policy: {
      ok: false,
      checks: 205,
      violations: [
        "kpi.operatorTurnDeleteSummaryValidated",
        "kpi.operatorTurnDeleteExpectedEventSeen",
        "kpi.operatorTurnDeleteTotal",
      ],
    },
    summary: {
      generatedAt: "2026-02-26T00:00:00.000Z",
      kpis: {
        gatewayWsRoundTripMs: 45,
        operatorTurnDeleteSummaryValidated: false,
        operatorTurnDeleteExpectedEventSeen: false,
        operatorTurnDeleteTotal: 0,
        operatorTurnDeleteUniqueRuns: 0,
        operatorTurnDeleteUniqueSessions: 0,
        operatorTurnDeleteLatestSeenAt: "",
      },
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.badge.color, "red");
  const evidence = result.details.evidence as Record<string, unknown>;
  const turnDelete = evidence.operatorTurnDelete as Record<string, unknown>;
  const damageControl = evidence.damageControl as Record<string, unknown>;
  const operatorDamageControl = evidence.operatorDamageControl as Record<string, unknown>;
  const governancePolicy = evidence.governancePolicy as Record<string, unknown>;
  const skillsRegistry = evidence.skillsRegistry as Record<string, unknown>;
  const deviceNodes = evidence.deviceNodes as Record<string, unknown>;
  assert.equal(turnDelete.status, "fail");
  assert.equal(turnDelete.validated, false);
  assert.equal(turnDelete.total, 0);
  assert.equal(turnDelete.latestSeenAtIsIso, false);
  assert.equal(damageControl.status, "fail");
  assert.equal(damageControl.enabled, false);
  assert.equal(damageControl.diagnosticsValidated, false);
  assert.equal(damageControl.matchedRuleCount, 0);
  assert.deepEqual(damageControl.matchedRuleIds, []);
  assert.equal(operatorDamageControl.status, "fail");
  assert.equal(governancePolicy.status, "fail");
  assert.equal(governancePolicy.validated, false);
  assert.equal(governancePolicy.overridesTotal, 0);
  assert.equal(skillsRegistry.status, "fail");
  assert.equal(skillsRegistry.validated, false);
  assert.equal(skillsRegistry.indexTotal, 0);
  assert.equal(skillsRegistry.registryTotal, 0);
  assert.equal(deviceNodes.status, "fail");
  assert.equal(deviceNodes.validated, false);
  assert.equal(deviceNodes.lookupStatus, "");
  assert.equal(deviceNodes.summaryTotal, 0);
});
