import test from "node:test";
import assert from "node:assert/strict";
import {
  createEnvelope,
  createNormalizedError,
  LIVE_CAPABILITY_FLAGS,
  LIVE_CONNECTION_MODES,
  RollingMetrics,
  safeParseEnvelope,
  UI_FAILURE_CLASSES,
  UI_VERIFICATION_STATES,
  type LiveCapabilitiesSnapshot,
  type LiveRuntimeStatus,
  type RuntimeLiveSessionEventIngestRequest,
  type RuntimeLiveSessionEventIngestResponse,
  type LiveSessionTokenResponse,
} from "../../shared/contracts/src/index.js";

test("createEnvelope + safeParseEnvelope roundtrip", () => {
  const envelope = createEnvelope({
    userId: "user-1",
    sessionId: "session-1",
    runId: "run-1",
    conversation: "default",
    metadata: {
      clientEventId: "evt-123",
    },
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: { text: "hello" },
    },
  });

  const parsed = safeParseEnvelope(JSON.stringify(envelope));
  assert.ok(parsed, "safeParseEnvelope should parse valid envelope");
  assert.equal(parsed?.id, envelope.id);
  assert.equal(parsed?.sessionId, "session-1");
  assert.equal(parsed?.type, "orchestrator.request");
  assert.equal(parsed?.conversation, "default");
  assert.equal((parsed?.metadata as { clientEventId?: string })?.clientEventId, "evt-123");
});

test("safeParseEnvelope rejects malformed payload", () => {
  const invalid = JSON.stringify({
    id: "x",
    source: "frontend",
    ts: new Date().toISOString(),
    payload: {},
  });
  const parsed = safeParseEnvelope(invalid);
  assert.equal(parsed, null);
});

test("ui verification states and failure classes are exposed as shared contract constants", () => {
  assert.deepEqual(UI_VERIFICATION_STATES, [
    "verified",
    "partially_verified",
    "unverified",
    "blocked_pending_approval",
  ]);
  for (const token of [
    "approval_required",
    "approval_rejected",
    "damage_control_blocked",
    "device_node_unavailable",
    "execution_failed",
    "loop_detected",
    "missing_grounding",
    "sandbox_blocked",
    "stale_grounding",
    "verification_failed",
    "visual_regression",
  ]) {
    assert.ok(UI_FAILURE_CLASSES.includes(token as (typeof UI_FAILURE_CLASSES)[number]));
  }
});

test("live direct mode contracts are exposed as shared contract constants and typed shapes", () => {
  assert.deepEqual(LIVE_CONNECTION_MODES, ["relay", "direct_live"]);
  assert.deepEqual(LIVE_CAPABILITY_FLAGS, [
    "audioInput",
    "audioOutput",
    "videoInput",
    "screenInput",
    "toolCalls",
    "interruptions",
    "translation",
    "reconnectSupported",
  ]);

  const capabilities: LiveCapabilitiesSnapshot = {
    audioInput: true,
    audioOutput: true,
    videoInput: true,
    screenInput: false,
    toolCalls: true,
    interruptions: true,
    translation: true,
    reconnectSupported: true,
  };

  const tokenResponse: LiveSessionTokenResponse = {
    provider: "gemini",
    model: "gemini-live-2.5-flash",
    connectionMode: "direct_live",
    expiresAt: "2026-04-08T12:00:00.000Z",
    sessionToken: "live-session-token",
    sessionId: "live-session-1",
    capabilities,
    fallbackMode: "relay",
    warnings: ["relay fallback remains available"],
  };

  const runtimeStatus: LiveRuntimeStatus = {
    preferredMode: "direct_live",
    activeMode: "relay",
    provider: "gemini",
    model: "gemini-live-2.5-flash",
    ephemeralTokensSupported: true,
    fallbackAvailable: true,
    lastFallbackReason: "direct_live_not_available_for_browser",
    capabilities,
  };

  assert.equal(tokenResponse.connectionMode, "direct_live");
  assert.equal(tokenResponse.capabilities.audioInput, true);
  assert.equal(runtimeStatus.activeMode, "relay");
  assert.equal(runtimeStatus.fallbackAvailable, true);
});

