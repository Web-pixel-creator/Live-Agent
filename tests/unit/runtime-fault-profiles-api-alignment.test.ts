import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend exposes runtime fault profiles endpoint", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "/v1/runtime/fault-profiles",
    "/v1/runtime/fault-profiles/execute",
    "getRuntimeFaultProfilesSnapshot",
    "buildRuntimeFaultProfileExecutionPlan",
    "resolveRuntimeFaultProfileExecution",
    "extractRuntimeFaultProfileExecutionFollowUpContext",
    'source: "repo_owned_fault_profile_execution"',
    'source: "repo_owned_fault_profiles"',
    "summary:",
    "totalProfiles:",
    "apiExecutableProfiles,",
    "manualOnlyProfiles:",
    "readyToExecute",
    "missingContext:",
    "followUpContext",
    "executionMode",
    "API_RUNTIME_FAULT_PROFILE_EXECUTION_UNSUPPORTED",
    "API_RUNTIME_FAULT_PROFILE_CONTEXT_REQUIRED",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `runtime fault profiles API contract missing token: ${token}`);
  }
});

test("docs and env expose runtime fault profiles config", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
  const architecture = readFileSync(resolve(process.cwd(), "docs", "architecture.md"), "utf8");
  const operatorGuide = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");
  const challengeRunbook = readFileSync(resolve(process.cwd(), "docs", "challenge-demo-runbook.md"), "utf8");

  assert.match(readme, /GET \/v1\/runtime\/fault-profiles/);
  assert.match(readme, /POST \/v1\/runtime\/fault-profiles\/execute/);
  assert.match(readme, /configs\/runtime\.fault-profiles\.json/);
  assert.match(envExample, /RUNTIME_FAULT_PROFILES_PATH=configs\/runtime\.fault-profiles\.json/);
  assert.match(envExample, /RUNTIME_FAULT_PROFILES_JSON=/);
  assert.match(architecture, /configs\/runtime\.fault-profiles\.json/);
  assert.match(operatorGuide, /POST \/v1\/runtime\/fault-profiles\/execute/);
  assert.match(operatorGuide, /dryRun=true/);
  assert.match(challengeRunbook, /POST \/v1\/runtime\/fault-profiles\/execute/);
});
