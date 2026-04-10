import assert from "node:assert/strict";
import test from "node:test";
import type {
  ApprovalRecord,
  EventListItem,
  RunListItem,
  SessionListItem,
} from "../../apps/api-backend/src/firestore.js";
import { buildRuntimeCaseWiki } from "../../apps/api-backend/src/runtime-case-wiki.js";
import type { RuntimeWorkflowControlPlaneSummary } from "../../apps/api-backend/src/runtime-workflow-control-plane.js";

function buildWorkflowSummary(
  overrides: Partial<RuntimeWorkflowControlPlaneSummary> = {},
): RuntimeWorkflowControlPlaneSummary {
  return {
    sourceKind: "repo",
    sourcePath: "./agents/orchestrator/src/workflow-store.ts",
    usingLastKnownGood: false,
    fingerprint: "workflow-fingerprint",
    loadedAt: "2026-04-09T09:00:00.000Z",
    lastAttemptAt: "2026-04-09T09:00:00.000Z",
    lastError: null,
    controlPlaneOverrideActive: false,
    controlPlaneOverrideUpdatedAt: null,
    controlPlaneOverrideReason: null,
    assistiveRouterEnabled: true,
    assistiveRouterApiKeyConfigured: true,
    assistiveRouterProvider: "gemini",
    assistiveRouterModel: "gemini-2.5-flash",
    assistiveRouterBaseUrl: "http://localhost:8082",
    assistiveRouterTimeoutMs: 8000,
    assistiveRouterMinConfidence: 0.5,
    assistiveRouterAllowIntents: ["translation", "ui_task"],
    assistiveRouterBudgetPolicy: "balanced",
    assistiveRouterPromptCaching: "enabled",
    assistiveRouterWatchlistEnabled: true,
    idempotencyTtlMs: 300000,
    workflowExecutionStatus: "active",
    workflowCurrentStage: "document_collection",
    workflowActiveRole: "operator",
    workflowRunId: "run-case-1",
    workflowSessionId: "session-case-1",
    workflowTaskId: "task-case-1",
    workflowIntent: "translation",
    workflowRoute: "live-agent",
    workflowReason: "Collect remaining visa materials.",
    workflowUpdatedAt: "2026-04-09T09:02:00.000Z",
    workflowBookingStatus: null,
    workflowBookingTopic: "Spouse visa consultation",
    workflowBookingSelectedSlotLabel: null,
    workflowBookingSummary: null,
    workflowHandoffScenario: null,
    workflowHandoffStatus: null,
    workflowHandoffIntent: null,
    workflowHandoffCaseId: null,
    workflowHandoffDestinationCountry: null,
    workflowHandoffAssignedOwner: null,
    workflowHandoffPriority: null,
    workflowHandoffSummary: null,
    workflowHandoffNextStep: null,
    workflowHandoffReady: null,
    workflowFollowUpScenario: "visa_followup",
    workflowFollowUpStatus: "collecting",
    workflowFollowUpIntent: "document_collection",
    workflowFollowUpCaseId: "case-42",
    workflowFollowUpDestinationCountry: "Canada",
    workflowFollowUpMissingItemsCount: 2,
    workflowFollowUpSummary: "Passport scan and invitation letter are still missing.",
    workflowFollowUpNextStep: "Ask the customer to upload the missing documents.",
    workflowFollowUpReady: false,
    retryContinuationStatusCode: 409,
    retryContinuationBackoffMs: 250,
    retryTransientErrorCodes: ["ETIMEDOUT"],
    retryTransientErrorPatterns: [],
    retryTerminalErrorCodes: [],
    retryTerminalErrorPatterns: [],
    ...overrides,
  };
}

test("runtime case wiki returns null when no session context is available", () => {
  const wiki = buildRuntimeCaseWiki({
    sessions: [],
    runs: [],
    approvals: [],
    recentEvents: [],
    selectedEvents: [],
  });

  assert.equal(wiki, null);
});

