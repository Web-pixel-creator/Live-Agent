import assert from "node:assert/strict";
import test from "node:test";
import { createEnvelope, type OrchestratorRequest } from "@mla/contracts";
import { runLiveAgent } from "../../agents/live-agent/src/index.js";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected object payload");
  }
  return value as Record<string, unknown>;
}

test("live-agent recognizes seeded case escalation input and returns operator-ready human handoff summary", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.LIVE_AGENT_CONTEXT_COMPACTION_ENABLED = "false";

  const request = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session-case-escalation",
    runId: "unit-run-case-escalation",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        scenario: "case_escalation_human_handoff",
        handoff: {
          caseId: "VISA-2048",
          clientName: "Anna Petrova",
          destinationCountry: "Spain",
          visaType: "Digital Nomad Visa",
          assignedOwner: "Sofia Kim",
          escalationReason: "Proof of address is still missing and the deadline is inside 48 hours.",
          priority: "high",
          caseNote: "Call Anna, confirm the address letter, and keep the escalation queue updated.",
        },
      },
    },
  }) as OrchestratorRequest;

  const response = await runLiveAgent(request);
  assert.equal(response.payload.status, "completed");

  const output = asObject(response.payload.output);
  const handoff = asObject(output.handoff);
  const summary = asObject(handoff.summary);
  const leadProfile = asObject(handoff.leadProfile);

  assert.equal(output.mode, "handoff");
  assert.equal(handoff.scenario, "case_escalation_human_handoff");
  assert.equal(handoff.handoffIntent, "human_handoff");
  assert.equal(handoff.status, "ready_for_handoff");
  assert.equal(leadProfile.caseId, "VISA-2048");
  assert.equal(leadProfile.clientName, "Anna Petrova");
  assert.equal(leadProfile.assignedOwner, "Sofia Kim");
  assert.equal(summary.assignedOwner, "Sofia Kim");
  assert.equal(summary.priority, "high");
  assert.equal(summary.readyForHandoff, true);
  assert.match(String(output.message), /Case Escalation \/ Human Handoff/);
  assert.match(String(handoff.operatorSummary), /Sofia Kim/);
  assert.match(String(handoff.operatorSummary), /deadline/i);
  assert.match(String(handoff.nextStep), /Assign to Sofia Kim/i);
});
