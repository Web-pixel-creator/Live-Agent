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
        costEstimateCurrency: "USD",
        costEstimateGeminiLiveUsd: 0.12,
        costEstimateImagenUsd: 0.35,
        costEstimateVeoUsd: 0.2,
        costEstimateTtsUsd: 0.04,
        costEstimateTotalUsd: 0.71,
        costEstimateSource: "env_json",
        tokensUsedInput: 6200,
        tokensUsedOutput: 3100,
        tokensUsedTotal: 9300,
        tokensUsedSource: "env_json",
        storytellerTtsProvider: "deepgram",
        storytellerTtsModel: "aura-2",
        storytellerTtsDefaultProvider: "gemini_api",
        storytellerTtsDefaultModel: "gemini-tts",
        storytellerTtsSelectionReason: "provider_override",
        storytellerTtsSecondaryProvider: "deepgram",
        storytellerTtsSecondaryModel: "aura-2",
        storytellerTtsMetadataValidated: true,
        storytellerImageEditProvider: "fal",
        storytellerImageEditModel: "fal-ai/nano-banana-2/edit",
        storytellerImageEditDefaultProvider: "fal",
        storytellerImageEditDefaultModel: "fal-ai/nano-banana-2/edit",
        storytellerImageEditSelectionReason: "request_input",
        storytellerImageEditRequested: true,
        storytellerImageEditApplied: true,
        storytellerImageEditMetadataValidated: true,
        researchProvider: "perplexity",
        researchModel: "sonar-pro",
        researchDefaultProvider: "perplexity",
        researchDefaultModel: "sonar-pro",
        researchSelectionReason: "mock_response",
        researchCitationCount: 2,
        researchSourceUrlCount: 2,
        researchMetadataValidated: true,
        assistiveRouterProvider: "openai",
        assistiveRouterModel: "gpt-5.4",
        assistiveRouterDefaultProvider: "gemini_api",
        assistiveRouterDefaultModel: "gemini-3-flash",
        assistiveRouterSelectionReason: "provider_override",
        assistiveRouterBudgetPolicy: "long_context_operator",
        assistiveRouterPromptCaching: "provider_default",
        assistiveRouterWatchlistEnabled: false,
        assistiveRouterProviderMetadataValidated: true,
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
        operatorPluginMarketplaceLifecycleValidated: true,
        operatorPluginMarketplaceStatus: "observed",
        operatorPluginMarketplaceTotal: 4,
        operatorPluginMarketplaceUniquePlugins: 2,
        operatorPluginMarketplaceOutcomeSucceeded: 2,
        operatorPluginMarketplaceOutcomeDenied: 1,
        operatorPluginMarketplaceOutcomeFailed: 1,
        operatorPluginMarketplaceLifecycleCreated: 1,
        operatorPluginMarketplaceLifecycleUpdated: 1,
        operatorPluginMarketplaceLifecycleIdempotentReplay: 1,
        operatorPluginMarketplaceConflictVersionConflict: 1,
        operatorPluginMarketplaceConflictPluginInvalidPermission: 1,
        operatorPluginMarketplaceSigningVerified: 1,
        operatorPluginMarketplaceSigningUnsigned: 1,
        operatorPluginMarketplaceSigningNone: 2,
        operatorPluginMarketplaceSigningEvidenceObserved: true,
        operatorPluginMarketplacePermissionTotal: 2,
        operatorPluginMarketplacePermissionEntriesWithPermissions: 1,
        operatorPluginMarketplaceLatestOutcome: "denied",
        operatorPluginMarketplaceLatestPluginId: "demo-plugin-1",
        operatorPluginMarketplaceLatestVersion: 1,
        operatorPluginMarketplaceLatestSigningStatus: "unsigned",
        operatorPluginMarketplaceLatestSeenAt: "2026-02-26T00:00:00.000Z",
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
        operatorAgentUsageSummaryValidated: true,
        operatorAgentUsageTotal: 3,
        operatorAgentUsageUniqueRuns: 3,
        operatorAgentUsageUniqueSessions: 1,
        operatorAgentUsageTotalCalls: 4,
        operatorAgentUsageInputTokens: 6400,
        operatorAgentUsageOutputTokens: 3200,
        operatorAgentUsageTotalTokens: 9600,
        operatorAgentUsageModels: ["gemini-3-flash", "gemini-3-pro"],
        operatorAgentUsageSource: "gateway_runtime",
        operatorAgentUsageStatus: "observed",
        operatorRuntimeGuardrailsSignalPathsValidated: true,
        operatorRuntimeGuardrailsSignalPaths: {
          status: "critical signals=3",
          signalsSummary: "total=3 | critical=1 | warn=2 | info=0",
          coverageSummary: "healthy=4/4 | ready=4/4 | runtime=4/4 | metrics=4/4 | startup=0/0",
          sandboxSummary: "mode=audit | network=allow_all | setup=present | warnings=1",
          skillsSummary: "catalog=path/1w | personas=2/2 | recipes=1/1 | runtime=off active=0 skipped=0 blocked=0",
          topSignal:
            "critical assistive_router_missing_api_key@orchestrator | value=false | Assistive router is enabled but API key is not configured.",
          historyStatus:
            "Signal paths are sourced from the current runtime summary. Release artifacts exclude browser-local lifecycle history.",
          totalPaths: 3,
          lifecycleCounts: {
            active: 3,
            staged: 0,
            opened: 0,
            focused: 0,
            planned: 0,
            executed: 0,
            cleared: 0,
            failed: 0,
          },
          lifecycleSummary: "active=3",
          primaryPath: {
            title: "Recovery drill - assistive-router-missing-key",
            kind: "runtime_drill",
            signalKey: "assistive_router_missing_api_key",
            signalService: "orchestrator",
            signalKeys: ["assistive_router_missing_api_key"],
            signalDescriptors: ["critical assistive_router_missing_api_key@orchestrator"],
            profileId: "assistive-router-missing-key",
            phase: "recovery",
            targetStatusId: null,
            summaryText:
              "Recovery drill: Assistive router deterministic fallback (assistive-router-missing-key/recovery) for assistive_router_missing_api_key@orchestrator.",
            buttonLabel: "Plan Recovery Drill",
            lifecycle: {
              statusCode: "active",
              statusText: "active",
              detailText: "Repo-generated active signal path from runtime diagnostics summary.",
              updatedAt: "2026-02-26T00:00:00.000Z",
            },
          },
          paths: [
            {
              title: "Recovery drill - assistive-router-missing-key",
              kind: "runtime_drill",
              signalKey: "assistive_router_missing_api_key",
              signalService: "orchestrator",
              signalKeys: ["assistive_router_missing_api_key"],
              signalDescriptors: ["critical assistive_router_missing_api_key@orchestrator"],
              profileId: "assistive-router-missing-key",
              phase: "recovery",
              targetStatusId: null,
              summaryText:
                "Recovery drill: Assistive router deterministic fallback (assistive-router-missing-key/recovery) for assistive_router_missing_api_key@orchestrator.",
              buttonLabel: "Plan Recovery Drill",
              lifecycle: {
                statusCode: "active",
                statusText: "active",
                detailText: "Repo-generated active signal path from runtime diagnostics summary.",
                updatedAt: "2026-02-26T00:00:00.000Z",
              },
            },
            {
              title: "Recovery drill - ui-executor-force-simulation",
              kind: "runtime_drill",
              signalKey: "ui_executor_force_simulation",
              signalService: "ui-executor",
              signalKeys: ["ui_executor_force_simulation"],
              signalDescriptors: ["warn ui_executor_force_simulation@ui-executor"],
              profileId: "ui-executor-force-simulation",
              phase: "recovery",
              targetStatusId: null,
              summaryText:
                "Recovery drill: UI executor forced simulation (ui-executor-force-simulation/recovery) for ui_executor_force_simulation@ui-executor.",
              buttonLabel: "Plan Recovery Drill",
              lifecycle: {
                statusCode: "active",
                statusText: "active",
                detailText: "Repo-generated active signal path from runtime diagnostics summary.",
                updatedAt: "2026-02-26T00:00:00.000Z",
              },
            },
            {
              title: "Workflow clear path",
              kind: "workflow_control",
              signalKey: "workflow_control_plane_override_active",
              signalService: "orchestrator",
              signalKeys: ["workflow_control_plane_override_active"],
              signalDescriptors: ["warn workflow_control_plane_override_active@orchestrator"],
              profileId: null,
              phase: null,
              targetStatusId: null,
              summaryText:
                "Recovery surface: Workflow Control Panel -> Clear Override for workflow_control_plane_override_active@orchestrator.",
              buttonLabel: "Open Workflow Clear Path",
              lifecycle: {
                statusCode: "active",
                statusText: "active",
                detailText: "Repo-generated active signal path from runtime diagnostics summary.",
                updatedAt: "2026-02-26T00:00:00.000Z",
              },
            },
          ],
        },
      },
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.badge.message, "pass | 205 checks | 37ms ws");
  const costEstimate = result.details.costEstimate as Record<string, unknown>;
  const tokensUsed = result.details.tokensUsed as Record<string, unknown>;
  const providerUsage = result.details.providerUsage as Record<string, unknown>;
  assert.ok(costEstimate && typeof costEstimate === "object");
  assert.ok(tokensUsed && typeof tokensUsed === "object");
  assert.ok(providerUsage && typeof providerUsage === "object");
  assert.equal(costEstimate.currency, "USD");
  assert.equal(costEstimate.totalUsd, 0.71);
  assert.equal(tokensUsed.input, 6200);
  assert.equal(tokensUsed.output, 3100);
  assert.equal(tokensUsed.total, 9300);
  assert.equal(providerUsage.status, "pass");
  assert.equal(providerUsage.validated, true);
  assert.equal(providerUsage.activeSecondaryProviders, 2);
  const providerUsageEntries = providerUsage.entries as Record<string, unknown>[];
  assert.equal(providerUsageEntries.length, 4);
  assert.equal(providerUsageEntries[0]?.capability, "tts");
  assert.equal(providerUsageEntries[0]?.selectedProvider, "deepgram");
  assert.equal(providerUsageEntries[0]?.defaultProvider, "gemini_api");
  assert.equal(providerUsageEntries[0]?.selectionReason, "provider_override");
  assert.equal(providerUsageEntries[1]?.capability, "image_edit");
  assert.equal(providerUsageEntries[1]?.selectedProvider, "fal");
  assert.equal(providerUsageEntries[1]?.defaultProvider, "fal");
  assert.equal(providerUsageEntries[1]?.selectionReason, "request_input");
  assert.equal(providerUsageEntries[1]?.secondaryActive, false);
  assert.equal(providerUsageEntries[2]?.capability, "research");
  assert.equal(providerUsageEntries[2]?.selectedProvider, "perplexity");
  assert.equal(providerUsageEntries[2]?.defaultProvider, "perplexity");
  assert.equal(providerUsageEntries[2]?.selectionReason, "mock_response");
  assert.equal(providerUsageEntries[2]?.citationCount, 2);
  assert.equal(providerUsageEntries[2]?.sourceUrlCount, 2);
  assert.equal(providerUsageEntries[3]?.route, "orchestrator");
  assert.equal(providerUsageEntries[3]?.capability, "routing_reasoning");
  assert.equal(providerUsageEntries[3]?.selectedProvider, "openai");
  assert.equal(providerUsageEntries[3]?.defaultProvider, "gemini_api");
  assert.equal(providerUsageEntries[3]?.selectionReason, "provider_override");
  assert.equal(providerUsageEntries[3]?.budgetPolicy, "long_context_operator");
  assert.equal(providerUsageEntries[3]?.promptCaching, "provider_default");
  assert.equal(providerUsageEntries[3]?.watchlistEnabled, false);
  assert.equal(providerUsageEntries[3]?.secondaryActive, true);
  const evidence = result.details.evidence as Record<string, unknown>;
  assert.ok(evidence && typeof evidence === "object");
  const turnTruncation = evidence.operatorTurnTruncation as Record<string, unknown>;
  const turnDelete = evidence.operatorTurnDelete as Record<string, unknown>;
  const damageControl = evidence.damageControl as Record<string, unknown>;
  const operatorDamageControl = evidence.operatorDamageControl as Record<string, unknown>;
  const governancePolicy = evidence.governancePolicy as Record<string, unknown>;
  const skillsRegistry = evidence.skillsRegistry as Record<string, unknown>;
  const pluginMarketplace = evidence.pluginMarketplace as Record<string, unknown>;
  const deviceNodes = evidence.deviceNodes as Record<string, unknown>;
  const agentUsage = evidence.agentUsage as Record<string, unknown>;
  const runtimeGuardrailsSignalPaths = evidence.runtimeGuardrailsSignalPaths as Record<string, unknown>;
  assert.equal(turnTruncation.status, "pass");
  assert.equal(turnDelete.status, "pass");
  assert.equal(damageControl.status, "pass");
  assert.equal(operatorDamageControl.status, "pass");
  assert.equal(governancePolicy.status, "pass");
  assert.equal(skillsRegistry.status, "pass");
  assert.equal(pluginMarketplace.status, "pass");
  assert.equal(deviceNodes.status, "pass");
  assert.equal(agentUsage.status, "pass");
  assert.equal(runtimeGuardrailsSignalPaths.status, "pass");
  assert.equal(runtimeGuardrailsSignalPaths.validated, true);
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
  assert.equal(pluginMarketplace.summaryStatus, "observed");
  assert.equal(pluginMarketplace.total, 4);
  assert.equal(pluginMarketplace.uniquePlugins, 2);
  const pluginMarketplaceLatest = pluginMarketplace.latest as Record<string, unknown>;
  assert.equal(pluginMarketplaceLatest.pluginId, "demo-plugin-1");
  assert.equal(pluginMarketplaceLatest.signingStatus, "unsigned");
  assert.equal(pluginMarketplaceLatest.seenAtIsIso, true);
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
  assert.equal(agentUsage.total, 3);
  assert.equal(agentUsage.totalCalls, 4);
  assert.equal(agentUsage.totalTokens, 9600);
  assert.deepEqual(agentUsage.models, ["gemini-3-flash", "gemini-3-pro"]);
  assert.equal(agentUsage.summarySource, "gateway_runtime");
  assert.equal(agentUsage.summaryStatus, "observed");
  assert.equal(runtimeGuardrailsSignalPaths.summaryStatus, "critical signals=3");
  assert.equal(runtimeGuardrailsSignalPaths.totalPaths, 3);
  assert.equal(runtimeGuardrailsSignalPaths.lifecycleSummary, "active=3");
  const runtimeGuardrailsCounts = runtimeGuardrailsSignalPaths.lifecycleCounts as Record<string, unknown>;
  const runtimeGuardrailsPrimaryPath = runtimeGuardrailsSignalPaths.primaryPath as Record<string, unknown>;
  const runtimeGuardrailsPaths = runtimeGuardrailsSignalPaths.paths as Record<string, unknown>[];
  assert.equal(runtimeGuardrailsCounts.active, 3);
  assert.equal(runtimeGuardrailsPrimaryPath.kind, "runtime_drill");
  assert.equal(runtimeGuardrailsPrimaryPath.profileId, "assistive-router-missing-key");
  assert.equal(runtimeGuardrailsPrimaryPath.buttonLabel, "Plan Recovery Drill");
  assert.equal(runtimeGuardrailsPaths.length, 3);
  assert.equal(runtimeGuardrailsPaths[2]?.kind, "workflow_control");
  assert.equal(runtimeGuardrailsPaths[2]?.buttonLabel, "Open Workflow Clear Path");
});

