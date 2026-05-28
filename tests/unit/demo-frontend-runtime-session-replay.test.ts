import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRuntimeSessionReplaySummary,
  buildSessionExportMarkdown,
  buildSessionExportPayload,
} from "../../apps/demo-frontend/app-shell/src/lib/runtime-session-replay.ts";
import type { RuntimeCaseWiki } from "../../apps/demo-frontend/app-shell/src/hooks/useWorkspaceRuntime.tsx";
import type { WorkspaceCase } from "../../apps/demo-frontend/app-shell/src/data/workspace.ts";

function buildCase(): WorkspaceCase {
  return {
    ref: "case-visa-042",
    caseId: "case-visa-042",
    sessionId: "session-visa-042",
    source: "runtime",
    client: "A. Petrov",
    email: "case-visa-042@runtime-case.local",
    phone: "+00 000 000 0000",
    visa: "EU Blue Card",
    country: "DE",
    stage: "Document follow-up",
    stageEnteredAt: "2026-04-21T11:00:00.000Z",
    owner: "Maya K.",
    status: "needs_action",
    sla: "pending",
    updated: "Apr 21",
    events: [],
    documents: [],
    sourceNodeId: "NODE-BER-01",
  };
}

function buildWiki(): RuntimeCaseWiki {
  return {
    caseId: "case-visa-042",
    sessionId: "session-visa-042",
    generatedAt: "2026-04-21T11:30:00.000Z",
    overview: {
      title: "Visa intake follow-up",
      summary: "Passport scan is still missing, so the case cannot move to export.",
      status: "waiting_on_operator",
      customerGoal: "Collect the missing passport scan and prepare handoff.",
      currentStage: "Document follow-up",
      lastMeaningfulUpdateAt: "2026-04-21T11:25:00.000Z",
    },
    entities: [],
    timeline: [],
    openQuestions: [
      {
        id: "question-1",
        question: "Should the operator request a redacted passport scan before export?",
        priority: "high",
        blocking: true,
        owner: "Maya K.",
        suggestedNextStep: "Ask the customer to upload the passport scan.",
        sourceRefs: ["question:question-1"],
      },
    ],
    recommendedNextAction: {
      type: "approval_request",
      title: "Send missing-document reminder",
      summary: "Prepare and approve a customer reminder before export proceeds.",
      owner: "Maya K.",
      dueBy: "2026-04-21T12:00:00.000Z",
      blocking: true,
      relatedQuestionIds: ["question-1"],
      sourceRefs: ["action:reminder"],
    },
    highlights: {
      topBlockingQuestion: {
        id: "question-1",
        question: "Should the operator request a redacted passport scan before export?",
        priority: "high",
        blocking: true,
        owner: "Maya K.",
        suggestedNextStep: "Ask the customer to upload the passport scan.",
        sourceRefs: ["question:question-1"],
      },
    },
    operatorPreviewPack: {
      remediation: {
        draft: {
          kind: "redact_artifact",
          title: "Redact passport scan",
          targetLabel: "passport scan",
          owner: "Maya K.",
          dueBy: null,
          summary: "Replace the raw passport scan before export.",
          body: "Prepare the redacted replacement and attach it to the case.",
          checklist: ["Locate raw artifact", "Prepare redacted version"],
          sourceRefs: ["artifact:raw:passport-scan"],
        },
      },
      compliance: {
        enforcement: {
          exportReady: false,
          status: "fail",
        },
      },
    },
    compliance: {
      enforcement: {
        exportReady: false,
        status: "fail",
        summary: "Case Wiki export is blocked until raw evidence refs are redacted.",
      },
    },
    evidenceSignature: {
      status: "unsigned",
    },
  };
}

