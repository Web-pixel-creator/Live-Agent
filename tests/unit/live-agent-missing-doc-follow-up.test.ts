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

test("live-agent recognizes seeded missing-doc follow-up input and returns operator-ready summary", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.LIVE_AGENT_CONTEXT_COMPACTION_ENABLED = "false";

  const request = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session-missing-doc-follow-up",
    runId: "unit-run-missing-doc-follow-up",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        scenario: "missing_documents_follow_up",
        seed: {
          caseId: "visa-case-001",
          clientName: "Amina Khan",
          destinationCountry: "Canada",
          visaType: "work permit",
          deadline: "2026-04-15",
          checklist: [
            { label: "Passport scan", status: "missing" },
            { label: "Proof of address", status: "missing" },
            { label: "Employment letter", status: "has" },
          ],
        },
      },
    },
  }) as OrchestratorRequest;

  const response = await runLiveAgent(request);
  assert.equal(response.payload.status, "completed");

  const output = asObject(response.payload.output);
  const followUp = asObject(output.followUp);
  const summary = asObject(followUp.summary);
  const leadProfile = asObject(followUp.leadProfile);
  const checklist = Array.isArray(followUp.checklist) ? followUp.checklist.map((item) => asObject(item)) : [];
  const missingItems = Array.isArray(followUp.missingItems) ? followUp.missingItems.map((item) => asObject(item)) : [];

  assert.equal(output.mode, "follow_up");
  assert.equal(followUp.followUpIntent, "document_collection_follow_up");
  assert.equal(followUp.status, "needs_documents");
  assert.equal(leadProfile.caseId, "visa-case-001");
  assert.equal(leadProfile.clientName, "Amina Khan");
  assert.equal(leadProfile.destinationCountry, "Canada");
  assert.ok(checklist.length >= 3);
  assert.equal(missingItems.length, 2);
  assert.match(String(output.message), /Missing Documents Follow-up/);
  assert.match(String(summary.shortSummary), /Passport scan/);
  assert.match(String(summary.operatorSummary), /Proof of address/);
  assert.equal(summary.readyForSubmission, false);
  assert.match(String(summary.nextStep), /Passport scan/);
});