test("runtime case wiki builds compiled overview, timeline, proofs, and next action from runtime evidence", () => {
  const sessions: SessionListItem[] = [
    {
      sessionId: "session-case-1",
      tenantId: "tenant-a",
      mode: "live",
      status: "active",
      version: 3,
      lastMutationId: "mutation-case-1",
      updatedAt: "2026-04-09T09:03:00.000Z",
    },
  ];

  const runs: RunListItem[] = [
    {
      runId: "run-case-1",
      sessionId: "session-case-1",
      status: "completed",
      route: "live-agent",
      updatedAt: "2026-04-09T09:03:00.000Z",
    },
  ];

  const approvals: ApprovalRecord[] = [
    {
      approvalId: "approval-case-1",
      tenantId: "tenant-a",
      sessionId: "session-case-1",
      runId: "run-case-1",
      status: "approved",
      decision: "approved",
      reason: "Escalation pack was cleared by the operator.",
      requestedAt: "2026-04-09T08:50:00.000Z",
      softDueAt: "2026-04-09T08:55:00.000Z",
      hardDueAt: "2026-04-09T09:10:00.000Z",
      resolvedAt: "2026-04-09T08:52:00.000Z",
      softReminderSentAt: null,
      auditLog: [],
      createdAt: "2026-04-09T08:50:00.000Z",
      updatedAt: "2026-04-09T08:52:00.000Z",
      metadata: null,
    },
  ];

  const selectedEvents: EventListItem[] = [
    {
      eventId: "event-case-1",
      sessionId: "session-case-1",
      runId: "run-case-1",
      type: "orchestrator.response",
      source: "live-agent",
      createdAt: "2026-04-09T09:03:00.000Z",
      route: "live-agent",
      status: "completed",
      intent: "translation",
      verificationState: "verified",
      verificationSummary: "Initial intake summary was verified and attached to the case.",
      liveTransportMode: "direct_live",
      liveTransportProvider: "gemini_live_api",
      liveTransportModel: "gemini-live-2.5-flash-native-audio",
      liveTransportEvidenceSource: "session_events",
    },
    {
      eventId: "event-case-note-1",
      sessionId: "session-case-1",
      runId: "run-case-1",
      type: "operator.note",
      source: "operator",
      createdAt: "2026-04-09T09:01:00.000Z",
      route: "case-wiki",
      status: "captured",
      payload: {
        kind: "case_wiki_note",
        title: "Customer follow-up required",
        note: "Customer must upload the passport scan before submission.",
        priority: "high",
        blocking: true,
        owner: "customer",
        suggestedNextStep: "Request the missing passport scan.",
      },
      metadata: {
        kind: "case_wiki_note",
      },
    },
  ];

  const wiki = buildRuntimeCaseWiki({
    sessions,
    runs,
    approvals,
    recentEvents: selectedEvents,
    selectedEvents,
    selectedSessionId: "session-case-1",
    workflowSummary: buildWorkflowSummary(),
    userId: "user-case-1",
    now: new Date("2026-04-09T09:05:00.000Z"),
  });

  assert.ok(wiki, "expected a compiled case wiki");
  assert.equal(wiki?.schemaVersion, 1);
  assert.equal(wiki?.caseId, "case-42");
  assert.equal(wiki?.sessionId, "session-case-1");
  assert.equal(wiki?.userId, "user-case-1");
  assert.equal(wiki?.generatedAt, "2026-04-09T09:05:00.000Z");
  assert.equal(wiki?.overview.title, "Case case-42 for Canada");
  assert.equal(wiki?.overview.status, "waiting_on_customer");
  assert.equal(wiki?.overview.customerGoal, "Spouse visa consultation");
  assert.equal(wiki?.overview.currentStage, "document_collection");
  assert.match(wiki?.overview.summary ?? "", /passport scan and invitation letter are still missing/i);
  assert.match(wiki?.overview.missingEvidenceSummary ?? "", /2 required follow-up items still missing/i);
  assert.equal(wiki?.overview.contradictionsSummary, null);
  assert.equal(wiki?.highlights.topProof?.id, "proof:followup-completeness");
  assert.equal(wiki?.highlights.topProof?.status, "missing");
  assert.equal(wiki?.highlights.topEntity?.id, "location:canada");
  assert.equal(wiki?.highlights.topEntity?.label, "Canada");
  assert.equal(wiki?.highlights.topBlockingQuestion?.id, "question:missing-followup-items");
  assert.equal(wiki?.evidencePack.proofs[0]?.id, "proof:followup-completeness");
  assert.equal(wiki?.evidencePack.entities[0]?.id, "location:canada");
  assert.equal(wiki?.evidencePack.questions[0]?.id, "question:missing-followup-items");
  assert.equal(wiki?.evidencePack.sourceRefs.includes("workflow:control-plane"), true);
  assert.equal(wiki?.handoffPack.proofs[0]?.focusId, "proof:followup-completeness");
  assert.match(wiki?.handoffPack.proofs[0]?.handoff ?? "", /Focus proof: Follow-up package is complete/i);
  assert.equal(wiki?.handoffPack.questions[0]?.focusId, "question:missing-followup-items");
  assert.match(wiki?.handoffPack.questions[0]?.handoff ?? "", /Resolve: Ask the customer to upload the missing documents/i);
  assert.equal(wiki?.detailPack.proofs[0]?.focusId, "proof:followup-completeness");
  assert.match(wiki?.detailPack.proofs[0]?.meta ?? "", /Missing/i);
  assert.equal(wiki?.detailPack.questions[0]?.focusId, "question:missing-followup-items");
  assert.match(wiki?.detailPack.questions[0]?.meta ?? "", /owner: customer/i);
  assert.equal(wiki?.routingPack.proofs[0]?.focusId, "proof:followup-completeness");
  assert.equal(wiki?.routingPack.proofs[0]?.route.lane, "customer_followup");
  assert.equal(wiki?.routingPack.proofs[0]?.cta.actionId, "run_negotiation");
  assert.equal(wiki?.routingPack.questions[0]?.focusId, "question:missing-followup-items");
  assert.equal(wiki?.routingPack.questions[0]?.route.blocking, true);
  assert.equal(wiki?.actionPack.proofs[0]?.focusId, "proof:followup-completeness");
  assert.match(wiki?.actionPack.proofs[0]?.refsText ?? "", /workflow:control-plane/i);
  assert.equal(wiki?.actionPack.questions[0]?.focusId, "question:missing-followup-items");
  assert.match(wiki?.actionPack.questions[0]?.handoffText ?? "", /Question handoff/i);
  assert.equal(wiki?.focusPack.proofs[0]?.focusId, "proof:followup-completeness");
  assert.match(wiki?.focusPack.proofs[0]?.drilldown ?? "", /Follow-up package is complete/i);
  assert.equal(wiki?.focusPack.questions[0]?.focusId, "question:missing-followup-items");
  assert.match(wiki?.focusPack.questions[0]?.handoffPreview ?? "", /Focus question/i);
  assert.match(wiki?.previewPack.packValue ?? "", /3 proofs/i);
  assert.match(wiki?.previewPack.refsValue ?? "", /workflow:control-plane/i);
  assert.match(wiki?.previewPack.questionsSummary ?? "", /\[high\]/i);
  assert.match(wiki?.previewPack.handoffValue ?? "", /Request missing follow-up items/i);
  assert.match(wiki?.workspacePack.statusValue ?? "", /Waiting on customer/i);
  assert.match(wiki?.workspacePack.summaryValue ?? "", /passport scan and invitation letter are still missing/i);
  assert.match(wiki?.workspacePack.blockerValue ?? "", /missing follow-up items/i);
  assert.match(wiki?.workspacePack.nextActionValue ?? "", /Request missing follow-up items/i);
  assert.match(wiki?.workspacePack.packValue ?? "", /3 proofs/i);
  assert.match(wiki?.workspacePack.handoffValue ?? "", /Request missing follow-up items/i);
  assert.match(wiki?.operatorPreviewPack.overview.overview?.summary ?? "", /passport scan and invitation letter are still missing/i);
  assert.equal(wiki?.operatorPreviewPack.overview.counts.proofs, wiki?.proofs.length);
  assert.equal(wiki?.operatorPreviewPack.evidence.topProof?.status, "missing");
  assert.match(wiki?.operatorPreviewPack.evidence.topEntity?.summary ?? "", /Primary destination/i);
  assert.match(wiki?.operatorPreviewPack.evidence.recommendedNextAction?.summary ?? "", /upload the missing documents/i);
  assert.equal(wiki?.entities.some((item) => item.kind === "case" && item.id === "case:case-42"), true);
  assert.equal(wiki?.entities.some((item) => item.kind === "location" && item.label === "Canada"), true);
  assert.equal(wiki?.timeline[0]?.id, "session:session-case-1");
  assert.equal(wiki?.timeline.some((item) => item.kind === "workflow"), true);
  assert.equal(wiki?.timeline.some((item) => item.kind === "approval"), true);
  assert.equal(
    wiki?.timeline.some(
      (item) => item.kind === "operator_note" && item.title === "Customer follow-up required",
    ),
    true,
  );
  assert.equal(
    wiki?.proofs.some(
      (item) =>
        item.id === "proof:followup-completeness" &&
        item.status === "missing" &&
        /2 required follow-up items/i.test(item.evidenceSummary ?? ""),
    ),
    true,
  );
  assert.equal(
    wiki?.proofs.some((item) => item.id === "proof:approval:approval-case-1" && item.status === "confirmed"),
    true,
  );
  assert.equal(
    wiki?.proofs.some((item) => item.id === "proof:event:event-case-1" && item.status === "confirmed"),
    true,
  );
  assert.equal(
    wiki?.openQuestions.some(
      (item) =>
        item.id === "question:missing-followup-items" &&
        item.priority === "high" &&
        item.blocking === true,
    ),
    true,
  );
  assert.equal(
    wiki?.openQuestions.some(
      (item) =>
        item.id === "question:event:event-case-note-1" &&
        item.owner === "customer" &&
        item.blocking === true,
    ),
    true,
  );
  assert.deepEqual(wiki?.recommendedNextAction, {
    type: "document_request",
    title: "Request missing follow-up items",
    summary: "Ask the customer to upload the missing documents.",
    owner: "customer",
    dueBy: null,
    blocking: true,
    relatedQuestionIds: ["question:missing-followup-items"],
    sourceRefs: ["workflow:control-plane"],
  });
});

