import test from "node:test";
import assert from "node:assert/strict";
import {
  CASE_WIKI_COMPLIANCE_ENFORCEMENT_STATUSES,
  CASE_WIKI_COMPLIANCE_SNAPSHOT_MODES,
  CASE_WIKI_ENTITY_KINDS,
  CASE_WIKI_NEXT_ACTION_TYPES,
  CASE_WIKI_PRIORITIES,
  CASE_WIKI_PROOF_STATUSES,
  CASE_WIKI_ROUTING_ACTION_IDS,
  CASE_WIKI_ROUTING_FOCUS_KINDS,
  CASE_WIKI_ROUTING_LANES,
  CASE_WIKI_STATUSES,
  CASE_WIKI_TIMELINE_ENTRY_KINDS,
  RUNTIME_OPERATOR_QUEUE_ACTION_IDS,
  RUNTIME_OPERATOR_QUEUE_PRIORITIES,
  RUNTIME_OPERATOR_QUEUE_TONES,
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
  type RuntimeOperatorQueueSnapshot,
  type RuntimeLiveSessionEventIngestRequest,
  type RuntimeLiveSessionEventIngestResponse,
  type CaseWiki,
  type EvidenceSignature,
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
  assert.deepEqual(CASE_WIKI_COMPLIANCE_ENFORCEMENT_STATUSES, ["pass", "warn", "fail"]);
  assert.deepEqual(CASE_WIKI_COMPLIANCE_SNAPSHOT_MODES, ["compiled_operator_safe", "raw_ref_review"]);

  const evidenceSignature: EvidenceSignature = {
    schemaVersion: 1,
    status: "unsigned",
    algorithm: "ed25519-sha256",
    canonicalization: "json-stable-v1",
    payloadHash: "sha256:contract-hash",
    signature: null,
    keyId: null,
    signerId: "api-backend",
    signedAt: "2026-04-09T07:00:00.000Z",
  };

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
    compliance: {
      templateId: "strict",
      requestedTemplateId: "strict",
      fallbackApplied: false,
      source: "tenant_override",
      controls: {
        piiRedactionLevel: "high",
        crossTenantAdminOnly: true,
        approvalSlaEnforced: true,
        auditTrailRequired: true,
      },
      retention: {
        rawMediaDays: 3,
        auditLogsDays: 540,
        eventsDays: 540,
        sessionsDays: 120,
      },
      evidenceSigning: {
        enabled: false,
        keyState: "missing",
        expectedSignatureStatus: "unsigned",
        signerId: "api-backend",
        keyId: null,
      },
      enforcement: {
        status: "pass",
        snapshotMode: "compiled_operator_safe",
        rawRefCount: 0,
        rawRefsPreview: [],
        redactionRequired: true,
        redactionSatisfied: true,
        signingRequired: false,
        observedSignatureStatus: "unsigned",
        signatureSatisfied: true,
        exportReady: true,
        blockingReasons: [],
        summary: "status=pass | snapshot=compiled_operator_safe | redaction=ok | signing=unsigned | export=ready | rawRefs=0",
      },
      summary: "template=strict | tenant_override | pii=high | rawMedia=3d | audit=required | signing=unsigned | enforcement=pass",
    },
    evidenceSignature,
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
    actionPack: {
      proofs: [
        {
          focusKind: "proof",
          focusId: "proof-1",
          focusLabel: "Customer wants a spouse relocation consultation.",
          title: "Customer wants a spouse relocation consultation.",
          handoffText: [
            "Proof handoff: Customer wants a spouse relocation consultation.",
            "Confirmed | confidence 96% | refs: session:session-123",
            "Confirmed in the latest live intake.",
            "Focus proof: Customer wants a spouse relocation consultation.",
          ].join("\n"),
          refs: ["session:session-123"],
          refsText: ["Proof refs: Customer wants a spouse relocation consultation.", "session:session-123"].join("\n"),
          focusSummary: "Customer wants a spouse relocation consultation.",
          remediationDraft: {
            kind: "customer_message",
            actionType: "document_request",
            title: "Request missing visa documents",
            targetLabel: "customer",
            owner: "operator",
            dueBy: null,
            summary: "Send a customer-ready follow-up for Customer wants a spouse relocation consultation. and request the next required update.",
            body: [
              "Subject: Request missing visa documents",
              "",
              "Hello,",
              "",
              "We are following up on your case.",
              "Current blocker: Confirmed in the latest live intake.",
              "Requested next step: Ask the customer for the passport scan and invitation letter before scheduling filing.",
              "Please reply with the requested update so we can continue.",
              "",
              "Regards,",
              "Operations team",
            ].join("\n"),
            checklist: [
              "Verify the blocker is still current.",
              "Attach the latest source refs before sending.",
              "Send through the live or customer follow-up lane.",
              "Log the response back into Case Wiki.",
            ],
            sourceRefs: ["session:session-123"],
          },
        },
      ],
      questions: [
        {
          focusKind: "question",
          focusId: "question-1",
          focusLabel: "Has the customer already received the invitation letter?",
          title: "Has the customer already received the invitation letter?",
          handoffText: [
            "Question handoff: Has the customer already received the invitation letter?",
            "High | Blocking | owner: customer | refs: proof:proof-1",
            "Request the invitation letter or confirm issuance status.",
            "Focus question: Has the customer already received the invitation letter?",
          ].join("\n"),
          refs: ["proof:proof-1"],
          refsText: ["Question refs: Has the customer already received the invitation letter?", "proof:proof-1"].join("\n"),
          focusSummary: "Has the customer already received the invitation letter?",
          remediationDraft: {
            kind: "customer_message",
            actionType: "document_request",
            title: "Request missing visa documents",
            targetLabel: "customer",
            owner: "operator",
            dueBy: null,
            summary: "Send a customer-ready follow-up for Has the customer already received the invitation letter? and request the next required update.",
            body: [
              "Subject: Request missing visa documents",
              "",
              "Hello,",
              "",
              "We are following up on your case.",
              "Current blocker: Request the invitation letter or confirm issuance status.",
              "Requested next step: Ask the customer for the passport scan and invitation letter before scheduling filing.",
              "Please reply with the requested update so we can continue.",
              "",
              "Regards,",
              "Operations team",
            ].join("\n"),
            checklist: [
              "Verify the blocker is still current.",
              "Attach the latest source refs before sending.",
              "Send through the live or customer follow-up lane.",
              "Log the response back into Case Wiki.",
            ],
            sourceRefs: ["proof:proof-1"],
          },
        },
      ],
    },
    focusPack: {
      proofs: [
        {
          focusKind: "proof",
          focusId: "proof-1",
          focusLabel: "Customer wants a spouse relocation consultation.",
          chipTitle: [
            "Customer wants a spouse relocation consultation.",
            "Confirmed in the latest live intake.",
            "Refs: session:session-123",
          ].join("\n"),
          focusSummary: "Customer wants a spouse relocation consultation.",
          drilldown: "Customer wants a spouse relocation consultation. | Confirmed in the latest live intake.",
          handoffPreview: [
            "Focus proof: Customer wants a spouse relocation consultation.",
            "Evidence: Confirmed in the latest live intake.",
          ].join("\n"),
        },
      ],
      questions: [
        {
          focusKind: "question",
          focusId: "question-1",
          focusLabel: "Has the customer already received the invitation letter?",
          chipTitle: [
            "Has the customer already received the invitation letter?",
            "Request the invitation letter or confirm issuance status.",
            "Owner: customer",
          ].join("\n"),
          focusSummary: "Has the customer already received the invitation letter?",
          drilldown: "Has the customer already received the invitation letter? | Request the invitation letter or confirm issuance status. | customer",
          handoffPreview: [
            "Focus question: Has the customer already received the invitation letter?",
            "Resolve: Request the invitation letter or confirm issuance status.",
          ].join("\n"),
        },
      ],
    },
    previewPack: {
      packValue: "1 proofs | 1 entities | 1 questions",
      refsValue: "session:session-123 | note:operator-1 | proof:proof-1",
      proofsSummary: "[confirmed] Customer wants a spouse relocation consultation.",
      questionsSummary: "[high] Has the customer already received the invitation letter?",
      drilldownValue:
        "[confirmed] Customer wants a spouse relocation consultation. | [high] Has the customer already received the invitation letter?",
      handoffValue: "Request missing visa documents | refs: question:question-1, timeline:timeline-1",
    },
    workspacePack: {
      defaultFocus: {
        focusKind: "question",
        focusId: "question-1",
        focusLabel: "Has the customer already received the invitation letter?",
        chipTitle: [
          "Has the customer already received the invitation letter?",
          "Request the invitation letter or confirm issuance status.",
          "Owner: customer",
        ].join("\n"),
        focusSummary: "Has the customer already received the invitation letter?",
        drilldown: "Has the customer already received the invitation letter? | Request the invitation letter or confirm issuance status. | customer",
        handoffPreview: [
          "Focus question: Has the customer already received the invitation letter?",
          "Resolve: Request the invitation letter or confirm issuance status.",
        ].join("\n"),
        source: "highlight",
      },
      statusValue: "Waiting on customer | document_collection",
      summaryValue: "Customer is evaluating a relocation package and waiting on document guidance.",
      blockerValue: "Has the customer already received the invitation letter?",
      nextActionValue: "Request missing visa documents",
      proofTitle: "Customer wants a spouse relocation consultation.",
      proofSummary: "Confirmed in the latest live intake.",
      entityTitle: "Primary applicant",
      entitySummary: "customer | Applicant relocating with spouse.",
      packValue: "1 proofs | 1 entities | 1 questions",
      refsValue: "session:session-123 | note:operator-1 | proof:proof-1",
      questionsValue: "[high] Has the customer already received the invitation letter?",
      timelineValue: "[session] Live intake session completed",
      drilldownValue:
        "[confirmed] Customer wants a spouse relocation consultation. | [high] Has the customer already received the invitation letter?",
      handoffValue: "Request missing visa documents | refs: question:question-1, timeline:timeline-1",
      costValue: "$0.0124 | 480 tokens | live 2.5m | 0.03 MB",
      costSummary: {
        status: "observed",
        source: "case_wiki",
        summaryStatus: "observed",
        summarySource: "operator_summary",
        summaryAuthority: "authoritative",
        aggregationMode: "high_water_by_run",
        estimationMode: "runtime_rate_estimate",
        observationMode: "event_span_estimate",
        pricingConfigured: true,
        currency: "USD",
        inputTokens: 320,
        outputTokens: 160,
        derivedTotalTokens: 480,
        totalTokens: 480,
        tokenConsistency: true,
        tokenDriftTokens: 0,
        inputUsd: 0.000144,
        outputUsd: 0.000216,
        liveUsd: 0.012,
        uiExecutorUsd: 0,
        storageUsd: 0.000006,
        totalUsd: 0.012366,
        liveMinutes: 2.5,
        uiExecutorMinutes: 0,
        storageMb: 0.03,
        pricePer1kInputUsd: 0.00045,
        pricePer1kOutputUsd: 0.00135,
        pricePerLiveMinuteUsd: 0.0048,
        pricePerUiExecutorMinuteUsd: 0,
        pricePerStorageMbUsd: 0.0002,
        models: ["gemini-live-2.5-flash-native-audio"],
        uniqueModels: 1,
        unknownSourceCount: 0,
        latestSeenAt: "2026-04-09T07:00:00.000Z",
        sourceRefs: ["session:session-123", "run:run-123"],
        validated: true,
      },
    },
    operatorPreviewPack: {
      overview: {
        caseId: "case-123",
        sessionId: "session-123",
        schemaVersion: 1,
        generatedAt: "2026-04-09T07:00:00.000Z",
        overview: {
          title: "Visa intake for spouse relocation",
          status: "waiting_on_customer",
          currentStage: "document_collection",
          customerGoal: "Collect missing visa documents and book a consultation.",
          summary: "Customer is evaluating a relocation package and waiting on document guidance.",
          missingEvidenceSummary: "Passport scan and invitation letter are still missing.",
          contradictionsSummary: null,
        },
        recommendedNextAction: {
          type: "document_request",
          title: "Request missing visa documents",
          owner: "operator",
          summary: "Ask the customer for the passport scan and invitation letter before scheduling filing.",
        },
        counts: {
          entities: 1,
          proofs: 1,
          openQuestions: 1,
          timeline: 1,
        },
      },
      evidence: {
        topProof: {
          status: "confirmed",
          statement: "Customer wants a spouse relocation consultation.",
          evidenceSummary: "Confirmed in the latest live intake.",
          contradictionNote: null,
          sourceRefs: ["session:session-123"],
        },
        topEntity: {
          kind: "person",
          label: "Primary applicant",
          role: "customer",
          summary: "customer | Applicant relocating with spouse.",
          sourceRefs: ["session:session-123", "note:operator-1"],
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
        previewPack: {
          packValue: "1 proofs | 1 entities | 1 questions",
          refsValue: "session:session-123 | note:operator-1 | proof:proof-1",
          proofsSummary: "[confirmed] Customer wants a spouse relocation consultation.",
          questionsSummary: "[high] Has the customer already received the invitation letter?",
          drilldownValue:
            "[confirmed] Customer wants a spouse relocation consultation. | [high] Has the customer already received the invitation letter?",
          handoffValue: "Request missing visa documents | refs: question:question-1, timeline:timeline-1",
        },
        handoffPack: {
          proofs: [],
          questions: [],
        },
        detailPack: {
          proofs: [],
          questions: [],
        },
        recommendedNextAction: {
          type: "document_request",
          title: "Request missing visa documents",
          owner: "operator",
          summary: "Ask the customer for the passport scan and invitation letter before scheduling filing.",
        },
      },
      questions: {
        totalQuestions: 1,
        blockingQuestions: 1,
        items: [
          {
            id: "question-1",
            priority: "high",
            blocking: true,
            owner: "customer",
            question: "Has the customer already received the invitation letter?",
            suggestedNextStep: "Request the invitation letter or confirm issuance status.",
            sourceRefs: ["proof:proof-1"],
          },
        ],
      },
      remediation: {
        focusKind: "question",
        focusId: "question-1",
        focusLabel: "Has the customer already received the invitation letter?",
        draft: {
          kind: "customer_message",
          actionType: "document_request",
          title: "Request missing visa documents",
          targetLabel: "customer",
          owner: "operator",
          dueBy: null,
          summary: "Send a customer-ready follow-up for Has the customer already received the invitation letter? and request the next required update.",
          body: [
            "Subject: Request missing visa documents",
            "",
            "Hello,",
            "",
            "We are following up on your case.",
            "Current blocker: Request the invitation letter or confirm issuance status.",
            "Requested next step: Ask the customer for the passport scan and invitation letter before scheduling filing.",
            "Please reply with the requested update so we can continue.",
            "",
            "Regards,",
            "Operations team",
          ].join("\n"),
          checklist: [
            "Verify the blocker is still current.",
            "Attach the latest source refs before sending.",
            "Send through the live or customer follow-up lane.",
            "Log the response back into Case Wiki.",
          ],
          sourceRefs: ["proof:proof-1"],
        },
      },
      timeline: {
        totalEntries: 1,
        latestEntries: [
          {
            ts: "2026-04-09T06:55:00.000Z",
            kind: "session",
            title: "Live intake session completed",
            summary: "Customer asked about spouse visa steps and consultation timing.",
            status: "completed",
            sourceRefs: ["session:session-123"],
          },
        ],
      },
      audit: {
        totalEntries: 2,
        latestEntries: [
          {
            id: "audit:event:evt-case-note-1",
            ts: "2026-04-09T06:58:00.000Z",
            actor: "operator",
            source: "operator_note",
            action: "blocking_note_added",
            field: "caseWiki.blockingQuestion",
            summary: "Missing invitation letter: Customer still needs to upload the invitation letter.",
            reason: "Request the invitation letter in the next follow-up.",
            oldValue: null,
            newValue: "Customer still needs to upload the invitation letter.",
            sourceRefs: ["event:evt-case-note-1"],
          },
          {
            id: "audit:workflow:control-plane",
            ts: "2026-04-09T06:57:00.000Z",
            actor: "workflow-store",
            source: "workflow",
            action: "workflow_updated",
            field: "workflow.currentStage",
            summary: "Workflow control plane refreshed the active case state.",
            reason: "active",
            oldValue: null,
            newValue: "document_collection",
            sourceRefs: ["workflow:control-plane"],
          },
        ],
      },
      compliance: {
        templateId: "strict",
        requestedTemplateId: "strict",
        fallbackApplied: false,
        source: "tenant_override",
        controls: {
          piiRedactionLevel: "high",
          crossTenantAdminOnly: true,
          approvalSlaEnforced: true,
          auditTrailRequired: true,
        },
        retention: {
          rawMediaDays: 3,
          auditLogsDays: 540,
          eventsDays: 540,
          sessionsDays: 120,
        },
        evidenceSigning: {
          enabled: false,
          keyState: "missing",
          expectedSignatureStatus: "unsigned",
          signerId: "api-backend",
          keyId: null,
        },
        enforcement: {
          status: "pass",
          snapshotMode: "compiled_operator_safe",
          rawRefCount: 0,
          rawRefsPreview: [],
          redactionRequired: true,
          redactionSatisfied: true,
          signingRequired: false,
          observedSignatureStatus: "unsigned",
          signatureSatisfied: true,
          exportReady: true,
          blockingReasons: [],
          summary: "status=pass | snapshot=compiled_operator_safe | redaction=ok | signing=unsigned | export=ready | rawRefs=0",
        },
        summary: "template=strict | tenant_override | pii=high | rawMedia=3d | audit=required | signing=unsigned | enforcement=pass",
      },
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
    auditLog: [
      {
        id: "audit:event:evt-case-note-1",
        ts: "2026-04-09T06:58:00.000Z",
        actor: "operator",
        source: "operator_note",
        action: "blocking_note_added",
        field: "caseWiki.blockingQuestion",
        summary: "Missing invitation letter: Customer still needs to upload the invitation letter.",
        reason: "Request the invitation letter in the next follow-up.",
        oldValue: null,
        newValue: "Customer still needs to upload the invitation letter.",
        sourceRefs: ["event:evt-case-note-1"],
      },
      {
        id: "audit:workflow:control-plane",
        ts: "2026-04-09T06:57:00.000Z",
        actor: "workflow-store",
        source: "workflow",
        action: "workflow_updated",
        field: "workflow.currentStage",
        summary: "Workflow control plane refreshed the active case state.",
        reason: "active",
        oldValue: null,
        newValue: "document_collection",
        sourceRefs: ["workflow:control-plane"],
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
  assert.equal(wiki.compliance.templateId, "strict");
  assert.equal(wiki.compliance.controls.piiRedactionLevel, "high");
  assert.equal(wiki.compliance.enforcement.status, "pass");
  assert.equal(wiki.compliance.enforcement.exportReady, true);
  assert.equal(wiki.evidenceSignature?.status, "unsigned");
  assert.equal(wiki.evidenceSignature?.algorithm, "ed25519-sha256");
  assert.equal(wiki.evidenceSignature?.canonicalization, "json-stable-v1");
  assert.match(wiki.handoffPack.proofs[0]?.handoff ?? "", /Focus proof/i);
  assert.equal(wiki.handoffPack.questions[0]?.detail.priority, "high");
  assert.equal(wiki.detailPack.proofs[0]?.badges[0]?.tone, "ok");
  assert.match(wiki.detailPack.questions[0]?.meta ?? "", /owner: customer/i);
  assert.equal(wiki.routingPack.proofs[0]?.route.lane, "customer_followup");
  assert.equal(wiki.routingPack.questions[0]?.cta.actionId, "run_negotiation");
  assert.match(wiki.actionPack.proofs[0]?.handoffText ?? "", /Proof handoff/i);
  assert.match(wiki.actionPack.questions[0]?.refsText ?? "", /Question refs/i);
  assert.equal(wiki.actionPack.questions[0]?.remediationDraft?.kind, "customer_message");
  assert.equal(wiki.actionPack.questions[0]?.remediationDraft?.targetLabel, "customer");
  assert.match(wiki.focusPack.proofs[0]?.chipTitle ?? "", /Refs:/i);
  assert.match(wiki.focusPack.questions[0]?.handoffPreview ?? "", /Focus question/i);
  assert.match(wiki.previewPack.packValue ?? "", /1 proofs/i);
  assert.match(wiki.previewPack.handoffValue ?? "", /Request missing visa documents/i);
  assert.equal(wiki.workspacePack.defaultFocus?.focusKind, "question");
  assert.equal(wiki.workspacePack.defaultFocus?.source, "highlight");
  assert.match(wiki.workspacePack.statusValue ?? "", /Waiting on customer/i);
  assert.match(wiki.workspacePack.questionsValue ?? "", /\[high\]/i);
  assert.match(wiki.workspacePack.timelineValue ?? "", /\[session\]/i);
  assert.match(wiki.workspacePack.handoffValue ?? "", /Request missing visa documents/i);
  assert.match(wiki.workspacePack.costValue ?? "", /\$0\.0124/i);
  assert.equal(wiki.workspacePack.costSummary?.source, "case_wiki");
  assert.equal(wiki.workspacePack.costSummary?.totalTokens, 480);
  assert.match(wiki.operatorPreviewPack.overview.overview?.summary ?? "", /document guidance/i);
  assert.match(wiki.operatorPreviewPack.evidence.topEntity?.summary ?? "", /Applicant relocating with spouse/i);
  assert.equal(wiki.operatorPreviewPack.questions.totalQuestions, 1);
  assert.equal(wiki.operatorPreviewPack.questions.items[0]?.id, "question-1");
  assert.equal(wiki.operatorPreviewPack.remediation.focusId, "question-1");
  assert.equal(wiki.operatorPreviewPack.remediation.draft?.kind, "customer_message");
  assert.equal(wiki.operatorPreviewPack.timeline.totalEntries, 1);
  assert.equal(wiki.operatorPreviewPack.timeline.latestEntries[0]?.kind, "session");
  assert.equal(wiki.operatorPreviewPack.audit.totalEntries, 2);
  assert.equal(wiki.operatorPreviewPack.audit.latestEntries[0]?.source, "operator_note");
  assert.equal(wiki.operatorPreviewPack.compliance.templateId, "strict");
  assert.equal(wiki.operatorPreviewPack.compliance.evidenceSigning.expectedSignatureStatus, "unsigned");
  assert.equal(wiki.operatorPreviewPack.compliance.enforcement.status, "pass");
  assert.equal(wiki.entities[0]?.kind, "person");
  assert.equal(wiki.auditLog[0]?.source, "operator_note");
  assert.equal(wiki.auditLog[1]?.field, "workflow.currentStage");
  assert.equal(wiki.proofs[0]?.status, "confirmed");
  assert.equal(wiki.recommendedNextAction?.type, "document_request");
});

test("runtime operator queue contracts expose stable queue constants and typed snapshots", () => {
  assert.deepEqual(RUNTIME_OPERATOR_QUEUE_TONES, ["neutral", "ok", "watch", "fail", "stale"]);
  assert.deepEqual(RUNTIME_OPERATOR_QUEUE_PRIORITIES, ["critical", "high", "medium"]);
  assert.deepEqual(RUNTIME_OPERATOR_QUEUE_ACTION_IDS, [
    "refresh_summary",
    "open_quick_start",
    "open_playbook",
    "open_workflow_control",
    "open_case_wiki_remediation",
    "copy_case_wiki_remediation_draft",
    "run_runtime_guardrail_path",
    "show_all_cards",
    "full_ops_view",
    "open_device_nodes",
    "run_negotiation",
    "run_story",
    "run_ui_task",
    "saved_view_incidents",
    "saved_view_runtime",
    "saved_view_approvals",
    "saved_view_audit",
    "jump_status_card",
  ]);

  const queueSnapshot: RuntimeOperatorQueueSnapshot = {
    schemaVersion: 1,
    generatedAt: "2026-04-16T08:00:00.000Z",
    tenantId: "tenant-queue-demo",
    totalItems: 1,
    blockingItems: 1,
    items: [
      {
        id: "operator_queue:session-123",
        key: "case_wiki:session-123",
        source: "case_wiki",
        generatedAt: "2026-04-16T08:00:00.000Z",
        caseId: "case-123",
        sessionId: "session-123",
        tone: "fail",
        priority: "critical",
        blocking: true,
        kicker: "Approval lane",
        title: "Approve visa intake follow-up",
        meta: "Focus: Missing passport scan. Blocker: Approval still pending.",
        focus: {
          kind: "question",
          id: "question-approval-1",
          label: "Missing passport scan",
          summary: "Approval is blocking the next operator step.",
        },
        question: {
          id: "question-approval-1",
          priority: "high",
          blocking: true,
          owner: "operator",
          question: "Has an operator approved the next customer follow-up?",
          suggestedNextStep: "Open the approval lane and confirm the follow-up.",
        },
        route: {
          lane: "approval_queue",
          owner: "operator",
          priority: "high",
          status: "pending",
          blocking: true,
          approvalRequired: true,
          dueBy: "2026-04-16T09:00:00.000Z",
          summary: "Approval pending before the customer follow-up can be sent.",
        },
        remediation: {
          focusKind: "question",
          focusId: "question-approval-1",
          focusLabel: "Missing passport scan",
          draft: {
            kind: "approval_brief",
            actionType: "approval_request",
            title: "Approve visa intake follow-up",
            targetLabel: "operator",
            owner: "operator",
            dueBy: "2026-04-16T09:00:00.000Z",
            summary: "Approve the follow-up draft before it is sent to the customer.",
            body: "Approve the follow-up draft before it is sent to the customer.",
            checklist: ["Review the case blocker.", "Approve the follow-up draft."],
            sourceRefs: ["approval:approval-1"],
          },
        },
        recommendedNextAction: {
          type: "approval_request",
          title: "Approve visa intake follow-up",
          owner: "operator",
          summary: "Approve the follow-up draft before it is sent to the customer.",
          dueBy: "2026-04-16T09:00:00.000Z",
          blocking: true,
        },
        compliance: {
          templateId: "strict",
          piiRedactionLevel: "high",
          expectedSignatureStatus: "unsigned",
          enforcementStatus: "pass",
          exportReady: true,
          blockingReasons: [],
        },
        primary: {
          label: "Open Remediation",
          shortLabel: "Open",
          actionId: "open_case_wiki_remediation",
        },
        secondary: {
          label: "Copy Draft",
          shortLabel: "Copy",
          actionId: "copy_case_wiki_remediation_draft",
          kind: "secondary",
        },
        sourceRefs: ["approval:approval-1", "session:session-123"],
      },
    ],
  };

  assert.equal(queueSnapshot.items[0]?.priority, "critical");
  assert.equal(queueSnapshot.items[0]?.primary?.actionId, "open_case_wiki_remediation");
  assert.equal(queueSnapshot.items[0]?.secondary?.actionId, "copy_case_wiki_remediation_draft");
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
              healedRefTargets: [],
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
