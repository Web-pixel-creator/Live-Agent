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

test("live-agent offers at least two visa/relocation consultation slots", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.LIVE_AGENT_CONTEXT_COMPACTION_ENABLED = "false";

  const request = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session-booking-offer",
    runId: "unit-run-booking-offer",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "I need to book a visa and relocation consultation.",
      },
    },
  }) as OrchestratorRequest;

  const response = await runLiveAgent(request);
  assert.equal(response.payload.status, "completed");

  const output = asObject(response.payload.output);
  const booking = asObject(output.booking);
  const slots = Array.isArray(booking.slots) ? booking.slots.map((item) => asObject(item)) : [];

  assert.equal(output.mode, "booking");
  assert.equal(booking.status, "offered");
  assert.ok(slots.length >= 2);
  assert.match(String(output.message), /Choose one of these slots/);
  assert.equal(booking.selectedSlotId, null);
  assert.equal(booking.confirmedSummary, null);
});

test("live-agent confirms a selected consultation slot with a structured summary", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.LIVE_AGENT_CONTEXT_COMPACTION_ENABLED = "false";

  const sessionId = "unit-session-booking-confirm";

  const offerRequest = createEnvelope({
    userId: "unit-user",
    sessionId,
    runId: "unit-run-booking-confirm-offer",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "Please book a visa consultation for relocation.",
      },
    },
  }) as OrchestratorRequest;

  const offerResponse = await runLiveAgent(offerRequest);
  assert.equal(offerResponse.payload.status, "completed");

  const confirmRequest = createEnvelope({
    userId: "unit-user",
    sessionId,
    runId: "unit-run-booking-confirm",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "Slot 2 works for me.",
      },
    },
  }) as OrchestratorRequest;

  const confirmResponse = await runLiveAgent(confirmRequest);
  assert.equal(confirmResponse.payload.status, "completed");

  const output = asObject(confirmResponse.payload.output);
  const booking = asObject(output.booking);
  const selectedSlot = asObject(booking.selectedSlot);
  const confirmedSummary = asObject(booking.confirmedSummary);

  assert.equal(output.mode, "booking");
  assert.equal(booking.status, "confirmed");
  assert.equal(booking.selectedSlotId, "slot-2");
  assert.equal(selectedSlot.id, "slot-2");
  assert.match(String(confirmedSummary.shortSummary), /Confirmed visa and relocation consultation/);
  assert.match(String(confirmedSummary.shortSummary), /Wed 02:30 PM/);
  assert.equal(confirmedSummary.slotId, "slot-2");
  assert.equal(confirmedSummary.slotLabel, "Wed 02:30 PM");
});
