import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const releaseScriptPath = resolve(process.cwd(), "scripts", "release-readiness.ps1");

function resolvePowerShellBinary(): string | null {
  const candidates = process.platform === "win32" ? ["powershell", "pwsh"] : ["pwsh", "powershell"];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
      encoding: "utf8",
    });
    if (probe.status === 0) {
      return candidate;
    }
  }
  return null;
}

const powershellBin = resolvePowerShellBinary();
const skipIfNoPowerShell = powershellBin ? false : "PowerShell binary is not available";

function createPassingSummary(
  overrides: Partial<{
    pressureLevel: string;
    queueTotal: number;
    queueStale: number;
    queuePending: number;
    gatewayRoundTripMs: number;
    gatewayInterruptLatencyMs: number | null;
    gatewayInterruptEventType: string;
    gatewayErrorCorrelationSource: string;
    gatewayErrorCorrelationCode: string;
    gatewayErrorCorrelationTraceId: string;
    gatewayErrorCorrelationClientEventId: string;
    gatewayErrorCorrelationExpectedClientEventId: string;
    gatewayErrorCorrelationClientEventType: string;
    gatewayErrorCorrelationConversation: string;
    gatewayErrorCorrelationLatencyMs: number | string;
    gatewayErrorCorrelationValidated: boolean | string;
    assistantActivityLifecycleValidated: boolean | string;
    liveContextCompactionValidated: boolean | string;
    serviceStartMaxAttempts: number | string;
    serviceStartRetryBackoffMs: number | string;
    scenarioRetryMaxAttempts: number | string;
    scenarioRetryBackoffMs: number | string;
    scenarioRetriesUsedCount: number | string;
    gatewayWsRoundTripScenarioAttempts: number | string;
    gatewayInterruptSignalScenarioAttempts: number | string;
    gatewayItemTruncateScenarioAttempts: number | string;
    gatewayItemDeleteScenarioAttempts: number | string;
    gatewayTaskProgressScenarioAttempts: number | string;
    gatewayRequestReplayScenarioAttempts: number | string;
    gatewayInvalidEnvelopeScenarioAttempts: number | string;
    gatewayBindingMismatchScenarioAttempts: number | string;
    gatewayDrainingRejectionScenarioAttempts: number | string;
    multiAgentDelegationScenarioAttempts: number | string;
    operatorDeviceNodesLifecycleScenarioAttempts: number | string;
    approvalsListScenarioAttempts: number | string;
    approvalsInvalidIntentScenarioAttempts: number | string;
    governancePolicyScenarioAttempts: number | string;
    skillsRegistryScenarioAttempts: number | string;
    pluginMarketplaceScenarioAttempts: number | string;
    governancePolicyLifecycleValidated: boolean | string;
    governancePolicyOperatorActionSeen: boolean | string;
    governancePolicyOverrideTenantSeen: boolean | string;
    governancePolicyIdempotencyReplayOutcome: string;
    governancePolicyVersionConflictCode: string;
    governancePolicyIdempotencyConflictCode: string;
    governancePolicyTenantScopeForbiddenCode: string;
    governancePolicySummaryTemplateId: string;
    governancePolicySummarySource: string;
    governancePolicyOverridesTotal: number | string;
    governancePolicyComplianceTemplate: string;
    skillsRegistryLifecycleValidated: boolean | string;
    skillsRegistryIndexHasSkill: boolean | string;
    skillsRegistryRegistryHasSkill: boolean | string;
    skillsRegistryCreateOutcome: string;
    skillsRegistryReplayOutcome: string;
    skillsRegistryVersionConflictCode: string;
    skillsRegistryPluginInvalidPermissionCode: string;
    skillsRegistryIndexTotal: number | string;
    skillsRegistryTotal: number | string;
    operatorPluginMarketplaceLifecycleValidated: boolean | string;
    operatorPluginMarketplaceStatus: string;
    operatorPluginMarketplaceTotal: number | string;
    operatorPluginMarketplaceUniquePlugins: number | string;
    operatorPluginMarketplaceOutcomeSucceeded: number | string;
    operatorPluginMarketplaceOutcomeDenied: number | string;
    operatorPluginMarketplaceOutcomeFailed: number | string;
    operatorPluginMarketplaceLifecycleCreated: number | string;
    operatorPluginMarketplaceLifecycleUpdated: number | string;
    operatorPluginMarketplaceLifecycleIdempotentReplay: number | string;
    operatorPluginMarketplaceConflictVersionConflict: number | string;
    operatorPluginMarketplaceConflictPluginInvalidPermission: number | string;
    operatorPluginMarketplaceSigningVerified: number | string;
    operatorPluginMarketplaceSigningUnsigned: number | string;
    operatorPluginMarketplaceSigningNone: number | string;
    operatorPluginMarketplaceSigningEvidenceObserved: boolean | string;
    operatorPluginMarketplacePermissionTotal: number | string;
    operatorPluginMarketplacePermissionEntriesWithPermissions: number | string;
    operatorPluginMarketplaceLatestOutcome: string;
    operatorPluginMarketplaceLatestPluginId: string;
    operatorPluginMarketplaceLatestVersion: number | string;
    operatorPluginMarketplaceLatestSigningStatus: string;
    operatorPluginMarketplaceLatestSeenAt: string;
    sessionVersioningScenarioAttempts: number | string;
    liveTranslationScenarioAttempts: number | string;
    liveNegotiationScenarioAttempts: number | string;
    liveContextCompactionScenarioAttempts: number | string;
    storytellerPipelineScenarioAttempts: number | string;
    uiSandboxPolicyModesScenarioAttempts: number | string;
    uiVisualTestingScenarioAttempts: number | string;
    operatorConsoleActionsScenarioAttempts: number | string;
    runtimeLifecycleScenarioAttempts: number | string;
    runtimeMetricsScenarioAttempts: number | string;
    scenarioRetryableFailuresTotal: number | string;
    analyticsSplitTargetsValidated: boolean | string;
    analyticsBigQueryConfigValidated: boolean | string;
    analyticsServicesValidated: number | string;
    analyticsRequestedEnabledServices: number | string;
    analyticsEnabledServices: number | string;
    assistiveRouterDiagnosticsValidated: boolean | string;
    assistiveRouterMode: string;
    assistiveRouterProviderMetadataValidated: boolean | string;
    assistiveRouterProvider: string;
    transportModeValidated: boolean | string;
    gatewayTransportRequestedMode: string;
    gatewayTransportActiveMode: string;
    gatewayTransportFallbackActive: boolean | string;
    operatorTurnTruncationSummaryValidated: boolean | string;
    operatorTurnTruncationExpectedEventSeen: boolean | string;
    operatorTurnTruncationTotal: number | string;
    operatorTurnTruncationUniqueRuns: number | string;
    operatorTurnTruncationUniqueSessions: number | string;
    operatorTurnTruncationLatestSeenAt: string;
    operatorTurnDeleteSummaryValidated: boolean | string;
    operatorTurnDeleteExpectedEventSeen: boolean | string;
    operatorTurnDeleteTotal: number | string;
    operatorTurnDeleteUniqueRuns: number | string;
    operatorTurnDeleteUniqueSessions: number | string;
    operatorTurnDeleteLatestSeenAt: string;
    operatorAgentUsageSummaryValidated: boolean | string;
    operatorAgentUsageTotal: number | string;
    operatorAgentUsageUniqueRuns: number | string;
    operatorAgentUsageUniqueSessions: number | string;
    operatorAgentUsageTotalCalls: number | string;
    operatorAgentUsageInputTokens: number | string;
    operatorAgentUsageOutputTokens: number | string;
    operatorAgentUsageTotalTokens: number | string;
    operatorAgentUsageModels: string[];
    operatorAgentUsageSource: string;
    operatorAgentUsageStatus: string;
    operatorDamageControlSummaryValidated: boolean | string;
    operatorDamageControlTotal: number | string;
    operatorDamageControlUniqueRuns: number | string;
    operatorDamageControlUniqueSessions: number | string;
    operatorDamageControlMatchedRuleCountTotal: number | string;
    operatorDamageControlAllowCount: number | string;
    operatorDamageControlAskCount: number | string;
    operatorDamageControlBlockCount: number | string;
    operatorDamageControlLatestVerdict: string;
    operatorDamageControlLatestSource: string;
    operatorDamageControlLatestMatchedRuleCount: number | string;
    operatorDamageControlLatestSeenAt: string;
    operatorAuditTrailValidated: boolean | string;
    operatorTraceCoverageValidated: boolean | string;
    operatorLiveBridgeHealthBlockValidated: boolean | string;
    operatorLiveBridgeProbeTelemetryValidated: boolean | string;
    operatorLiveBridgeHealthConsistencyValidated: boolean | string;
    gatewayItemTruncateValidated: boolean | string;
    gatewayItemDeleteValidated: boolean | string;
    operatorLiveBridgeHealthState: string;
    storytellerVideoAsyncValidated: boolean | string;
    storytellerMediaQueueVisible: boolean | string;
    storytellerMediaQueueQuotaValidated: boolean | string;
    storytellerCacheEnabled: boolean | string;
    storytellerCacheHitValidated: boolean | string;
    storytellerCacheInvalidationValidated: boolean | string;
    storytellerMediaMode: string;
    storytellerImageMode: string;
    storytellerVideoMode: string;
    storytellerTtsMode: string;
    storytellerImageEditMode: string;
    storytellerMediaQueueWorkers: number | string;
    storytellerCacheHits: number | string;
  }> = {},
): Record<string, unknown> {
  const hasOverride = (key: string): boolean => Object.prototype.hasOwnProperty.call(overrides, key);
  return {
    success: true,
    scenarios: [
      { name: "gateway.websocket.item_truncate", status: "passed" },
      { name: "gateway.websocket.item_delete", status: "passed" },
      { name: "gateway.websocket.binding_mismatch", status: "passed" },
      { name: "gateway.websocket.draining_rejection", status: "passed" },
      { name: "governance.policy.lifecycle", status: "passed" },
      { name: "skills.registry.lifecycle", status: "passed" },
      { name: "api.sessions.versioning", status: "passed" },
    ],
    kpis: {
      gatewayItemTruncateValidated: hasOverride("gatewayItemTruncateValidated")
        ? overrides.gatewayItemTruncateValidated
        : true,
      gatewayItemDeleteValidated: hasOverride("gatewayItemDeleteValidated")
        ? overrides.gatewayItemDeleteValidated
        : true,
      gatewayWsBindingMismatchValidated: true,
      gatewayWsDrainingValidated: true,
      gatewayErrorCorrelationSource: hasOverride("gatewayErrorCorrelationSource")
        ? overrides.gatewayErrorCorrelationSource
        : "gateway.error",
      gatewayErrorCorrelationCode: hasOverride("gatewayErrorCorrelationCode")
        ? overrides.gatewayErrorCorrelationCode
        : "GATEWAY_SESSION_MISMATCH",
      gatewayErrorCorrelationTraceId: hasOverride("gatewayErrorCorrelationTraceId")
        ? overrides.gatewayErrorCorrelationTraceId
        : "trace-gateway-correlation-1",
      gatewayErrorCorrelationClientEventId: hasOverride("gatewayErrorCorrelationClientEventId")
        ? overrides.gatewayErrorCorrelationClientEventId
        : "event-gateway-correlation-1",
      gatewayErrorCorrelationExpectedClientEventId: hasOverride("gatewayErrorCorrelationExpectedClientEventId")
        ? overrides.gatewayErrorCorrelationExpectedClientEventId
        : "event-gateway-correlation-1",
      gatewayErrorCorrelationClientEventType: hasOverride("gatewayErrorCorrelationClientEventType")
        ? overrides.gatewayErrorCorrelationClientEventType
        : "orchestrator.request",
      gatewayErrorCorrelationConversation: hasOverride("gatewayErrorCorrelationConversation")
        ? overrides.gatewayErrorCorrelationConversation
        : "none",
      gatewayErrorCorrelationLatencyMs: hasOverride("gatewayErrorCorrelationLatencyMs")
        ? overrides.gatewayErrorCorrelationLatencyMs
        : 120,
      gatewayErrorCorrelationValidated: hasOverride("gatewayErrorCorrelationValidated")
        ? overrides.gatewayErrorCorrelationValidated
        : true,
      assistantActivityLifecycleValidated: hasOverride("assistantActivityLifecycleValidated")
        ? overrides.assistantActivityLifecycleValidated
        : true,
      liveContextCompactionValidated: hasOverride("liveContextCompactionValidated")
        ? overrides.liveContextCompactionValidated
        : true,
      sessionVersioningValidated: true,
      operatorTurnTruncationSummaryValidated: hasOverride("operatorTurnTruncationSummaryValidated")
        ? overrides.operatorTurnTruncationSummaryValidated
        : true,
      operatorTurnTruncationExpectedEventSeen: hasOverride("operatorTurnTruncationExpectedEventSeen")
        ? overrides.operatorTurnTruncationExpectedEventSeen
        : true,
      operatorTurnTruncationTotal: hasOverride("operatorTurnTruncationTotal")
        ? overrides.operatorTurnTruncationTotal
        : 1,
      operatorTurnTruncationUniqueRuns: hasOverride("operatorTurnTruncationUniqueRuns")
        ? overrides.operatorTurnTruncationUniqueRuns
        : 1,
      operatorTurnTruncationUniqueSessions: hasOverride("operatorTurnTruncationUniqueSessions")
        ? overrides.operatorTurnTruncationUniqueSessions
        : 1,
      operatorTurnTruncationLatestSeenAt: hasOverride("operatorTurnTruncationLatestSeenAt")
        ? overrides.operatorTurnTruncationLatestSeenAt
        : "2026-02-26T00:00:00.000Z",
      operatorTurnDeleteSummaryValidated: hasOverride("operatorTurnDeleteSummaryValidated")
        ? overrides.operatorTurnDeleteSummaryValidated
        : true,
      operatorTurnDeleteExpectedEventSeen: hasOverride("operatorTurnDeleteExpectedEventSeen")
        ? overrides.operatorTurnDeleteExpectedEventSeen
        : true,
      operatorTurnDeleteTotal: hasOverride("operatorTurnDeleteTotal")
        ? overrides.operatorTurnDeleteTotal
        : 1,
      operatorTurnDeleteUniqueRuns: hasOverride("operatorTurnDeleteUniqueRuns")
        ? overrides.operatorTurnDeleteUniqueRuns
        : 1,
      operatorTurnDeleteUniqueSessions: hasOverride("operatorTurnDeleteUniqueSessions")
        ? overrides.operatorTurnDeleteUniqueSessions
        : 1,
      operatorTurnDeleteLatestSeenAt: hasOverride("operatorTurnDeleteLatestSeenAt")
        ? overrides.operatorTurnDeleteLatestSeenAt
        : "2026-02-26T00:00:00.000Z",
      operatorAgentUsageSummaryValidated: hasOverride("operatorAgentUsageSummaryValidated")
        ? overrides.operatorAgentUsageSummaryValidated
        : true,
      operatorAgentUsageTotal: hasOverride("operatorAgentUsageTotal") ? overrides.operatorAgentUsageTotal : 1,
      operatorAgentUsageUniqueRuns: hasOverride("operatorAgentUsageUniqueRuns")
        ? overrides.operatorAgentUsageUniqueRuns
        : 1,
      operatorAgentUsageUniqueSessions: hasOverride("operatorAgentUsageUniqueSessions")
        ? overrides.operatorAgentUsageUniqueSessions
        : 1,
      operatorAgentUsageTotalCalls: hasOverride("operatorAgentUsageTotalCalls")
        ? overrides.operatorAgentUsageTotalCalls
        : 1,
      operatorAgentUsageInputTokens: hasOverride("operatorAgentUsageInputTokens")
        ? overrides.operatorAgentUsageInputTokens
        : 6400,
      operatorAgentUsageOutputTokens: hasOverride("operatorAgentUsageOutputTokens")
        ? overrides.operatorAgentUsageOutputTokens
        : 3200,
      operatorAgentUsageTotalTokens: hasOverride("operatorAgentUsageTotalTokens")
        ? overrides.operatorAgentUsageTotalTokens
        : 9600,
      operatorAgentUsageModels: hasOverride("operatorAgentUsageModels")
        ? overrides.operatorAgentUsageModels
        : ["gemini-3-flash"],
      operatorAgentUsageSource: hasOverride("operatorAgentUsageSource")
        ? overrides.operatorAgentUsageSource
        : "operator_summary",
      operatorAgentUsageStatus: hasOverride("operatorAgentUsageStatus")
        ? overrides.operatorAgentUsageStatus
        : "observed",
      operatorDamageControlSummaryValidated: hasOverride("operatorDamageControlSummaryValidated")
        ? overrides.operatorDamageControlSummaryValidated
        : true,
      operatorDamageControlTotal: hasOverride("operatorDamageControlTotal")
        ? overrides.operatorDamageControlTotal
        : 1,
      operatorDamageControlUniqueRuns: hasOverride("operatorDamageControlUniqueRuns")
        ? overrides.operatorDamageControlUniqueRuns
        : 1,
      operatorDamageControlUniqueSessions: hasOverride("operatorDamageControlUniqueSessions")
        ? overrides.operatorDamageControlUniqueSessions
        : 1,
      operatorDamageControlMatchedRuleCountTotal: hasOverride("operatorDamageControlMatchedRuleCountTotal")
        ? overrides.operatorDamageControlMatchedRuleCountTotal
        : 1,
      operatorDamageControlAllowCount: hasOverride("operatorDamageControlAllowCount")
        ? overrides.operatorDamageControlAllowCount
        : 0,
      operatorDamageControlAskCount: hasOverride("operatorDamageControlAskCount")
        ? overrides.operatorDamageControlAskCount
        : 1,
      operatorDamageControlBlockCount: hasOverride("operatorDamageControlBlockCount")
        ? overrides.operatorDamageControlBlockCount
        : 0,
      operatorDamageControlLatestVerdict: hasOverride("operatorDamageControlLatestVerdict")
        ? overrides.operatorDamageControlLatestVerdict
        : "ask",
      operatorDamageControlLatestSource: hasOverride("operatorDamageControlLatestSource")
        ? overrides.operatorDamageControlLatestSource
        : "file",
      operatorDamageControlLatestMatchedRuleCount: hasOverride("operatorDamageControlLatestMatchedRuleCount")
        ? overrides.operatorDamageControlLatestMatchedRuleCount
        : 1,
      operatorDamageControlLatestSeenAt: hasOverride("operatorDamageControlLatestSeenAt")
        ? overrides.operatorDamageControlLatestSeenAt
        : "2026-02-26T00:00:00.000Z",
      operatorTaskQueueSummaryValidated: true,
      operatorTaskQueuePressureLevel: hasOverride("pressureLevel") ? overrides.pressureLevel : "healthy",
      operatorTaskQueueTotal: hasOverride("queueTotal") ? overrides.queueTotal : 1,
      operatorTaskQueueStaleCount: hasOverride("queueStale") ? overrides.queueStale : 0,
      operatorTaskQueuePendingApproval: hasOverride("queuePending") ? overrides.queuePending : 0,
      gatewayWsRoundTripMs: hasOverride("gatewayRoundTripMs") ? overrides.gatewayRoundTripMs : 120,
      gatewayInterruptLatencyMs: hasOverride("gatewayInterruptLatencyMs") ? overrides.gatewayInterruptLatencyMs : 120,
      gatewayInterruptEventType: hasOverride("gatewayInterruptEventType")
        ? overrides.gatewayInterruptEventType
        : "live.interrupt.requested",
      analyticsSplitTargetsValidated: hasOverride("analyticsSplitTargetsValidated")
        ? overrides.analyticsSplitTargetsValidated
        : true,
      analyticsBigQueryConfigValidated: hasOverride("analyticsBigQueryConfigValidated")
        ? overrides.analyticsBigQueryConfigValidated
        : true,
      analyticsServicesValidated: hasOverride("analyticsServicesValidated") ? overrides.analyticsServicesValidated : 4,
      analyticsRequestedEnabledServices: hasOverride("analyticsRequestedEnabledServices")
        ? overrides.analyticsRequestedEnabledServices
        : 4,
      analyticsEnabledServices: hasOverride("analyticsEnabledServices") ? overrides.analyticsEnabledServices : 4,
      assistiveRouterDiagnosticsValidated: hasOverride("assistiveRouterDiagnosticsValidated")
        ? overrides.assistiveRouterDiagnosticsValidated
        : true,
      assistiveRouterMode: hasOverride("assistiveRouterMode") ? overrides.assistiveRouterMode : "deterministic",
      assistiveRouterProviderMetadataValidated: hasOverride("assistiveRouterProviderMetadataValidated")
        ? overrides.assistiveRouterProviderMetadataValidated
        : true,
      assistiveRouterProvider: hasOverride("assistiveRouterProvider")
        ? overrides.assistiveRouterProvider
        : "gemini_api",
      transportModeValidated: hasOverride("transportModeValidated") ? overrides.transportModeValidated : true,
      gatewayTransportRequestedMode: hasOverride("gatewayTransportRequestedMode")
        ? overrides.gatewayTransportRequestedMode
        : "websocket",
      gatewayTransportActiveMode: hasOverride("gatewayTransportActiveMode")
        ? overrides.gatewayTransportActiveMode
        : "websocket",
      gatewayTransportFallbackActive: hasOverride("gatewayTransportFallbackActive")
        ? overrides.gatewayTransportFallbackActive
        : false,
      operatorAuditTrailValidated: hasOverride("operatorAuditTrailValidated")
        ? overrides.operatorAuditTrailValidated
        : true,
      operatorTraceCoverageValidated: hasOverride("operatorTraceCoverageValidated")
        ? overrides.operatorTraceCoverageValidated
        : true,
      operatorLiveBridgeHealthBlockValidated: hasOverride("operatorLiveBridgeHealthBlockValidated")
        ? overrides.operatorLiveBridgeHealthBlockValidated
        : true,
      operatorLiveBridgeProbeTelemetryValidated: hasOverride("operatorLiveBridgeProbeTelemetryValidated")
        ? overrides.operatorLiveBridgeProbeTelemetryValidated
        : true,
      operatorLiveBridgeHealthConsistencyValidated: hasOverride("operatorLiveBridgeHealthConsistencyValidated")
        ? overrides.operatorLiveBridgeHealthConsistencyValidated
        : true,
      operatorLiveBridgeHealthState: hasOverride("operatorLiveBridgeHealthState")
        ? overrides.operatorLiveBridgeHealthState
        : "unknown",
      storytellerVideoAsyncValidated: hasOverride("storytellerVideoAsyncValidated")
        ? overrides.storytellerVideoAsyncValidated
        : true,
      storytellerMediaQueueVisible: hasOverride("storytellerMediaQueueVisible")
        ? overrides.storytellerMediaQueueVisible
        : true,
      storytellerMediaQueueQuotaValidated: hasOverride("storytellerMediaQueueQuotaValidated")
        ? overrides.storytellerMediaQueueQuotaValidated
        : true,
      storytellerCacheEnabled: hasOverride("storytellerCacheEnabled")
        ? overrides.storytellerCacheEnabled
        : true,
      storytellerCacheHitValidated: hasOverride("storytellerCacheHitValidated")
        ? overrides.storytellerCacheHitValidated
        : true,
      storytellerCacheInvalidationValidated: hasOverride("storytellerCacheInvalidationValidated")
        ? overrides.storytellerCacheInvalidationValidated
        : true,
      storytellerMediaMode: hasOverride("storytellerMediaMode")
        ? overrides.storytellerMediaMode
        : "simulated",
      storytellerImageMode: hasOverride("storytellerImageMode")
        ? overrides.storytellerImageMode
        : "simulated",
      storytellerVideoMode: hasOverride("storytellerVideoMode")
        ? overrides.storytellerVideoMode
        : "simulated",
      storytellerTtsMode: hasOverride("storytellerTtsMode")
        ? overrides.storytellerTtsMode
        : "simulated",
      storytellerImageEditMode: hasOverride("storytellerImageEditMode")
        ? overrides.storytellerImageEditMode
        : "simulated",
      storytellerMediaQueueWorkers: hasOverride("storytellerMediaQueueWorkers")
        ? overrides.storytellerMediaQueueWorkers
        : 2,
      storytellerCacheHits: hasOverride("storytellerCacheHits") ? overrides.storytellerCacheHits : 3,
      scenarioRetriesUsedCount: hasOverride("scenarioRetriesUsedCount") ? overrides.scenarioRetriesUsedCount : 0,
      liveTranslationScenarioAttempts: hasOverride("liveTranslationScenarioAttempts")
        ? overrides.liveTranslationScenarioAttempts
        : 1,
      liveNegotiationScenarioAttempts: hasOverride("liveNegotiationScenarioAttempts")
        ? overrides.liveNegotiationScenarioAttempts
        : 1,
      liveContextCompactionScenarioAttempts: hasOverride("liveContextCompactionScenarioAttempts")
        ? overrides.liveContextCompactionScenarioAttempts
        : 1,
      storytellerPipelineScenarioAttempts: hasOverride("storytellerPipelineScenarioAttempts")
        ? overrides.storytellerPipelineScenarioAttempts
        : 1,
      uiSandboxPolicyModesScenarioAttempts: hasOverride("uiSandboxPolicyModesScenarioAttempts")
        ? overrides.uiSandboxPolicyModesScenarioAttempts
        : 1,
      gatewayWsRoundTripScenarioAttempts: hasOverride("gatewayWsRoundTripScenarioAttempts")
        ? overrides.gatewayWsRoundTripScenarioAttempts
        : 1,
      gatewayInterruptSignalScenarioAttempts: hasOverride("gatewayInterruptSignalScenarioAttempts")
        ? overrides.gatewayInterruptSignalScenarioAttempts
        : 1,
      gatewayItemTruncateScenarioAttempts: hasOverride("gatewayItemTruncateScenarioAttempts")
        ? overrides.gatewayItemTruncateScenarioAttempts
        : 1,
      gatewayItemDeleteScenarioAttempts: hasOverride("gatewayItemDeleteScenarioAttempts")
        ? overrides.gatewayItemDeleteScenarioAttempts
        : 1,
      gatewayTaskProgressScenarioAttempts: hasOverride("gatewayTaskProgressScenarioAttempts")
        ? overrides.gatewayTaskProgressScenarioAttempts
        : 1,
      gatewayRequestReplayScenarioAttempts: hasOverride("gatewayRequestReplayScenarioAttempts")
        ? overrides.gatewayRequestReplayScenarioAttempts
        : 1,
      gatewayInvalidEnvelopeScenarioAttempts: hasOverride("gatewayInvalidEnvelopeScenarioAttempts")
        ? overrides.gatewayInvalidEnvelopeScenarioAttempts
        : 1,
      gatewayBindingMismatchScenarioAttempts: hasOverride("gatewayBindingMismatchScenarioAttempts")
        ? overrides.gatewayBindingMismatchScenarioAttempts
        : 1,
      gatewayDrainingRejectionScenarioAttempts: hasOverride("gatewayDrainingRejectionScenarioAttempts")
        ? overrides.gatewayDrainingRejectionScenarioAttempts
        : 1,
      multiAgentDelegationScenarioAttempts: hasOverride("multiAgentDelegationScenarioAttempts")
        ? overrides.multiAgentDelegationScenarioAttempts
        : 1,
      operatorDeviceNodesLifecycleScenarioAttempts: hasOverride("operatorDeviceNodesLifecycleScenarioAttempts")
        ? overrides.operatorDeviceNodesLifecycleScenarioAttempts
        : 1,
      approvalsListScenarioAttempts: hasOverride("approvalsListScenarioAttempts")
        ? overrides.approvalsListScenarioAttempts
        : 1,
      approvalsInvalidIntentScenarioAttempts: hasOverride("approvalsInvalidIntentScenarioAttempts")
        ? overrides.approvalsInvalidIntentScenarioAttempts
        : 1,
      governancePolicyScenarioAttempts: hasOverride("governancePolicyScenarioAttempts")
        ? overrides.governancePolicyScenarioAttempts
        : 1,
      skillsRegistryScenarioAttempts: hasOverride("skillsRegistryScenarioAttempts")
        ? overrides.skillsRegistryScenarioAttempts
        : 1,
      pluginMarketplaceScenarioAttempts: hasOverride("pluginMarketplaceScenarioAttempts")
        ? overrides.pluginMarketplaceScenarioAttempts
        : 1,
      governancePolicyLifecycleValidated: hasOverride("governancePolicyLifecycleValidated")
        ? overrides.governancePolicyLifecycleValidated
        : true,
      governancePolicyOperatorActionSeen: hasOverride("governancePolicyOperatorActionSeen")
        ? overrides.governancePolicyOperatorActionSeen
        : true,
      governancePolicyOverrideTenantSeen: hasOverride("governancePolicyOverrideTenantSeen")
        ? overrides.governancePolicyOverrideTenantSeen
        : true,
      governancePolicyIdempotencyReplayOutcome: hasOverride("governancePolicyIdempotencyReplayOutcome")
        ? overrides.governancePolicyIdempotencyReplayOutcome
        : "idempotent_replay",
      governancePolicyVersionConflictCode: hasOverride("governancePolicyVersionConflictCode")
        ? overrides.governancePolicyVersionConflictCode
        : "API_GOVERNANCE_POLICY_VERSION_CONFLICT",
      governancePolicyIdempotencyConflictCode: hasOverride("governancePolicyIdempotencyConflictCode")
        ? overrides.governancePolicyIdempotencyConflictCode
        : "API_GOVERNANCE_POLICY_IDEMPOTENCY_CONFLICT",
      governancePolicyTenantScopeForbiddenCode: hasOverride("governancePolicyTenantScopeForbiddenCode")
        ? overrides.governancePolicyTenantScopeForbiddenCode
        : "API_TENANT_SCOPE_FORBIDDEN",
      governancePolicySummaryTemplateId: hasOverride("governancePolicySummaryTemplateId")
        ? overrides.governancePolicySummaryTemplateId
        : "strict",
      governancePolicySummarySource: hasOverride("governancePolicySummarySource")
        ? overrides.governancePolicySummarySource
        : "tenant_override",
      governancePolicyOverridesTotal: hasOverride("governancePolicyOverridesTotal")
        ? overrides.governancePolicyOverridesTotal
        : 1,
      governancePolicyComplianceTemplate: hasOverride("governancePolicyComplianceTemplate")
        ? overrides.governancePolicyComplianceTemplate
        : "strict",
      skillsRegistryLifecycleValidated: hasOverride("skillsRegistryLifecycleValidated")
        ? overrides.skillsRegistryLifecycleValidated
        : true,
      skillsRegistryIndexHasSkill: hasOverride("skillsRegistryIndexHasSkill")
        ? overrides.skillsRegistryIndexHasSkill
        : true,
      skillsRegistryRegistryHasSkill: hasOverride("skillsRegistryRegistryHasSkill")
        ? overrides.skillsRegistryRegistryHasSkill
        : true,
      skillsRegistryCreateOutcome: hasOverride("skillsRegistryCreateOutcome")
        ? overrides.skillsRegistryCreateOutcome
        : "created",
      skillsRegistryReplayOutcome: hasOverride("skillsRegistryReplayOutcome")
        ? overrides.skillsRegistryReplayOutcome
        : "idempotent_replay",
      skillsRegistryVersionConflictCode: hasOverride("skillsRegistryVersionConflictCode")
        ? overrides.skillsRegistryVersionConflictCode
        : "API_SKILL_REGISTRY_VERSION_CONFLICT",
      skillsRegistryPluginInvalidPermissionCode: hasOverride("skillsRegistryPluginInvalidPermissionCode")
        ? overrides.skillsRegistryPluginInvalidPermissionCode
        : "API_SKILL_PLUGIN_PERMISSION_INVALID",
      skillsRegistryIndexTotal: hasOverride("skillsRegistryIndexTotal") ? overrides.skillsRegistryIndexTotal : 1,
      skillsRegistryTotal: hasOverride("skillsRegistryTotal") ? overrides.skillsRegistryTotal : 1,
      operatorPluginMarketplaceLifecycleValidated: hasOverride("operatorPluginMarketplaceLifecycleValidated")
        ? overrides.operatorPluginMarketplaceLifecycleValidated
        : true,
      operatorPluginMarketplaceStatus: hasOverride("operatorPluginMarketplaceStatus")
        ? overrides.operatorPluginMarketplaceStatus
        : "observed",
      operatorPluginMarketplaceTotal: hasOverride("operatorPluginMarketplaceTotal")
        ? overrides.operatorPluginMarketplaceTotal
        : 4,
      operatorPluginMarketplaceUniquePlugins: hasOverride("operatorPluginMarketplaceUniquePlugins")
        ? overrides.operatorPluginMarketplaceUniquePlugins
        : 1,
      operatorPluginMarketplaceOutcomeSucceeded: hasOverride("operatorPluginMarketplaceOutcomeSucceeded")
        ? overrides.operatorPluginMarketplaceOutcomeSucceeded
        : 2,
      operatorPluginMarketplaceOutcomeDenied: hasOverride("operatorPluginMarketplaceOutcomeDenied")
        ? overrides.operatorPluginMarketplaceOutcomeDenied
        : 1,
      operatorPluginMarketplaceOutcomeFailed: hasOverride("operatorPluginMarketplaceOutcomeFailed")
        ? overrides.operatorPluginMarketplaceOutcomeFailed
        : 1,
      operatorPluginMarketplaceLifecycleCreated: hasOverride("operatorPluginMarketplaceLifecycleCreated")
        ? overrides.operatorPluginMarketplaceLifecycleCreated
        : 1,
      operatorPluginMarketplaceLifecycleUpdated: hasOverride("operatorPluginMarketplaceLifecycleUpdated")
        ? overrides.operatorPluginMarketplaceLifecycleUpdated
        : 1,
      operatorPluginMarketplaceLifecycleIdempotentReplay: hasOverride("operatorPluginMarketplaceLifecycleIdempotentReplay")
        ? overrides.operatorPluginMarketplaceLifecycleIdempotentReplay
        : 1,
      operatorPluginMarketplaceConflictVersionConflict: hasOverride("operatorPluginMarketplaceConflictVersionConflict")
        ? overrides.operatorPluginMarketplaceConflictVersionConflict
        : 1,
      operatorPluginMarketplaceConflictPluginInvalidPermission: hasOverride("operatorPluginMarketplaceConflictPluginInvalidPermission")
        ? overrides.operatorPluginMarketplaceConflictPluginInvalidPermission
        : 1,
      operatorPluginMarketplaceSigningVerified: hasOverride("operatorPluginMarketplaceSigningVerified")
        ? overrides.operatorPluginMarketplaceSigningVerified
        : 1,
      operatorPluginMarketplaceSigningUnsigned: hasOverride("operatorPluginMarketplaceSigningUnsigned")
        ? overrides.operatorPluginMarketplaceSigningUnsigned
        : 1,
      operatorPluginMarketplaceSigningNone: hasOverride("operatorPluginMarketplaceSigningNone")
        ? overrides.operatorPluginMarketplaceSigningNone
        : 2,
      operatorPluginMarketplaceSigningEvidenceObserved: hasOverride("operatorPluginMarketplaceSigningEvidenceObserved")
        ? overrides.operatorPluginMarketplaceSigningEvidenceObserved
        : true,
      operatorPluginMarketplacePermissionTotal: hasOverride("operatorPluginMarketplacePermissionTotal")
        ? overrides.operatorPluginMarketplacePermissionTotal
        : 2,
      operatorPluginMarketplacePermissionEntriesWithPermissions: hasOverride("operatorPluginMarketplacePermissionEntriesWithPermissions")
        ? overrides.operatorPluginMarketplacePermissionEntriesWithPermissions
        : 1,
      operatorPluginMarketplaceLatestOutcome: hasOverride("operatorPluginMarketplaceLatestOutcome")
        ? overrides.operatorPluginMarketplaceLatestOutcome
        : "denied",
      operatorPluginMarketplaceLatestPluginId: hasOverride("operatorPluginMarketplaceLatestPluginId")
        ? overrides.operatorPluginMarketplaceLatestPluginId
        : "demo-skill-plugin-1",
      operatorPluginMarketplaceLatestVersion: hasOverride("operatorPluginMarketplaceLatestVersion")
        ? overrides.operatorPluginMarketplaceLatestVersion
        : 1,
      operatorPluginMarketplaceLatestSigningStatus: hasOverride("operatorPluginMarketplaceLatestSigningStatus")
        ? overrides.operatorPluginMarketplaceLatestSigningStatus
        : "unsigned",
      operatorPluginMarketplaceLatestSeenAt: hasOverride("operatorPluginMarketplaceLatestSeenAt")
        ? overrides.operatorPluginMarketplaceLatestSeenAt
        : "2026-02-26T00:00:00.000Z",
      sessionVersioningScenarioAttempts: hasOverride("sessionVersioningScenarioAttempts")
        ? overrides.sessionVersioningScenarioAttempts
        : 1,
      uiVisualTestingScenarioAttempts: hasOverride("uiVisualTestingScenarioAttempts")
        ? overrides.uiVisualTestingScenarioAttempts
        : 1,
      operatorConsoleActionsScenarioAttempts: hasOverride("operatorConsoleActionsScenarioAttempts")
        ? overrides.operatorConsoleActionsScenarioAttempts
        : 1,
      runtimeLifecycleScenarioAttempts: hasOverride("runtimeLifecycleScenarioAttempts")
        ? overrides.runtimeLifecycleScenarioAttempts
        : 1,
      runtimeMetricsScenarioAttempts: hasOverride("runtimeMetricsScenarioAttempts")
        ? overrides.runtimeMetricsScenarioAttempts
        : 1,
      scenarioRetryableFailuresTotal: hasOverride("scenarioRetryableFailuresTotal")
        ? overrides.scenarioRetryableFailuresTotal
        : 0,
    },
    options: {
      serviceStartMaxAttempts: hasOverride("serviceStartMaxAttempts") ? overrides.serviceStartMaxAttempts : "2",
      serviceStartRetryBackoffMs: hasOverride("serviceStartRetryBackoffMs")
        ? overrides.serviceStartRetryBackoffMs
        : "1200",
      scenarioRetryMaxAttempts: hasOverride("scenarioRetryMaxAttempts") ? overrides.scenarioRetryMaxAttempts : "2",
      scenarioRetryBackoffMs: hasOverride("scenarioRetryBackoffMs") ? overrides.scenarioRetryBackoffMs : "900",
    },
  };
}

