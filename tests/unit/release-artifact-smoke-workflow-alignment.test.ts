import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("artifact-only smoke workflow keeps manual strict toggle and script wiring", () => {
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "release-artifact-only-smoke.yml");
  const source = readFileSync(workflowPath, "utf8");

  assert.match(source, /name:\s*Release Artifact-Only Smoke/);
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /strict_final_run:/);
  assert.match(source, /type:\s*boolean/);
  assert.match(source, /default:\s*false/);
  assert.match(source, /release-artifact-only-smoke-\$\{\{ github\.ref \}\}/);

  assert.match(source, /Run Artifact-Only Smoke \(Standard\)/);
  assert.match(source, /Run Artifact-Only Smoke \(Strict\)/);
  assert.match(source, /strict_final_run != 'true'/);
  assert.match(source, /strict_final_run == 'true'/);
  assert.match(source, /release-artifact-only-smoke\.ps1/);
  assert.match(source, /-StrictFinalRun/);

  assert.match(source, /Publish Smoke Summary/);
  assert.match(source, /Strict final run:/);
  assert.match(source, /Smoke script:\s*scripts\/release-artifact-only-smoke\.ps1/);
});
