import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("release artifact revalidation workflow resolves source artifacts and runs artifact-only gate", () => {
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "release-artifact-revalidation.yml");
  const source = readFileSync(workflowPath, "utf8");

  assert.match(source, /name:\s*Release Artifact Revalidation/);
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /source_run_id:/);
  assert.match(source, /artifact_name:/);
  assert.match(source, /perf_gate_mode:/);
  assert.match(source, /strict_final_run:/);
  assert.match(source, /default:\s*auto/);
  assert.match(source, /default:\s*false/);
  assert.match(source, /-\s*with_perf/);
  assert.match(source, /-\s*without_perf/);
  assert.match(source, /actions\/github-script@v7/);
  assert.match(source, /demo-e2e\.yml/);
  assert.match(source, /release-strict-final\.yml/);
  assert.match(source, /actions\/download-artifact@v4/);
  assert.match(source, /id:\s*inspect_artifacts/);
  assert.match(source, /has_perf_artifacts/);
  assert.match(source, /run_with_perf/);
  assert.match(source, /effective_perf_mode/);
  assert.match(source, /requested_perf_mode/);
  assert.match(source, /strict_final_run/);
  assert.match(source, /npm run verify:release:artifact-only/);
  assert.match(source, /-SkipPerfLoad/);
  assert.match(source, /-StrictFinalRun/);
});

test("release artifact revalidation workflow publishes consolidated artifacts", () => {
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "release-artifact-revalidation.yml");
  const source = readFileSync(workflowPath, "utf8");

  assert.match(source, /name:\s*release-artifact-revalidation-artifacts/);
  assert.match(source, /artifacts\/demo-e2e\/summary\.json/);
  assert.match(source, /artifacts\/demo-e2e\/policy-check\.json/);
  assert.match(source, /artifacts\/perf-load\/summary\.json/);
  assert.match(source, /artifacts\/perf-load\/policy-check\.json/);
});
