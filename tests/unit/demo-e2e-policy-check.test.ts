import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

type PolicyRunResult = {
  exitCode: number;
  payload: Record<string, unknown>;
};

const policyScriptPath = resolve(process.cwd(), "scripts", "demo-e2e-policy-check.mjs");

const requiredScenarioNames = [
  "live.translation",
  "live.negotiation",
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
];

function createPassingSummary(overrides?: {
  kpis?: Record<string, unknown>;
  options?: Record<string, unknown>;
  scenarios?: Array<Record<string, unknown>>;
}): Record<string, unknown> {
  const scenarios =
    overrides?.scenarios ??
    requiredScenarioNames.map((name) => ({
      name,
      status: "passed",
      elapsedMs: name === "ui.approval.approve_resume" ? 12_000 : 50,
      data: {},
    }));

  const kpis: Record<string, unknown> = {
    negotiationConstraintsSatisfied: true,
    negotiationRequiresUserConfirmation: true,
    storytellerMediaMode: "simulated",
    storytellerVideoAsync: true,
    storytellerVideoJobsCount: 1,
    storytellerVideoPendingCount: 1,
    storytellerVideoAsyncValidated: true,
    storytellerMediaQueueVisible: true,
    storytellerMediaQueueWorkers: 1,
    storytellerMediaQueueQuotaEntries: 1,
    storytellerMediaQueueQuotaModelSeen: true,
    storytellerMediaQueueQuotaValidated: true,
    storytellerCacheEnabled: true,
    storytellerCacheHits: 1,
    storytellerCacheHitValidated: true,
    storytellerCacheInvalidationValidated: true,
    gatewayWsResponseStatus: "completed",
    gatewayInterruptHandled: true,
    gatewayInterruptEventType: "live.interrupt.requested",
    gatewayInterruptLatencyMs: 120,
    gatewayWsInvalidEnvelopeCode: "GATEWAY_INVALID_ENVELOPE",
    gatewayWsSessionMismatchCode: "GATEWAY_SESSION_MISMATCH",
    gatewayWsUserMismatchCode: "GATEWAY_USER_MISMATCH",
    gatewayWsBindingMismatchValidated: true,
    gatewayWsDrainingCode: "GATEWAY_DRAINING",
    gatewayWsDrainingTraceIdPresent: true,
    gatewayWsDrainingRecoveryStatus: "completed",
    gatewayWsDrainingValidated: true,
    operatorActionsValidated: true,
    operatorAuditTrailValidated: true,
    operatorTraceCoverageValidated: true,
    operatorLiveBridgeHealthBlockValidated: true,
    operatorLiveBridgeProbeTelemetryValidated: true,
    operatorLiveBridgeHealthState: "healthy",
    operatorLiveBridgeHealthConnectTimeoutEvents: 0,
    operatorLiveBridgeHealthProbeStartedEvents: 0,
    operatorLiveBridgeHealthPingSentEvents: 0,
    operatorLiveBridgeHealthPongEvents: 0,
    operatorLiveBridgeHealthPingErrorEvents: 0,
    operatorTaskQueueSummaryValidated: true,
    operatorTaskQueuePressureLevel: "healthy",
    operatorTaskQueueTotal: 1,
    operatorTaskQueueStaleCount: 0,
    operatorTaskQueuePendingApproval: 0,
    operatorFailoverForbiddenCode: "API_OPERATOR_ADMIN_REQUIRED",
    operatorFailoverDrainState: "draining",
    operatorFailoverWarmupState: "ready",
    operatorFailoverUiExecutorDrainState: "draining",
    operatorFailoverUiExecutorWarmupState: "ready",
    operatorFailoverUiExecutorValidated: true,
    operatorDeviceNodeLookupValidated: true,
    operatorDeviceNodeLookupStatus: "degraded",
    operatorDeviceNodeLookupVersion: 3,
    operatorDeviceNodeCreatedVersion: 1,
    operatorDeviceNodeUpdatedVersion: 2,
    operatorDeviceNodeVersionConflictValidated: true,
    operatorDeviceNodeVersionConflictStatusCode: 409,
    operatorDeviceNodeVersionConflictCode: "API_DEVICE_NODE_VERSION_CONFLICT",
    operatorDeviceNodeHealthSummaryValidated: true,
    operatorDeviceNodeSummaryTotal: 1,
    operatorDeviceNodeSummaryDegraded: 1,
    operatorDeviceNodeSummaryRecentContainsLookup: true,
    approvalsInvalidIntentStatusCode: 400,
    approvalsInvalidIntentCode: "API_INVALID_INTENT",
    approvalsRecorded: 2,
    sessionVersioningValidated: true,
    sessionVersionConflictCode: "API_SESSION_VERSION_CONFLICT",
    sessionIdempotencyReplayOutcome: "idempotent_replay",
    sessionIdempotencyConflictCode: "API_SESSION_IDEMPOTENCY_CONFLICT",
    uiAdapterMode: "remote_http",
    uiExecutorMode: "remote_http",
    uiExecutorForceSimulation: true,
    uiExecutorRuntimeValidated: true,
    uiExecutorLifecycleValidated: true,
    uiApprovalResumeRequestAttempts: 1,
    uiApprovalResumeRequestRetried: false,
    sandboxPolicyValidated: true,
    visualTestingStatus: "passed",
    visualRegressionCount: 0,
    visualChecksCount: 3,
    visualComparatorMode: "fallback_heuristic",
    visualTestingValidated: true,
    uiGroundingDomSeen: true,
    uiGroundingAccessibilitySeen: true,
    uiGroundingMarkHintsCount: 2,
    uiGroundingAdapterNoteSeen: true,
    uiGroundingSignalsValidated: true,
    gatewayWsRoundTripMs: 120,
    sessionRunBindingValidated: true,
    sessionStateTransitionsObserved: 3,
    taskProgressEventsObserved: 1,
    activeTasksVisible: 1,
    gatewayRequestReplayValidated: true,
    translationProvider: "fallback",
    lifecycleEndpointsValidated: true,
    runtimeProfileValidated: true,
    analyticsRuntimeVisible: true,
    analyticsServicesValidated: 4,
    transportModeValidated: true,
    transportServicesValidated: 1,
    gatewayTransportRequestedMode: "websocket",
    gatewayTransportActiveMode: "websocket",
    gatewayTransportFallbackActive: false,
    metricsEndpointsValidated: true,
    metricsServicesValidated: 4,
    capabilityAdaptersValidated: true,
    ...(overrides?.kpis ?? {}),
  };

  return {
    generatedAt: new Date().toISOString(),
    success: true,
    scenarios,
    kpis,
    options: {
      uiNavigatorRemoteHttpFallbackMode: "failed",
      serviceStartMaxAttempts: 2,
      serviceStartRetryBackoffMs: 1200,
      ...(overrides?.options ?? {}),
    },
  };
}

