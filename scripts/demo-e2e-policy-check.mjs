import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      result[key] = "true";
      continue;
    }
    result[key] = value;
    index += 1;
  }
  return result;
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}

function toNumber(value, fallback = Number.NaN) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

function toSafeString(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value.length > 0 ? value : "-";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function fail(message, details) {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: message,
      details: details ?? null,
    })}\n`,
  );
  process.exit(1);
}

function renderMarkdown(params) {
  const { inputPath, success, checks, violations } = params;
  const lines = [];
  lines.push("# Demo E2E KPI Policy Check");
  lines.push("");
  lines.push(`- Input: ${inputPath}`);
  lines.push(`- Success: ${success ? "true" : "false"}`);
  lines.push(`- Checks: ${checks.length}`);
  lines.push(`- Violations: ${violations.length}`);
  lines.push("");
  lines.push("## Checks");
  lines.push("");
  lines.push("| Check | Status | Value | Expectation |");
  lines.push("| --- | --- | --- | --- |");
  for (const check of checks) {
    lines.push(
      `| ${check.name} | ${check.passed ? "passed" : "failed"} | ${toSafeString(check.value)} | ${toSafeString(check.expectation)} |`,
    );
  }
  lines.push("");
  if (violations.length > 0) {
    lines.push("## Violations");
    lines.push("");
    for (const violation of violations) {
      lines.push(`- ${violation}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const inputPath = resolve(args.input ?? "artifacts/demo-e2e/summary.json");
  const outputPath = resolve(args.output ?? "artifacts/demo-e2e/policy-check.md");
  const jsonOutputPath = resolve(args.jsonOutput ?? "artifacts/demo-e2e/policy-check.json");

  const maxGatewayWsRoundTripMs = Number.isFinite(toNumber(args.maxGatewayWsRoundTripMs))
    ? toNumber(args.maxGatewayWsRoundTripMs)
    : 1800;
  const maxGatewayInterruptLatencyMs = Number.isFinite(toNumber(args.maxGatewayInterruptLatencyMs))
    ? toNumber(args.maxGatewayInterruptLatencyMs)
    : 300;
  const minServiceStartMaxAttempts = Number.isFinite(toNumber(args.minServiceStartMaxAttempts))
    ? toNumber(args.minServiceStartMaxAttempts)
    : 2;
  const minServiceStartRetryBackoffMs = Number.isFinite(toNumber(args.minServiceStartRetryBackoffMs))
    ? toNumber(args.minServiceStartRetryBackoffMs)
    : 300;
  const minScenarioRetryMaxAttempts = Number.isFinite(toNumber(args.minScenarioRetryMaxAttempts))
    ? toNumber(args.minScenarioRetryMaxAttempts)
    : 2;
  const minScenarioRetryBackoffMs = Number.isFinite(toNumber(args.minScenarioRetryBackoffMs))
    ? toNumber(args.minScenarioRetryBackoffMs)
    : 500;
  const maxScenarioRetriesUsedCount = Number.isFinite(toNumber(args.maxScenarioRetriesUsedCount))
    ? toNumber(args.maxScenarioRetriesUsedCount)
    : 2;
  const minAnalyticsServicesValidated = Number.isFinite(toNumber(args.minAnalyticsServicesValidated))
    ? toNumber(args.minAnalyticsServicesValidated)
    : 4;
  const minAnalyticsRequestedEnabledServices = Number.isFinite(toNumber(args.minAnalyticsRequestedEnabledServices))
    ? toNumber(args.minAnalyticsRequestedEnabledServices)
    : 4;
  const minAnalyticsEnabledServices = Number.isFinite(toNumber(args.minAnalyticsEnabledServices))
    ? toNumber(args.minAnalyticsEnabledServices)
    : 4;
  const minApprovalsRecorded = Number.isFinite(toNumber(args.minApprovalsRecorded))
    ? toNumber(args.minApprovalsRecorded)
    : 1;
  const maxUiApprovalResumeElapsedMs = Number.isFinite(toNumber(args.maxUiApprovalResumeElapsedMs))
    ? toNumber(args.maxUiApprovalResumeElapsedMs)
    : 60_000;
  const minUiApprovalResumeRequestAttempts = Number.isFinite(toNumber(args.minUiApprovalResumeRequestAttempts))
    ? toNumber(args.minUiApprovalResumeRequestAttempts)
    : 1;
  const maxUiApprovalResumeRequestAttempts = Number.isFinite(toNumber(args.maxUiApprovalResumeRequestAttempts))
    ? toNumber(args.maxUiApprovalResumeRequestAttempts)
    : 2;
  const expectedUiAdapterMode = args.expectedUiAdapterMode ?? "remote_http";
  const allowedUiAdapterModes = toStringArray(args.allowedUiAdapterModes ?? expectedUiAdapterMode);
  const expectedUiRemoteHttpFallbackMode = args.expectedUiRemoteHttpFallbackMode ?? "failed";
  const allowedUiRemoteHttpFallbackModes = toStringArray(
    args.allowedUiRemoteHttpFallbackModes ?? expectedUiRemoteHttpFallbackMode,
  );
  const allowedGatewayInterruptEvents = toStringArray(
    args.allowedGatewayInterruptEvents ?? "live.interrupt.requested,live.bridge.unavailable",
  );
  const allowedTranslationProviders = toStringArray(args.allowedTranslationProviders ?? "fallback,gemini");
  const allowedAssistiveRouterModes = toStringArray(
    args.allowedAssistiveRouterModes ?? "deterministic,assistive_override,assistive_match,assistive_fallback",
  );
  const allowedVisualComparatorModes = toStringArray(
    args.allowedVisualComparatorModes ?? "fallback_heuristic,gemini_reasoning",
  );
  const allowedStoryMediaModes = toStringArray(args.allowedStoryMediaModes ?? "simulated");
  const requiredScenarios = toStringArray(
    args.requiredScenarios ??
      [
        "live.translation",
        "live.negotiation",
        "live.context_compaction",
        "storyteller.pipeline",
        "ui.approval.request",
        "ui.approval.reject",
        "ui.approval.approve_resume",
        "ui.sandbox.policy_modes",
        "ui.visual_testing",
        "multi_agent.delegation",
        "gateway.websocket.roundtrip",
        "gateway.websocket.task_progress",
        "gateway.websocket.request_replay",
        "gateway.websocket.interrupt_signal",
        "gateway.websocket.invalid_envelope",
        "gateway.websocket.binding_mismatch",
        "gateway.websocket.draining_rejection",
        "operator.console.actions",
        "operator.device_nodes.lifecycle",
        "api.approvals.list",
        "api.approvals.resume.invalid_intent",
        "api.sessions.versioning",
        "runtime.lifecycle.endpoints",
        "runtime.metrics.endpoints",
      ].join(","),
  );

  const raw = await readFile(inputPath, "utf8");
  const normalized = raw.replace(/^\uFEFF/, "");
  const summary = JSON.parse(normalized);

  if (!isObject(summary)) {
    fail("summary.json is not an object");
  }

  const kpis = isObject(summary.kpis) ? summary.kpis : {};
  const options = isObject(summary.options) ? summary.options : {};
  const scenarios = Array.isArray(summary.scenarios) ? summary.scenarios : [];
  const scenarioByName = new Map(
    scenarios.map((item) => [isObject(item) ? String(item.name) : "", item]).filter(([name]) => name.length > 0),
  );

  const checks = [];
  const violations = [];

  function addCheck(name, passed, value, expectation) {
    checks.push({ name, passed, value, expectation });
    if (!passed) {
      violations.push(`${name}: expected ${toSafeString(expectation)}, got ${toSafeString(value)}`);
    }
  }

  addCheck("summary.success", summary.success === true, summary.success, true);

  for (const scenarioName of requiredScenarios) {
    const found = scenarioByName.get(scenarioName);
    const status = isObject(found) ? found.status : null;
    addCheck(`scenario.${scenarioName}`, status === "passed", status, "passed");
  }
  const uiApprovalResumeScenario = scenarioByName.get("ui.approval.approve_resume");
  const uiApprovalResumeElapsedMs = isObject(uiApprovalResumeScenario)
    ? toNumber(uiApprovalResumeScenario.elapsedMs)
    : Number.NaN;
  addCheck(
    "scenario.ui.approval.approve_resume.elapsedMs",
    Number.isFinite(uiApprovalResumeElapsedMs) && uiApprovalResumeElapsedMs <= maxUiApprovalResumeElapsedMs,
    isObject(uiApprovalResumeScenario) ? uiApprovalResumeScenario.elapsedMs : null,
    `<= ${maxUiApprovalResumeElapsedMs}`,
  );

  addCheck(
    "kpi.negotiationConstraintsSatisfied",
    kpis.negotiationConstraintsSatisfied === true,
    kpis.negotiationConstraintsSatisfied,
    true,
  );
  addCheck(
    "kpi.negotiationRequiresUserConfirmation",
    kpis.negotiationRequiresUserConfirmation === true,
    kpis.negotiationRequiresUserConfirmation,
    true,
  );
  addCheck(
    "kpi.liveContextCompactionValidated",
    kpis.liveContextCompactionValidated === true,
    kpis.liveContextCompactionValidated,
    true,
  );
  addCheck(
    "kpi.liveContextCompactionObserved",
    kpis.liveContextCompactionObserved === true,
    kpis.liveContextCompactionObserved,
    true,
  );
  addCheck(
    "kpi.liveContextCompactionCount",
    toNumber(kpis.liveContextCompactionCount) >= 1,
    kpis.liveContextCompactionCount,
    ">= 1",
  );
  addCheck(
    "kpi.liveContextCompactionSummaryPresent",
    kpis.liveContextCompactionSummaryPresent === true,
    kpis.liveContextCompactionSummaryPresent,
    true,
  );
  addCheck(
    "kpi.liveContextCompactionSummaryChars",
    toNumber(kpis.liveContextCompactionSummaryChars) >= 1 &&
      toNumber(kpis.liveContextCompactionSummaryChars) <= 3200,
    kpis.liveContextCompactionSummaryChars,
    "1..3200",
  );
  addCheck(
    "kpi.liveContextCompactionRetainedTurns",
    toNumber(kpis.liveContextCompactionRetainedTurns) >= toNumber(kpis.liveContextCompactionMinRetainedTurns),
    kpis.liveContextCompactionRetainedTurns,
    ">= liveContextCompactionMinRetainedTurns",
  );
  addCheck(
    "kpi.liveContextCompactionReason",
    ["compacted", "compacted_with_fallback_summary"].includes(String(kpis.liveContextCompactionReason)),
    kpis.liveContextCompactionReason,
    "compacted | compacted_with_fallback_summary",
  );
  addCheck(
    "kpi.storytellerMediaMode",
    allowedStoryMediaModes.includes(String(kpis.storytellerMediaMode)),
    kpis.storytellerMediaMode,
    allowedStoryMediaModes.join(" | "),
  );
  addCheck(
    "kpi.storytellerVideoAsync",
    kpis.storytellerVideoAsync === true,
    kpis.storytellerVideoAsync,
    true,
  );
  addCheck(
    "kpi.storytellerVideoJobsCount",
    toNumber(kpis.storytellerVideoJobsCount) >= 1,
    kpis.storytellerVideoJobsCount,
    ">= 1",
  );
  addCheck(
    "kpi.storytellerVideoPendingCount",
    toNumber(kpis.storytellerVideoPendingCount) >= 1,
    kpis.storytellerVideoPendingCount,
    ">= 1",
  );
  addCheck(
    "kpi.storytellerVideoAsyncValidated",
    kpis.storytellerVideoAsyncValidated === true,
    kpis.storytellerVideoAsyncValidated,
    true,
  );
  addCheck(
    "kpi.storytellerMediaQueueVisible",
    kpis.storytellerMediaQueueVisible === true,
    kpis.storytellerMediaQueueVisible,
    true,
  );
  addCheck(
    "kpi.storytellerMediaQueueWorkers",
    toNumber(kpis.storytellerMediaQueueWorkers) >= 1,
    kpis.storytellerMediaQueueWorkers,
    ">= 1",
  );
  addCheck(
    "kpi.storytellerMediaQueueQuotaEntries",
    toNumber(kpis.storytellerMediaQueueQuotaEntries) >= 1,
    kpis.storytellerMediaQueueQuotaEntries,
    ">= 1",
  );
  addCheck(
    "kpi.storytellerMediaQueueQuotaModelSeen",
    kpis.storytellerMediaQueueQuotaModelSeen === true,
    kpis.storytellerMediaQueueQuotaModelSeen,
    true,
  );
  addCheck(
    "kpi.storytellerMediaQueueQuotaValidated",
    kpis.storytellerMediaQueueQuotaValidated === true,
    kpis.storytellerMediaQueueQuotaValidated,
    true,
  );
  addCheck(
    "kpi.storytellerCacheEnabled",
    kpis.storytellerCacheEnabled === true,
    kpis.storytellerCacheEnabled,
    true,
  );
  addCheck(
    "kpi.storytellerCacheHits",
    toNumber(kpis.storytellerCacheHits) >= 1,
    kpis.storytellerCacheHits,
    ">= 1",
  );
  addCheck(
    "kpi.storytellerCacheHitValidated",
    kpis.storytellerCacheHitValidated === true,
    kpis.storytellerCacheHitValidated,
    true,
  );
  addCheck(
    "kpi.storytellerCacheInvalidationValidated",
    kpis.storytellerCacheInvalidationValidated === true,
    kpis.storytellerCacheInvalidationValidated,
    true,
  );
  addCheck(
    "kpi.gatewayWsResponseStatus",
    kpis.gatewayWsResponseStatus === "completed",
    kpis.gatewayWsResponseStatus,
    "completed",
  );
  addCheck(
    "kpi.assistantActivityLifecycleValidated",
    kpis.assistantActivityLifecycleValidated === true,
    kpis.assistantActivityLifecycleValidated,
    true,
  );
  addCheck(
    "kpi.gatewayInterruptHandled",
    kpis.gatewayInterruptHandled === true,
    kpis.gatewayInterruptHandled,
    true,
  );
  addCheck(
    "kpi.gatewayInterruptEventType",
    allowedGatewayInterruptEvents.includes(String(kpis.gatewayInterruptEventType)),
    kpis.gatewayInterruptEventType,
    allowedGatewayInterruptEvents.join(" | "),
  );
  const gatewayInterruptLatencyMs = toNumber(kpis.gatewayInterruptLatencyMs);
  const gatewayInterruptUnavailable = String(kpis.gatewayInterruptEventType) === "live.bridge.unavailable";
  const gatewayInterruptLatencyMeasured = Number.isFinite(gatewayInterruptLatencyMs);
  addCheck(
    "kpi.gatewayInterruptLatencyObservedOrUnavailable",
    gatewayInterruptLatencyMeasured || gatewayInterruptUnavailable,
    gatewayInterruptLatencyMeasured ? gatewayInterruptLatencyMs : kpis.gatewayInterruptEventType,
    "latency measured | live.bridge.unavailable",
  );
  addCheck(
    "kpi.gatewayInterruptLatencyMs",
    gatewayInterruptLatencyMeasured ? gatewayInterruptLatencyMs <= maxGatewayInterruptLatencyMs : gatewayInterruptUnavailable,
    gatewayInterruptLatencyMeasured ? gatewayInterruptLatencyMs : null,
    `<= ${maxGatewayInterruptLatencyMs} (when measured)`,
  );
  addCheck(
    "kpi.gatewayWsInvalidEnvelopeCode",
    kpis.gatewayWsInvalidEnvelopeCode === "GATEWAY_INVALID_ENVELOPE",
    kpis.gatewayWsInvalidEnvelopeCode,
    "GATEWAY_INVALID_ENVELOPE",
  );
  addCheck(
    "kpi.gatewayWsSessionMismatchCode",
    String(kpis.gatewayWsSessionMismatchCode) === "GATEWAY_SESSION_MISMATCH",
    kpis.gatewayWsSessionMismatchCode,
    "GATEWAY_SESSION_MISMATCH",
  );
  addCheck(
    "kpi.gatewayWsUserMismatchCode",
    String(kpis.gatewayWsUserMismatchCode) === "GATEWAY_USER_MISMATCH",
    kpis.gatewayWsUserMismatchCode,
    "GATEWAY_USER_MISMATCH",
  );
  addCheck(
    "kpi.gatewayWsBindingMismatchValidated",
    kpis.gatewayWsBindingMismatchValidated === true,
    kpis.gatewayWsBindingMismatchValidated,
    true,
  );
  addCheck(
    "kpi.gatewayWsDrainingCode",
    String(kpis.gatewayWsDrainingCode) === "GATEWAY_DRAINING",
    kpis.gatewayWsDrainingCode,
    "GATEWAY_DRAINING",
  );
  addCheck(
    "kpi.gatewayWsDrainingTraceIdPresent",
    kpis.gatewayWsDrainingTraceIdPresent === true,
    kpis.gatewayWsDrainingTraceIdPresent,
    true,
  );
  addCheck(
    "kpi.gatewayWsDrainingRecoveryStatus",
    String(kpis.gatewayWsDrainingRecoveryStatus) === "completed",
    kpis.gatewayWsDrainingRecoveryStatus,
    "completed",
  );
  addCheck(
    "kpi.gatewayWsDrainingValidated",
    kpis.gatewayWsDrainingValidated === true,
    kpis.gatewayWsDrainingValidated,
    true,
  );
  addCheck(
    "kpi.operatorActionsValidated",
    kpis.operatorActionsValidated === true,
    kpis.operatorActionsValidated,
    true,
  );
  addCheck(
    "kpi.operatorAuditTrailValidated",
    kpis.operatorAuditTrailValidated === true,
    kpis.operatorAuditTrailValidated,
    true,
  );
  addCheck(
    "kpi.operatorTraceCoverageValidated",
    kpis.operatorTraceCoverageValidated === true,
    kpis.operatorTraceCoverageValidated,
    true,
  );
  addCheck(
    "kpi.operatorLiveBridgeHealthBlockValidated",
    kpis.operatorLiveBridgeHealthBlockValidated === true,
    kpis.operatorLiveBridgeHealthBlockValidated,
    true,
  );
  addCheck(
    "kpi.operatorLiveBridgeProbeTelemetryValidated",
    kpis.operatorLiveBridgeProbeTelemetryValidated === true,
    kpis.operatorLiveBridgeProbeTelemetryValidated,
    true,
  );
  addCheck(
    "kpi.operatorLiveBridgeHealthState",
    ["healthy", "degraded", "unknown"].includes(String(kpis.operatorLiveBridgeHealthState)),
    kpis.operatorLiveBridgeHealthState,
    "healthy | degraded | unknown",
  );
  addCheck(
    "kpi.operatorLiveBridgeHealthConnectTimeoutEvents",
    toNumber(kpis.operatorLiveBridgeHealthConnectTimeoutEvents) >= 0,
    kpis.operatorLiveBridgeHealthConnectTimeoutEvents,
    ">= 0",
  );
  addCheck(
    "kpi.operatorLiveBridgeHealthProbeStartedEvents",
    toNumber(kpis.operatorLiveBridgeHealthProbeStartedEvents) >= 0,
    kpis.operatorLiveBridgeHealthProbeStartedEvents,
    ">= 0",
  );
  addCheck(
    "kpi.operatorLiveBridgeHealthPingSentEvents",
    toNumber(kpis.operatorLiveBridgeHealthPingSentEvents) >= 0,
    kpis.operatorLiveBridgeHealthPingSentEvents,
    ">= 0",
  );
  addCheck(
    "kpi.operatorLiveBridgeHealthPongEvents",
    toNumber(kpis.operatorLiveBridgeHealthPongEvents) >= 0,
    kpis.operatorLiveBridgeHealthPongEvents,
    ">= 0",
  );
  addCheck(
    "kpi.operatorLiveBridgeHealthPingErrorEvents",
    toNumber(kpis.operatorLiveBridgeHealthPingErrorEvents) >= 0,
    kpis.operatorLiveBridgeHealthPingErrorEvents,
    ">= 0",
  );
  addCheck(
    "kpi.operatorLiveBridgeHealthConsistencyValidated",
    kpis.operatorLiveBridgeHealthConsistencyValidated === true,
    kpis.operatorLiveBridgeHealthConsistencyValidated,
    true,
  );
  addCheck(
    "kpi.operatorStartupDiagnosticsValidated",
    kpis.operatorStartupDiagnosticsValidated === true,
    kpis.operatorStartupDiagnosticsValidated,
    true,
  );
  addCheck(
    "kpi.operatorStartupFailuresStatus",
    ["healthy", "degraded", "critical"].includes(String(kpis.operatorStartupFailuresStatus)),
    kpis.operatorStartupFailuresStatus,
    "healthy | degraded | critical",
  );
  addCheck(
    "kpi.operatorStartupFailuresTotal",
    toNumber(kpis.operatorStartupFailuresTotal) >= 0,
    kpis.operatorStartupFailuresTotal,
    ">= 0",
  );
  addCheck(
    "kpi.operatorStartupFailuresBlocking",
    toNumber(kpis.operatorStartupFailuresBlocking) >= 0 &&
      toNumber(kpis.operatorStartupFailuresBlocking) <= toNumber(kpis.operatorStartupFailuresTotal),
    kpis.operatorStartupFailuresBlocking,
    ">= 0 and <= operatorStartupFailuresTotal",
  );
  addCheck(
    "kpi.operatorTaskQueueSummaryValidated",
    kpis.operatorTaskQueueSummaryValidated === true,
    kpis.operatorTaskQueueSummaryValidated,
    true,
  );
  addCheck(
    "kpi.operatorTaskQueuePressureLevel",
    ["idle", "healthy", "elevated"].includes(String(kpis.operatorTaskQueuePressureLevel)),
    kpis.operatorTaskQueuePressureLevel,
    "idle | healthy | elevated",
  );
  addCheck(
    "kpi.operatorTaskQueueTotal",
    toNumber(kpis.operatorTaskQueueTotal) >= 1,
    kpis.operatorTaskQueueTotal,
    ">= 1",
  );
  addCheck(
    "kpi.operatorTaskQueueStaleCount",
    toNumber(kpis.operatorTaskQueueStaleCount) >= 0,
    kpis.operatorTaskQueueStaleCount,
    ">= 0",
  );
  addCheck(
    "kpi.operatorTaskQueuePendingApproval",
    toNumber(kpis.operatorTaskQueuePendingApproval) >= 0,
    kpis.operatorTaskQueuePendingApproval,
    ">= 0",
  );
  addCheck(
    "kpi.operatorFailoverForbiddenCode",
    String(kpis.operatorFailoverForbiddenCode) === "API_OPERATOR_ADMIN_REQUIRED",
    kpis.operatorFailoverForbiddenCode,
    "API_OPERATOR_ADMIN_REQUIRED",
  );
  addCheck(
    "kpi.operatorFailoverDrainState",
    String(kpis.operatorFailoverDrainState) === "draining",
    kpis.operatorFailoverDrainState,
    "draining",
  );
  addCheck(
    "kpi.operatorFailoverWarmupState",
    String(kpis.operatorFailoverWarmupState) === "ready",
    kpis.operatorFailoverWarmupState,
    "ready",
  );
  addCheck(
    "kpi.operatorFailoverUiExecutorDrainState",
    String(kpis.operatorFailoverUiExecutorDrainState) === "draining",
    kpis.operatorFailoverUiExecutorDrainState,
    "draining",
  );
  addCheck(
    "kpi.operatorFailoverUiExecutorWarmupState",
    String(kpis.operatorFailoverUiExecutorWarmupState) === "ready",
    kpis.operatorFailoverUiExecutorWarmupState,
    "ready",
  );
  addCheck(
    "kpi.operatorFailoverUiExecutorValidated",
    kpis.operatorFailoverUiExecutorValidated === true,
    kpis.operatorFailoverUiExecutorValidated,
    true,
  );
  addCheck(
    "kpi.operatorDeviceNodeLookupValidated",
    kpis.operatorDeviceNodeLookupValidated === true,
    kpis.operatorDeviceNodeLookupValidated,
    true,
  );
  addCheck(
    "kpi.operatorDeviceNodeLookupStatus",
    String(kpis.operatorDeviceNodeLookupStatus) === "degraded",
    kpis.operatorDeviceNodeLookupStatus,
    "degraded",
  );
  addCheck(
    "kpi.operatorDeviceNodeLookupVersion",
    toNumber(kpis.operatorDeviceNodeLookupVersion) > toNumber(kpis.operatorDeviceNodeUpdatedVersion),
    kpis.operatorDeviceNodeLookupVersion,
    "> operatorDeviceNodeUpdatedVersion",
  );
  addCheck(
    "kpi.operatorDeviceNodeUpdatedVersion",
    toNumber(kpis.operatorDeviceNodeUpdatedVersion) > toNumber(kpis.operatorDeviceNodeCreatedVersion),
    kpis.operatorDeviceNodeUpdatedVersion,
    "> operatorDeviceNodeCreatedVersion",
  );
  addCheck(
    "kpi.operatorDeviceNodeVersionConflictValidated",
    kpis.operatorDeviceNodeVersionConflictValidated === true,
    kpis.operatorDeviceNodeVersionConflictValidated,
    true,
  );
  addCheck(
    "kpi.operatorDeviceNodeVersionConflictStatusCode",
    toNumber(kpis.operatorDeviceNodeVersionConflictStatusCode) === 409,
    kpis.operatorDeviceNodeVersionConflictStatusCode,
    409,
  );
  addCheck(
    "kpi.operatorDeviceNodeVersionConflictCode",
    String(kpis.operatorDeviceNodeVersionConflictCode) === "API_DEVICE_NODE_VERSION_CONFLICT",
    kpis.operatorDeviceNodeVersionConflictCode,
    "API_DEVICE_NODE_VERSION_CONFLICT",
  );
  addCheck(
    "kpi.operatorDeviceNodeHealthSummaryValidated",
    kpis.operatorDeviceNodeHealthSummaryValidated === true,
    kpis.operatorDeviceNodeHealthSummaryValidated,
    true,
  );
  addCheck(
    "kpi.operatorDeviceNodeSummaryTotal",
    toNumber(kpis.operatorDeviceNodeSummaryTotal) >= 1,
    kpis.operatorDeviceNodeSummaryTotal,
    ">= 1",
  );
  addCheck(
    "kpi.operatorDeviceNodeSummaryDegraded",
    toNumber(kpis.operatorDeviceNodeSummaryDegraded) >= 1,
    kpis.operatorDeviceNodeSummaryDegraded,
    ">= 1",
  );
  addCheck(
    "kpi.operatorDeviceNodeSummaryRecentContainsLookup",
    kpis.operatorDeviceNodeSummaryRecentContainsLookup === true,
    kpis.operatorDeviceNodeSummaryRecentContainsLookup,
    true,
  );
  addCheck(
    "kpi.approvalsInvalidIntentStatusCode",
    toNumber(kpis.approvalsInvalidIntentStatusCode) === 400,
    kpis.approvalsInvalidIntentStatusCode,
    400,
  );
  addCheck(
    "kpi.approvalsInvalidIntentCode",
    String(kpis.approvalsInvalidIntentCode) === "API_INVALID_INTENT",
    kpis.approvalsInvalidIntentCode,
    "API_INVALID_INTENT",
  );
  addCheck(
    "kpi.approvalsRecorded",
    toNumber(kpis.approvalsRecorded) >= minApprovalsRecorded,
    kpis.approvalsRecorded,
    `>= ${minApprovalsRecorded}`,
  );
  addCheck(
    "kpi.sessionVersioningValidated",
    kpis.sessionVersioningValidated === true,
    kpis.sessionVersioningValidated,
    true,
  );
  addCheck(
    "kpi.sessionVersionConflictCode",
    String(kpis.sessionVersionConflictCode) === "API_SESSION_VERSION_CONFLICT",
    kpis.sessionVersionConflictCode,
    "API_SESSION_VERSION_CONFLICT",
  );
  addCheck(
    "kpi.sessionIdempotencyReplayOutcome",
    String(kpis.sessionIdempotencyReplayOutcome) === "idempotent_replay",
    kpis.sessionIdempotencyReplayOutcome,
    "idempotent_replay",
  );
  addCheck(
    "kpi.sessionIdempotencyConflictCode",
    String(kpis.sessionIdempotencyConflictCode) === "API_SESSION_IDEMPOTENCY_CONFLICT",
    kpis.sessionIdempotencyConflictCode,
    "API_SESSION_IDEMPOTENCY_CONFLICT",
  );
  addCheck(
    "kpi.uiAdapterMode",
    allowedUiAdapterModes.includes(String(kpis.uiAdapterMode)),
    kpis.uiAdapterMode,
    allowedUiAdapterModes.join(" | "),
  );
  addCheck(
    "kpi.uiExecutorMode",
    String(kpis.uiExecutorMode) === "remote_http",
    kpis.uiExecutorMode,
    "remote_http",
  );
  addCheck(
    "kpi.uiExecutorForceSimulation",
    kpis.uiExecutorForceSimulation === true,
    kpis.uiExecutorForceSimulation,
    true,
  );
  addCheck(
    "kpi.uiExecutorRuntimeValidated",
    kpis.uiExecutorRuntimeValidated === true,
    kpis.uiExecutorRuntimeValidated,
    true,
  );
  addCheck(
    "kpi.uiExecutorLifecycleValidated",
    kpis.uiExecutorLifecycleValidated === true,
    kpis.uiExecutorLifecycleValidated,
    true,
  );
  addCheck(
    "options.uiNavigatorRemoteHttpFallbackMode",
    allowedUiRemoteHttpFallbackModes.includes(String(options.uiNavigatorRemoteHttpFallbackMode)),
    options.uiNavigatorRemoteHttpFallbackMode,
    allowedUiRemoteHttpFallbackModes.join(" | "),
  );
  const serviceStartMaxAttempts = toNumber(options.serviceStartMaxAttempts);
  addCheck(
    "options.serviceStartMaxAttempts",
    Number.isFinite(serviceStartMaxAttempts) && serviceStartMaxAttempts >= minServiceStartMaxAttempts,
    options.serviceStartMaxAttempts,
    `>= ${minServiceStartMaxAttempts}`,
  );
  const serviceStartRetryBackoffMs = toNumber(options.serviceStartRetryBackoffMs);
  addCheck(
    "options.serviceStartRetryBackoffMs",
    Number.isFinite(serviceStartRetryBackoffMs) && serviceStartRetryBackoffMs >= minServiceStartRetryBackoffMs,
    options.serviceStartRetryBackoffMs,
    `>= ${minServiceStartRetryBackoffMs}`,
  );
  const scenarioRetryMaxAttempts = toNumber(options.scenarioRetryMaxAttempts);
  addCheck(
    "options.scenarioRetryMaxAttempts",
    Number.isFinite(scenarioRetryMaxAttempts) && scenarioRetryMaxAttempts >= minScenarioRetryMaxAttempts,
    options.scenarioRetryMaxAttempts,
    `>= ${minScenarioRetryMaxAttempts}`,
  );
  const scenarioRetryBackoffMs = toNumber(options.scenarioRetryBackoffMs);
  addCheck(
    "options.scenarioRetryBackoffMs",
    Number.isFinite(scenarioRetryBackoffMs) && scenarioRetryBackoffMs >= minScenarioRetryBackoffMs,
    options.scenarioRetryBackoffMs,
    `>= ${minScenarioRetryBackoffMs}`,
  );
  const scenarioRetriesUsedCount = toNumber(kpis.scenarioRetriesUsedCount);
  addCheck(
    "kpi.scenarioRetriesUsedCount",
    Number.isFinite(scenarioRetriesUsedCount) &&
      scenarioRetriesUsedCount >= 0 &&
      scenarioRetriesUsedCount <= maxScenarioRetriesUsedCount,
    kpis.scenarioRetriesUsedCount,
    `0..${maxScenarioRetriesUsedCount}`,
  );
  const liveTranslationScenarioAttempts = toNumber(kpis.liveTranslationScenarioAttempts);
  addCheck(
    "kpi.liveTranslationScenarioAttempts",
    Number.isFinite(liveTranslationScenarioAttempts) &&
      liveTranslationScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      liveTranslationScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.liveTranslationScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const liveNegotiationScenarioAttempts = toNumber(kpis.liveNegotiationScenarioAttempts);
  addCheck(
    "kpi.liveNegotiationScenarioAttempts",
    Number.isFinite(liveNegotiationScenarioAttempts) &&
      liveNegotiationScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      liveNegotiationScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.liveNegotiationScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const liveContextCompactionScenarioAttempts = toNumber(kpis.liveContextCompactionScenarioAttempts);
  addCheck(
    "kpi.liveContextCompactionScenarioAttempts",
    Number.isFinite(liveContextCompactionScenarioAttempts) &&
      liveContextCompactionScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      liveContextCompactionScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.liveContextCompactionScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const storytellerPipelineScenarioAttempts = toNumber(kpis.storytellerPipelineScenarioAttempts);
  addCheck(
    "kpi.storytellerPipelineScenarioAttempts",
    Number.isFinite(storytellerPipelineScenarioAttempts) &&
      storytellerPipelineScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      storytellerPipelineScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.storytellerPipelineScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const uiSandboxPolicyModesScenarioAttempts = toNumber(kpis.uiSandboxPolicyModesScenarioAttempts);
  addCheck(
    "kpi.uiSandboxPolicyModesScenarioAttempts",
    Number.isFinite(uiSandboxPolicyModesScenarioAttempts) &&
      uiSandboxPolicyModesScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      uiSandboxPolicyModesScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.uiSandboxPolicyModesScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const gatewayWsRoundTripScenarioAttempts = toNumber(kpis.gatewayWsRoundTripScenarioAttempts);
  addCheck(
    "kpi.gatewayWsRoundTripScenarioAttempts",
    Number.isFinite(gatewayWsRoundTripScenarioAttempts) &&
      gatewayWsRoundTripScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      gatewayWsRoundTripScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.gatewayWsRoundTripScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const gatewayInterruptSignalScenarioAttempts = toNumber(kpis.gatewayInterruptSignalScenarioAttempts);
  addCheck(
    "kpi.gatewayInterruptSignalScenarioAttempts",
    Number.isFinite(gatewayInterruptSignalScenarioAttempts) &&
      gatewayInterruptSignalScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      gatewayInterruptSignalScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.gatewayInterruptSignalScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const gatewayTaskProgressScenarioAttempts = toNumber(kpis.gatewayTaskProgressScenarioAttempts);
  addCheck(
    "kpi.gatewayTaskProgressScenarioAttempts",
    Number.isFinite(gatewayTaskProgressScenarioAttempts) &&
      gatewayTaskProgressScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      gatewayTaskProgressScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.gatewayTaskProgressScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const gatewayRequestReplayScenarioAttempts = toNumber(kpis.gatewayRequestReplayScenarioAttempts);
  addCheck(
    "kpi.gatewayRequestReplayScenarioAttempts",
    Number.isFinite(gatewayRequestReplayScenarioAttempts) &&
      gatewayRequestReplayScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      gatewayRequestReplayScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.gatewayRequestReplayScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const gatewayInvalidEnvelopeScenarioAttempts = toNumber(kpis.gatewayInvalidEnvelopeScenarioAttempts);
  addCheck(
    "kpi.gatewayInvalidEnvelopeScenarioAttempts",
    Number.isFinite(gatewayInvalidEnvelopeScenarioAttempts) &&
      gatewayInvalidEnvelopeScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      gatewayInvalidEnvelopeScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.gatewayInvalidEnvelopeScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const gatewayBindingMismatchScenarioAttempts = toNumber(kpis.gatewayBindingMismatchScenarioAttempts);
  addCheck(
    "kpi.gatewayBindingMismatchScenarioAttempts",
    Number.isFinite(gatewayBindingMismatchScenarioAttempts) &&
      gatewayBindingMismatchScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      gatewayBindingMismatchScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.gatewayBindingMismatchScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const gatewayDrainingRejectionScenarioAttempts = toNumber(kpis.gatewayDrainingRejectionScenarioAttempts);
  addCheck(
    "kpi.gatewayDrainingRejectionScenarioAttempts",
    Number.isFinite(gatewayDrainingRejectionScenarioAttempts) &&
      gatewayDrainingRejectionScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      gatewayDrainingRejectionScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.gatewayDrainingRejectionScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const multiAgentDelegationScenarioAttempts = toNumber(kpis.multiAgentDelegationScenarioAttempts);
  addCheck(
    "kpi.multiAgentDelegationScenarioAttempts",
    Number.isFinite(multiAgentDelegationScenarioAttempts) &&
      multiAgentDelegationScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      multiAgentDelegationScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.multiAgentDelegationScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const operatorDeviceNodesLifecycleScenarioAttempts = toNumber(kpis.operatorDeviceNodesLifecycleScenarioAttempts);
  addCheck(
    "kpi.operatorDeviceNodesLifecycleScenarioAttempts",
    Number.isFinite(operatorDeviceNodesLifecycleScenarioAttempts) &&
      operatorDeviceNodesLifecycleScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      operatorDeviceNodesLifecycleScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.operatorDeviceNodesLifecycleScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const approvalsListScenarioAttempts = toNumber(kpis.approvalsListScenarioAttempts);
  addCheck(
    "kpi.approvalsListScenarioAttempts",
    Number.isFinite(approvalsListScenarioAttempts) &&
      approvalsListScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      approvalsListScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.approvalsListScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const approvalsInvalidIntentScenarioAttempts = toNumber(kpis.approvalsInvalidIntentScenarioAttempts);
  addCheck(
    "kpi.approvalsInvalidIntentScenarioAttempts",
    Number.isFinite(approvalsInvalidIntentScenarioAttempts) &&
      approvalsInvalidIntentScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      approvalsInvalidIntentScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.approvalsInvalidIntentScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const sessionVersioningScenarioAttempts = toNumber(kpis.sessionVersioningScenarioAttempts);
  addCheck(
    "kpi.sessionVersioningScenarioAttempts",
    Number.isFinite(sessionVersioningScenarioAttempts) &&
      sessionVersioningScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      sessionVersioningScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.sessionVersioningScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const uiVisualTestingScenarioAttempts = toNumber(kpis.uiVisualTestingScenarioAttempts);
  addCheck(
    "kpi.uiVisualTestingScenarioAttempts",
    Number.isFinite(uiVisualTestingScenarioAttempts) &&
      uiVisualTestingScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      uiVisualTestingScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.uiVisualTestingScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const operatorConsoleActionsScenarioAttempts = toNumber(kpis.operatorConsoleActionsScenarioAttempts);
  addCheck(
    "kpi.operatorConsoleActionsScenarioAttempts",
    Number.isFinite(operatorConsoleActionsScenarioAttempts) &&
      operatorConsoleActionsScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      operatorConsoleActionsScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.operatorConsoleActionsScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const runtimeLifecycleScenarioAttempts = toNumber(kpis.runtimeLifecycleScenarioAttempts);
  addCheck(
    "kpi.runtimeLifecycleScenarioAttempts",
    Number.isFinite(runtimeLifecycleScenarioAttempts) &&
      runtimeLifecycleScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      runtimeLifecycleScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.runtimeLifecycleScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const runtimeMetricsScenarioAttempts = toNumber(kpis.runtimeMetricsScenarioAttempts);
  addCheck(
    "kpi.runtimeMetricsScenarioAttempts",
    Number.isFinite(runtimeMetricsScenarioAttempts) &&
      runtimeMetricsScenarioAttempts >= 1 &&
      Number.isFinite(scenarioRetryMaxAttempts) &&
      runtimeMetricsScenarioAttempts <= scenarioRetryMaxAttempts,
    kpis.runtimeMetricsScenarioAttempts,
    "1..options.scenarioRetryMaxAttempts",
  );
  const scenarioRetryableFailuresTotal = toNumber(kpis.scenarioRetryableFailuresTotal);
  addCheck(
    "kpi.scenarioRetryableFailuresTotal",
    Number.isFinite(scenarioRetryableFailuresTotal) && scenarioRetryableFailuresTotal >= 0,
    kpis.scenarioRetryableFailuresTotal,
    ">= 0",
  );
  const uiApprovalResumeRequestAttempts = toNumber(kpis.uiApprovalResumeRequestAttempts);
  addCheck(
    "kpi.uiApprovalResumeRequestAttempts",
    Number.isFinite(uiApprovalResumeRequestAttempts) &&
      uiApprovalResumeRequestAttempts >= minUiApprovalResumeRequestAttempts &&
      uiApprovalResumeRequestAttempts <= maxUiApprovalResumeRequestAttempts,
    kpis.uiApprovalResumeRequestAttempts,
    `${minUiApprovalResumeRequestAttempts}..${maxUiApprovalResumeRequestAttempts}`,
  );
  addCheck(
    "kpi.uiApprovalResumeRequestRetried",
    typeof kpis.uiApprovalResumeRequestRetried === "boolean",
    kpis.uiApprovalResumeRequestRetried,
    "boolean",
  );
  addCheck(
    "kpi.sandboxPolicyValidated",
    kpis.sandboxPolicyValidated === true,
    kpis.sandboxPolicyValidated,
    true,
  );
  addCheck(
    "kpi.visualTestingStatus",
    String(kpis.visualTestingStatus) === "passed",
    kpis.visualTestingStatus,
    "passed",
  );
  addCheck(
    "kpi.visualRegressionCount",
    toNumber(kpis.visualRegressionCount) === 0,
    kpis.visualRegressionCount,
    0,
  );
  addCheck(
    "kpi.visualChecksCount",
    toNumber(kpis.visualChecksCount) >= 3,
    kpis.visualChecksCount,
    ">= 3",
  );
  addCheck(
    "kpi.visualComparatorMode",
    allowedVisualComparatorModes.includes(String(kpis.visualComparatorMode)),
    kpis.visualComparatorMode,
    allowedVisualComparatorModes.join(" | "),
  );
  addCheck(
    "kpi.visualTestingValidated",
    kpis.visualTestingValidated === true,
    kpis.visualTestingValidated,
    true,
  );
  addCheck(
    "kpi.uiGroundingDomSeen",
    kpis.uiGroundingDomSeen === true,
    kpis.uiGroundingDomSeen,
    true,
  );
  addCheck(
    "kpi.uiGroundingAccessibilitySeen",
    kpis.uiGroundingAccessibilitySeen === true,
    kpis.uiGroundingAccessibilitySeen,
    true,
  );
  addCheck(
    "kpi.uiGroundingMarkHintsCount",
    toNumber(kpis.uiGroundingMarkHintsCount) >= 2,
    kpis.uiGroundingMarkHintsCount,
    ">= 2",
  );
  addCheck(
    "kpi.uiGroundingAdapterNoteSeen",
    kpis.uiGroundingAdapterNoteSeen === true,
    kpis.uiGroundingAdapterNoteSeen,
    true,
  );
  addCheck(
    "kpi.uiGroundingSignalsValidated",
    kpis.uiGroundingSignalsValidated === true,
    kpis.uiGroundingSignalsValidated,
    true,
  );
  addCheck(
    "kpi.gatewayWsRoundTripMs",
    toNumber(kpis.gatewayWsRoundTripMs) <= maxGatewayWsRoundTripMs,
    kpis.gatewayWsRoundTripMs,
    `<= ${maxGatewayWsRoundTripMs}`,
  );
  addCheck(
    "kpi.sessionRunBindingValidated",
    kpis.sessionRunBindingValidated === true,
    kpis.sessionRunBindingValidated,
    true,
  );
  addCheck(
    "kpi.sessionStateTransitionsObserved",
    toNumber(kpis.sessionStateTransitionsObserved) >= 3,
    kpis.sessionStateTransitionsObserved,
    ">= 3",
  );
  addCheck(
    "kpi.taskProgressEventsObserved",
    toNumber(kpis.taskProgressEventsObserved) >= 1,
    kpis.taskProgressEventsObserved,
    ">= 1",
  );
  addCheck(
    "kpi.activeTasksVisible",
    toNumber(kpis.activeTasksVisible) >= 1,
    kpis.activeTasksVisible,
    ">= 1",
  );
  addCheck(
    "kpi.gatewayRequestReplayValidated",
    kpis.gatewayRequestReplayValidated === true,
    kpis.gatewayRequestReplayValidated,
    true,
  );
  addCheck(
    "kpi.translationProvider",
    allowedTranslationProviders.includes(String(kpis.translationProvider)),
    kpis.translationProvider,
    allowedTranslationProviders.join(" | "),
  );
  addCheck(
    "kpi.assistiveRouterDiagnosticsValidated",
    kpis.assistiveRouterDiagnosticsValidated === true,
    kpis.assistiveRouterDiagnosticsValidated,
    true,
  );
  addCheck(
    "kpi.assistiveRouterMode",
    allowedAssistiveRouterModes.includes(String(kpis.assistiveRouterMode)),
    kpis.assistiveRouterMode,
    allowedAssistiveRouterModes.join(" | "),
  );
  addCheck(
    "kpi.lifecycleEndpointsValidated",
    kpis.lifecycleEndpointsValidated === true,
    kpis.lifecycleEndpointsValidated,
    true,
  );
  addCheck(
    "kpi.runtimeProfileValidated",
    kpis.runtimeProfileValidated === true,
    kpis.runtimeProfileValidated,
    true,
  );
  addCheck(
    "kpi.analyticsRuntimeVisible",
    kpis.analyticsRuntimeVisible === true,
    kpis.analyticsRuntimeVisible,
    true,
  );
  addCheck(
    "kpi.analyticsServicesValidated",
    toNumber(kpis.analyticsServicesValidated) >= minAnalyticsServicesValidated,
    kpis.analyticsServicesValidated,
    `>= ${minAnalyticsServicesValidated}`,
  );
  addCheck(
    "kpi.analyticsSplitTargetsValidated",
    kpis.analyticsSplitTargetsValidated === true,
    kpis.analyticsSplitTargetsValidated,
    true,
  );
  addCheck(
    "kpi.analyticsBigQueryConfigValidated",
    kpis.analyticsBigQueryConfigValidated === true,
    kpis.analyticsBigQueryConfigValidated,
    true,
  );
  addCheck(
    "kpi.analyticsRequestedEnabledServices",
    toNumber(kpis.analyticsRequestedEnabledServices) >= minAnalyticsRequestedEnabledServices,
    kpis.analyticsRequestedEnabledServices,
    `>= ${minAnalyticsRequestedEnabledServices}`,
  );
  addCheck(
    "kpi.analyticsEnabledServices",
    toNumber(kpis.analyticsEnabledServices) >= minAnalyticsEnabledServices,
    kpis.analyticsEnabledServices,
    `>= ${minAnalyticsEnabledServices}`,
  );
  addCheck(
    "kpi.transportModeValidated",
    kpis.transportModeValidated === true,
    kpis.transportModeValidated,
    true,
  );
  addCheck(
    "kpi.transportServicesValidated",
    toNumber(kpis.transportServicesValidated) >= 1,
    kpis.transportServicesValidated,
    ">= 1",
  );
  addCheck(
    "kpi.gatewayTransportRequestedMode",
    ["websocket", "webrtc"].includes(String(kpis.gatewayTransportRequestedMode)),
    kpis.gatewayTransportRequestedMode,
    "websocket | webrtc",
  );
  addCheck(
    "kpi.gatewayTransportActiveMode",
    String(kpis.gatewayTransportActiveMode) === "websocket",
    kpis.gatewayTransportActiveMode,
    "websocket",
  );
  addCheck(
    "kpi.gatewayTransportFallbackActive",
    String(kpis.gatewayTransportRequestedMode) === "webrtc"
      ? kpis.gatewayTransportFallbackActive === true
      : kpis.gatewayTransportFallbackActive === false,
    kpis.gatewayTransportFallbackActive,
    String(kpis.gatewayTransportRequestedMode) === "webrtc" ? true : false,
  );
  addCheck(
    "kpi.metricsEndpointsValidated",
    kpis.metricsEndpointsValidated === true,
    kpis.metricsEndpointsValidated,
    true,
  );
  addCheck(
    "kpi.metricsServicesValidated",
    toNumber(kpis.metricsServicesValidated) >= 4,
    kpis.metricsServicesValidated,
    ">= 4",
  );
  addCheck(
    "kpi.capabilityAdaptersValidated",
    kpis.capabilityAdaptersValidated === true,
    kpis.capabilityAdaptersValidated,
    true,
  );

  const success = violations.length === 0;
  const report = renderMarkdown({
    inputPath,
    success,
    checks,
    violations,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(jsonOutputPath), { recursive: true });
  await writeFile(outputPath, report, "utf8");

  const result = {
    ok: success,
    generatedAt: new Date().toISOString(),
    input: inputPath,
    output: outputPath,
    jsonOutput: jsonOutputPath,
    thresholds: {
      maxGatewayWsRoundTripMs,
      maxGatewayInterruptLatencyMs,
      minServiceStartMaxAttempts,
      minServiceStartRetryBackoffMs,
      minScenarioRetryMaxAttempts,
      minScenarioRetryBackoffMs,
      maxScenarioRetriesUsedCount,
      minAnalyticsServicesValidated,
      minAnalyticsRequestedEnabledServices,
      minAnalyticsEnabledServices,
      minApprovalsRecorded,
      maxUiApprovalResumeElapsedMs,
      minUiApprovalResumeRequestAttempts,
      maxUiApprovalResumeRequestAttempts,
      expectedUiAdapterMode,
      allowedUiAdapterModes,
      expectedUiRemoteHttpFallbackMode,
      allowedUiRemoteHttpFallbackModes,
      allowedVisualComparatorModes,
      allowedStoryMediaModes,
      allowedGatewayInterruptEvents,
      allowedTranslationProviders,
      allowedAssistiveRouterModes,
      requiredScenarios,
    },
    checks: checks.length,
    checkItems: checks,
    violations,
  };

  await writeFile(jsonOutputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  if (!success) {
    fail("KPI policy check failed", result);
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  fail("KPI policy check crashed", {
    error: error instanceof Error ? error.message : String(error),
  });
});
