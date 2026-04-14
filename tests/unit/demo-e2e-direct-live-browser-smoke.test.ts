import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("browser direct-live smoke script drives frontend connect flow and checks backend replay", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "demo-e2e-direct-live-browser-smoke.mjs");
  const source = readFileSync(scriptPath, "utf8");

  for (const token of [
    'import { chromium } from "playwright";',
    "/v1/runtime/live/capabilities",
    "/v1/runtime/session-replay",
    'searchParams.set("livePreferredMode", "direct_live")',
    'searchParams.set("debugLive", "true")',
    "#liveDockVoiceBtn",
    '#sessionId',
    '#userId',
    '#intent',
    '#message',
    '#connectBtn',
    '#disconnectBtn',
    '#sendConversationItemBtn',
    '#connectionStatus',
    '#modeStatus',
    "function ensureVoiceTrayConnectSurface",
    "function waitForFrontendRuntimeReady",
    'localhost:8080',
    'localhost:8081',
    "function triggerFrontendButtonClick",
    'button not found: ${targetSelector}',
    'connectClickPath',
    'serviceItemSendClickPath',
    'serviceItemPrompt',
    "function setFrontendInputValue",
    "function setFrontendSelectValue",
    "function sendDirectLiveServiceItem",
    "window.__liveDebug.sendLiveText",
    "Reply with a short greeting for direct live latency proof.",
    "function readFrontendInputValue",
    "actualSessionId",
    "requestedSessionId",
    "transcriptSnapshot",
    "conversationSnapshot",
    "latencyObserved",
    "firstAudioMs",
    "firstOutputMs",
    "fallbackEventCount",
    '"session_events"',
    "direct-live-browser-smoke.png",
  ]) {
    assert.ok(source.includes(token), `browser direct-live smoke script missing token: ${token}`);
  }
});
