import assert from "node:assert/strict";

const runtimeProfileModule = await import("../shared/contracts/src/runtime-profile.ts");
const { applyRuntimeProfile, resolveRuntimeProfile } = runtimeProfileModule;

const cases = [];

function runCase(name, execute) {
  const startedAt = Date.now();
  const details = execute();
  cases.push({
    name,
    passed: true,
    elapsedMs: Date.now() - startedAt,
    details,
  });
}

runCase("dev.standard.allowed", () => {
  const env = {
    APP_ENV: "dev",
    RUNTIME_PROFILE: "standard",
  };
  const state = resolveRuntimeProfile({
    service: "profile-smoke",
    env,
    applyDefaults: true,
  });
  assert.equal(state.blocked, false);
  assert.equal(state.localFirst, false);
  assert.equal(state.profile, "standard");
  return state;
});

runCase("dev.local_first.defaults", () => {
  const env = {
    APP_ENV: "dev",
    LOCAL_FIRST_PROFILE: "true",
  };
  const state = resolveRuntimeProfile({
    service: "profile-smoke",
    env,
    applyDefaults: true,
  });
  assert.equal(state.blocked, false);
  assert.equal(state.localFirst, true);
  assert.equal(state.profile, "local-first");
  assert.equal(env.FIRESTORE_ENABLED, "false");
  assert.equal(env.LIVE_API_ENABLED, "false");
  assert.equal(env.STORYTELLER_USE_GEMINI_PLANNER, "false");
  assert.equal(env.UI_NAVIGATOR_EXECUTOR_MODE, "simulated");
  assert.ok(state.appliedDefaults.length >= 4);
  return state;
});

runCase("staging.local_first.blocked", () => {
  const env = {
    APP_ENV: "staging",
    LOCAL_FIRST_PROFILE: "true",
  };
  const state = resolveRuntimeProfile({
    service: "profile-smoke",
    env,
    applyDefaults: true,
  });
  assert.equal(state.blocked, true);
  assert.equal(state.environment, "staging");
  assert.equal(state.localFirst, true);
  return state;
});

runCase("prod.local_first.blocked", () => {
  const env = {
    APP_ENV: "prod",
    RUNTIME_PROFILE: "local-first",
  };
  const state = resolveRuntimeProfile({
    service: "profile-smoke",
    env,
    applyDefaults: true,
  });
  assert.equal(state.blocked, true);
  assert.equal(state.environment, "prod");
  return state;
});

runCase("guard.apply_runtime_profile_throws", () => {
  const env = {
    APP_ENV: "staging",
    LOCAL_FIRST_PROFILE: "true",
  };
  let blocked = false;
  let errorMessage = "";
  try {
    applyRuntimeProfile("profile-smoke", env);
  } catch (error) {
    blocked = true;
    errorMessage = error instanceof Error ? error.message : String(error);
  }
  assert.equal(blocked, true);
  assert.ok(errorMessage.includes("LOCAL_FIRST profile is allowed only in dev environment"));
  return {
    blocked,
    errorMessage,
  };
});

const output = {
  ok: true,
  generatedAt: new Date().toISOString(),
  checks: cases.length,
  cases,
};

console.log(JSON.stringify(output));