test("runtime session replay summary extracts boundary, proof ingress, and refresh path data", () => {
  const summary = buildRuntimeSessionReplaySummary({
    generatedAt: "2026-04-21T11:31:00.000Z",
    selectedSessionId: "session-visa-042",
    evidenceSignature: {
      status: "signed",
    },
    selectedSession: {
      session: {
        sessionId: "session-visa-042",
        status: "active",
      },
      workflow: {
        linked: true,
        workflowExecutionStatus: "active",
        workflowCurrentStage: "review",
        workflowRoute: "live-agent",
        workflowIntent: "document_follow_up",
      },
      replay: {
        replayState: "verified",
        resumeReady: true,
        nextOperatorAction: "resume_handoff",
        nextOperatorActionLabel: "Resume handoff",
        nextOperatorWorkspace: "runtime",
        nextOperatorChecklist: ["Open Session Ops.", "Resume the handoff package."],
        nextOperatorRemainingSteps: ["Resume the handoff package."],
        nextOperatorStepProgress: {
          label: "1/2",
        },
        boundaryOwner: {
          role: "operator",
          owner: "Maya K.",
          sessionId: "session-visa-042",
        },
        approvalGate: {
          status: "pending",
          reason: "Awaiting operator decision",
          pendingCount: 1,
        },
        workflowBoundarySummary: {
          kind: "handoff",
          summary: "Escalation pack is ready",
          nextStep: "Transfer to specialist",
          owner: "Maya K.",
        },
        latestProofPointer: {
          summary: "Runtime replay confirmed the missing passport artifact.",
          verifiedAt: "2026-04-21T11:31:00.000Z",
          route: "live-agent",
          intent: "document_follow_up",
          contextSource: "case_wiki",
          ingressSource: "preserved_input_case_wiki",
        },
        latestContextSource: "case_wiki",
        latestContextIngressSource: "gateway_hydrated_case_wiki",
        latestVerifiedContextSource: "case_wiki",
        latestVerifiedContextIngressSource: "preserved_input_case_wiki",
        recoveryPathHint: {
          label: "Resume from the handoff boundary and transfer the prepared case pack.",
          action: "resume_handoff",
        },
        recoveryHandoff: {
          targetLabel: "Operator Session Ops",
          reason: "Keep the selected session loaded while you resolve replay.",
        },
        liveTransport: {
          activeMode: "direct_live",
          provider: "mock",
          bootstrapState: "healthy",
          evidenceSource: "session_events",
          firstAudioMs: 182,
          firstOutputMs: 264,
        },
        nextOperatorPrimaryStep: {
          label: "Open Session Ops.",
          ctaLabel: "Open first step",
          targetLabel: "Operator Session Ops",
          actionMode: "openable",
          surfaceState: "primed",
          needsRefresh: true,
          refreshState: {
            disposition: "reopen_then_refresh",
            evidenceHint: "Refresh replay before the first operator step becomes executable.",
            outcomeLabel: "Rehydrate the current read model.",
            detourHint: "Stay in Session Ops until the recovery path is clear.",
            compatibility: {
              legacyProjection: "flat_refresh_escalation_fields",
            },
            followupPath: [
              {
                level: "path",
                label: "Open Session Ops.",
                targetLabel: "Operator Session Ops",
                stateLabel: "primed",
                ctaLabel: "Open first step",
              },
            ],
          },
        },
      },
    },
  });

  assert.ok(summary);
  assert.equal(summary?.sessionId, "session-visa-042");
  assert.equal(summary?.workflowRoute, "live-agent");
  assert.equal(summary?.replayState, "verified");
  assert.equal(summary?.approvalGateStatus, "pending");
  assert.equal(summary?.workflowBoundarySummary, "Escalation pack is ready");
  assert.equal(summary?.latestProofIngressSource, "preserved_input_case_wiki");
  assert.equal(summary?.latestTurnIngressSource, "gateway_hydrated_case_wiki");
  assert.equal(summary?.primaryStepNeedsRefresh, true);
  assert.equal(summary?.primaryStepRefreshCompatibility, "flat_refresh_escalation_fields");
  assert.deepEqual(summary?.primaryStepRefreshFollowupPath, [
    "path: Open Session Ops. (Operator Session Ops - primed - Open first step)",
  ]);
});

