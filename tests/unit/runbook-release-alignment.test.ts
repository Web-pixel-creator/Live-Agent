import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function extractQuotedItems(raw: string): string[] {
  return [...raw.matchAll(/"([^"]+)"/g)]
    .map((match) => match[1].trim())
    .filter((item) => item.length > 0);
}

function parseCriticalKpiKeys(source: string): string[] {
  const match = source.match(/\$criticalKpiChecks\s*=\s*@\{([\s\S]*?)\n\s*\}/m);
  assert.ok(match, "Could not parse $criticalKpiChecks block");
  return [...match[1].matchAll(/([A-Za-z0-9_]+)\s*=\s*\$true/g)].map((item) => item[1]);
}

function parseRequiredPerfPolicyChecks(source: string): string[] {
  const match = source.match(/\$requiredPerfPolicyChecks\s*=\s*@\(([\s\S]*?)\)/m);
  assert.ok(match, "Could not parse $requiredPerfPolicyChecks block");
  const checks = extractQuotedItems(match[1]);

  const adapterModeMatch = source.match(/RequiredPerfUiAdapterMode\s*=\s*"([^"]+)"/m);
  const adapterMode = adapterModeMatch?.[1]?.trim();
  if (
    adapterMode &&
    /"workload\.ui\.adapterMode\."\s*\+\s*\$ReleaseThresholds\.RequiredPerfUiAdapterMode/m.test(match[1])
  ) {
    checks.push(`workload.ui.adapterMode.${adapterMode}`);
  }

  return checks;
}

test("runbook documents release perf artifact-only mode and critical evidence keys", () => {
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");
  const runbookSource = readFileSync(runbookPath, "utf8");

  const requiredRunbookTokens = [
    "npm run verify:release",
    "-SkipPerfRun",
    "-DemoRunMaxAttempts",
    "-DemoRunRetryBackoffMs",
    "-DemoScenarioRetryMaxAttempts",
    "-DemoScenarioRetryBackoffMs",
    "-StrictFinalRun",
    "`operatorAuditTrailValidated=true`",
    "`operatorTraceCoverageValidated=true`",
    "`operatorLiveBridgeHealthBlockValidated=true`",
    "`operatorLiveBridgeProbeTelemetryValidated=true`",
    "`operatorLiveBridgeHealthConsistencyValidated=true`",
    "`operatorStartupDiagnosticsValidated=true`",
    "`operatorTurnTruncationSummaryValidated=true`",
    "`operatorTurnTruncationExpectedEventSeen=true`",
    "`operatorTurnTruncationTotal >= 1`",
    "`operatorTurnTruncationUniqueRuns >= 1`",
    "`operatorTurnTruncationUniqueSessions >= 1`",
    "`operatorTurnTruncationLatestSeenAt` is ISO timestamp",
    "`operatorTurnDeleteSummaryValidated=true`",
    "`operatorTurnDeleteExpectedEventSeen=true`",
    "`operatorTurnDeleteTotal >= 1`",
    "`operatorTurnDeleteUniqueRuns >= 1`",
    "`operatorTurnDeleteUniqueSessions >= 1`",
    "`operatorTurnDeleteLatestSeenAt` is ISO timestamp",
    "`operatorDamageControlSummaryValidated=true`",
    "`operatorDamageControlTotal >= 1`",
    "`operatorDamageControlMatchedRuleCountTotal >= 1`",
    "`operatorDamageControlLatestSeenAt` is ISO timestamp",
    "`assistantActivityLifecycleValidated=true`",
    "`liveContextCompactionValidated=true`",
    "`gatewayItemTruncateValidated=true`",
    "`gatewayItemDeleteValidated=true`",
    "`artifacts/demo-e2e/badge-details.json`",
    "`evidence.operatorTurnDelete`",
    "`evidence.operatorTurnTruncation`",
    "`evidence.operatorDamageControl`",
    "`gate.evidenceSnapshot.operatorDamageControlSummaryValidated`",
    "`gate.evidenceSnapshot.badgeEvidenceOperatorDamageControlStatus`",
    "`analyticsSplitTargetsValidated=true`",
    "`analyticsBigQueryConfigValidated=true`",
    "`kpi.analyticsServicesValidated >= 4`",
    "`kpi.analyticsRequestedEnabledServices >= 4`",
    "`kpi.analyticsEnabledServices >= 4`",
    "`operatorLiveBridgeHealthState in {healthy,degraded,unknown}`",
    "`storytellerMediaQueueWorkers >= 1`",
    "`storytellerCacheHits >= 1`",
    "`options.scenarioRetryMaxAttempts >= 2`",
    "`options.scenarioRetryBackoffMs >= 500`",
    "`kpi.scenarioRetriesUsedCount <= 2`",
    "`kpi.scenarioRetriesUsedCount = 0`",
    "`kpi.liveTranslationScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.liveNegotiationScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.liveContextCompactionScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.storytellerPipelineScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.uiSandboxPolicyModesScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.gatewayWsRoundTripScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.gatewayInterruptSignalScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.gatewayItemTruncateScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.gatewayItemDeleteScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.gatewayTaskProgressScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.gatewayRequestReplayScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.gatewayInvalidEnvelopeScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.gatewayBindingMismatchScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.gatewayDrainingRejectionScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.multiAgentDelegationScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.operatorDeviceNodesLifecycleScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.approvalsListScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.approvalsInvalidIntentScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.sessionVersioningScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.uiVisualTestingScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.operatorConsoleActionsScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.runtimeLifecycleScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.runtimeMetricsScenarioAttempts <= options.scenarioRetryMaxAttempts`",
    "`kpi.scenarioRetryableFailuresTotal >= 0`",
    "`workload.live.p95`",
    "`workload.ui.p95`",
    "`workload.gateway_replay.p95`",
    "`workload.gateway_replay.errorRatePct`",
    "`aggregate.errorRatePct`",
    "`workload.gateway_replay.contract.responseIdReusedAll`",
    "`workload.gateway_replay.contract.taskStartedExactlyOneAll`",
    "`workload.ui.adapterMode.remote_http`",
  ];

  for (const token of requiredRunbookTokens) {
    assert.ok(runbookSource.includes(token), `runbook missing token: ${token}`);
  }
});

