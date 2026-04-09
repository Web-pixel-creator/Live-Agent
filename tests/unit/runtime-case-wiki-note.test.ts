import assert from "node:assert/strict";
import test from "node:test";
import {
  appendRuntimeCaseWikiNote,
  normalizeRuntimeCaseWikiNoteRequest,
} from "../../apps/api-backend/src/runtime-case-wiki-notes.js";

test("runtime case wiki note validator rejects missing sessionId and note", () => {
  const missingSession = normalizeRuntimeCaseWikiNoteRequest({
    note: "Missing passport scan.",
  });
  assert.equal(missingSession.ok, false);
  if (missingSession.ok) {
    assert.fail("expected missing sessionId to be rejected");
  }
  assert.equal(missingSession.code, "API_RUNTIME_CASE_WIKI_NOTE_INVALID_REQUEST");

  const missingNote = normalizeRuntimeCaseWikiNoteRequest({
    sessionId: "session-1",
  });
  assert.equal(missingNote.ok, false);
  if (missingNote.ok) {
    assert.fail("expected missing note to be rejected");
  }
  assert.equal(missingNote.code, "API_RUNTIME_CASE_WIKI_NOTE_INVALID_REQUEST");
});

test("runtime case wiki note append persists operator note through session events", async () => {
  const normalized = normalizeRuntimeCaseWikiNoteRequest({
    sessionId: "session-note-1",
    runId: "run-note-1",
    userId: "operator-note-1",
    title: "Missing passport scan",
    note: "Customer still needs to send the passport scan.",
    priority: "high",
    blocking: true,
    owner: "customer",
    suggestedNextStep: "Request the missing document before filing.",
    ts: "2026-04-09T10:00:00.000Z",
  });
  assert.equal(normalized.ok, true);
  if (!normalized.ok) {
    return;
  }

  const response = await appendRuntimeCaseWikiNote({
    tenantId: "tenant-a",
    request: normalized.value,
  });

  assert.deepEqual(response, {
    accepted: true,
    eventId: normalized.value.eventId,
    sessionId: "session-note-1",
    runId: "run-note-1",
    source: "operator",
    kind: "operator_note",
    createdAt: "2026-04-09T10:00:00.000Z",
  });
});
