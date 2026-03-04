import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend keeps live status strip states mapped to pill variants", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    "class=\"meta-row meta-row-status meta-row-status-live\"",
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
    "function setStatusTextValue(",
    "setStatusTextValue(el.currentUserId",
    "setStatusTextValue(el.runId",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing live status strip token: ${token}`);
  }

  const requiredStyleTokens = [
    ".meta-row-status-live {",
    "flex-wrap: nowrap;",
    "overflow-x: auto;",
    ".meta-row-status-live .status-item-wide > span:not(.status-pill) {",
    "text-overflow: ellipsis;",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing live status strip token: ${token}`);
  }

  assert.ok(
    operatorGuideSource.includes("single-row inline bar on desktop"),
    "operator guide missing live status strip single-row note",
  );
});
