import test from "node:test";
import assert from "node:assert/strict";
import {
  CASE_WIKI_ENTITY_KINDS,
  CASE_WIKI_NEXT_ACTION_TYPES,
  CASE_WIKI_PRIORITIES,
  CASE_WIKI_PROOF_STATUSES,
  CASE_WIKI_ROUTING_ACTION_IDS,
  CASE_WIKI_ROUTING_FOCUS_KINDS,
  CASE_WIKI_ROUTING_LANES,
  CASE_WIKI_STATUSES,
  CASE_WIKI_TIMELINE_ENTRY_KINDS,
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
  type RuntimeCaseWikiNoteRequest,
  type RuntimeCaseWikiNoteResponse,
  type RuntimeLiveSessionEventIngestRequest,
  type RuntimeLiveSessionEventIngestResponse,
  type CaseWiki,
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

test("case wiki contracts expose stable structured memory shapes", () => {
  assert.deepEqual(CASE_WIKI_STATUSES, [
    "active",
    "waiting_on_customer",
    "waiting_on_operator",
    "blocked",
    "resolved",
  ]);
  assert.deepEqual(CASE_WIKI_ENTITY_KINDS, [
    "person",
    "company",
    "document",
    "appointment",
    "policy",
    "requirement",
    "task",
    "location",
    "system",
    "case",
  ]);
  assert.deepEqual(CASE_WIKI_TIMELINE_ENTRY_KINDS, [
    "session",
    "operator_note",
    "approval",
    "workflow",
    "document",
    "task",
    "system",
  ]);
  assert.deepEqual(CASE_WIKI_PROOF_STATUSES, ["confirmed", "pending", "contradicted", "missing"]);
  assert.deepEqual(CASE_WIKI_PRIORITIES, ["low", "medium", "high"]);
  assert.deepEqual(CASE_WIKI_NEXT_ACTION_TYPES, [
    "operator_followup",
    "approval_request",
    "document_request",
    "workflow_resume",
    "ui_task",
    "live_followup",
  ]);
  assert.deepEqual(CASE_WIKI_ROUTING_FOCUS_KINDS, ["proof", "question"]);
  assert.deepEqual(CASE_WIKI_ROUTING_LANES, [
    "approval_queue",
    "customer_followup",
    "workflow_resume",
    "ui_task",
    "live_followup",
    "operator_followup",
  ]);
  assert.deepEqual(CASE_WIKI_ROUTING_ACTION_IDS, [
    "open_workflow_control",
    "run_negotiation",
    "run_ui_task",
    "refresh_summary",
  ]);

  const wiki: CaseWiki = {
    schemaVersion: 1,
    caseId: "case-123",
    sessionId: "session-123",
    userId: "user-123",
    generatedAt: "2026-04-09T07:00:00.000Z",
    overview: {
      title: "Visa intake for spouse relocation",
      summary: "Customer is evaluating a relocation package and waiting on document guidance.",
      status: "waiting_on_customer",
      customerGoal: "Collect missing visa documents and book a consultation.",
      currentStage: "document_collection",
      lastMeaningfulUpdateAt: "2026-04-09T06:58:00.000Z",
      activeLanguage: "en",
      missingEvidenceSummary: "Passport scan and invitation letter are still missing.",
      contradictionsSummary: null,
    },
    highlights: {
      topProof: {
        id: "proof-1",
        statement: "Customer wants a spouse relocation consultation.",
        status: "confirmed",
        confidence: 0.96,
        evidenceSummary: "Confirmed in the latest live intake.",
        contradictionNote: null,
        sourceRefs: ["session:session-123"],
      },
      topEntity: {
        id: "entity-customer",
        kind: "person",
        label: "Primary applicant",
        role: "customer",
        description: "Applicant relocating with spouse.",
        confidence: 0.98,
        sourceRefs: ["session:session-123", "note:operator-1"],
      },
      topBlockingQuestion: {
        id: "question-1",
        question: "Has the customer already received the invitation letter?",
        priority: "high",
        blocking: true,
        owner: "customer",
        suggestedNextStep: "Request the invitation letter or confirm issuance status.",
        sourceRefs: ["proof:proof-1"],
      },
    },
    evidencePack: {
      proofs: [
        {
          id: "proof-1",
          statement: "Customer wants a spouse relocation consultation.",
          status: "confirmed",
          confidence: 0.96,
          evidenceSummary: "Confirmed in the latest live intake.",
          contradictionNote: null,
          sourceRefs: ["session:session-123"],
        },
      ],
      entities: [
        {
          id: "entity-customer",
          kind: "person",
          label: "Primary applicant",
          role: "customer",
          description: "Applicant relocating with spouse.",
          confidence: 0.98,
          sourceRefs: ["session:session-123", "note:operator-1"],
        },
      ],
      questions: [
        {
          id: "question-1",
          question: "Has the customer already received the invitation letter?",
          priority: "high",
          blocking: true,
          owner: "customer",
          suggestedNextStep: "Request the invitation letter or confirm issuance status.",
          sourceRefs: ["proof:proof-1"],
        },
      ],
      sourceRefs: ["session:session-123", "note:operator-1", "proof:proof-1"],
    },
    handoffPack: {
      proofs: [
        {
          focusKind: "proof",
          focusId: "proof-1",
          focusLabel: "Customer wants a spouse relocation consultation.",
          handoff: [
            "Focus proof: Customer wants a spouse relocation consultation.",
            "Evidence: Confirmed in the latest live intake.",
            "Next: Request missing visa documents",
            "Refs: session:session-123",
          ].join("\n"),
          detail: {
            status: "confirmed",
            confidence: 0.96,
            evidenceSummary: "Confirmed in the latest live intake.",
            contradictionNote: null,
            priority: null,
            blocking: true,
            owner: "operator",
            suggestedNextStep: null,
          },
          sourceRefs: ["session:session-123"],
          nextAction: {
            type: "document_request",
            title: "Request missing visa documents",
            summary: "Ask the customer for the passport scan and invitation letter before scheduling filing.",
            owner: "operator",
            dueBy: null,
            blocking: true,
            relatedQuestionIds: ["question-1"],
            sourceRefs: ["question:question-1", "timeline:timeline-1"],
          },
        },
      ],
      questions: [
        {
          focusKind: "question",
          focusId: "question-1",
          focusLabel: "Has the customer already received the invitation letter?",
          handoff: [
            "Focus question: Has the customer already received the invitation letter?",
            "Resolve: Request the invitation letter or confirm issuance status.",
            "Owner: customer",
            "Next: Request missing visa documents",
            "Refs: proof:proof-1",
          ].join("\n"),
          detail: {
            status: "open",
            confidence: null,
            evidenceSummary: null,
            contradictionNote: null,
            priority: "high",
            blocking: true,
            owner: "customer",
            suggestedNextStep: "Request the invitation letter or confirm issuance status.",
          },
          sourceRefs: ["proof:proof-1"],
          nextAction: {
            type: "document_request",
            title: "Request missing visa documents",
            summary: "Ask the customer for the passport scan and invitation letter before scheduling filing.",
            owner: "operator",
            dueBy: null,
            blocking: true,
            relatedQuestionIds: ["question-1"],
            sourceRefs: ["question:question-1", "timeline:timeline-1"],
          },
        },
      ],
    },
    detailPack: {
      proofs: [
        {
          focusKind: "proof",
          focusId: "proof-1",
          focusLabel: "Customer wants a spouse relocation consultation.",
          title: "Customer wants a spouse relocation consultation.",
          meta: "Confirmed | confidence 96% | refs: session:session-123",
          body: "Confirmed in the latest live intake.",
          badges: [
            { tone: "ok", label: "Confirmed" },
            { tone: "neutral", label: "confidence 96%" },
            { tone: "ok", label: "refs 1" },
          ],
          sourceRefs: ["session:session-123"],
        },
      ],
      questions: [
        {
          focusKind: "question",
          focusId: "question-1",
          focusLabel: "Has the customer already received the invitation letter?",
          title: "Has the customer already received the invitation letter?",
          meta: "High | Blocking | owner: customer | refs: proof:proof-1",
          body: "Request the invitation letter or confirm issuance status.",
          badges: [
            { tone: "watch", label: "High" },
            { tone: "watch", label: "Blocking" },
            { tone: "ok", label: "owner customer" },
            { tone: "ok", label: "refs 1" },
          ],
          sourceRefs: ["proof:proof-1"],
        },
      ],
    },
    routingPack: {
      proofs: [
        {
          focusKind: "proof",
          focusId: "proof-1",
          focusLabel: "Customer wants a spouse relocation consultation.",
          route: {
            lane: "customer_followup",
            owner: "operator",
            priority: "low",
            status: "confirmed",
            blocking: true,
            approvalRequired: false,
            dueBy: null,
            summary: "Customer followup | owner: operator | priority: Low | blocking",
          },
          cta: {
            actionId: "run_negotiation",
            label: "Prepare customer follow-up",
            hint: "Use the live follow-up lane to request the missing proof and attach the focused refs.",
            owner: "operator",
            lane: "customer_followup",
            approvalRequired: false,
            blocking: true,
            summary: "Prepare customer follow-up | owner: operator | focus: Customer wants a spouse relocation consultation.",
          },
          sourceRefs: ["session:session-123"],
          relatedQuestionIds: ["question-1"],
          nextAction: {
            type: "document_request",
            title: "Request missing visa documents",
            summary: "Ask the customer for the passport scan and invitation letter before scheduling filing.",
            owner: "operator",
            dueBy: null,
            blocking: true,
            relatedQuestionIds: ["question-1"],
            sourceRefs: ["question:question-1", "timeline:timeline-1"],
          },
        },
      ],
      questions: [
        {
          focusKind: "question",
          focusId: "question-1",
          focusLabel: "Has the customer already received the invitation letter?",
          route: {
            lane: "customer_followup",
            owner: "operator",
            priority: "high",
            status: "open",
            blocking: true,
            approvalRequired: false,
            dueBy: null,
            summary: "Customer followup | owner: operator | priority: High | blocking",
          },
          cta: {
            actionId: "run_negotiation",
            label: "Prepare customer follow-up",
            hint: "Use the live follow-up lane to request the missing proof and attach the focused refs.",
            owner: "operator",
            lane: "customer_followup",
            approvalRequired: false,
            blocking: true,
            summary: "Prepare customer follow-up | owner: operator | focus: Has the customer already received the invitation letter?",
          },
          sourceRefs: ["proof:proof-1"],
          relatedQuestionIds: ["question-1"],
          nextAction: {
            type: "document_request",
            title: "Request missing visa documents",
            summary: "Ask the customer for the passport scan and invitation letter before scheduling filing.",
            owner: "operator",
            dueBy: null,
            blocking: true,
            relatedQuestionIds: ["question-1"],
            sourceRefs: ["question:question-1", "timeline:timeline-1"],
          },
        },
      ],
    },
    entities: [
      {
        id: "entity-customer",
        kind: "person",
        label: "Primary applicant",
        role: "customer",
        description: "Applicant relocating with spouse.",
        confidence: 0.98,
        sourceRefs: ["session:session-123", "note:operator-1"],
      },
    ],
    timeline: [
      {
        id: "timeline-1",
        kind: "session",
        ts: "2026-04-09T06:55:00.000Z",
        title: "Live intake session completed",
        summary: "Customer asked about spouse visa steps and consultation timing.",
        status: "completed",
        sourceRefs: ["session:session-123"],
      },
    ],
    proofs: [
      {
        id: "proof-1",
        statement: "Customer wants a spouse relocation consultation.",
        status: "confirmed",
        confidence: 0.96,
        evidenceSummary: "Confirmed in the latest live intake.",
        contradictionNote: null,
        sourceRefs: ["session:session-123"],
      },
    ],
    openQuestions: [
      {
        id: "question-1",
        question: "Has the customer already received the invitation letter?",
        priority: "high",
        blocking: true,
        owner: "customer",
        suggestedNextStep: "Request the invitation letter or confirm issuance status.",
        sourceRefs: ["proof:proof-1"],
      },
    ],
    recommendedNextAction: {
      type: "document_request",
      title: "Request missing visa documents",
      summary: "Ask the customer for the passport scan and invitation letter before scheduling filing.",
      owner: "operator",
      dueBy: null,
      blocking: true,
      relatedQuestionIds: ["question-1"],
      sourceRefs: ["question:question-1", "timeline:timeline-1"],
    },
  };

  assert.equal(wiki.overview.status, "waiting_on_customer");
  assert.equal(wiki.highlights.topProof?.status, "confirmed");
  assert.equal(wiki.highlights.topEntity?.kind, "person");
  assert.equal(wiki.highlights.topBlockingQuestion?.priority, "high");
  assert.equal(wiki.evidencePack.proofs[0]?.status, "confirmed");
  assert.equal(wiki.evidencePack.entities[0]?.kind, "person");
  assert.equal(wiki.evidencePack.questions[0]?.priority, "high");
  assert.equal(wiki.evidencePack.sourceRefs.includes("proof:proof-1"), true);
  assert.match(wiki.handoffPack.proofs[0]?.handoff ?? "", /Focus proof/i);
  assert.equal(wiki.handoffPack.questions[0]?.detail.priority, "high");
  assert.equal(wiki.detailPack.proofs[0]?.badges[0]?.tone, "ok");
  assert.match(wiki.detailPack.questions[0]?.meta ?? "", /owner: customer/i);
  assert.equal(wiki.routingPack.proofs[0]?.route.lane, "customer_followup");
  assert.equal(wiki.routingPack.questions[0]?.cta.actionId, "run_negotiation");
  assert.equal(wiki.entities[0]?.kind, "person");
  assert.equal(wiki.proofs[0]?.status, "confirmed");
  assert.equal(wiki.recommendedNextAction?.type, "document_request");
});

test("runtime case wiki note contracts expose stable operator append shapes", () => {
  const request: RuntimeCaseWikiNoteRequest = {
    sessionId: "session-123",
    runId: "run-123",
    userId: "operator-123",
    title: "Missing passport scan",
    note: "Customer still needs to upload the passport scan before submission.",
    priority: "high",
    blocking: true,
    owner: "customer",
    suggestedNextStep: "Request the passport scan in the next follow-up.",
    ts: "2026-04-09T09:15:00.000Z",
  };
  const response: RuntimeCaseWikiNoteResponse = {
    accepted: true,
    eventId: "evt-case-note-1",
    sessionId: "session-123",
    runId: "run-123",
    source: "operator",
    kind: "operator_note",
    createdAt: "2026-04-09T09:15:00.000Z",
  };

  assert.equal(request.blocking, true);
  assert.equal(request.priority, "high");
  assert.equal(response.accepted, true);
  assert.equal(response.kind, "operator_note");
  assert.equal(response.source, "operator");
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
