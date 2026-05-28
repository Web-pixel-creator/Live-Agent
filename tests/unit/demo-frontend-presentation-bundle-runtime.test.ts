import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceCase } from "../../apps/demo-frontend/app-shell/src/data/workspace.ts";
import {
  buildPresentationBundleIndex,
  buildRuntimePresentationBundle,
  buildRuntimePresentationBundles,
  matchesPresentationBundleRef,
  type RuntimePresentationCaseWiki,
  type RuntimePresentationSessionReplay,
} from "../../apps/demo-frontend/app-shell/src/lib/presentation-bundle-runtime.ts";

function buildRuntimeCaseWiki(
  overrides: Partial<RuntimePresentationCaseWiki> = {},
): RuntimePresentationCaseWiki {
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
    highlights: {
      topProof: {
        id: "proof-1",
        statement: "passport scan missing",
        status: "pending",
        confidence: 88,
        evidenceSummary: "Document inventory still lacks a passport scan artifact.",
        contradictionNote: null,
        sourceRefs: ["proof:proof-1"],
      },
      topEntity: {
        id: "entity-1",
        kind: "person",
        label: "A. Petrov",
        role: "applicant",
        description: "Primary applicant for the visa intake.",
        sourceRefs: ["entity:person-1"],
      },
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
    entities: [
      {
        id: "entity-1",
        kind: "person",
        label: "A. Petrov",
        role: "applicant",
        description: "Primary applicant for the visa intake.",
        sourceRefs: ["entity:person-1"],
      },
      {
        id: "entity-2",
        kind: "document",
        label: "Employment contract",
        role: null,
        description: "Verified and attached to the case record.",
        sourceRefs: ["artifact:signed:employment-contract"],
      },
    ],
    timeline: [
      {
        ts: "2026-04-21T11:00:00.000Z",
        kind: "session",
        title: "Lead intake",
        summary: "Client started the visa intake.",
        sourceRefs: ["event:event-1"],
      },
      {
        ts: "2026-04-21T11:12:00.000Z",
        kind: "workflow",
        title: "Document gap detected",
        summary: "Case Wiki flagged a missing passport scan.",
        sourceRefs: ["event:event-2", "NODE-BER-01"],
      },
      {
        ts: "2026-04-21T11:18:00.000Z",
        kind: "approval",
        title: "Approval requested",
        summary: "Operator approval is required before the reminder is sent.",
        sourceRefs: ["event:event-3"],
      },
    ],
    proofs: [
      {
        id: "proof-1",
        statement: "passport scan missing",
        status: "pending",
        confidence: 88,
        evidenceSummary: "Document inventory still lacks a passport scan artifact.",
        contradictionNote: null,
        sourceRefs: ["proof:proof-1"],
      },
    ],
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
    compliance: {
      templateId: "regulated",
      enforcement: {
        exportReady: false,
        status: "fail",
        blockingReasons: ["raw_like_source_refs_detected"],
        artifactPosture: {
          totalItems: 3,
          rawCount: 1,
          redactedCount: 1,
          signedCount: 1,
          blockingRefs: ["artifact:raw:passport-scan"],
          items: [
            { ref: "artifact:raw:passport-scan", posture: "raw", source: "artifact_ref" },
          ],
        },
        remediation: {
          primaryAction: {
            title: "Redact passport scan",
            summary: "Replace the raw passport scan with a redacted artifact before export.",
            blockingRef: "artifact:raw:passport-scan",
            operatorActionLabel: "Prepare redacted replacement",
            requiredPosture: "redacted",
          },
        },
      },
    },
    evidenceSignature: {
      status: "unsigned",
      payloadHash: "sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      signedAt: "2026-04-21T11:30:00.000Z",
      signerId: "api-backend",
    },
    ...overrides,
  };
}

test("runtime presentation bundle derives judge-facing narrative from case wiki and replay", () => {
  const wiki = buildRuntimeCaseWiki();
  const replay: RuntimePresentationSessionReplay = {
    evidenceSignature: {
      status: "unsigned",
      payloadHash: "sha256:feedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed",
      signedAt: "2026-04-21T11:31:00.000Z",
    },
    selectedSession: {
      workflow: {
        workflowRoute: "live-agent",
        workflowIntent: "document_follow_up",
        workflowCurrentStage: "review",
      },
      replay: {
        latestVerifiedSummary: "Runtime replay confirmed the missing passport artifact.",
        latestVerifiedStage: "review",
        latestProofPointer: {
          runId: "run-1",
          summary: "Missing passport artifact confirmed.",
          verifiedAt: "2026-04-21T11:31:00.000Z",
          route: "live-agent",
          intent: "document_follow_up",
          contextSource: "case_wiki",
          ingressSource: "preserved_input_case_wiki",
          workflowStage: "review",
        },
        liveTransport: {
          mode: "direct_live",
          status: "healthy",
          fallbackEventCount: 0,
          firstAudioMs: 182,
          firstOutputMs: 264,
        },
      },
    },
  };
  const fallbackCase: WorkspaceCase = {
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

  const bundle = buildRuntimePresentationBundle({ wiki, replay, fallbackCase });

  assert.equal(bundle.source, "runtime");
  assert.equal(bundle.id, "case-visa-042");
  assert.equal(bundle.runtimeSource?.sessionId, "session-visa-042");
  assert.equal(bundle.outcomeTone, "rose");
  assert.equal(bundle.operator, "Maya K.");
  assert.match(bundle.policyHash, /^sha256:/);
  assert.equal(bundle.decision.policyName, "live-agent");
  assert.equal(bundle.decision.changes.some((item) => item.label === "Context ingress"), true);
  assert.equal(bundle.evidence.some((item) => item.kind === "Node telemetry"), true);
  assert.equal(bundle.evidence.some((item) => item.title === "Evidence signature"), true);
  assert.equal(bundle.counterfactual.rows.length, 4);
});

test("runtime presentation bundle collections preserve route matching and index summaries", () => {
  const newest = buildRuntimeCaseWiki({
    caseId: "case-newest",
    sessionId: "session-newest",
    generatedAt: "2026-04-21T12:00:00.000Z",
  });
  const older = buildRuntimeCaseWiki({
    caseId: "case-older",
    sessionId: "session-older",
    generatedAt: "2026-04-21T09:00:00.000Z",
  });

  const bundles = buildRuntimePresentationBundles({
    caseWikis: [older, newest],
  });
  const index = buildPresentationBundleIndex(bundles);

  assert.equal(bundles[0]?.id, "case-newest");
  assert.equal(index[0]?.id, "case-newest");
  assert.equal(index[0]?.source, "runtime");
  assert.equal(matchesPresentationBundleRef(bundles[0], "case-newest"), true);
  assert.equal(matchesPresentationBundleRef(bundles[0], "session-newest"), true);
  assert.equal(matchesPresentationBundleRef(bundles[0], bundles[0].caseRef), true);
  assert.equal(matchesPresentationBundleRef(bundles[0], "BDL-unknown"), false);
});
