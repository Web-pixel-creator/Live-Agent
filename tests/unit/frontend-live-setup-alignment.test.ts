import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend wires live.setup runtime override controls", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  const requiredHtmlIds = [
    'id="liveSetupModel"',
    'id="liveSetupVoice"',
    'id="liveSetupActivityHandling"',
    'id="liveSetupInstruction"',
    'id="applyLiveSetupBtn"',
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(htmlSource.includes(token), `frontend html missing live.setup control: ${token}`);
  }

  const requiredRuntimeTokens = [
    "collectLiveSetupOverride",
    "sendLiveSetupOverride",
    'sendEnvelope("live.setup"',
    "applyLiveSetupBtn",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing live.setup wiring token: ${token}`);
  }
});