test("runtime case wiki prioritizes pending approvals as the next action when operator decision is blocking", () => {
  const wiki = buildRuntimeCaseWiki({
    sessions: [
      {
        sessionId: "session-approval-1",
        tenantId: "tenant-a",
        mode: "ui",
        status: "paused",
        version: 2,
        lastMutationId: "mutation-approval-1",
        updatedAt: "2026-04-09T09:10:00.000Z",
      },
    ],
    runs: [
      {
        runId: "run-approval-1",
        sessionId: "session-approval-1",
        status: "pending_approval",
        route: "ui-navigator-agent",
        updatedAt: "2026-04-09T09:10:00.000Z",
      },
    ],
    approvals: [
      {
        approvalId: "approval-pending-1",
        tenantId: "tenant-a",
        sessionId: "session-approval-1",
        runId: "run-approval-1",
        status: "pending",
        decision: null,
        reason: "Approve browser-side submission before continuing.",
        requestedAt: "2026-04-09T09:08:00.000Z",
        softDueAt: "2026-04-09T09:12:00.000Z",
        hardDueAt: "2026-04-09T09:20:00.000Z",
        resolvedAt: null,
        softReminderSentAt: null,
        auditLog: [],
        createdAt: "2026-04-09T09:08:00.000Z",
        updatedAt: "2026-04-09T09:08:00.000Z",
        metadata: null,
      },
    ],
    recentEvents: [
      {
        eventId: "event-approval-1",
        sessionId: "session-approval-1",
        runId: "run-approval-1",
        type: "orchestrator.response",
        source: "ui-navigator-agent",
        createdAt: "2026-04-09T09:10:00.000Z",
        route: "ui-navigator-agent",
        status: "pending_approval",
        intent: "ui_task",
        approvalId: "approval-pending-1",
        approvalStatus: "pending",
      },
    ],
    selectedEvents: [],
    workflowSummary: buildWorkflowSummary({
      workflowSessionId: "session-approval-1",
      workflowCurrentStage: "operator_review",
      workflowActiveRole: "operator",
      workflowRoute: "ui-navigator-agent",
      workflowFollowUpCaseId: "case-approval-1",
      workflowFollowUpMissingItemsCount: 0,
      workflowFollowUpSummary: "Browser replay is ready once approval clears.",
      workflowFollowUpNextStep: "Resolve the pending approval before resuming browser automation.",
    }),
    now: new Date("2026-04-09T09:11:00.000Z"),
  });

  assert.ok(wiki);
  assert.equal(wiki?.overview.status, "waiting_on_operator");
  assert.equal(wiki?.recommendedNextAction?.type, "approval_request");
  assert.equal(wiki?.recommendedNextAction?.owner, "operator");
  assert.equal(wiki?.recommendedNextAction?.dueBy, "2026-04-09T09:20:00.000Z");
  assert.deepEqual(wiki?.recommendedNextAction?.relatedQuestionIds, ["question:approval:approval-pending-1"]);
  assert.deepEqual(wiki?.recommendedNextAction?.sourceRefs, ["approval:approval-pending-1"]);
  assert.equal(wiki?.highlights.topBlockingQuestion?.id, "question:approval:approval-pending-1");
  assert.equal(wiki?.handoffPack.questions[0]?.focusId, "question:approval:approval-pending-1");
  assert.match(wiki?.handoffPack.questions[0]?.handoff ?? "", /Focus question: Who should resolve the pending operator approval/i);
  assert.equal(wiki?.detailPack.questions[0]?.focusId, "question:approval:approval-pending-1");
  assert.match(wiki?.detailPack.questions[0]?.meta ?? "", /Blocking/i);
  assert.equal(wiki?.routingPack.questions[0]?.route.lane, "approval_queue");
  assert.equal(wiki?.routingPack.questions[0]?.cta.actionId, "open_workflow_control");
  assert.equal(wiki?.actionPack.questions[0]?.focusId, "question:approval:approval-pending-1");
  assert.match(wiki?.actionPack.questions[0]?.refsText ?? "", /approval:approval-pending-1/i);
  assert.equal(wiki?.focusPack.questions[0]?.focusId, "question:approval:approval-pending-1");
  assert.match(wiki?.focusPack.questions[0]?.chipTitle ?? "", /Owner: operator/i);
  assert.match(wiki?.previewPack.handoffValue ?? "", /Resolve pending approval/i);
  assert.match(wiki?.workspacePack.statusValue ?? "", /Waiting on operator/i);
  assert.match(wiki?.workspacePack.nextActionValue ?? "", /Resolve pending approval/i);
  assert.match(wiki?.operatorPreviewPack.overview.overview?.summary ?? "", /approval.*pending|pending.*approval/i);
  assert.equal(wiki?.operatorPreviewPack.evidence.recommendedNextAction?.type, "approval_request");
});