function runReleaseReadiness(
  summary: Record<string, unknown>,
  options?: Partial<{
    strictFinalRun: boolean;
    promptfooEvalSummary: Record<string, unknown> | null;
  }>,
): { exitCode: number; stdout: string; stderr: string } {
  if (!powershellBin) {
    throw new Error("PowerShell binary is not available");
  }

  const tempDir = mkdtempSync(join(tmpdir(), "mla-release-readiness-"));
  try {
    const summaryPath = join(tempDir, "summary.json");
    const promptfooEvalSummaryPath = join(tempDir, "evals", "latest-run.json");
    const releaseEvidenceReportPath = join(tempDir, "release-evidence", "report.json");
    const releaseEvidenceReportMarkdownPath = join(tempDir, "release-evidence", "report.md");
    const releaseEvidenceManifestPath = join(tempDir, "release-evidence", "manifest.json");
    const releaseEvidenceManifestMarkdownPath = join(tempDir, "release-evidence", "manifest.md");
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    const promptfooEvalSummary = Object.prototype.hasOwnProperty.call(options ?? {}, "promptfooEvalSummary")
      ? options?.promptfooEvalSummary
      : createPassingPromptfooEvalSummary();
    if (promptfooEvalSummary !== null && promptfooEvalSummary !== undefined) {
      mkdirSync(dirname(promptfooEvalSummaryPath), { recursive: true });
      writeFileSync(promptfooEvalSummaryPath, `${JSON.stringify(promptfooEvalSummary, null, 2)}\n`, "utf8");
    }

    const args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      releaseScriptPath,
      "-SkipBuild",
      "-SkipUnitTests",
      "-SkipMonitoringTemplates",
      "-SkipProfileSmoke",
      "-SkipPolicy",
      "-SkipBadge",
      "-SkipPerfLoad",
      "-SkipDemoRun",
      "-PromptfooEvalSummaryPath",
      promptfooEvalSummaryPath,
      "-SummaryPath",
      summaryPath,
      "-ReleaseEvidenceReportPath",
      releaseEvidenceReportPath,
      "-ReleaseEvidenceReportMarkdownPath",
      releaseEvidenceReportMarkdownPath,
      "-ReleaseEvidenceManifestPath",
      releaseEvidenceManifestPath,
      "-ReleaseEvidenceManifestMarkdownPath",
      releaseEvidenceManifestMarkdownPath,
    ];
    if (options?.strictFinalRun) {
      args.push("-StrictFinalRun");
    }

    const result = spawnSync(
      powershellBin,
      args,
      {
        encoding: "utf8",
      },
    );

    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function createPassingPerfSummary(
  overrides: Partial<{
    liveP95Ms: number;
    uiP95Ms: number;
    gatewayReplayP95Ms: number;
    gatewayReplayErrorRatePct: number;
    aggregateErrorRatePct: number;
  }> = {},
): Record<string, unknown> {
  const hasOverride = (key: string): boolean => Object.prototype.hasOwnProperty.call(overrides, key);
  return {
    success: true,
    workloads: [
      {
        name: "live_voice_translation",
        latencyMs: {
          p95: hasOverride("liveP95Ms") ? overrides.liveP95Ms : 1100,
        },
        errorRatePct: 0,
      },
      {
        name: "ui_navigation_execution",
        latencyMs: {
          p95: hasOverride("uiP95Ms") ? overrides.uiP95Ms : 8500,
        },
        errorRatePct: 0,
      },
      {
        name: "gateway_ws_request_replay",
        latencyMs: {
          p95: hasOverride("gatewayReplayP95Ms") ? overrides.gatewayReplayP95Ms : 3200,
        },
        errorRatePct: hasOverride("gatewayReplayErrorRatePct") ? overrides.gatewayReplayErrorRatePct : 0,
      },
    ],
    aggregate: {
      errorRatePct: hasOverride("aggregateErrorRatePct") ? overrides.aggregateErrorRatePct : 0,
    },
  };
}

function createPassingPerfPolicy(): Record<string, unknown> {
  const checkNames = [
    "summary.success",
    "workload.live.exists",
    "workload.ui.exists",
    "workload.gateway_replay.exists",
    "workload.live.p95",
    "workload.ui.p95",
    "workload.gateway_replay.p95",
    "workload.gateway_replay.errorRatePct",
    "aggregate.errorRatePct",
    "workload.live.success",
    "workload.ui.success",
    "workload.gateway_replay.success",
    "workload.gateway_replay.contract.responseIdReusedAll",
    "workload.gateway_replay.contract.taskStartedExactlyOneAll",
    "workload.ui.adapterMode.remote_http",
  ];
  return {
    ok: true,
    checks: checkNames.length,
    thresholds: {
      maxLiveP95Ms: 1800,
      maxUiP95Ms: 25000,
      maxGatewayReplayP95Ms: 9000,
      maxGatewayReplayErrorRatePct: 20,
      maxAggregateErrorRatePct: 10,
      requiredUiAdapterMode: "remote_http",
    },
    checkItems: checkNames.map((name) => ({
      name,
      passed: true,
      value: 1,
      expectation: "ok",
    })),
    violations: [],
  };
}

function createPassingSourceRunManifest(
  overrides: Partial<{
    schemaVersion: string;
    sourceRunId: string;
    sourceRunBranch: string;
    sourceRunConclusion: string;
    sourceRunAgeHours: number | string;
    allowAnySourceBranch: boolean | string;
    allowedBranches: string[];
    maxSourceRunAgeHours: number | string;
    retryAttempts: number | string;
    effectivePerfMode: string;
    evidenceOperatorTurnTruncationValidated: boolean | string;
    evidenceOperatorTurnDeleteValidated: boolean | string;
    evidenceOperatorDamageControlValidated: boolean | string;
    evidenceOperatorDamageControlTotal: number | string;
    evidenceOperatorTurnTruncationStatus: string;
    evidenceOperatorTurnDeleteStatus: string;
    evidenceOperatorDamageControlStatus: string;
    evidenceGovernancePolicyStatus: string;
    evidenceSkillsRegistryStatus: string;
    evidencePluginMarketplaceStatus: string;
    evidenceDeviceNodesStatus: string;
    evidenceAgentUsageStatus: string;
    evidenceRuntimeGuardrailsSignalPathsStatus: string;
    evidenceRuntimeGuardrailsSignalPathsSummaryStatus: string;
    evidenceRuntimeGuardrailsSignalPathsTotalPaths: number | string;
    evidenceRuntimeGuardrailsSignalPathsPrimaryPath: Record<string, unknown> | null;
    evidenceProviderUsageStatus: string;
    evidenceProviderUsageValidated: boolean;
    evidenceProviderUsageActiveSecondaryProviders: number | string;
    evidenceProviderUsageEntriesCount: number | string;
    evidenceProviderUsagePrimaryEntry: Record<string, unknown> | null;
    evidenceDeviceNodeUpdatesStatus: string;
    railwayDeploySummaryPresent: boolean | string;
    railwayDeploySummaryStatus: string;
    railwayDeploySummaryDeploymentId: string;
    railwayDeploySummaryEffectivePublicUrl: string;
    railwayDeploySummaryBadgeEndpoint: string;
    railwayDeploySummaryBadgeDetailsEndpoint: string;
    railwayDeploySummaryProjectId: string;
    railwayDeploySummaryService: string;
    railwayDeploySummaryEnvironment: string;
    railwayDeploySummaryEffectiveStartCommand: string;
    railwayDeploySummaryConfigSource: string;
    railwayDeploySummaryRootDescriptorAttempted: boolean | string;
    railwayDeploySummaryRootDescriptorSkipped: boolean | string;
    railwayDeploySummaryRootDescriptorExpectedUiUrl: string;
    railwayDeploySummaryPublicBadgeAttempted: boolean | string;
    railwayDeploySummaryPublicBadgeSkipped: boolean | string;
    repoPublishSummaryPresent: boolean | string;
    repoPublishSummaryBranch: string;
    repoPublishSummaryRemoteName: string;
    repoPublishSummaryVerificationScript: string;
    repoPublishSummaryVerificationSkipped: boolean | string;
    repoPublishSummaryVerificationStrict: boolean | string;
    repoPublishSummaryReleaseEvidenceValidated: boolean | string;
    repoPublishSummaryReleaseEvidenceArtifactsCount: number | string;
    repoPublishSummaryCommitEnabled: boolean | string;
    repoPublishSummaryPushEnabled: boolean | string;
    repoPublishSummaryPagesEnabled: boolean | string;
    repoPublishSummaryBadgeCheckEnabled: boolean | string;
    repoPublishSummaryRailwayDeployEnabled: boolean | string;
    repoPublishSummaryRailwayFrontendDeployEnabled: boolean | string;
    repoPublishSummaryRuntimeRailwayPublicUrl: string;
    repoPublishSummaryRuntimeRailwayDemoFrontendPublicUrl: string;
    repoPublishSummaryRuntimeRailwayNoWait: boolean | string;
    repoPublishSummaryRuntimeRailwayFrontendNoWait: boolean | string;
    repoPublishSummaryArtifactSelf: string;
    repoPublishSummaryArtifactRailwayDeploySummary: string;
    repoPublishSummaryArtifactReleaseEvidenceReportJson: string;
    repoPublishSummaryArtifactReleaseEvidenceManifestJson: string;
    repoPublishSummaryArtifactBadgeDetailsJson: string;
    evidenceOperatorDamageControlLatestVerdict: string;
    evidenceOperatorDamageControlLatestSource: string;
  }> = {},
): Record<string, unknown> {
  const hasOverride = (key: string): boolean => Object.prototype.hasOwnProperty.call(overrides, key);
  return {
    schemaVersion: hasOverride("schemaVersion") ? overrides.schemaVersion : "1.0",
    generatedAt: "2026-02-23T00:00:00.000Z",
    repository: {
      owner: "Web-pixel-creator",
      repo: "Live-Agent",
    },
    sourceRun: {
      runId: hasOverride("sourceRunId") ? overrides.sourceRunId : "123456",
      workflow: "demo-e2e.yml",
      branch: hasOverride("sourceRunBranch") ? overrides.sourceRunBranch : "main",
      headSha: "abcdef123456",
      headShaShort: "abcdef123456",
      conclusion: hasOverride("sourceRunConclusion") ? overrides.sourceRunConclusion : "success",
      updatedAtUtc: "2026-02-23T00:00:00.000Z",
      ageHours: hasOverride("sourceRunAgeHours") ? overrides.sourceRunAgeHours : 1.5,
    },
    artifact: {
      name: "demo-e2e-artifacts",
      id: 777,
    },
    sourceSelection: {
      allowAnySourceBranch: hasOverride("allowAnySourceBranch") ? overrides.allowAnySourceBranch : false,
      allowedBranches: hasOverride("allowedBranches") ? overrides.allowedBranches : ["main", "master"],
      maxSourceRunAgeHours: hasOverride("maxSourceRunAgeHours") ? overrides.maxSourceRunAgeHours : 168,
    },
    gate: {
      skipArtifactOnlyGate: false,
      strictFinalRun: false,
      requestedPerfMode: "without_perf",
      effectivePerfMode: hasOverride("effectivePerfMode") ? overrides.effectivePerfMode : "without_perf",
      perfArtifactsDetected: "false",
      evidenceSnapshot: {
        railwayDeploySummaryPresent: hasOverride("railwayDeploySummaryPresent")
          ? overrides.railwayDeploySummaryPresent
          : true,
        railwayDeploySummaryStatus: hasOverride("railwayDeploySummaryStatus")
          ? overrides.railwayDeploySummaryStatus
          : "success",
        railwayDeploySummaryDeploymentId: hasOverride("railwayDeploySummaryDeploymentId")
          ? overrides.railwayDeploySummaryDeploymentId
          : "railway-smoke-deploy-1",
        railwayDeploySummaryEffectivePublicUrl: hasOverride("railwayDeploySummaryEffectivePublicUrl")
          ? overrides.railwayDeploySummaryEffectivePublicUrl
          : "https://live-agent.example.test",
        railwayDeploySummaryBadgeEndpoint: hasOverride("railwayDeploySummaryBadgeEndpoint")
          ? overrides.railwayDeploySummaryBadgeEndpoint
          : "https://live-agent.example.test/demo-e2e/badge.json",
        railwayDeploySummaryBadgeDetailsEndpoint: hasOverride("railwayDeploySummaryBadgeDetailsEndpoint")
          ? overrides.railwayDeploySummaryBadgeDetailsEndpoint
          : "https://live-agent.example.test/demo-e2e/badge-details.json",
        railwayDeploySummaryProjectId: hasOverride("railwayDeploySummaryProjectId")
          ? overrides.railwayDeploySummaryProjectId
          : "railway-smoke-project",
        railwayDeploySummaryService: hasOverride("railwayDeploySummaryService")
          ? overrides.railwayDeploySummaryService
          : "gateway",
        railwayDeploySummaryEnvironment: hasOverride("railwayDeploySummaryEnvironment")
          ? overrides.railwayDeploySummaryEnvironment
          : "production",
        railwayDeploySummaryEffectiveStartCommand: hasOverride("railwayDeploySummaryEffectiveStartCommand")
          ? overrides.railwayDeploySummaryEffectiveStartCommand
          : "npm run start:gateway",
        railwayDeploySummaryConfigSource: hasOverride("railwayDeploySummaryConfigSource")
          ? overrides.railwayDeploySummaryConfigSource
          : "railway.toml",
        railwayDeploySummaryRootDescriptorAttempted: hasOverride("railwayDeploySummaryRootDescriptorAttempted")
          ? overrides.railwayDeploySummaryRootDescriptorAttempted
          : true,
        railwayDeploySummaryRootDescriptorSkipped: hasOverride("railwayDeploySummaryRootDescriptorSkipped")
          ? overrides.railwayDeploySummaryRootDescriptorSkipped
          : false,
        railwayDeploySummaryRootDescriptorExpectedUiUrl: hasOverride("railwayDeploySummaryRootDescriptorExpectedUiUrl")
          ? overrides.railwayDeploySummaryRootDescriptorExpectedUiUrl
          : "https://demo.live-agent.example.test",
        railwayDeploySummaryPublicBadgeAttempted: hasOverride("railwayDeploySummaryPublicBadgeAttempted")
          ? overrides.railwayDeploySummaryPublicBadgeAttempted
          : true,
        railwayDeploySummaryPublicBadgeSkipped: hasOverride("railwayDeploySummaryPublicBadgeSkipped")
          ? overrides.railwayDeploySummaryPublicBadgeSkipped
          : false,
        repoPublishSummaryPresent: hasOverride("repoPublishSummaryPresent")
          ? overrides.repoPublishSummaryPresent
          : true,
        repoPublishSummaryBranch: hasOverride("repoPublishSummaryBranch")
          ? overrides.repoPublishSummaryBranch
          : "main",
        repoPublishSummaryRemoteName: hasOverride("repoPublishSummaryRemoteName")
          ? overrides.repoPublishSummaryRemoteName
          : "origin",
        repoPublishSummaryVerificationScript: hasOverride("repoPublishSummaryVerificationScript")
          ? overrides.repoPublishSummaryVerificationScript
          : "verify:release",
        repoPublishSummaryVerificationSkipped: hasOverride("repoPublishSummaryVerificationSkipped")
          ? overrides.repoPublishSummaryVerificationSkipped
          : false,
        repoPublishSummaryVerificationStrict: hasOverride("repoPublishSummaryVerificationStrict")
          ? overrides.repoPublishSummaryVerificationStrict
          : false,
        repoPublishSummaryReleaseEvidenceValidated: hasOverride("repoPublishSummaryReleaseEvidenceValidated")
          ? overrides.repoPublishSummaryReleaseEvidenceValidated
          : true,
        repoPublishSummaryReleaseEvidenceArtifactsCount: hasOverride("repoPublishSummaryReleaseEvidenceArtifactsCount")
          ? overrides.repoPublishSummaryReleaseEvidenceArtifactsCount
          : 3,
        repoPublishSummaryCommitEnabled: hasOverride("repoPublishSummaryCommitEnabled")
          ? overrides.repoPublishSummaryCommitEnabled
          : true,
        repoPublishSummaryPushEnabled: hasOverride("repoPublishSummaryPushEnabled")
          ? overrides.repoPublishSummaryPushEnabled
          : true,
        repoPublishSummaryPagesEnabled: hasOverride("repoPublishSummaryPagesEnabled")
          ? overrides.repoPublishSummaryPagesEnabled
          : true,
        repoPublishSummaryBadgeCheckEnabled: hasOverride("repoPublishSummaryBadgeCheckEnabled")
          ? overrides.repoPublishSummaryBadgeCheckEnabled
          : true,
        repoPublishSummaryRailwayDeployEnabled: hasOverride("repoPublishSummaryRailwayDeployEnabled")
          ? overrides.repoPublishSummaryRailwayDeployEnabled
          : true,
        repoPublishSummaryRailwayFrontendDeployEnabled: hasOverride("repoPublishSummaryRailwayFrontendDeployEnabled")
          ? overrides.repoPublishSummaryRailwayFrontendDeployEnabled
          : false,
        repoPublishSummaryRuntimeRailwayPublicUrl: hasOverride("repoPublishSummaryRuntimeRailwayPublicUrl")
          ? overrides.repoPublishSummaryRuntimeRailwayPublicUrl
          : "https://live-agent.example.test",
        repoPublishSummaryRuntimeRailwayDemoFrontendPublicUrl: hasOverride("repoPublishSummaryRuntimeRailwayDemoFrontendPublicUrl")
          ? overrides.repoPublishSummaryRuntimeRailwayDemoFrontendPublicUrl
          : "https://demo.live-agent.example.test",
        repoPublishSummaryRuntimeRailwayNoWait: hasOverride("repoPublishSummaryRuntimeRailwayNoWait")
          ? overrides.repoPublishSummaryRuntimeRailwayNoWait
          : false,
        repoPublishSummaryRuntimeRailwayFrontendNoWait: hasOverride("repoPublishSummaryRuntimeRailwayFrontendNoWait")
          ? overrides.repoPublishSummaryRuntimeRailwayFrontendNoWait
          : false,
        repoPublishSummaryArtifactSelf: hasOverride("repoPublishSummaryArtifactSelf")
          ? overrides.repoPublishSummaryArtifactSelf
          : "artifacts/deploy/repo-publish-summary.json",
        repoPublishSummaryArtifactRailwayDeploySummary: hasOverride("repoPublishSummaryArtifactRailwayDeploySummary")
          ? overrides.repoPublishSummaryArtifactRailwayDeploySummary
          : "artifacts/deploy/railway-deploy-summary.json",
        repoPublishSummaryArtifactReleaseEvidenceReportJson: hasOverride("repoPublishSummaryArtifactReleaseEvidenceReportJson")
          ? overrides.repoPublishSummaryArtifactReleaseEvidenceReportJson
          : "artifacts/release-evidence/report.json",
        repoPublishSummaryArtifactReleaseEvidenceManifestJson: hasOverride("repoPublishSummaryArtifactReleaseEvidenceManifestJson")
          ? overrides.repoPublishSummaryArtifactReleaseEvidenceManifestJson
          : "artifacts/release-evidence/manifest.json",
        repoPublishSummaryArtifactBadgeDetailsJson: hasOverride("repoPublishSummaryArtifactBadgeDetailsJson")
          ? overrides.repoPublishSummaryArtifactBadgeDetailsJson
          : "artifacts/demo-e2e/badge-details.json",
        operatorTurnTruncationSummaryValidated: hasOverride("evidenceOperatorTurnTruncationValidated")
          ? overrides.evidenceOperatorTurnTruncationValidated
          : true,
        operatorTurnDeleteSummaryValidated: hasOverride("evidenceOperatorTurnDeleteValidated")
          ? overrides.evidenceOperatorTurnDeleteValidated
          : true,
        operatorDamageControlSummaryValidated: hasOverride("evidenceOperatorDamageControlValidated")
          ? overrides.evidenceOperatorDamageControlValidated
          : true,
        operatorDamageControlTotal: hasOverride("evidenceOperatorDamageControlTotal")
          ? overrides.evidenceOperatorDamageControlTotal
          : 1,
        badgeEvidenceOperatorTurnTruncationStatus: hasOverride("evidenceOperatorTurnTruncationStatus")
          ? overrides.evidenceOperatorTurnTruncationStatus
          : "pass",
        badgeEvidenceOperatorTurnDeleteStatus: hasOverride("evidenceOperatorTurnDeleteStatus")
          ? overrides.evidenceOperatorTurnDeleteStatus
          : "pass",
        badgeEvidenceOperatorDamageControlStatus: hasOverride("evidenceOperatorDamageControlStatus")
          ? overrides.evidenceOperatorDamageControlStatus
          : "pass",
        badgeEvidenceGovernancePolicyStatus: hasOverride("evidenceGovernancePolicyStatus")
          ? overrides.evidenceGovernancePolicyStatus
          : "pass",
        badgeEvidenceSkillsRegistryStatus: hasOverride("evidenceSkillsRegistryStatus")
          ? overrides.evidenceSkillsRegistryStatus
          : "pass",
        badgeEvidencePluginMarketplaceStatus: hasOverride("evidencePluginMarketplaceStatus")
          ? overrides.evidencePluginMarketplaceStatus
          : "pass",
        badgeEvidenceDeviceNodesStatus: hasOverride("evidenceDeviceNodesStatus")
          ? overrides.evidenceDeviceNodesStatus
          : "pass",
        badgeEvidenceAgentUsageStatus: hasOverride("evidenceAgentUsageStatus")
          ? overrides.evidenceAgentUsageStatus
          : "pass",
        badgeEvidenceRuntimeGuardrailsSignalPathsStatus: hasOverride("evidenceRuntimeGuardrailsSignalPathsStatus")
          ? overrides.evidenceRuntimeGuardrailsSignalPathsStatus
          : "pass",
        badgeEvidenceRuntimeGuardrailsSignalPathsSummaryStatus: hasOverride("evidenceRuntimeGuardrailsSignalPathsSummaryStatus")
          ? overrides.evidenceRuntimeGuardrailsSignalPathsSummaryStatus
          : "critical signals=2",
        badgeEvidenceRuntimeGuardrailsSignalPathsTotalPaths: hasOverride("evidenceRuntimeGuardrailsSignalPathsTotalPaths")
          ? overrides.evidenceRuntimeGuardrailsSignalPathsTotalPaths
          : 2,
        badgeEvidenceRuntimeGuardrailsSignalPathsPrimaryPath: hasOverride("evidenceRuntimeGuardrailsSignalPathsPrimaryPath")
          ? overrides.evidenceRuntimeGuardrailsSignalPathsPrimaryPath
          : {
              title: "Recovery drill - ui-executor-sandbox-audit",
              kind: "runtime_drill",
              profileId: "ui-executor-sandbox-audit",
              phase: "recovery",
              buttonLabel: "Plan Recovery Drill",
              summaryText:
                "Recovery drill: UI executor sandbox audit mode for ui_executor_sandbox_not_enforce@ui-executor.",
              lifecycleStatus: "active",
            },
        badgeEvidenceProviderUsageStatus: hasOverride("evidenceProviderUsageStatus")
          ? overrides.evidenceProviderUsageStatus
          : "pass",
        badgeEvidenceProviderUsageValidated: hasOverride("evidenceProviderUsageValidated")
          ? overrides.evidenceProviderUsageValidated
          : true,
        badgeEvidenceProviderUsageActiveSecondaryProviders: hasOverride("evidenceProviderUsageActiveSecondaryProviders")
          ? overrides.evidenceProviderUsageActiveSecondaryProviders
          : 0,
        badgeEvidenceProviderUsageEntriesCount: hasOverride("evidenceProviderUsageEntriesCount")
          ? overrides.evidenceProviderUsageEntriesCount
          : 3,
        badgeEvidenceProviderUsagePrimaryEntry: hasOverride("evidenceProviderUsagePrimaryEntry")
          ? overrides.evidenceProviderUsagePrimaryEntry
          : {
              route: "storyteller-agent",
              capability: "tts",
              selectedProvider: "gemini_api",
              selectedModel: "gemini-tts",
              selectionReason: "default_primary",
            },
        badgeEvidenceDeviceNodeUpdatesStatus: hasOverride("evidenceDeviceNodeUpdatesStatus")
          ? overrides.evidenceDeviceNodeUpdatesStatus
          : "pass",
        operatorDamageControlLatestVerdict: hasOverride("evidenceOperatorDamageControlLatestVerdict")
          ? overrides.evidenceOperatorDamageControlLatestVerdict
          : "ask",
        operatorDamageControlLatestSource: hasOverride("evidenceOperatorDamageControlLatestSource")
          ? overrides.evidenceOperatorDamageControlLatestSource
          : "file",
      },
    },
    retry: {
      githubApiMaxAttempts: hasOverride("retryAttempts") ? overrides.retryAttempts : 3,
      githubApiRetryBackoffMs: 1200,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    },
  };
}

function createPassingPromptfooEvalSummary(
  overrides: Partial<{
    dryRun: boolean;
    suiteSelection: string;
    redTeamPresent: boolean;
    redTeamPassed: boolean;
    redTeamExitCode: number;
    redTeamDryRun: boolean;
  }> = {},
): Record<string, unknown> {
  const hasOverride = (key: string): boolean => Object.prototype.hasOwnProperty.call(overrides, key);
  const suites = [];
  if (hasOverride("redTeamPresent") ? overrides.redTeamPresent !== false : true) {
    suites.push({
      id: "red-team",
      name: "Red Team Bundle",
      configPath: "C:\\temp\\red-team.promptfooconfig.yaml",
      outputPath: "C:\\temp\\red-team.results.json",
      command: "npx.cmd -y promptfoo@latest eval -c red-team.promptfooconfig.yaml -o red-team.results.json --no-cache",
      exitCode: hasOverride("redTeamExitCode") ? overrides.redTeamExitCode : 0,
      passed: hasOverride("redTeamPassed") ? overrides.redTeamPassed : true,
      dryRun: hasOverride("redTeamDryRun") ? overrides.redTeamDryRun : false,
    });
  } else {
    suites.push({
      id: "translation",
      name: "Translation Playbook",
      configPath: "C:\\temp\\translation.promptfooconfig.yaml",
      outputPath: "C:\\temp\\translation.results.json",
      command: "npx.cmd -y promptfoo@latest eval -c translation.promptfooconfig.yaml -o translation.results.json --no-cache",
      exitCode: 0,
      passed: true,
      dryRun: false,
    });
  }

  return {
    generatedAt: "2026-03-18T00:00:00.000Z",
    manifestPath: "C:\\Gemini_Live_Agent\\configs\\evals\\eval-manifest.json",
    suiteSelection: hasOverride("suiteSelection") ? overrides.suiteSelection : "red-team",
    gate: true,
    dryRun: hasOverride("dryRun") ? overrides.dryRun : false,
    suites,
  };
}

function runReleaseReadinessWithPerfArtifacts(
  summary: Record<string, unknown>,
  perfSummary: Record<string, unknown>,
  perfPolicy: Record<string, unknown>,
): { exitCode: number; stdout: string; stderr: string } {
  if (!powershellBin) {
    throw new Error("PowerShell binary is not available");
  }

  const tempDir = mkdtempSync(join(tmpdir(), "mla-release-readiness-perf-"));
  try {
    const summaryPath = join(tempDir, "summary.json");
    const perfSummaryPath = join(tempDir, "perf-summary.json");
    const perfPolicyPath = join(tempDir, "perf-policy.json");
    const promptfooEvalSummaryPath = join(tempDir, "evals", "latest-run.json");
    const releaseEvidenceReportPath = join(tempDir, "release-evidence", "report.json");
    const releaseEvidenceReportMarkdownPath = join(tempDir, "release-evidence", "report.md");
    const releaseEvidenceManifestPath = join(tempDir, "release-evidence", "manifest.json");
    const releaseEvidenceManifestMarkdownPath = join(tempDir, "release-evidence", "manifest.md");
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    writeFileSync(perfSummaryPath, `${JSON.stringify(perfSummary, null, 2)}\n`, "utf8");
    writeFileSync(perfPolicyPath, `${JSON.stringify(perfPolicy, null, 2)}\n`, "utf8");
    mkdirSync(dirname(promptfooEvalSummaryPath), { recursive: true });
    writeFileSync(
      promptfooEvalSummaryPath,
      `${JSON.stringify(createPassingPromptfooEvalSummary(), null, 2)}\n`,
      "utf8",
    );

    const result = spawnSync(
      powershellBin,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        releaseScriptPath,
        "-SkipBuild",
        "-SkipUnitTests",
        "-SkipMonitoringTemplates",
        "-SkipProfileSmoke",
        "-SkipPolicy",
        "-SkipBadge",
        "-SkipDemoRun",
        "-SkipPerfRun",
        "-PromptfooEvalSummaryPath",
        promptfooEvalSummaryPath,
        "-SummaryPath",
        summaryPath,
        "-PerfSummaryPath",
        perfSummaryPath,
        "-PerfPolicyPath",
        perfPolicyPath,
        "-ReleaseEvidenceReportPath",
        releaseEvidenceReportPath,
        "-ReleaseEvidenceReportMarkdownPath",
        releaseEvidenceReportMarkdownPath,
        "-ReleaseEvidenceManifestPath",
        releaseEvidenceManifestPath,
        "-ReleaseEvidenceManifestMarkdownPath",
        releaseEvidenceManifestMarkdownPath,
      ],
      {
        encoding: "utf8",
      },
    );

    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function runReleaseReadinessArtifactOnly(
  options?: Partial<{
    manifest: Record<string, unknown> | null;
    manifestRaw: string | null;
    promptfooEvalSummary: Record<string, unknown> | null;
  }>,
): { exitCode: number; stdout: string; stderr: string } {
  if (!powershellBin) {
    throw new Error("PowerShell binary is not available");
  }

  const tempDir = mkdtempSync(join(tmpdir(), "mla-release-readiness-artifact-only-"));
  try {
    const manifestPath = join(tempDir, "release-artifact-revalidation", "source-run.json");
    const promptfooEvalSummaryPath = join(tempDir, "evals", "latest-run.json");
    const manifest = Object.prototype.hasOwnProperty.call(options ?? {}, "manifest")
      ? options?.manifest
      : createPassingSourceRunManifest();
    const manifestRaw = Object.prototype.hasOwnProperty.call(options ?? {}, "manifestRaw")
      ? options?.manifestRaw
      : null;
    const promptfooEvalSummary = Object.prototype.hasOwnProperty.call(options ?? {}, "promptfooEvalSummary")
      ? options?.promptfooEvalSummary
      : createPassingPromptfooEvalSummary();

    if (manifestRaw !== null) {
      mkdirSync(dirname(manifestPath), { recursive: true });
      writeFileSync(manifestPath, manifestRaw, "utf8");
    } else if (manifest !== null && manifest !== undefined) {
      mkdirSync(dirname(manifestPath), { recursive: true });
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    }
    if (promptfooEvalSummary !== null && promptfooEvalSummary !== undefined) {
      mkdirSync(dirname(promptfooEvalSummaryPath), { recursive: true });
      writeFileSync(promptfooEvalSummaryPath, `${JSON.stringify(promptfooEvalSummary, null, 2)}\n`, "utf8");
    }

    const result = spawnSync(
      powershellBin,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        releaseScriptPath,
        "-SkipBuild",
        "-SkipUnitTests",
        "-SkipMonitoringTemplates",
        "-SkipProfileSmoke",
        "-SkipDemoE2E",
        "-SkipPolicy",
        "-SkipBadge",
        "-SkipPerfLoad",
        "-SkipDemoRun",
        "-PromptfooEvalSummaryPath",
        promptfooEvalSummaryPath,
        "-SourceRunManifestPath",
        manifestPath,
      ],
      {
        encoding: "utf8",
      },
    );

    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test(
  "release-readiness passes with healthy operator task queue pressure",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary());
    assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
  },
);

test(
  "release-readiness fails when promptfoo red-team proof is missing",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary(), {
      promptfooEvalSummary: null,
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /promptfoo red-team proof missing/i);
  },
);

