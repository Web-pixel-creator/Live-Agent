import assert from "node:assert/strict";
import test from "node:test";
import { buildRuntimeOperatorQueueItem, buildRuntimeOperatorQueueSnapshot } from "../../apps/api-backend/src/runtime-operator-queue.js";
import type { CaseWiki, CaseWikiNextAction, CaseWikiOpenQuestion, CaseWikiRoutingPackItem } from "../../shared/contracts/src/index.js";

type QueueScenario = {
  caseId: string;
  sessionId: string;
  generatedAt: string;
  title: string;
  question?: {
    id?: string;
    question: string;
    priority?: "low" | "medium" | "high";
    blocking?: boolean;
    owner?: string | null;
    suggestedNextStep?: string | null;
  } | null;
  route?: {
    lane: "approval_queue" | "customer_followup" | "workflow_resume" | "ui_task" | "live_followup" | "operator_followup";
    owner?: string | null;
    priority?: "low" | "medium" | "high";
    status?: string | null;
    blocking?: boolean;
    approvalRequired?: boolean;
    dueBy?: string | null;
    summary?: string | null;
  } | null;
  nextAction?: {
    type: "operator_followup" | "approval_request" | "document_request" | "workflow_resume" | "ui_task" | "live_followup";
    title: string;
    summary: string;
    owner?: string | null;
    dueBy?: string | null;
    blocking?: boolean;
  } | null;
  remediationDraft?: {
    kind: "customer_message" | "approval_brief" | "workflow_resume" | "operator_brief";
    actionType: "operator_followup" | "approval_request" | "document_request" | "workflow_resume" | "ui_task" | "live_followup" | null;
    title: string;
    targetLabel?: string | null;
    owner?: string | null;
    dueBy?: string | null;
    summary: string;
    body: string;
    checklist?: string[];
  } | null;
};

function resolveRouteCtaActionId(route: QueueScenario["route"]): "run_negotiation" | "run_ui_task" | "open_workflow_control" | "refresh_summary" {
  switch (route?.lane) {
    case "customer_followup":
    case "live_followup":
      return "run_negotiation";
    case "ui_task":
      return "run_ui_task";
    case "approval_queue":
    case "workflow_resume":
      return "open_workflow_control";
    case "operator_followup":
    default:
      return "refresh_summary";
  }
}

