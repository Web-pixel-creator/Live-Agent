import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("orchestrator exposes storyteller runtime config and control-plane override endpoints", () => {
  const source = readFileSync(resolve(process.cwd(), "agents", "orchestrator", "src", "index.ts"), "utf8");

  for (const token of [
    "/story/runtime/config",
    "/story/runtime/control-plane-override",
    "getStorytellerRuntimeConfig",
    "setStorytellerRuntimeControlPlaneOverride",
    "clearStorytellerRuntimeControlPlaneOverride",
    "ORCHESTRATOR_STORYTELLER_RUNTIME_OVERRIDE_INVALID",
    'action: "set"',
    'action: "clear"',
  ]) {
    assert.ok(source.includes(token), `orchestrator storyteller runtime route is missing token: ${token}`);
  }
});

test("docs describe storyteller runtime control-plane override contract", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuide = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");
  const architecture = readFileSync(resolve(process.cwd(), "docs", "architecture.md"), "utf8");

  assert.match(readme, /GET \/story\/runtime\/config/);
  assert.match(readme, /POST \/story\/runtime\/control-plane-override/);
  assert.match(readme, /STORYTELLER_IMAGE_EDIT_ENABLED/);
  assert.match(readme, /STORYTELLER_TTS_PROVIDER_OVERRIDE/);
  assert.match(operatorGuide, /story\/runtime\/control-plane-override/);
  assert.match(operatorGuide, /mediaMode: "simulated"/);
  assert.match(operatorGuide, /imageEditEnabled: true/);
  assert.match(operatorGuide, /ttsProvider: "deepgram"/);
  assert.match(architecture, /runtime media-mode override/i);
  assert.match(architecture, /image_edit/i);
  assert.match(architecture, /Deepgram fallback/i);
});
