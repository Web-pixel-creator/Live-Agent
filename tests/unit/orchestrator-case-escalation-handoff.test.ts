import assert from "node:assert/strict";
import test from "node:test";
import { createEnvelope, type OrchestratorRequest } from "../../shared/contracts/src/index.js";
import { orchestrate } from "../../agents/orchestrator/src/orchestrate.js";
import {
  clearOrchestratorWorkflowExecutionState,
  getOrchestratorWorkflowStoreStatus,
} from "../../agents/orchestrator/src/workflow-store.js";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

test("orchestrator routes seeded case escalation handoff through live-agent and stores snapshot state", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  clearOrchestratorWorkflowExecutionState();

  const request = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session-orch-case-handoff",
    runId: "unit-run-orch-case-handoff",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        scenario: "case_escalation_human_handoff",
        seed: {
          caseId: "visa-case-004",
          clientName: "Anna Petrova",
          destinationCountry: "Germany",
          visaType: "work permit",
          assignedOwner: "Sofia Kim",
          escalationReason: "Client needs a human callback after the deadline changed.",
          caseNote: "Please review the case and take over the next client touchpoint.",
          priority: "high",
          prompt: "Review the case and confirm next steps with the client.",
        },
      },
      task: {
        taskId: "task-orch-case-handoff",
        status: "queued",
        stage: "intake",
      },
    },
  }) as OrchestratorRequest;

  const response = await orchestrate(request);
  assert.equal(response.payload.route, "live-agent");
  assert.equal(response.payload.status, "completed");

  const output = asObject(response.payload.output);
  const handoff = asObject(output.handoff);
  const summary = asObject(handoff.summary);
  const task = asObject(response.payload.task);
  const workflow = getOrchestratorWorkflowStoreStatus().workflowState;

  assert.equal(output.mode, "handoff");
  assert.equal(handoff.handoffIntent, "human_handoff");
  assert.equal(handoff.status, "ready_for_handoff");
  assert.match(String(output.message), /Case Escalation \/ Human Handoff/);
  assert.match(String(summary.operatorSummary), /Sofia Kim/);
  assert.match(String(summary.prompt), /review the case/i);
  assert.equal(task.status, "completed");
  assert.equal(task.stage, "reporting");
  assert.equal(workflow.handoffState?.scenario, "case_escalation_human_handoff");
  assert.equal(workflow.handoffState?.handoffIntent, "human_handoff");
  assert.equal(workflow.handoffState?.caseId, "visa-case-004");
  assert.equal(workflow.handoffState?.assignedOwner, "Sofia Kim");
  assert.equal(workflow.handoffState?.priority, "high");
  assert.equal(workflow.handoffState?.readyForHandoff, true);
});