test("direct-live replay ingest contracts expose a stable browser-to-backend proof shape", () => {
  const ingestRequest: RuntimeLiveSessionEventIngestRequest = {
    sessionId: "live-session-1",
    runId: "run-live-1",
    conversation: "default",
    source: "direct_live",
    type: "gateway.connected",
    ts: "2026-04-08T12:01:00.000Z",
    payload: {
      route: "live-agent",
      status: "connected",
      intent: "translation",
      liveTransport: {
        activeMode: "direct_live",
        provider: "gemini_live_api",
        model: "gemini-live-2.5-flash-native-audio",
        bootstrapState: "prepared_direct",
      },
    },
  };
  const ingestResponse: RuntimeLiveSessionEventIngestResponse = {
    accepted: true,
    eventId: "evt-direct-proof-1",
    sessionId: "live-session-1",
    runId: "run-live-1",
    source: "direct_live",
    createdAt: "2026-04-08T12:01:00.000Z",
  };

  assert.equal(ingestRequest.source, "direct_live");
  const liveTransportPayload = (ingestRequest.payload as { liveTransport?: { activeMode?: string } } | undefined)
    ?.liveTransport;
  assert.equal(liveTransportPayload?.activeMode, "direct_live");
  assert.equal(ingestResponse.accepted, true);
  assert.equal(ingestResponse.source, "direct_live");
});

test("task metadata roundtrips ui verification state and failure class", () => {
  const envelope = createEnvelope({
    userId: "task-user",
    sessionId: "session-task",
    runId: "run-task",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "ui_task",
      input: { goal: "Open settings and verify account controls" },
      task: {
        taskId: "task-123",
        status: "pending_approval",
        stage: "verification",
        route: "ui-navigator-agent",
        verificationState: "blocked_pending_approval",
        verificationFailureClass: "approval_required",
        verificationSummary: "Waiting for approval before executing the UI action.",
      },
    },
  });

  const parsed = safeParseEnvelope(JSON.stringify(envelope));
  assert.ok(parsed, "safeParseEnvelope should parse valid task envelope");
  const payload = parsed?.payload as {
    task?: {
      taskId?: string;
      status?: string;
      stage?: string;
      route?: string | null;
      verificationState?: string;
      verificationFailureClass?: string | null;
      verificationSummary?: string;
    };
  };
  assert.equal(payload.task?.taskId, "task-123");
  assert.equal(payload.task?.status, "pending_approval");
  assert.equal(payload.task?.stage, "verification");
  assert.equal(payload.task?.route, "ui-navigator-agent");
  assert.equal(payload.task?.verificationState, "blocked_pending_approval");
  assert.equal(payload.task?.verificationFailureClass, "approval_required");
  assert.equal(payload.task?.verificationSummary, "Waiting for approval before executing the UI action.");
});

test("ui verification evidence shape carries explicit post-action verification intent", () => {
  const envelope = createEnvelope({
    userId: "verification-user",
    sessionId: "verification-session",
    runId: "verification-run",
    type: "orchestrator.response",
    source: "ui-navigator-agent",
    payload: {
      route: "ui-navigator-agent",
      status: "completed",
      output: {
        verification: {
          state: "partially_verified",
          failureClass: "verification_failed",
          summary: "Action steps completed without enough verification evidence.",
          recoveryHint: "Add a clearer post-action verify step or rerun with stronger grounding.",
          evidence: {
            traceSteps: 3,
            completedSteps: 2,
            plannedVerifySteps: 1,
            verifySteps: 0,
            verificationRequested: true,
            blockedSteps: 0,
            screenshotRefs: ["ui://trace/1.png"],
            groundingSignals: {
              screenshotRefProvided: false,
              domSnapshotProvided: true,
              accessibilityTreeProvided: true,
              markHintsCount: 1,
              refMapCount: 0,
              actionableRefIds: [],
              staleRefTargets: [],
            },
            visualChecks: 0,
            visualRegressions: 0,
          },
        },
      },
    },
  });

  const parsed = safeParseEnvelope(JSON.stringify(envelope));
  assert.ok(parsed);
  const payload = parsed?.payload as { output?: { verification?: { evidence?: Record<string, unknown> } } };
  assert.equal(payload.output?.verification?.evidence?.plannedVerifySteps, 1);
  assert.equal(payload.output?.verification?.evidence?.verificationRequested, true);
});

test("createNormalizedError always emits traceId", () => {
  const normalized = createNormalizedError({
    code: "TEST_ERROR",
    message: "failure",
  });
  assert.equal(normalized.code, "TEST_ERROR");
  assert.equal(normalized.message, "failure");
  assert.ok(typeof normalized.traceId === "string" && normalized.traceId.length > 10);
});

test("rolling metrics onRecord hook receives normalized samples", () => {
  const records: Array<{ operation: string; durationMs: number; ok: boolean }> = [];
  const metrics = new RollingMetrics({
    maxSamplesPerBucket: 50,
    onRecord: (entry) => {
      records.push({
        operation: entry.operation,
        durationMs: entry.durationMs,
        ok: entry.ok,
      });
    },
  });

  metrics.record("GET /healthz", 10.9, true);
  metrics.record("GET /healthz", -5, false);

  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    operation: "GET /healthz",
    durationMs: 10,
    ok: true,
  });
  assert.deepEqual(records[1], {
    operation: "GET /healthz",
    durationMs: 0,
    ok: false,
  });
});
