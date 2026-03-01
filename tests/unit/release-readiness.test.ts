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
  }>,
): { exitCode: number; stdout: string; stderr: string } {
  if (!powershellBin) {
    throw new Error("PowerShell binary is not available");
  }

  const tempDir = mkdtempSync(join(tmpdir(), "mla-release-readiness-"));
  try {
    const summaryPath = join(tempDir, "summary.json");
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

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
      "-SummaryPath",
      summaryPath,
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
    evidenceOperatorDamageControlStatus: string;
    evidenceGovernancePolicyStatus: string;
    evidenceSkillsRegistryStatus: string;
    evidenceDeviceNodesStatus: string;
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
        badgeEvidenceOperatorDamageControlStatus: hasOverride("evidenceOperatorDamageControlStatus")
          ? overrides.evidenceOperatorDamageControlStatus
          : "pass",
        badgeEvidenceGovernancePolicyStatus: hasOverride("evidenceGovernancePolicyStatus")
          ? overrides.evidenceGovernancePolicyStatus
          : "pass",
        badgeEvidenceSkillsRegistryStatus: hasOverride("evidenceSkillsRegistryStatus")
          ? overrides.evidenceSkillsRegistryStatus
          : "pass",
        badgeEvidenceDeviceNodesStatus: hasOverride("evidenceDeviceNodesStatus")
          ? overrides.evidenceDeviceNodesStatus
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
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    writeFileSync(perfSummaryPath, `${JSON.stringify(perfSummary, null, 2)}\n`, "utf8");
    writeFileSync(perfPolicyPath, `${JSON.stringify(perfPolicy, null, 2)}\n`, "utf8");

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
        "-SummaryPath",
        summaryPath,
        "-PerfSummaryPath",
        perfSummaryPath,
        "-PerfPolicyPath",
        perfPolicyPath,
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
  }>,
): { exitCode: number; stdout: string; stderr: string } {
  if (!powershellBin) {
    throw new Error("PowerShell binary is not available");
  }

  const tempDir = mkdtempSync(join(tmpdir(), "mla-release-readiness-artifact-only-"));
  try {
    const manifestPath = join(tempDir, "release-artifact-revalidation", "source-run.json");
    const manifest = Object.prototype.hasOwnProperty.call(options ?? {}, "manifest")
      ? options?.manifest
      : createPassingSourceRunManifest();
    const manifestRaw = Object.prototype.hasOwnProperty.call(options ?? {}, "manifestRaw")
      ? options?.manifestRaw
      : null;

    if (manifestRaw !== null) {
      mkdirSync(dirname(manifestPath), { recursive: true });
      writeFileSync(manifestPath, manifestRaw, "utf8");
    } else if (manifest !== null && manifest !== undefined) {
      mkdirSync(dirname(manifestPath), { recursive: true });
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
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
  "release-readiness fails when operator task queue pressure is critical",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ pressureLevel: "critical" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorTaskQueuePressureLevel expected one of \[idle, healthy, elevated\]/i);
    assert.match(output, /actual\s+crit\s*ical/i);
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
  "release-readiness fails when interrupt latency is missing for non-unavailable event",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        gatewayInterruptLatencyMs: null,
        gatewayInterruptEventType: "live.interrupt.requested",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /gatewayInterruptLatencyMs is missing and gatewayInterruptEventType is not\s+live\.bridge/i);
    assert.match(output, /actual live\.interrupt\.requested/i);
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
  "release-readiness fails when storyteller media mode is not simulated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ storytellerMediaMode: "live_api" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /storytellerMediaMode expected one of \[simulated\], actual live_api/i);
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
    assert.match(output, /operator_damage_control_status=pass/i);
    assert.match(output, /governance_policy_status=pass/i);
    assert.match(output, /skills_registry_status=pass/i);
    assert.match(output, /device_nodes_status=pass/i);
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
