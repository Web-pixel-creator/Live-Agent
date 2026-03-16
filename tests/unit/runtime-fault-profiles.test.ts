import assert from "node:assert/strict";
import test from "node:test";
import { getRuntimeFaultProfilesSnapshot } from "../../apps/api-backend/src/runtime-fault-profiles.ts";

test("runtime fault profiles load repo-owned drills from config path", async () => {
  const snapshot = await getRuntimeFaultProfilesSnapshot({
    env: process.env,
    cwd: process.cwd(),
  });

  assert.equal(snapshot.source, "path");
  assert.equal(snapshot.configPath?.endsWith("configs\\runtime.fault-profiles.json") || snapshot.configPath?.endsWith("configs/runtime.fault-profiles.json"), true);
  assert.ok(snapshot.profiles.length >= 8, "expected curated fault profiles");
  assert.ok(snapshot.profiles.some((item) => item.id === "gateway-drain-rejection"));
  assert.ok(snapshot.profiles.some((item) => item.category === "sandbox"));
  assert.ok(snapshot.profiles.some((item) => item.service === "ui-executor"));
});

test("runtime fault profiles report invalid inline JSON safely", async () => {
  const snapshot = await getRuntimeFaultProfilesSnapshot({
    env: {
      ...process.env,
      RUNTIME_FAULT_PROFILES_JSON: "{",
    },
    cwd: process.cwd(),
  });

  assert.equal(snapshot.source, "invalid");
  assert.equal(snapshot.profiles.length, 0);
  assert.ok(snapshot.warnings.some((item) => item.includes("Failed to parse RUNTIME_FAULT_PROFILES_JSON")));
});
