import test from "node:test";
import assert from "node:assert/strict";
import {
  ingestRuntimeLiveSessionEvent,
  normalizeRuntimeLiveSessionEventIngestRequest,
} from "../../apps/api-backend/src/runtime-live-session-events.js";
import { listEvents, listSessions } from "../../apps/api-backend/src/firestore.js";

test("runtime live session event validator rejects non-direct-live source", () => {
  const normalized = normalizeRuntimeLiveSessionEventIngestRequest({
    sessionId: "session-live-invalid",
    type: "gateway.connected",
    source: "frontend",
  });

  assert.equal(normalized.ok, false);
  if (normalized.ok) {
    assert.fail("expected non-direct-live source to be rejected");
  }
  assert.equal(normalized.code, "API_RUNTIME_LIVE_SESSION_EVENT_INVALID_REQUEST");
  assert.match(normalized.message, /direct_live source/i);
});

test("runtime live session ingest persists repo-owned direct-live replay proof", async () => {
  const normalized = normalizeRuntimeLiveSessionEventIngestRequest({
    id: "evt-direct-proof-runtime",
    sessionId: "session-live-proof",
    runId: "run-live-proof",
    source: "direct_live",
    type: "gateway.connected",
    ts: "2026-04-08T12:34:56.000Z",
    payload: {
      route: "live-agent",
      status: "connected",
      intent: "translation",
      liveTransport: {
        activeMode: "direct_live",
        provider: "gemini_live_api",
        model: "gemini-live-2.5-flash-native-audio",
        bootstrapState: "prepared_direct",
      },
    },
  });

  assert.equal(normalized.ok, true);
  if (!normalized.ok) {
    return;
  }

  const response = await ingestRuntimeLiveSessionEvent({
    tenantId: "tenant-live-proof",
    request: normalized.value,
  });

  assert.deepEqual(response, {
    accepted: true,
    eventId: "evt-direct-proof-runtime",
    sessionId: "session-live-proof",
    runId: "run-live-proof",
    source: "direct_live",
    createdAt: "2026-04-08T12:34:56.000Z",
  });

  const events = await listEvents({ sessionId: "session-live-proof", limit: 5 });
  assert.equal(events[0]?.source, "direct_live");
  assert.equal(events[0]?.liveTransportMode, "direct_live");
  assert.equal(events[0]?.liveTransportProvider, "gemini_live_api");
  assert.equal(events[0]?.liveTransportModel, "gemini-live-2.5-flash-native-audio");
  assert.equal(events[0]?.liveTransportBootstrapState, "prepared_direct");

  const sessions = await listSessions(20, { tenantId: "tenant-live-proof" });
  assert.ok(sessions.some((item) => item.sessionId === "session-live-proof"));
});