test(
  "release-readiness fails when promptfoo red-team summary is a dry run",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary(), {
      promptfooEvalSummary: createPassingPromptfooEvalSummary({ dryRun: true }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /promptfoo red-team summary must be a real run, not dry-run/i);
  },
);

test(
  "release-readiness fails when promptfoo red-team suite is missing from the eval summary",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary(), {
      promptfooEvalSummary: createPassingPromptfooEvalSummary({ redTeamPresent: false }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /promptfoo red-team suite missing from summary/i);
  },
);

test(
  "release-readiness fails when promptfoo red-team suite did not pass",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary(), {
      promptfooEvalSummary: createPassingPromptfooEvalSummary({
        redTeamPassed: false,
        redTeamExitCode: 1,
      }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /promptfoo red-team suite expected passed=true and exitCode=0/i);
  },
);

test(
  "release-readiness fails when operator task queue pressure level is invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ pressureLevel: "panic" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorTaskQueuePressureLevel expected one of \[idle, healthy, elevated, critical\]/i);
    // PowerShell may wrap "actual" across lines ("a\r\nctual"), keep assertion robust.
    assert.match(output, /a\s*ctual\s+panic/i);
  },
);

test(
  "release-readiness fails when required summary scenario is missing",
  { skip: skipIfNoPowerShell },
  () => {
    const summary = createPassingSummary();
    summary.scenarios = [{ name: "gateway.websocket.binding_mismatch", status: "passed" }];

    const result = runReleaseReadiness(summary);
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /Required scenario missing in summary:\s*gateway\.websocket\.item_truncate/i);
  },
);