test("runbook critical evidence list is aligned with release-readiness checks", () => {
  const releasePath = resolve(process.cwd(), "scripts", "release-readiness.ps1");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");

  const releaseSource = readFileSync(releasePath, "utf8");
  const runbookSource = readFileSync(runbookPath, "utf8");

  const criticalKpis = parseCriticalKpiKeys(releaseSource);
  const requiredPerfPolicyChecks = parseRequiredPerfPolicyChecks(releaseSource);

  const requiredCriticalKpis = [
    "operatorAuditTrailValidated",
    "operatorTraceCoverageValidated",
    "operatorLiveBridgeHealthBlockValidated",
    "operatorLiveBridgeProbeTelemetryValidated",
    "operatorTurnTruncationSummaryValidated",
    "operatorTurnTruncationExpectedEventSeen",
    "operatorTurnDeleteSummaryValidated",
    "operatorTurnDeleteExpectedEventSeen",
    "operatorDamageControlSummaryValidated",
    "assistantActivityLifecycleValidated",
    "liveContextCompactionValidated",
    "gatewayItemTruncateValidated",
    "gatewayItemDeleteValidated",
    "storytellerVideoAsyncValidated",
    "storytellerMediaQueueVisible",
    "storytellerMediaQueueQuotaValidated",
    "storytellerCacheEnabled",
    "storytellerCacheHitValidated",
    "storytellerCacheInvalidationValidated",
  ];

  for (const kpi of requiredCriticalKpis) {
    assert.ok(criticalKpis.includes(kpi), `release-readiness missing critical KPI gate: ${kpi}`);
    assert.ok(
      runbookSource.includes(`\`${kpi}=true\``),
      `runbook missing critical KPI documentation: ${kpi}=true`,
    );
  }

  const requiredPerfChecks = [
    "workload.live.p95",
    "workload.ui.p95",
    "workload.gateway_replay.p95",
    "workload.gateway_replay.errorRatePct",
    "aggregate.errorRatePct",
    "workload.gateway_replay.contract.responseIdReusedAll",
    "workload.gateway_replay.contract.taskStartedExactlyOneAll",
    "workload.ui.adapterMode.remote_http",
  ];

  for (const checkName of requiredPerfChecks) {
    assert.ok(
      requiredPerfPolicyChecks.includes(checkName),
      `release-readiness missing required perf policy check: ${checkName}`,
    );
    assert.ok(runbookSource.includes(`\`${checkName}\``), `runbook missing perf policy check doc: ${checkName}`);
  }
});