function createCaseWiki(scenario: QueueScenario): CaseWiki {
  const sourceRef = `session:${scenario.sessionId}`;
  const questionId = scenario.question?.id ?? `question:${scenario.sessionId}:blocker`;
  const question: CaseWikiOpenQuestion | null = scenario.question
    ? {
        id: questionId,
        question: scenario.question.question,
        priority: scenario.question.priority ?? "high",
        blocking: scenario.question.blocking !== false,
        owner: scenario.question.owner ?? "operator",
        suggestedNextStep: scenario.question.suggestedNextStep ?? scenario.nextAction?.summary ?? null,
        sourceRefs: [sourceRef],
      }
    : null;
  const nextAction: CaseWikiNextAction | null = scenario.nextAction
    ? {
        type: scenario.nextAction.type,
        title: scenario.nextAction.title,
        summary: scenario.nextAction.summary,
        owner: scenario.nextAction.owner ?? "operator",
        dueBy: scenario.nextAction.dueBy ?? null,
        blocking: scenario.nextAction.blocking === true,
        relatedQuestionIds: question ? [question.id] : [],
        sourceRefs: [sourceRef],
      }
    : null;
  const routeItem: CaseWikiRoutingPackItem | null = scenario.route
    ? {
        focusKind: "question",
        focusId: question?.id ?? `focus:${scenario.sessionId}`,
        focusLabel: question?.question ?? scenario.title,
        route: {
          lane: scenario.route.lane,
          owner: scenario.route.owner ?? "operator",
          priority: scenario.route.priority ?? "medium",
          status: scenario.route.status ?? "open",
          blocking: scenario.route.blocking === true,
          approvalRequired: scenario.route.approvalRequired === true,
          dueBy: scenario.route.dueBy ?? null,
          summary: scenario.route.summary ?? `${scenario.route.lane} follow-up`,
        },
        cta: {
          actionId: resolveRouteCtaActionId(scenario.route),
          label: "Open route",
          hint: "Open the focused route for the compiled case.",
          owner: scenario.route.owner ?? "operator",
          lane: scenario.route.lane,
          approvalRequired: scenario.route.approvalRequired === true,
          blocking: scenario.route.blocking === true,
          summary: scenario.route.summary ?? `${scenario.route.lane} follow-up`,
        },
        sourceRefs: [sourceRef],
        relatedQuestionIds: question ? [question.id] : [],
        nextAction,
      }
    : null;
  const remediationDraft = scenario.remediationDraft
    ? {
        kind: scenario.remediationDraft.kind,
        actionType: scenario.remediationDraft.actionType,
        title: scenario.remediationDraft.title,
        targetLabel: scenario.remediationDraft.targetLabel ?? "customer",
        owner: scenario.remediationDraft.owner ?? "operator",
        dueBy: scenario.remediationDraft.dueBy ?? null,
        summary: scenario.remediationDraft.summary,
        body: scenario.remediationDraft.body,
        checklist: scenario.remediationDraft.checklist ?? ["Review the blocker", "Send the update"],
        sourceRefs: [sourceRef],
      }
    : null;
  const focusItem = question
    ? {
        focusKind: "question" as const,
        focusId: question.id,
        focusLabel: question.question,
        chipTitle: question.question,
        focusSummary: question.suggestedNextStep,
        drilldown: question.suggestedNextStep,
        handoffPreview: question.question,
      }
    : null;

  return {
    schemaVersion: 1,
    caseId: scenario.caseId,
    sessionId: scenario.sessionId,
    userId: "user-queue-demo",
    generatedAt: scenario.generatedAt,
    overview: {
      title: scenario.title,
      summary: "Compiled case summary for operator queue testing.",
      status: question?.blocking ? "blocked" : "waiting_on_operator",
      customerGoal: "Complete the next visa case step.",
      currentStage: "document_collection",
      lastMeaningfulUpdateAt: scenario.generatedAt,
      activeLanguage: "en",
      missingEvidenceSummary: question?.question ?? null,
      contradictionsSummary: null,
    },
    highlights: {
      topProof: {
        id: `proof:${scenario.sessionId}`,
        statement: "Compiled case summary is available.",
        status: "confirmed",
        confidence: 0.92,
        evidenceSummary: "Case Wiki compiled from runtime evidence.",
        contradictionNote: null,
        sourceRefs: [sourceRef],
      },
      topEntity: {
        id: `entity:${scenario.sessionId}`,
        kind: "case",
        label: scenario.title,
        role: "case",
        description: "Visa queue test case",
        confidence: 0.91,
        sourceRefs: [sourceRef],
      },
      topBlockingQuestion: question,
    },
    evidencePack: {
      proofs: [
        {
          id: `proof:${scenario.sessionId}`,
          statement: "Compiled case summary is available.",
          status: "confirmed",
          confidence: 0.92,
          evidenceSummary: "Case Wiki compiled from runtime evidence.",
          contradictionNote: null,
          sourceRefs: [sourceRef],
        },
      ],
      entities: [
        {
          id: `entity:${scenario.sessionId}`,
          kind: "case",
          label: scenario.title,
          role: "case",
          description: "Visa queue test case",
          confidence: 0.91,
          sourceRefs: [sourceRef],
        },
      ],
      questions: question ? [question] : [],
      sourceRefs: [sourceRef],
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
        rawMediaDays: 2,
        auditLogsDays: 540,
        eventsDays: 400,
        sessionsDays: 45,
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
      summary: "template=strict | tenant_override | pii=high | rawMedia=2d | audit=required | signing=unsigned | enforcement=pass",
    },
    evidenceSignature: {
      schemaVersion: 1,
      status: "unsigned",
      algorithm: "ed25519-sha256",
      canonicalization: "json-stable-v1",
      payloadHash: `sha256:${scenario.sessionId}`,
      signature: null,
      keyId: null,
      signerId: "api-backend",
      signedAt: scenario.generatedAt,
    },
    handoffPack: {
      proofs: [],
      questions: [],
    },
    detailPack: {
      proofs: [],
      questions: [],
    },
    routingPack: {
      proofs: [],
      questions: routeItem ? [routeItem] : [],
    },
    actionPack: {
      proofs: [],
      questions: focusItem
        ? [
            {
              focusKind: focusItem.focusKind,
              focusId: focusItem.focusId,
              focusLabel: focusItem.focusLabel,
              title: focusItem.focusLabel,
              handoffText: focusItem.focusLabel,
              refs: [sourceRef],
              refsText: sourceRef,
              focusSummary: focusItem.focusSummary,
              remediationDraft,
            },
          ]
        : [],
    },
    focusPack: {
      proofs: [],
      questions: focusItem ? [focusItem] : [],
    },
    previewPack: {
      packValue: question ? "1 proofs | 1 entities | 1 questions" : "1 proofs | 1 entities | 0 questions",
      refsValue: sourceRef,
      proofsSummary: "Compiled case summary is available.",
      questionsSummary: question?.question ?? null,
      drilldownValue: question?.suggestedNextStep ?? nextAction?.summary ?? null,
      handoffValue: nextAction?.title ?? null,
    },
    workspacePack: {
      defaultFocus: focusItem ? { ...focusItem, source: "highlight" } : null,
      statusValue: question?.blocking ? "Blocked" : "Waiting on operator",
      summaryValue: "Compiled case summary for operator queue testing.",
      blockerValue: question?.question ?? null,
      nextActionValue: nextAction?.title ?? null,
      proofTitle: "Compiled case summary is available.",
      proofSummary: "Case Wiki compiled from runtime evidence.",
      entityTitle: scenario.title,
      entitySummary: "case | Visa queue test case",
      packValue: question ? "1 proofs | 1 entities | 1 questions" : "1 proofs | 1 entities | 0 questions",
      refsValue: sourceRef,
      questionsValue: question?.question ?? null,
      timelineValue: "Queue signal synthesized from Case Wiki.",
      drilldownValue: question?.suggestedNextStep ?? nextAction?.summary ?? null,
      handoffValue: nextAction?.title ?? null,
      costValue: null,
      costSummary: null,
    },
    operatorPreviewPack: {
      overview: {
        caseId: scenario.caseId,
        sessionId: scenario.sessionId,
        schemaVersion: 1,
        generatedAt: scenario.generatedAt,
        overview: {
          title: scenario.title,
          status: question?.blocking ? "blocked" : "waiting_on_operator",
          currentStage: "document_collection",
          customerGoal: "Complete the next visa case step.",
          summary: "Compiled case summary for operator queue testing.",
          missingEvidenceSummary: question?.question ?? null,
          contradictionsSummary: null,
        },
        recommendedNextAction: nextAction
          ? {
              type: nextAction.type,
              title: nextAction.title,
              owner: nextAction.owner,
              summary: nextAction.summary,
            }
          : null,
        counts: {
          entities: 1,
          proofs: 1,
          openQuestions: question ? 1 : 0,
          timeline: 1,
        },
      },
      evidence: {
        topProof: {
          status: "confirmed",
          statement: "Compiled case summary is available.",
          evidenceSummary: "Case Wiki compiled from runtime evidence.",
          contradictionNote: null,
          sourceRefs: [sourceRef],
        },
        topEntity: {
          kind: "case",
          label: scenario.title,
          role: "case",
          summary: "case | Visa queue test case",
          sourceRefs: [sourceRef],
        },
        evidencePack: null,
        previewPack: null,
        handoffPack: null,
        detailPack: null,
        recommendedNextAction: nextAction
          ? {
              type: nextAction.type,
              title: nextAction.title,
              owner: nextAction.owner,
              summary: nextAction.summary,
            }
          : null,
      },
      questions: {
        totalQuestions: question ? 1 : 0,
        blockingQuestions: question?.blocking ? 1 : 0,
        items: question
          ? [
              {
                id: question.id,
                priority: question.priority,
                blocking: question.blocking,
                owner: question.owner,
                question: question.question,
                suggestedNextStep: question.suggestedNextStep,
                sourceRefs: [sourceRef],
              },
            ]
          : [],
      },
      remediation: {
        focusKind: focusItem?.focusKind ?? null,
        focusId: focusItem?.focusId ?? null,
        focusLabel: focusItem?.focusLabel ?? null,
        draft: remediationDraft,
      },
      timeline: {
        totalEntries: 1,
        latestEntries: [
          {
            ts: scenario.generatedAt,
            kind: "session",
            title: "Compiled case refreshed",
            summary: "Case Wiki refreshed for queue rendering.",
            status: "active",
            sourceRefs: [sourceRef],
          },
        ],
      },
      audit: {
        totalEntries: 1,
        latestEntries: [
          {
            id: `audit:${scenario.sessionId}`,
            ts: scenario.generatedAt,
            actor: "api-backend",
            source: "runtime",
            action: "case_wiki_compiled",
            field: "workspacePack",
            summary: "Compiled case queue posture refreshed.",
            reason: null,
            oldValue: null,
            newValue: "compiled",
            sourceRefs: [sourceRef],
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
          rawMediaDays: 2,
          auditLogsDays: 540,
          eventsDays: 400,
          sessionsDays: 45,
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
        summary: "template=strict | tenant_override | pii=high | rawMedia=2d | audit=required | signing=unsigned | enforcement=pass",
      },
    },
    entities: [
      {
        id: `entity:${scenario.sessionId}`,
        kind: "case",
        label: scenario.title,
        role: "case",
        description: "Visa queue test case",
        confidence: 0.91,
        sourceRefs: [sourceRef],
      },
    ],
    timeline: [
      {
        id: `timeline:${scenario.sessionId}`,
        kind: "session",
        ts: scenario.generatedAt,
        title: "Compiled case refreshed",
        summary: "Case Wiki refreshed for queue rendering.",
        status: "active",
        sourceRefs: [sourceRef],
      },
    ],
    auditLog: [
      {
        id: `audit:${scenario.sessionId}`,
        ts: scenario.generatedAt,
        actor: "api-backend",
        source: "runtime",
        action: "case_wiki_compiled",
        field: "workspacePack",
        summary: "Compiled case queue posture refreshed.",
        reason: null,
        oldValue: null,
        newValue: "compiled",
        sourceRefs: [sourceRef],
      },
    ],
    proofs: [
      {
        id: `proof:${scenario.sessionId}`,
        statement: "Compiled case summary is available.",
        status: "confirmed",
        confidence: 0.92,
        evidenceSummary: "Case Wiki compiled from runtime evidence.",
        contradictionNote: null,
        sourceRefs: [sourceRef],
      },
    ],
    openQuestions: question ? [question] : [],
    recommendedNextAction: nextAction,
  };
}

test("runtime operator queue item prefers remediation drafts over saved-view fallbacks", () => {
  const wiki = createCaseWiki({
    caseId: "case-remediation",
    sessionId: "session-remediation",
    generatedAt: "2026-04-16T08:00:00.000Z",
    title: "Visa intake follow-up",
    question: {
      question: "Passport scan is still missing.",
      blocking: true,
      owner: "customer",
      suggestedNextStep: "Send the follow-up draft to request the passport scan.",
    },
    route: {
      lane: "customer_followup",
      priority: "high",
      blocking: true,
      approvalRequired: false,
      summary: "Customer follow-up is blocking the next visa step.",
    },
    nextAction: {
      type: "document_request",
      title: "Request missing passport scan",
      summary: "Ask the customer to upload the passport scan before scheduling.",
      owner: "operator",
      blocking: true,
    },
    remediationDraft: {
      kind: "customer_message",
      actionType: "document_request",
      title: "Send passport scan reminder",
      summary: "Use the remediation draft instead of manually rebuilding the follow-up.",
      body: "Please upload the missing passport scan so we can continue.",
    },
  });

  const item = buildRuntimeOperatorQueueItem(wiki);
  assert.ok(item, "expected a queue item for a blocking case with remediation");
  assert.equal(item?.priority, "high");
  assert.equal(item?.tone, "fail");
  assert.equal(item?.primary?.actionId, "open_case_wiki_remediation");
  assert.equal(item?.secondary?.actionId, "copy_case_wiki_remediation_draft");
  assert.equal(item?.compliance.enforcementStatus, "pass");
  assert.equal(item?.compliance.exportReady, true);
  assert.match(item?.meta ?? "", /Focus: Passport scan is still missing/i);
});

test("runtime operator queue snapshot sorts critical approvals before blockers and trims to limit", () => {
  const approvalCase = createCaseWiki({
    caseId: "case-approval",
    sessionId: "session-approval",
    generatedAt: "2026-04-16T08:05:00.000Z",
    title: "Approval-gated visa case",
    question: {
      question: "Operator approval is still pending.",
      blocking: true,
      owner: "operator",
      suggestedNextStep: "Open approvals and confirm the next action.",
    },
    route: {
      lane: "approval_queue",
      priority: "high",
      blocking: true,
      approvalRequired: true,
      status: "pending",
      dueBy: "2026-04-16T08:15:00.000Z",
      summary: "Approval pending before the customer message can be sent.",
    },
    nextAction: {
      type: "approval_request",
      title: "Approve the next customer follow-up",
      summary: "Approval is required before the customer message can be sent.",
      owner: "operator",
      dueBy: "2026-04-16T08:15:00.000Z",
      blocking: true,
    },
  });
  const blockerCase = createCaseWiki({
    caseId: "case-blocker",
    sessionId: "session-blocker",
    generatedAt: "2026-04-16T08:02:00.000Z",
    title: "Customer follow-up blocker",
    question: {
      question: "Invitation letter is still missing.",
      blocking: true,
      owner: "customer",
      suggestedNextStep: "Prepare the customer follow-up reminder.",
    },
    route: {
      lane: "customer_followup",
      priority: "high",
      blocking: true,
      approvalRequired: false,
      dueBy: "2026-04-16T08:20:00.000Z",
      summary: "Customer follow-up is still blocking the case.",
    },
    nextAction: {
      type: "document_request",
      title: "Request invitation letter",
      summary: "Ask the customer for the invitation letter.",
      owner: "operator",
      dueBy: "2026-04-16T08:20:00.000Z",
      blocking: true,
    },
  });
  const mediumCase = createCaseWiki({
    caseId: "case-medium",
    sessionId: "session-medium",
    generatedAt: "2026-04-16T08:10:00.000Z",
    title: "Routine operator follow-up",
    nextAction: {
      type: "operator_followup",
      title: "Review routine handoff",
      summary: "Open the normal operator follow-up without a blocking issue.",
      owner: "operator",
      blocking: false,
    },
  });

  const snapshot = buildRuntimeOperatorQueueSnapshot({
    tenantId: "tenant-queue-demo",
    caseWikis: [mediumCase, blockerCase, approvalCase],
    generatedAt: "2026-04-16T08:30:00.000Z",
    limit: 2,
  });

  assert.equal(snapshot.totalItems, 2);
  assert.equal(snapshot.blockingItems, 2);
  assert.deepEqual(
    snapshot.items.map((item) => item.caseId),
    ["case-approval", "case-blocker"],
  );
  assert.equal(snapshot.items[0]?.priority, "critical");
  assert.equal(snapshot.items[0]?.primary?.actionId, "saved_view_approvals");
  assert.equal(snapshot.items[1]?.priority, "high");
  assert.equal(snapshot.items[1]?.primary?.actionId, "saved_view_incidents");
});

test("runtime operator queue item returns null when case wiki has no actionable signal", () => {
  const wiki = createCaseWiki({
    caseId: "case-empty",
    sessionId: "session-empty",
    generatedAt: "2026-04-16T08:00:00.000Z",
    title: "Empty compiled case",
  });

  assert.equal(buildRuntimeOperatorQueueItem(wiki), null);
});

test("runtime operator queue escalates compliance enforcement blockers even without other actions", () => {
  const wiki = createCaseWiki({
    caseId: "case-compliance",
    sessionId: "session-compliance",
    generatedAt: "2026-04-16T08:12:00.000Z",
    title: "Compliance-only blocker",
  });
  wiki.compliance.enforcement = {
    status: "fail",
    snapshotMode: "raw_ref_review",
    rawRefCount: 2,
    rawRefsPreview: ["artifact:raw:passport-scan", "file:C:/tmp/passport-scan.png"],
    redactionRequired: true,
    redactionSatisfied: false,
    signingRequired: false,
    observedSignatureStatus: "unsigned",
    signatureSatisfied: true,
    exportReady: false,
    blockingReasons: ["raw_like_source_refs_detected"],
    artifactPosture: {
      totalArtifacts: 2,
      rawArtifacts: 2,
      redactedArtifacts: 0,
      signedArtifacts: 0,
      blockingArtifacts: 2,
      blockingRefs: ["artifact:raw:passport-scan", "file:C:/tmp/passport-scan.png"],
      items: [
        {
          ref: "artifact:raw:passport-scan",
          posture: "raw",
          source: "artifact_ref",
          blocking: true,
          summary: "Raw runtime artifact must be redacted before export.",
        },
        {
          ref: "file:C:/tmp/passport-scan.png",
          posture: "raw",
          source: "source_ref",
          blocking: true,
          summary: "Raw runtime artifact must be redacted before export.",
        },
      ],
    },
    summary: "status=fail | snapshot=raw_ref_review | redaction=blocked | signing=unsigned | export=blocked | rawRefs=2",
  };
  wiki.compliance.summary =
    "template=strict | tenant_override | pii=high | rawMedia=2d | audit=required | signing=unsigned | enforcement=fail";

  const item = buildRuntimeOperatorQueueItem(wiki);

  assert.ok(item);
  assert.equal(item?.priority, "critical");
  assert.equal(item?.blocking, true);
  assert.equal(item?.kicker, "Compliance blocker");
  assert.equal(item?.compliance.enforcementStatus, "fail");
  assert.equal(item?.compliance.exportReady, false);
  assert.deepEqual(item?.compliance.blockingReasons, ["raw_like_source_refs_detected"]);
  assert.deepEqual(item?.compliance.artifactPosture?.blockingRefs, [
    "artifact:raw:passport-scan",
    "file:C:/tmp/passport-scan.png",
  ]);
  assert.match(item?.meta ?? "", /Compliance: status=fail/i);
});
