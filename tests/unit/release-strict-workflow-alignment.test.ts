import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("release strict workflow runs verify:release with strict final mode", () => {
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "release-strict-final.yml");
  const source = readFileSync(workflowPath, "utf8");

  assert.match(source, /name:\s*Release Strict Final Gate/);
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /push:\s*\r?\n\s*branches:\s*\r?\n\s*-\s*main[\s\S]*-\s*master/);
  assert.match(source, /Run Release Strict Final Gate/);
  assert.match(source, /npm run verify:release -- -StrictFinalRun/);
  assert.match(source, /release-strict-final-\$\{\{ github\.ref \}\}/);
});

test("release strict workflow publishes release-critical artifacts", () => {
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "release-strict-final.yml");
  const source = readFileSync(workflowPath, "utf8");

  assert.match(source, /name:\s*release-strict-final-artifacts/);
  assert.match(source, /artifacts\/demo-e2e\/summary\.json/);
  assert.match(source, /artifacts\/demo-e2e\/policy-check\.json/);
  assert.match(source, /artifacts\/demo-e2e\/badge\.json/);
  assert.match(source, /artifacts\/perf-load\/summary\.json/);
  assert.match(source, /artifacts\/perf-load\/policy-check\.json/);
});
