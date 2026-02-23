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
  assert.match(source, /actions\/github-script@v7/);
  assert.match(source, /demo-e2e\.yml/);
  assert.match(source, /release-strict-final\.yml/);
  assert.match(source, /actions\/download-artifact@v4/);
  assert.match(source, /npm run verify:release:artifact-only/);
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