test(
  "release-readiness fails when governance lifecycle KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        governancePolicyLifecycleValidated: false,
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /governancePolicyLifecycleValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when skills registry lifecycle KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        skillsRegistryLifecycleValidated: false,
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /skillsRegistryLifecycleValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when plugin marketplace lifecycle KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        operatorPluginMarketplaceLifecycleValidated: false,
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorPluginMarketplaceLifecycleValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when skills registry replay outcome drifts",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        skillsRegistryReplayOutcome: "created",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /skillsRegistryReplayOutcome expected idempotent_replay, actual created/i);
  },
);

test(
  "release-readiness fails when operator task queue total is below one",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ queueTotal: 0 }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorTaskQueueTotal expected >= 1, actual 0/i);
  },
);

test(
  "release-readiness fails when gateway websocket roundtrip exceeds threshold",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ gatewayRoundTripMs: 2001 }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /gatewayWsRoundTripMs expected <= 1800, actual 2001/i);
  },
);

test(
  "release-readiness fails when service startup max attempts are below minimum",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ serviceStartMaxAttempts: "1" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /options\.serviceStartMaxAttempts expected >= 2, actual 1/i);
  },
);

test(
  "release-readiness allows missing interrupt latency when bridge is unavailable",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        gatewayInterruptLatencyMs: null,
        gatewayInterruptEventType: "live.bridge.unavailable",
      }),
    );
    assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
  },
);

