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
  assert.match(source, /github_api_max_attempts:/);
  assert.match(source, /github_api_retry_backoff_ms:/);
  assert.match(source, /max_source_run_age_hours:/);
  assert.match(source, /allow_any_source_branch:/);
  assert.match(source, /default:\s*auto/);
  assert.match(source, /default:\s*false/);
  assert.match(source, /default:\s*"3"/);
  assert.match(source, /default:\s*"1200"/);
  assert.match(source, /default:\s*"168"/);
  assert.match(source, /-\s*with_perf/);
  assert.match(source, /-\s*without_perf/);
  assert.match(source, /actions\/github-script@v7/);
  assert.match(source, /demo-e2e\.yml/);
  assert.match(source, /release-strict-final\.yml/);
  assert.match(source, /getWorkflowRun/);
  assert.match(source, /withRetry/);
  assert.match(source, /artifact_id/);
  assert.match(source, /source_run_branch/);
  assert.match(source, /source_run_age_hours/);
  assert.match(source, /Invoke-WebRequest/);
  assert.match(source, /id:\s*inspect_artifacts/);
  assert.match(source, /has_perf_artifacts/);
  assert.match(source, /run_with_perf/);
  assert.match(source, /effective_perf_mode/);
  assert.match(source, /requested_perf_mode/);
  assert.match(source, /strict_final_run/);
  assert.match(source, /GitHub API retry attempts/);
  assert.match(source, /GitHub API retry backoff ms/);
  assert.match(source, /Source run workflow:/);
  assert.match(source, /Source run branch:/);
  assert.match(source, /Source run head sha:/);
  assert.match(source, /Source run updated at:/);
  assert.match(source, /Source run age hours:/);
  assert.match(source, /Allow any source branch:/);
  assert.match(source, /Max source run age hours:/);
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

test("workflow docs include retry-control inputs", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");
  const readme = readFileSync(readmePath, "utf8");
  const runbook = readFileSync(runbookPath, "utf8");

  for (const content of [readme, runbook]) {
    assert.match(content, /release-artifact-revalidation/);
    assert.match(content, /github_api_max_attempts/);
    assert.match(content, /github_api_retry_backoff_ms/);
    assert.match(content, /max_source_run_age_hours/);
    assert.match(content, /allow_any_source_branch/);
  }
});