test("session export payload and markdown include case wiki and replay provenance", () => {
  const payload = buildSessionExportPayload({
    caseValue: buildCase(),
    wiki: buildWiki(),
    replaySummary: {
      generatedAt: "2026-04-21T11:31:00.000Z",
      sessionId: "session-visa-042",
      sessionStatus: "active",
      workflowLinked: true,
      workflowExecutionStatus: "active",
      workflowCurrentStage: "review",
      workflowRoute: "live-agent",
      workflowIntent: "document_follow_up",
      replayState: "verified",
      resumeReady: true,
      resumeBlockedBy: null,
      nextOperatorAction: "resume_handoff",
      nextOperatorActionLabel: "Resume handoff",
      nextOperatorWorkspace: "runtime",
      nextOperatorChecklist: ["Open Session Ops.", "Resume the handoff package."],
      nextOperatorRemainingSteps: ["Resume the handoff package."],
      nextOperatorStepProgressLabel: "1/2",
      boundaryOwnerRole: "operator",
      boundaryOwnerName: "Maya K.",
      boundaryOwnerSessionId: "session-visa-042",
      approvalGateStatus: "pending",
      approvalGateReason: "Awaiting operator decision",
      approvalGatePendingCount: 1,
      workflowBoundaryKind: "handoff",
      workflowBoundarySummary: "Escalation pack is ready",
      workflowBoundaryNextStep: "Transfer to specialist",
      workflowBoundaryOwner: "Maya K.",
      latestProofSummary: "Runtime replay confirmed the missing passport artifact.",
      latestProofVerifiedAt: "2026-04-21T11:31:00.000Z",
      latestProofRoute: "live-agent",
      latestProofIntent: "document_follow_up",
      latestProofContextSource: "case_wiki",
      latestProofIngressSource: "preserved_input_case_wiki",
      latestTurnContextSource: "case_wiki",
      latestTurnIngressSource: "gateway_hydrated_case_wiki",
      latestVerifiedContextSource: "case_wiki",
      latestVerifiedContextIngressSource: "preserved_input_case_wiki",
      recoveryPathLabel: "Resume from the handoff boundary and transfer the prepared case pack.",
      recoveryPathAction: "resume_handoff",
      recoveryHandoffTargetLabel: "Operator Session Ops",
      recoveryHandoffReason: "Keep the selected session loaded while you resolve replay.",
      liveTransportMode: "direct_live",
      liveTransportProvider: "mock",
      liveTransportBootstrapState: "healthy",
      liveTransportEvidenceSource: "session_events",
      liveTransportFallbackReason: null,
      liveTransportFirstAudioMs: 182,
      liveTransportFirstOutputMs: 264,
      primaryStepLabel: "Open Session Ops.",
      primaryStepCtaLabel: "Open first step",
      primaryStepTargetLabel: "Operator Session Ops",
      primaryStepActionMode: "openable",
      primaryStepSurfaceState: "primed",
      primaryStepNeedsRefresh: false,
      primaryStepRefreshDisposition: null,
      primaryStepRefreshEvidenceHint: null,
      primaryStepRefreshOutcomeLabel: null,
      primaryStepRefreshDetourHint: null,
      primaryStepRefreshCompatibility: null,
      primaryStepRefreshFollowupPath: [],
      evidenceSignatureStatus: "signed",
    },
    runtimeDiagnostics: {
      status: "healthy",
      orchestrator: {
        latestCaseWikiRoutingContext: {
          contextSource: "case_wiki",
          ingressSource: "preserved_input_case_wiki",
          blocker: "passport scan missing",
          nextAction: "Send missing-document reminder",
          route: "live-agent",
        },
      },
    },
  });

  const markdown = buildSessionExportMarkdown(payload);

  assert.equal(payload.case.ref, "case-visa-042");
  assert.equal(payload.caseWiki.exportReady, false);
  assert.equal(payload.runtimeSurface.latestCaseWikiIngressSource, "preserved_input_case_wiki");
  assert.match(markdown, /# Session Export/);
  assert.match(markdown, /Case Wiki export is blocked until raw evidence refs are redacted/);
  assert.match(markdown, /Proof context: case_wiki via preserved_input_case_wiki/);
  assert.match(markdown, /Latest Case Wiki ingress: case_wiki via preserved_input_case_wiki/);
});