test(
  "release-readiness allows missing interrupt latency for requested interrupt event",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        gatewayInterruptLatencyMs: null,
        gatewayInterruptEventType: "live.interrupt.requested",
      }),
    );
    assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
  },
);

test(
  "release-readiness fails when service startup retry backoff is below minimum",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ serviceStartRetryBackoffMs: "200" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /options\.serviceStartRetryBackoffMs expected >= 300, actual 200/i);
  },
);

test(
  "release-readiness fails when scenario retry max attempts are below minimum",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ scenarioRetryMaxAttempts: "1" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /options\.scenarioRetryMaxAttempts expected >= 2, actual 1/i);
  },
);

test(
  "release-readiness fails when scenario retry backoff is below minimum",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ scenarioRetryBackoffMs: "300" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /options\.scenarioRetryBackoffMs expected >= 500, actual 300/i);
  },
);

test(
  "release-readiness fails when scenario retries used exceed threshold",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ scenarioRetriesUsedCount: "3" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.scenarioRetriesUsedCount expected 0\.\.2, actual 3/i);
  },
);

test(
  "release-readiness strict final run fails when any scenario retry is used",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ scenarioRetriesUsedCount: "1" }), {
      strictFinalRun: true,
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.scenarioRetriesUsedCount expected 0\.\.0, actual 1/i);
  },
);

