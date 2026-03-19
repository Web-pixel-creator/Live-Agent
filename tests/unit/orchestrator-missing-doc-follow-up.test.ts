import assert from "node:assert/strict";
import test from "node:test";
import { createEnvelope, type OrchestratorRequest } from "../../shared/contracts/src/index.js";
import { orchestrate } from "../../agents/orchestrator/src/orchestrate.js";
import { getOrchestratorWorkflowStoreStatus } from "../../agents/orchestrator/src/workflow-store.js";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

test("orchestrator routes seeded missing-doc follow-up through live-agent and stores snapshot state", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";

  const request = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session-orch-missing-doc-follow-up",
    runId: "unit-run-orch-missing-doc-follow-up",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        scenario: "missing_documents_follow_up",
        seed: {
          caseId: "visa-case-002",
          clientName: "Amina Khan",
          destinationCountry: "Canada",
          visaType: "work permit",
          checklist: [
            { label: "Passport scan", status: "missing" },
            { label: "Proof of address", status: "missing" },
            { label: "Employment letter", status: "has" },
          ],
        },
      },
      task: {
        taskId: "task-orch-missing-doc-follow-up",
        status: "queued",
        stage: "intake",
      },
    },
  }) as OrchestratorRequest;

  const response = await orchestrate(request);
  assert.equal(response.payload.route, "live-agent");
  assert.equal(response.payload.status, "completed");

  const output = asObject(response.payload.output);
  const followUp = asObject(output.followUp);
  const summary = asObject(followUp.summary);
  const task = asObject(response.payload.task);
  const workflow = getOrchestratorWorkflowStoreStatus().workflowState;

  assert.equal(output.mode, "follow_up");
  assert.equal(followUp.followUpIntent, "document_collection_follow_up");
  assert.equal(followUp.status, "needs_documents");
  assert.match(String(output.message), /Missing Documents Follow-up/);
  assert.match(String(summary.operatorSummary), /Passport scan/);
  assert.match(String(summary.nextStep), /Passport scan/);
  assert.equal(task.status, "completed");
  assert.equal(task.stage, "reporting");
  assert.equal(workflow.followUpState?.scenario, "missing_documents_follow_up");
  assert.equal(workflow.followUpState?.followUpIntent, "document_collection_follow_up");
  assert.equal(workflow.followUpState?.caseId, "visa-case-002");
  assert.equal(workflow.followUpState?.missingItemsCount, 2);
  assert.equal(workflow.followUpState?.readyForSubmission, false);
});