test("demo-e2e badge provider usage ignores disabled storyteller image-edit requests", () => {
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
        storytellerTtsProvider: "gemini_api",
        storytellerTtsModel: "gemini-2.5-pro-preview-tts",
        storytellerTtsDefaultProvider: "gemini_api",
        storytellerTtsDefaultModel: "gemini-2.5-pro-preview-tts",
        storytellerTtsSelectionReason: "provider_override",
        storytellerTtsSecondaryProvider: "deepgram",
        storytellerTtsSecondaryModel: "aura-2-thalia-en",
        storytellerTtsMetadataValidated: true,
        storytellerImageEditProvider: "fal",
        storytellerImageEditModel: "fal-ai/nano-banana-2/edit",
        storytellerImageEditDefaultProvider: "fal",
        storytellerImageEditDefaultModel: "fal-ai/nano-banana-2/edit",
        storytellerImageEditMode: "disabled",
        storytellerImageEditSelectionReason: "config_enabled",
        storytellerImageEditRequested: true,
        storytellerImageEditApplied: false,
        storytellerImageEditContractValidated: true,
        storytellerImageEditMetadataValidated: false,
        researchProvider: "perplexity",
        researchModel: "sonar-pro",
        researchDefaultProvider: "perplexity",
        researchDefaultModel: "sonar-pro",
        researchSelectionReason: "mock_response",
        researchCitationCount: 2,
        researchSourceUrlCount: 2,
        researchMetadataValidated: true,
        assistiveRouterProvider: "gemini_api",
        assistiveRouterModel: "gemini-3.1-flash-lite-preview",
        assistiveRouterDefaultProvider: "gemini_api",
        assistiveRouterDefaultModel: "gemini-3.1-flash-lite-preview",
        assistiveRouterSelectionReason: "judged_default",
        assistiveRouterBudgetPolicy: "judged_default",
        assistiveRouterPromptCaching: "none",
        assistiveRouterWatchlistEnabled: false,
        assistiveRouterProviderMetadataValidated: true,
      },
    },
  });

  assert.equal(result.exitCode, 0);
  const providerUsage = result.details.providerUsage as Record<string, unknown>;
  assert.equal(providerUsage.status, "pass");
  assert.equal(providerUsage.validated, true);
  assert.equal(providerUsage.activeSecondaryProviders, 0);
  const providerUsageEntries = providerUsage.entries as Record<string, unknown>[];
  assert.equal(providerUsageEntries.length, 3);
  assert.deepEqual(
    providerUsageEntries.map((entry) => `${entry.route}/${entry.capability}`),
    ["storyteller-agent/tts", "live-agent/research", "orchestrator/routing_reasoning"],
  );
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
  const costEstimate = result.details.costEstimate as Record<string, unknown>;
  const tokensUsed = result.details.tokensUsed as Record<string, unknown>;
  const providerUsage = result.details.providerUsage as Record<string, unknown>;
  assert.equal(costEstimate.currency, "USD");
  assert.equal(costEstimate.totalUsd, 0);
  assert.equal(tokensUsed.input, 0);
  assert.equal(tokensUsed.output, 0);
  assert.equal(tokensUsed.total, 0);
  assert.equal(providerUsage.status, "fail");
  assert.equal(providerUsage.validated, false);
  assert.equal(providerUsage.activeSecondaryProviders, 0);
  assert.deepEqual(providerUsage.entries, []);
  const evidence = result.details.evidence as Record<string, unknown>;
  const turnDelete = evidence.operatorTurnDelete as Record<string, unknown>;
  const damageControl = evidence.damageControl as Record<string, unknown>;
  const operatorDamageControl = evidence.operatorDamageControl as Record<string, unknown>;
  const governancePolicy = evidence.governancePolicy as Record<string, unknown>;
  const skillsRegistry = evidence.skillsRegistry as Record<string, unknown>;
  const pluginMarketplace = evidence.pluginMarketplace as Record<string, unknown>;
  const deviceNodes = evidence.deviceNodes as Record<string, unknown>;
  const agentUsage = evidence.agentUsage as Record<string, unknown>;
  const runtimeGuardrailsSignalPaths = evidence.runtimeGuardrailsSignalPaths as Record<string, unknown>;
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
  assert.equal(pluginMarketplace.status, "fail");
  assert.equal(pluginMarketplace.validated, false);
  assert.equal(pluginMarketplace.total, 0);
  assert.equal(deviceNodes.status, "fail");
  assert.equal(deviceNodes.validated, false);
  assert.equal(deviceNodes.lookupStatus, "");
  assert.equal(deviceNodes.summaryTotal, 0);
  assert.equal(agentUsage.status, "fail");
  assert.equal(runtimeGuardrailsSignalPaths.status, "fail");
  assert.equal(runtimeGuardrailsSignalPaths.validated, false);
  assert.equal(runtimeGuardrailsSignalPaths.totalPaths, 0);
});
