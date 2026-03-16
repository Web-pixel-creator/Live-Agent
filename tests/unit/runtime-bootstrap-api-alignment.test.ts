import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend exposes runtime bootstrap doctor and auth-profile control plane", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const helperPath = resolve(process.cwd(), "apps", "api-backend", "src", "runtime-bootstrap-doctor.ts");
  const source = readFileSync(sourcePath, "utf8");
  const helper = readFileSync(helperPath, "utf8");

  const requiredSourceTokens = [
    "/v1/runtime/bootstrap-status",
    "/v1/runtime/auth-profiles",
    "/v1/runtime/auth-profiles/rotate",
    "buildRuntimeBootstrapDoctorSnapshot",
    "listAuthProfileSnapshots",
    "rotateAuthProfile",
    'source: "repo_owned_bootstrap_doctor"',
    'source: "repo_owned_auth_profile_control_plane"',
    "runtime_auth_profile_rotate",
    "API_RUNTIME_AUTH_PROFILE_INVALID_JSON",
    "API_RUNTIME_AUTH_PROFILE_ID_REQUIRED",
    "API_RUNTIME_AUTH_PROFILE_ROTATION_FAILED",
    "bootstrapDoctor,",
  ];
  for (const token of requiredSourceTokens) {
    assert.ok(source.includes(token), `runtime bootstrap API missing token: ${token}`);
  }

  const requiredHelperTokens = [
    "Gemini / Live API",
    "Deepgram Aura-2",
    "fal image-edit",
    "Perplexity Sonar",
    "OpenAI reasoning",
    "Anthropic reasoning",
    "DeepSeek reasoning",
    "Moonshot / Kimi watchlist",
    "Credential store master key",
    "Auth-profile rotation",
    "Device-node readiness",
    "Fallback posture",
    "UI executor hardening",
  ];
  for (const token of requiredHelperTokens) {
    assert.ok(helper.includes(token), `runtime bootstrap helper missing token: ${token}`);
  }
});

test("docs describe bootstrap doctor and auth-profile runtime surfaces", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuide = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");
  const architecture = readFileSync(resolve(process.cwd(), "docs", "architecture.md"), "utf8");

  assert.match(readme, /GET \/v1\/runtime\/bootstrap-status/);
  assert.match(readme, /GET \/v1\/runtime\/auth-profiles/);
  assert.match(readme, /POST \/v1\/runtime\/auth-profiles\/rotate/);
  assert.match(readme, /Bootstrap Doctor & Auth Profiles/);
  assert.match(readme, /AUTH_PROFILE_STORE_FILE/);
  assert.match(readme, /SKILLS_MANAGED_INDEX_AUTH_PROFILE/);
  assert.match(readme, /UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_PROFILE/);
  assert.match(readme, /LIVE_API_AUTH_PROFILES_JSON/);
  assert.match(readme, /apiKeyProfileId/);
  assert.match(readme, /authHeaderProfileId/);
  assert.match(operatorGuide, /Bootstrap Doctor & Auth Profiles/);
  assert.match(operatorGuide, /auth-profile/i);
  assert.match(operatorGuide, /rotate/i);
  assert.match(architecture, /bootstrap doctor\/auth-profile/i);
});
