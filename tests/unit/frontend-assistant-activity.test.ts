import assert from "node:assert/strict";
import test from "node:test";
import { resolveAssistantActivityStatus } from "../../apps/demo-frontend/public/assistant-activity.js";

test("assistant activity shows waiting_connection while websocket is opening", () => {
  const status = resolveAssistantActivityStatus({
    connectionStatus: "connecting",
    isStreaming: false,
    isSpeaking: false,
  });
  assert.deepEqual(status, { text: "waiting_connection", variant: "neutral" });
});

test("assistant activity shows disconnected when websocket is unavailable", () => {
  const status = resolveAssistantActivityStatus({
    connectionStatus: "disconnected",
    isStreaming: true,
    isSpeaking: true,
  });
  assert.deepEqual(status, { text: "disconnected", variant: "fail" });
});

test("assistant activity prioritizes speaking over streaming while connected", () => {
  const status = resolveAssistantActivityStatus({
    connectionStatus: "connected",
    isStreaming: true,
    isSpeaking: true,
  });
  assert.deepEqual(status, { text: "speaking", variant: "ok" });
});

test("assistant activity falls back to idle when connected without active output", () => {
  const status = resolveAssistantActivityStatus({
    connectionStatus: "connected",
    isStreaming: false,
    isSpeaking: false,
  });
  assert.deepEqual(status, { text: "idle", variant: "neutral" });
});
