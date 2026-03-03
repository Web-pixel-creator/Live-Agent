import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend keeps live status strip states mapped to pill variants", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  const requiredHtmlTokens = [
    'id="connectionStatus" class="status-pill status-neutral"',
    'id="sessionState" class="status-pill status-neutral"',
    'id="modeStatus" class="status-pill status-neutral"',
    'id="pttStatus" class="status-pill status-neutral"',
    'id="exportStatus" class="status-pill status-neutral"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing live status strip token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "setConnectionStatus",
    "resolveSessionStateVariant",
    "resolveModeStatusVariant",
    "setSessionState",
    "setMode",
    "setStatusPill(el.connectionStatus",
    "setStatusPill(el.sessionState",
    "setStatusPill(el.modeStatus",
    "setStatusPill(el.exportStatus",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing live status strip token: ${token}`);
  }
});