test(
  "release-readiness strict final run passes when no scenario retries are used",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ scenarioRetriesUsedCount: "0" }), {
      strictFinalRun: true,
    });
    assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
  },
);

test(
  "release-readiness fails when live translation scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        liveTranslationScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.liveTranslationScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when live negotiation scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        liveNegotiationScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.liveNegotiationScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when live context compaction scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        liveContextCompactionScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.liveContextCompactionScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when storyteller pipeline scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        storytellerPipelineScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.storytellerPipelineScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when ui sandbox policy scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        uiSandboxPolicyModesScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.uiSandboxPolicyModesScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when ui visual scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        uiVisualTestingScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.uiVisualTestingScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when gateway roundtrip scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        gatewayWsRoundTripScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.gatewayWsRoundTripScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when gateway interrupt scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        gatewayInterruptSignalScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.gatewayInterruptSignalScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when gateway item-truncate scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        gatewayItemTruncateScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.gatewayItemTruncateScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when gateway item-delete scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        gatewayItemDeleteScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.gatewayItemDeleteScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when gateway task-progress scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        gatewayTaskProgressScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.gatewayTaskProgressScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when gateway request-replay scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        gatewayRequestReplayScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.gatewayRequestReplayScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when gateway invalid-envelope scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        gatewayInvalidEnvelopeScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.gatewayInvalidEnvelopeScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when gateway binding-mismatch scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        gatewayBindingMismatchScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.gatewayBindingMismatchScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when gateway draining-rejection scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        gatewayDrainingRejectionScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.gatewayDrainingRejectionScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when multi-agent delegation scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        multiAgentDelegationScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.multiAgentDelegationScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when operator device-nodes lifecycle scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        operatorDeviceNodesLifecycleScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.operatorDeviceNodesLifecycleScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when approvals list scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        approvalsListScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.approvalsListScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when approvals invalid-intent scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        approvalsInvalidIntentScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.approvalsInvalidIntentScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when session versioning scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        sessionVersioningScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.sessionVersioningScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when skills registry scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        skillsRegistryScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.skillsRegistryScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when plugin marketplace scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        pluginMarketplaceScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.pluginMarketplaceScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when runtime lifecycle scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        runtimeLifecycleScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.runtimeLifecycleScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when runtime metrics scenario attempts exceed configured retry max",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        scenarioRetryMaxAttempts: "2",
        runtimeMetricsScenarioAttempts: "3",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.runtimeMetricsScenarioAttempts expected 1\.\.2, actual 3/i);
  },
);

