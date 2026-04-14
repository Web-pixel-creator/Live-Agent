import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("deploy direct-live proof helper is wired across package, script, and docs", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const packageRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(packageRaw) as { scripts?: Record<string, string> };

  const alias = pkg.scripts?.["verify:deploy:direct-live-proof"] ?? "";
  assert.match(alias, /deploy-direct-live-proof\.ps1/);

  const scriptPath = resolve(process.cwd(), "scripts", "deploy-direct-live-proof.ps1");
  const scriptRaw = readFileSync(scriptPath, "utf8");
  assert.match(scriptRaw, /\[string\]\$FrontendPublicUrl/);
  assert.match(scriptRaw, /\[string\]\$ApiPublicUrl/);
  assert.match(scriptRaw, /direct-live-proof\.json/);
  assert.match(scriptRaw, /direct-live-proof\.md/);
  assert.match(scriptRaw, /direct-live-proof\.png/);
  assert.match(scriptRaw, /demo-e2e-direct-live-browser-smoke\.mjs/);
  assert.match(scriptRaw, /Resolve-ApiPublicUrl/);
  assert.match(scriptRaw, /FailOnSkip/);
  assert.match(scriptRaw, /RequireCaseWikiEvidenceSignature/);
  assert.match(scriptRaw, /ExpectedCaseWikiEvidenceSignatureStatus/);
  assert.match(scriptRaw, /direct_live\.proof\.status/);
  assert.match(scriptRaw, /direct_live\.proof\.runtime_evidence\.expected_signature_status/);
  assert.match(scriptRaw, /direct_live\.proof\.case_wiki\.expected_signature_status/);
  assert.match(scriptRaw, /direct_live\.proof\.case_wiki\.expected_signature_source/);
  assert.match(scriptRaw, /direct_live\.proof\.case_wiki\.signature_status/);
  assert.match(scriptRaw, /direct_live\.proof\.replay\.first_audio_ms/);
  assert.match(scriptRaw, /direct_live\.proof\.replay\.first_output_ms/);
  assert.match(scriptRaw, /direct_live\.proof\.replay\.fallback_event_count/);
  assert.match(scriptRaw, /Replay Evidence Source/);
  assert.match(scriptRaw, /Replay First Audio \(ms\)/);
  assert.match(scriptRaw, /Replay First Output \(ms\)/);
  assert.match(scriptRaw, /Replay Fallback Events/);
  assert.match(scriptRaw, /Runtime Evidence Expected Signature/);
  assert.match(scriptRaw, /Case Wiki Expected Signature/);
  assert.match(scriptRaw, /Case Wiki Signature Status/);

  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  assert.match(readme, /verify:deploy:direct-live-proof/);
  assert.match(readme, /direct-live-proof\.json/);
  assert.match(readme, /first-audio\/first-output latency/i);
  assert.match(readme, /case wiki evidence signature/i);
  assert.match(readme, /runtime diagnostics/i);

  const runbook = readFileSync(resolve(process.cwd(), "docs", "challenge-demo-runbook.md"), "utf8");
  assert.match(runbook, /verify:deploy:direct-live-proof/);
  assert.match(runbook, /first-audio\/first-output latency/i);
  assert.match(runbook, /case wiki evidence signature/i);
  assert.match(runbook, /runtime\/diagnostics/i);
});
