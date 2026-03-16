import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("local-first profile doc stays aligned with runtime contract and smoke script", () => {
  const doc = readFileSync(resolve(process.cwd(), "docs", "local-first-profile.md"), "utf8");
  const runtimeProfile = readFileSync(
    resolve(process.cwd(), "apps", "api-backend", "src", "contracts", "runtime-profile.ts"),
    "utf8",
  );
  const smokeScript = readFileSync(resolve(process.cwd(), "scripts", "runtime-profile-smoke.mjs"), "utf8");
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };

  const requiredDocTokens = [
    "LOCAL_FIRST_PROFILE=true",
    "RUNTIME_PROFILE=local-first",
    "APP_ENV=dev|staging|prod",
    "FIRESTORE_ENABLED=false",
    "LIVE_API_ENABLED=false",
    "LIVE_API_AUTO_SETUP=false",
    "LIVE_AGENT_USE_GEMINI_CHAT=false",
    "STORYTELLER_USE_GEMINI_PLANNER=false",
    "UI_NAVIGATOR_USE_GEMINI_PLANNER=false",
    "STORYTELLER_MEDIA_MODE=simulated",
    "UI_NAVIGATOR_EXECUTOR_MODE=simulated",
    "UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE=true",
    "local-first` is allowed only when `APP_ENV=dev`",
    "npm run profile:smoke",
    "npm run dev:live-mock",
  ];

  for (const token of requiredDocTokens) {
    assert.ok(doc.includes(token), `local-first profile doc missing token: ${token}`);
  }

  const requiredRuntimeTokens = [
    '["FIRESTORE_ENABLED", "false"]',
    '["LIVE_API_ENABLED", "false"]',
    '["LIVE_API_AUTO_SETUP", "false"]',
    '["LIVE_AGENT_USE_GEMINI_CHAT", "false"]',
    '["STORYTELLER_USE_GEMINI_PLANNER", "false"]',
    '["UI_NAVIGATOR_USE_GEMINI_PLANNER", "false"]',
    '["STORYTELLER_MEDIA_MODE", "simulated"]',
    '["UI_NAVIGATOR_EXECUTOR_MODE", "simulated"]',
    '["UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE", "true"]',
    "LOCAL_FIRST profile is allowed only in dev environment",
  ];

  for (const token of requiredRuntimeTokens) {
    assert.ok(runtimeProfile.includes(token), `runtime-profile contract missing token: ${token}`);
  }

  for (const smokeCase of [
    "dev.standard.allowed",
    "dev.local_first.defaults",
    "staging.local_first.blocked",
    "prod.local_first.blocked",
    "guard.apply_runtime_profile_throws",
  ]) {
    assert.ok(smokeScript.includes(smokeCase), `runtime-profile smoke script missing case: ${smokeCase}`);
  }

  assert.equal(packageJson.scripts?.["profile:smoke"], "node --import tsx ./scripts/runtime-profile-smoke.mjs");
});