test(
  "release-readiness fails when analytics split targets KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ analyticsSplitTargetsValidated: false }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /analyticsSplitTargetsValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when analytics BigQuery config KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ analyticsBigQueryConfigValidated: false }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /analyticsBigQueryConfigValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when analytics services validated count is below threshold",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ analyticsServicesValidated: 3 }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.analyticsServicesValidated expected >= 4, actual 3/i);
  },
);

test(
  "release-readiness fails when analytics requested-enabled service count is below threshold",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ analyticsRequestedEnabledServices: 3 }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.analyticsRequestedEnabledServices expected >= 4, actual 3/i);
  },
);

test(
  "release-readiness fails when analytics enabled service count is below threshold",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ analyticsEnabledServices: 3 }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /kpi\.analyticsEnabledServices expected >= 4, actual 3/i);
  },
);

test(
  "release-readiness fails when assistive router diagnostics KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ assistiveRouterDiagnosticsValidated: false }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /assistiveRouterDiagnosticsValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when assistive router mode is invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ assistiveRouterMode: "unknown" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /assistiveRouterMode expected/i);
    assert.match(output, /actual unknown/i);
  },
);

test(
  "release-readiness fails when assistive router provider metadata is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ assistiveRouterProviderMetadataValidated: false }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /assistiveRouterProviderMetadataValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when assistive router provider is invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ assistiveRouterProvider: "invalid" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /assistiveRouterProvider expected gemini_api\|openai\|anthropic\|deepseek\|moonshot, actua\s*l invalid/i);
  },
);

test(
  "release-readiness fails when transport mode KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ transportModeValidated: false }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /transportModeValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when gateway active transport mode is not websocket",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ gatewayTransportActiveMode: "webrtc" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /gatewayTransportActiveMode expected websocket, actual webrtc/i);
  },
);

test(
  "release-readiness fails when gateway requested transport mode is invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ gatewayTransportRequestedMode: "tcp" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /gatewayTransportRequestedMode expected websocket\|webrtc, actual tcp/i);
  },
);

test(
  "release-readiness fails when gateway transport fallback remains active",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ gatewayTransportFallbackActive: true }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /gatewayTransportFallbackActive expected False, actual True/i);
  },
);

test(
  "release-readiness fails when gateway item-truncate KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ gatewayItemTruncateValidated: false }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /gatewayItemTruncateValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when operator turn truncation KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({ operatorTurnTruncationSummaryValidated: false }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorTurnTruncationSummaryValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when operator turn truncation expected-event KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({ operatorTurnTruncationExpectedEventSeen: false }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorTurnTruncationExpectedEventSeen expected True, actual False/i);
  },
);

test(
  "release-readiness fails when operator turn truncation total is below one",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({ operatorTurnTruncationTotal: 0 }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorTurnTruncationTotal expected >= 1, actual 0/i);
  },
);

test(
  "release-readiness fails when operator turn truncation latest timestamp is invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({ operatorTurnTruncationLatestSeenAt: "not-an-iso" }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorTurnTruncationLatestSeenAt expected ISO timestamp, actual not-an-iso/i);
  },
);

test(
  "release-readiness fails when operator turn delete KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({ operatorTurnDeleteSummaryValidated: false }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorTurnDeleteSummaryValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when operator turn delete expected-event KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({ operatorTurnDeleteExpectedEventSeen: false }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorTurnDeleteExpectedEventSeen expected True, actual False/i);
  },
);

test(
  "release-readiness fails when operator turn delete total is below one",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({ operatorTurnDeleteTotal: 0 }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorTurnDeleteTotal expected >= 1, actual 0/i);
  },
);

test(
  "release-readiness fails when operator turn delete latest timestamp is invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({ operatorTurnDeleteLatestSeenAt: "not-an-iso" }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorTurnDeleteLatestSeenAt expected ISO timestamp, actual not-an-iso/i);
  },
);

test(
  "release-readiness fails when operator agent-usage summary KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ operatorAgentUsageSummaryValidated: false }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorAgentUsageSummaryValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when operator agent-usage total is below one",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ operatorAgentUsageTotal: 0 }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorAgentUsageTotal expected >= 1, actual 0/i);
  },
);

test(
  "release-readiness fails when operator agent-usage source is invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ operatorAgentUsageSource: "runtime" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /operatorAgentUsageSource expected one of \[operator_summary,\s*gateway_runtime\],\s*actual\s*runtime/i,
    );
  },
);

test(
  "release-readiness fails when operator damage-control summary KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({ operatorDamageControlSummaryValidated: false }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorDamageControlSummaryValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when operator damage-control verdict counts do not match total",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        operatorDamageControlAllowCount: 1,
        operatorDamageControlAskCount: 1,
        operatorDamageControlBlockCount: 1,
        operatorDamageControlTotal: 1,
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorDamageControl verdictCounts sum expected operatorDamageControlTotal/i);
  },
);

test(
  "release-readiness fails when operator damage-control latest timestamp is invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({ operatorDamageControlLatestSeenAt: "not-an-iso" }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorDamageControlLatestSeenAt expected ISO timestamp, actual not-an-iso/i);
  },
);

test(
  "release-readiness fails when gateway item-delete KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ gatewayItemDeleteValidated: false }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /gatewayItemDeleteValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when gateway error correlation KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ gatewayErrorCorrelationValidated: false }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /gatewayErrorCorrelationValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when gateway error correlation conversation is not none",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ gatewayErrorCorrelationConversation: "default" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /gatewayErrorCorrelationConversation expected none, actual default/i);
  },
);

test(
  "release-readiness fails when assistant activity lifecycle KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ assistantActivityLifecycleValidated: false }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /assistantActivityLifecycleValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when live context compaction KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ liveContextCompactionValidated: false }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /liveContextCompactionValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when operator audit trail KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ operatorAuditTrailValidated: false }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorAuditTrailValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when operator trace coverage KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ operatorTraceCoverageValidated: false }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorTraceCoverageValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when operator live bridge health state is invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ operatorLiveBridgeHealthState: "offline" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorLiveBridgeHealthState expected one of \[healthy, degraded, unknown\]/i);
    assert.match(output, /actual\s+of\s*fline/i);
  },
);

test(
  "release-readiness fails when operator live bridge health consistency KPI is invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ operatorLiveBridgeHealthConsistencyValidated: false }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorLiveBridgeHealthConsistencyValidated expected True, actual False/i);
  },
);

test(
  "release-readiness allows storyteller media mode default when a live lane is observed",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        storytellerMediaMode: "default",
        storytellerImageMode: "default",
        storytellerVideoMode: "fallback",
        storytellerTtsMode: "default",
        storytellerImageEditMode: "default",
      }),
    );
    assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
  },
);

test(
  "release-readiness allows zero storyteller queue workers when storyteller video mode is default",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        storytellerMediaMode: "default",
        storytellerImageMode: "default",
        storytellerVideoMode: "default",
        storytellerTtsMode: "default",
        storytellerImageEditMode: "default",
        storytellerMediaQueueWorkers: 0,
      }),
    );
    assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
  },
);

test(
  "release-readiness fails when storyteller media mode is invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ storytellerMediaMode: "live_api" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /storytellerMediaMode expected one of \[default, simulated\], actual live_api/i);
  },
);

test(
  "release-readiness fails when storyteller media mode default has no live lane",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        storytellerMediaMode: "default",
        storytellerImageMode: "fallback",
        storytellerVideoMode: "fallback",
        storytellerTtsMode: "fallback",
        storytellerImageEditMode: "fallback",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /storytellerMediaMode=default requires at least one storyteller lane mode=default/i);
  },
);

test(
  "release-readiness fails when storyteller cache hit KPI is below one",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ storytellerCacheHits: 0 }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /storytellerCacheHits expected >= 1, actual 0/i);
  },
);

test(
  "release-readiness allows gateway transport fallback when requested mode is webrtc",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        gatewayTransportRequestedMode: "webrtc",
        gatewayTransportActiveMode: "websocket",
        gatewayTransportFallbackActive: true,
      }),
    );
    assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
  },
);

test(
  "release-readiness passes with validated perf summary and policy artifacts",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessWithPerfArtifacts(
      createPassingSummary(),
      createPassingPerfSummary(),
      createPassingPerfPolicy(),
    );
    assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
  },
);

test(
  "release-readiness accepts decimal perf latency values from artifacts",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessWithPerfArtifacts(
      createPassingSummary(),
      createPassingPerfSummary({
        liveP95Ms: 40.5,
        uiP95Ms: 38.5,
        gatewayReplayP95Ms: 123.95,
      }),
      createPassingPerfPolicy(),
    );
    assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
  },
);

test(
  "release-readiness fails when perf policy threshold drifts above release limit",
  { skip: skipIfNoPowerShell },
  () => {
    const policy = createPassingPerfPolicy();
    if (policy.thresholds && typeof policy.thresholds === "object") {
      (policy.thresholds as Record<string, unknown>).maxLiveP95Ms = 2600;
    }

    const result = runReleaseReadinessWithPerfArtifacts(createPassingSummary(), createPassingPerfSummary(), policy);
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /perf policy threshold mismatch: maxLiveP95Ms expected <= 1800, actual 2600/i);
  },
);

test(
  "release-readiness fails when required perf policy check is missing",
  { skip: skipIfNoPowerShell },
  () => {
    const policy = createPassingPerfPolicy();
    if (Array.isArray(policy.checkItems)) {
      policy.checkItems = policy.checkItems.filter(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          (item as { name?: string }).name !== "workload.ui.adapterMode.remote_http",
      );
      policy.checkItems.push({
        name: "workload.ui.adapterMode.placeholder",
        passed: true,
        value: 1,
        expectation: "ok",
      });
    }
    policy.checks = 15;

    const result = runReleaseReadinessWithPerfArtifacts(createPassingSummary(), createPassingPerfSummary(), policy);
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /perf policy-check missing required check: workload\.ui\.adapterMode\.remote_http/i);
  },
);

test(
  "release-readiness fails when perf summary live p95 exceeds release limit",
  { skip: skipIfNoPowerShell },
  () => {
    const perfSummary = createPassingPerfSummary({ liveP95Ms: 2400 });
    const result = runReleaseReadinessWithPerfArtifacts(
      createPassingSummary(),
      perfSummary,
      createPassingPerfPolicy(),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /perf summary check failed: live_voice_translation p95 expected <= 1800, actual 2400/i);
  },
);

