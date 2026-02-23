import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function normalizeList(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.replace(/["'\s]/g, "").trim())
    .filter((item) => item.length > 0);
}

test("task queue pressure allowlist is aligned across policy/demo/release scripts", () => {
  const policyPath = resolve(process.cwd(), "scripts", "demo-e2e-policy-check.mjs");
  const demoPath = resolve(process.cwd(), "scripts", "demo-e2e.ps1");
  const releasePath = resolve(process.cwd(), "scripts", "release-readiness.ps1");

  const policySource = readFileSync(policyPath, "utf8");
  const demoSource = readFileSync(demoPath, "utf8");
  const releaseSource = readFileSync(releasePath, "utf8");

  const policyMatch = policySource.match(/\["idle",\s*"healthy",\s*"elevated"(?:,\s*"critical")?\]/);
  assert.ok(policyMatch, "Could not find policy allowlist in demo-e2e-policy-check.mjs");
  const policyLevels = normalizeList(policyMatch[0].slice(1, -1));

  const releaseMatch = releaseSource.match(
    /\$allowedTaskQueuePressureLevels\s*=\s*@\(([^)]*?)\)/m,
  );
  assert.ok(releaseMatch, "Could not find release allowlist in release-readiness.ps1");
  const releaseLevels = normalizeList(releaseMatch[1]);

  const demoMatches = [...demoSource.matchAll(/@\((\"[^\)]*?\"(?:\s*,\s*\"[^\)]*?\")*)\)/g)];
  const demoAllowLists = demoMatches
    .map((match) => normalizeList(match[1]))
    .filter((levels) => levels.includes("idle") && levels.includes("healthy") && levels.includes("elevated"));

  assert.ok(
    demoAllowLists.length >= 2,
    "Expected at least two task-queue allowlist declarations in demo-e2e.ps1",
  );

  const expected = ["idle", "healthy", "elevated"];
  assert.deepEqual(policyLevels, expected);
  assert.deepEqual(releaseLevels, expected);
  for (const levels of demoAllowLists) {
    assert.deepEqual(levels, expected);
  }
});
