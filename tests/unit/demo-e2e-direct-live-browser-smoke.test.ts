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
    "#liveDockVoiceBtn",
    '#sessionId',
    '#userId',
    '#connectBtn',
    '#disconnectBtn',
    '#connectionStatus',
    '#modeStatus',
    "function ensureVoiceTrayConnectSurface",
    "function triggerFrontendButtonClick",
    'button not found: ${targetSelector}',
    'connectClickPath',
    "function setFrontendInputValue",
    "function readFrontendInputValue",
    "actualSessionId",
    "requestedSessionId",
    "firstAudioMs",
    "firstOutputMs",
    "fallbackEventCount",
    '"session_events"',
    "direct-live-browser-smoke.png",
  ]) {
    assert.ok(source.includes(token), `browser direct-live smoke script missing token: ${token}`);
  }
});