test(
  "release-readiness artifact-only mode passes with valid source run manifest",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly();
    assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /artifact\.source_run_manifest: schema=1\.0/i);
    assert.match(output, /run_id=123456/i);
    assert.match(output, /branch=main/i);
    assert.match(output, /artifact\.source_run_manifest\.evidence:/i);
    assert.match(output, /operator_damage_control_validated=true/i);
    assert.match(output, /turn_truncation_status=pass/i);
    assert.match(output, /turn_delete_status=pass/i);
    assert.match(output, /operator_damage_control_status=pass/i);
    assert.match(output, /governance_policy_status=pass/i);
    assert.match(output, /skills_registry_status=pass/i);
    assert.match(output, /plugin_marketplace_status=pass/i);
    assert.match(output, /device_nodes_status=pass/i);
    assert.match(output, /agent_usage_status=pass/i);
    assert.match(output, /railway_deploy_summary_present=true/i);
    assert.match(output, /railway_deploy_summary_status=success/i);
    assert.match(output, /railway_deploy_summary_project_id=railway-smoke-project/i);
    assert.match(output, /railway_deploy_summary_service=gateway/i);
    assert.match(output, /railway_deploy_summary_environment=production/i);
    assert.match(output, /railway_deploy_summary_effective_start_command=npm run start:gateway/i);
    assert.match(output, /railway_deploy_summary_config_source=railway\.toml/i);
    assert.match(output, /railway_deploy_summary_root_descriptor_attempted=true/i);
    assert.match(output, /railway_deploy_summary_root_descriptor_skipped=false/i);
    assert.match(output, /railway_deploy_summary_expected_ui_url=https:\/\/demo\.live-agent\.example\.test/i);
    assert.match(output, /railway_deploy_summary_public_badge_attempted=true/i);
    assert.match(output, /railway_deploy_summary_public_badge_skipped=false/i);
    assert.match(output, /repo_publish_summary_present=true/i);
    assert.match(output, /repo_publish_summary_branch=main/i);
    assert.match(output, /repo_publish_summary_remote_name=origin/i);
    assert.match(output, /repo_publish_summary_verification_script=verify:release/i);
    assert.match(output, /repo_publish_summary_verification_skipped=false/i);
    assert.match(output, /repo_publish_summary_verification_strict=false/i);
    assert.match(output, /repo_publish_summary_release_evidence_validated=true/i);
    assert.match(output, /repo_publish_summary_release_evidence_artifacts_count=3/i);
    assert.match(output, /repo_publish_summary_commit_enabled=true/i);
    assert.match(output, /repo_publish_summary_push_enabled=true/i);
    assert.match(output, /repo_publish_summary_pages_enabled=true/i);
    assert.match(output, /repo_publish_summary_badge_check_enabled=true/i);
    assert.match(output, /repo_publish_summary_runtime_railway_public_url=https:\/\/live-agent\.example\.test/i);
    assert.match(output, /repo_publish_summary_runtime_railway_frontend_public_url=https:\/\/demo\.live-agent\.example\.test/i);
    assert.match(output, /repo_publish_summary_runtime_railway_no_wait=false/i);
    assert.match(output, /repo_publish_summary_runtime_railway_frontend_no_wait=false/i);
    assert.match(output, /repo_publish_summary_artifact_self=artifacts\/deploy\/repo-publish-summary\.json/i);
    assert.match(output, /repo_publish_summary_artifact_railway_deploy_summary=artifacts\/deploy\/railway-deploy-summary\.json/i);
    assert.match(output, /repo_publish_summary_artifact_release_evidence_report_json=artifacts\/release-evidence\/report\.json/i);
    assert.match(output, /repo_publish_summary_artifact_release_evidence_manifest_json=artifacts\/release-evidence\/manifest\.json/i);
    assert.match(output, /repo_publish_summary_artifact_badge_details_json=artifacts\/demo-e2e\/badge-details\.json/i);
  },
);

test(
  "release-readiness artifact-only mode remains compatible when new deploy and publish compact fields are absent",
  { skip: skipIfNoPowerShell },
  () => {
    const manifest = createPassingSourceRunManifest();
    const evidence = (
      (manifest.gate as Record<string, unknown>).evidenceSnapshot as Record<string, unknown>
    );
    for (const key of [
      "railwayDeploySummaryProjectId",
      "railwayDeploySummaryService",
      "railwayDeploySummaryEnvironment",
      "railwayDeploySummaryEffectiveStartCommand",
      "railwayDeploySummaryConfigSource",
      "railwayDeploySummaryRootDescriptorAttempted",
      "railwayDeploySummaryRootDescriptorSkipped",
      "railwayDeploySummaryRootDescriptorExpectedUiUrl",
      "railwayDeploySummaryPublicBadgeAttempted",
      "railwayDeploySummaryPublicBadgeSkipped",
      "repoPublishSummaryBranch",
      "repoPublishSummaryRemoteName",
      "repoPublishSummaryVerificationSkipped",
      "repoPublishSummaryVerificationStrict",
      "repoPublishSummaryReleaseEvidenceArtifactsCount",
      "repoPublishSummaryCommitEnabled",
      "repoPublishSummaryPushEnabled",
      "repoPublishSummaryPagesEnabled",
      "repoPublishSummaryBadgeCheckEnabled",
      "repoPublishSummaryRuntimeRailwayPublicUrl",
      "repoPublishSummaryRuntimeRailwayDemoFrontendPublicUrl",
      "repoPublishSummaryRuntimeRailwayNoWait",
      "repoPublishSummaryRuntimeRailwayFrontendNoWait",
      "repoPublishSummaryArtifactSelf",
      "repoPublishSummaryArtifactRailwayDeploySummary",
      "repoPublishSummaryArtifactReleaseEvidenceReportJson",
      "repoPublishSummaryArtifactReleaseEvidenceManifestJson",
      "repoPublishSummaryArtifactBadgeDetailsJson",
    ]) {
      delete evidence[key];
    }

    const result = runReleaseReadinessArtifactOnly({ manifest });
    assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
  },
);

test(
  "release-readiness artifact-only mode remains compatible when source run manifest has no evidence snapshot",
  { skip: skipIfNoPowerShell },
  () => {
    const manifest = createPassingSourceRunManifest();
    const gate = manifest.gate as Record<string, unknown>;
    delete gate.evidenceSnapshot;
    const result = runReleaseReadinessArtifactOnly({ manifest });
    assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /artifact\.source_run_manifest: schema=1\.0/i);
    assert.doesNotMatch(output, /artifact\.source_run_manifest\.evidence:/i);
  },
);

test(
  "release-readiness artifact-only mode fails when optional repo publish artifact count is invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({
        repoPublishSummaryReleaseEvidenceArtifactsCount: -1,
      }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.repoPublishSummaryReleaseEvidenceArtifactsCount expected >= 0 when provided/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence truncation validation is false",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceOperatorTurnTruncationValidated: false }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.operatorTurnTruncationSummaryValidated expected true, actual False/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence turn-delete validation is false",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceOperatorTurnDeleteValidated: false }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.operatorTurnDeleteSummaryValidated expected true, actual False/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence damage-control validation is false",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceOperatorDamageControlValidated: false }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.operatorDamageControlSummaryValidated expected true, actual False/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when railway deploy summary is marked present but deployment id is missing",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({
        railwayDeploySummaryPresent: true,
        railwayDeploySummaryDeploymentId: "",
      }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.railwayDeploySummaryDeploymentId is required when railwayDeploySummaryPrese\s*nt=true/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when repo publish summary is marked present but release evidence was not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({
        repoPublishSummaryPresent: true,
        repoPublishSummaryReleaseEvidenceValidated: false,
      }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.repoPublishSummaryReleaseEvidenceValidated expected true when repoPublishSu\s*mmaryPresent=true/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence damage-control latest verdict is invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceOperatorDamageControlLatestVerdict: "invalid" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.operatorDamageControlLatestVerdict expected one of \[allow,\s*ask,\s*block\],\s*act\s*ual invalid/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence damage-control latest source is invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceOperatorDamageControlLatestSource: "manual" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.operatorDamageControlLatestSource expected one of \[default,\s*file,\s*env_json,\s*unknown\],\s*actual manual/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence turn truncation status is not pass",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceOperatorTurnTruncationStatus: "warn" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidenceOperatorTurnTruncationStatus expected pass, actual warn/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence turn delete status is not pass",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceOperatorTurnDeleteStatus: "warn" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidenceOperatorTurnDeleteStatus expected pass, actual warn/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence damage-control status is not pass",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceOperatorDamageControlStatus: "warn" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidenceOperatorDamageControlStatus expected pass, actual warn/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence governance policy status is not pass",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceGovernancePolicyStatus: "warn" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidenceGovernancePolicyStatus expected pass, actual warn/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence skills registry status is not pass",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceSkillsRegistryStatus: "warn" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidenceSkillsRegistryStatus expected pass, actual warn/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence plugin marketplace status is not pass",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidencePluginMarketplaceStatus: "warn" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidencePluginMarketplaceStatus expected pass, actual warn/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence device nodes status is not pass",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceDeviceNodesStatus: "warn" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidenceDeviceNodesStatus expected pass, actual warn/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence agent-usage status is not pass",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceAgentUsageStatus: "warn" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidenceAgentUsageStatus expected pass, actual warn/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence runtime guardrails signal-paths status is not pass",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceRuntimeGuardrailsSignalPathsStatus: "warn" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidenceRuntimeGuardrailsSignalPathsStatus expected pass, actual warn/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence runtime guardrails summary status is missing",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceRuntimeGuardrailsSignalPathsSummaryStatus: "" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidenceRuntimeGuardrailsSignalPathsSummaryStatus is required/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence runtime guardrails primary path is missing while paths are present",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({
        evidenceRuntimeGuardrailsSignalPathsTotalPaths: 2,
        evidenceRuntimeGuardrailsSignalPathsPrimaryPath: null,
      }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidenceRuntimeGuardrailsSignalPathsPrimaryPath is required when total\s*Paths > 0/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence provider-usage status is not pass",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceProviderUsageStatus: "warn" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidenceProviderUsageStatus expected pass, actual warn/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence provider-usage validated flag is false",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceProviderUsageValidated: false }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidenceProviderUsageValidated expected true/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence provider-usage entries count is below one",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceProviderUsageEntriesCount: 0 }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidenceProviderUsageEntriesCount expected >= 1, actual 0/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence provider-usage primary entry is missing",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({
        evidenceProviderUsageEntriesCount: 2,
        evidenceProviderUsagePrimaryEntry: null,
      }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidenceProviderUsagePrimaryEntry is required when entriesCount > 0/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence device node updates status is not pass",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceDeviceNodeUpdatesStatus: "warn" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.badgeEvidenceDeviceNodeUpdatesStatus expected pass, actual warn/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run evidence damage-control total is below one",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ evidenceOperatorDamageControlTotal: 0 }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(
      output,
      /source run manifest evidenceSnapshot\.operatorDamageControlTotal expected >= 1, actual 0/i,
    );
  },
);

test(
  "release-readiness artifact-only mode fails when source run manifest is missing",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({ manifest: null });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /missing required artifacts:/i);
    assert.match(output, /source-run\.json/i);
  },
);

test(
  "release-readiness artifact-only mode fails when source run manifest schemaVersion drifts",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ schemaVersion: "2.0" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /source run manifest schemaVersion expected 1\.0, actual 2\.0/i);
  },
);

test(
  "release-readiness artifact-only mode fails when source run manifest retry attempts are invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ retryAttempts: 0 }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /source run manifest retry\.githubApiMaxAttempts expected >= 1, actual 0/i);
  },
);

test(
  "release-readiness artifact-only mode fails when source run manifest JSON is invalid",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifestRaw: "{not-json}",
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /invalid source run manifest json/i);
  },
);

test(
  "release-readiness artifact-only mode fails when source run manifest conclusion is not success",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ sourceRunConclusion: "failure" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /source run manifest sourceRun\.conclusion expected success, actual failure/i);
  },
);

test(
  "release-readiness artifact-only mode fails when source run branch is outside allowlist",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({ sourceRunBranch: "feature/demo" }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /source run manifest sourceRun\.branch not in allowlist: feature\/demo/i);
  },
);

test(
  "release-readiness artifact-only mode allows non-main branch when allowAnySourceBranch is true",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({
        sourceRunBranch: "feature/demo",
        allowAnySourceBranch: true,
      }),
    });
    assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
  },
);

test(
  "release-readiness artifact-only mode fails when source run age exceeds max age guard",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadinessArtifactOnly({
      manifest: createPassingSourceRunManifest({
        sourceRunAgeHours: 200,
        maxSourceRunAgeHours: 168,
      }),
    });
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /source run manifest sourceRun\.ageHours expected <= 168, actual 200/i);
  },
);