function parseJsonFromStream(streamValue: string): Record<string, unknown> {
  const lines = streamValue
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const lastLine = lines[lines.length - 1];
  return JSON.parse(lastLine) as Record<string, unknown>;
}

function runPolicyCheck(summary: Record<string, unknown>): PolicyRunResult {
  const tempDir = mkdtempSync(join(tmpdir(), "mla-policy-check-"));
  try {
    const inputPath = join(tempDir, "summary.json");
    const markdownOutputPath = join(tempDir, "policy-check.md");
    const jsonOutputPath = join(tempDir, "policy-check.json");
    writeFileSync(inputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

    const result = spawnSync(
      process.execPath,
      [policyScriptPath, "--input", inputPath, "--output", markdownOutputPath, "--jsonOutput", jsonOutputPath],
      {
        encoding: "utf8",
      },
    );
    const exitCode = result.status ?? 1;
    const payloadSource = exitCode === 0 ? result.stdout : result.stderr;
    const payload = parseJsonFromStream(payloadSource);
    return { exitCode, payload };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test("demo-e2e policy check passes with baseline passing summary", () => {
  const result = runPolicyCheck(createPassingSummary());
  assert.equal(result.exitCode, 0, JSON.stringify(result.payload));
  assert.equal(result.payload.ok, true);
  assert.equal(result.payload.checks, 134);
});

test("demo-e2e policy check fails when approval resume attempts exceed threshold", () => {
  const result = runPolicyCheck(
    createPassingSummary({
      kpis: {
        uiApprovalResumeRequestAttempts: 3,
      },
    }),
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.payload.ok, false);
  const details = result.payload.details as Record<string, unknown>;
  assert.ok(Array.isArray(details?.violations));
  const violations = details.violations as string[];
  assert.ok(violations.some((item) => item.includes("kpi.uiApprovalResumeRequestAttempts")));
});

test("demo-e2e policy check fails when approve-resume scenario exceeds elapsed threshold", () => {
  const summary = createPassingSummary();
  const scenarios = (summary.scenarios as Array<Record<string, unknown>>).map((item) =>
    item.name === "ui.approval.approve_resume" ? { ...item, elapsedMs: 80_001 } : item,
  );
  summary.scenarios = scenarios;

  const result = runPolicyCheck(summary);
  assert.equal(result.exitCode, 1);
  assert.equal(result.payload.ok, false);
  const details = result.payload.details as Record<string, unknown>;
  assert.ok(Array.isArray(details?.violations));
  const violations = details.violations as string[];
  assert.ok(violations.some((item) => item.includes("scenario.ui.approval.approve_resume.elapsedMs")));
});

test("demo-e2e policy check fails when ui remote fallback mode is not strict", () => {
  const result = runPolicyCheck(
    createPassingSummary({
      options: {
        uiNavigatorRemoteHttpFallbackMode: "simulated",
      },
    }),
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.payload.ok, false);
  const details = result.payload.details as Record<string, unknown>;
  assert.ok(Array.isArray(details?.violations));
  const violations = details.violations as string[];
  assert.ok(violations.some((item) => item.includes("options.uiNavigatorRemoteHttpFallbackMode")));
});

test("demo-e2e policy check fails when interrupt latency is missing for requested interrupt event", () => {
  const result = runPolicyCheck(
    createPassingSummary({
      kpis: {
        gatewayInterruptLatencyMs: null,
      },
    }),
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.payload.ok, false);
  const details = result.payload.details as Record<string, unknown>;
  assert.ok(Array.isArray(details?.violations));
  const violations = details.violations as string[];
  assert.ok(violations.some((item) => item.includes("kpi.gatewayInterruptLatencyObservedOrUnavailable")));
});

test("demo-e2e policy check fails when service startup retry config is too low", () => {
  const result = runPolicyCheck(
    createPassingSummary({
      options: {
        serviceStartMaxAttempts: 1,
      },
    }),
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.payload.ok, false);
  const details = result.payload.details as Record<string, unknown>;
  assert.ok(Array.isArray(details?.violations));
  const violations = details.violations as string[];
  assert.ok(violations.some((item) => item.includes("options.serviceStartMaxAttempts")));
});

test("demo-e2e policy check fails when operator.device_nodes.lifecycle scenario is missing", () => {
  const summary = createPassingSummary();
  summary.scenarios = (summary.scenarios as Array<Record<string, unknown>>).filter(
    (item) => item.name !== "operator.device_nodes.lifecycle",
  );

  const result = runPolicyCheck(summary);
  assert.equal(result.exitCode, 1);
  assert.equal(result.payload.ok, false);
  const details = result.payload.details as Record<string, unknown>;
  assert.ok(Array.isArray(details?.violations));
  const violations = details.violations as string[];
  assert.ok(violations.some((item) => item.includes("scenario.operator.device_nodes.lifecycle")));
});

test("demo-e2e policy check fails when session versioning KPI is invalid", () => {
  const result = runPolicyCheck(
    createPassingSummary({
      kpis: {
        sessionVersioningValidated: false,
      },
    }),
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.payload.ok, false);
  const details = result.payload.details as Record<string, unknown>;
  assert.ok(Array.isArray(details?.violations));
  const violations = details.violations as string[];
  assert.ok(violations.some((item) => item.includes("kpi.sessionVersioningValidated")));
});

test("demo-e2e policy check fails when gateway websocket binding mismatch KPI is invalid", () => {
  const result = runPolicyCheck(
    createPassingSummary({
      kpis: {
        gatewayWsBindingMismatchValidated: false,
      },
    }),
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.payload.ok, false);
  const details = result.payload.details as Record<string, unknown>;
  assert.ok(Array.isArray(details?.violations));
  const violations = details.violations as string[];
  assert.ok(violations.some((item) => item.includes("kpi.gatewayWsBindingMismatchValidated")));
});

test("demo-e2e policy check fails when gateway websocket draining KPI is invalid", () => {
  const result = runPolicyCheck(
    createPassingSummary({
      kpis: {
        gatewayWsDrainingValidated: false,
      },
    }),
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.payload.ok, false);
  const details = result.payload.details as Record<string, unknown>;
  assert.ok(Array.isArray(details?.violations));
  const violations = details.violations as string[];
  assert.ok(violations.some((item) => item.includes("kpi.gatewayWsDrainingValidated")));
});

test("demo-e2e policy check fails when ui-executor runtime profile is invalid", () => {
  const result = runPolicyCheck(
    createPassingSummary({
      kpis: {
        uiExecutorRuntimeValidated: false,
      },
    }),
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.payload.ok, false);
  const details = result.payload.details as Record<string, unknown>;
  assert.ok(Array.isArray(details?.violations));
  const violations = details.violations as string[];
  assert.ok(violations.some((item) => item.includes("kpi.uiExecutorRuntimeValidated")));
});

test("demo-e2e policy check fails when ui-executor lifecycle KPI is invalid", () => {
  const result = runPolicyCheck(
    createPassingSummary({
      kpis: {
        uiExecutorLifecycleValidated: false,
      },
    }),
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.payload.ok, false);
  const details = result.payload.details as Record<string, unknown>;
  assert.ok(Array.isArray(details?.violations));
  const violations = details.violations as string[];
  assert.ok(violations.some((item) => item.includes("kpi.uiExecutorLifecycleValidated")));
});

test("demo-e2e policy check fails when operator ui-executor failover KPI is invalid", () => {
  const result = runPolicyCheck(
    createPassingSummary({
      kpis: {
        operatorFailoverUiExecutorValidated: false,
      },
    }),
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.payload.ok, false);
  const details = result.payload.details as Record<string, unknown>;
  assert.ok(Array.isArray(details?.violations));
  const violations = details.violations as string[];
  assert.ok(violations.some((item) => item.includes("kpi.operatorFailoverUiExecutorValidated")));
});

test("demo-e2e policy check fails when operator task queue KPI is invalid", () => {
  const result = runPolicyCheck(
    createPassingSummary({
      kpis: {
        operatorTaskQueueSummaryValidated: false,
      },
    }),
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.payload.ok, false);
  const details = result.payload.details as Record<string, unknown>;
  assert.ok(Array.isArray(details?.violations));
  const violations = details.violations as string[];
  assert.ok(violations.some((item) => item.includes("kpi.operatorTaskQueueSummaryValidated")));
});
