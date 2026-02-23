import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("local release artifact revalidation script is exposed via npm alias", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const pkgRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };

  const alias = pkg.scripts?.["verify:release:artifact:revalidate"] ?? "";
  assert.match(alias, /release-artifact-revalidate\.ps1/);
});

test("local release artifact revalidation script keeps expected source and gate defaults", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "release-artifact-revalidate.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /\$env:GITHUB_TOKEN/);
  assert.match(source, /\$env:GH_TOKEN/);
  assert.match(source, /gh auth token/);
  assert.match(source, /demo-e2e\.yml/);
  assert.match(source, /release-strict-final\.yml/);
  assert.match(source, /release-strict-final-artifacts/);
  assert.match(source, /demo-e2e-artifacts/);
  assert.match(source, /pr-quality-artifacts/);
  assert.match(source, /PerfGateMode/);
  assert.match(source, /with_perf/);
  assert.match(source, /without_perf/);
  assert.match(source, /GithubApiMaxAttempts/);
  assert.match(source, /GithubApiRetryBackoffMs/);
  assert.match(source, /MaxSourceRunAgeHours/);
  assert.match(source, /AllowAnySourceBranch/);
  assert.match(source, /Invoke-WithRetry/);
  assert.match(source, /-StrictFinalRun/);
  assert.match(source, /-SkipPerfLoad/);
  assert.match(source, /SkipPerfLoadGate/);
  assert.match(source, /SkipPerfLoadGate is deprecated/);
  assert.match(source, /run branch/);
  assert.match(source, /run age hours/);
  assert.match(source, /requested perf gate mode/);
  assert.match(source, /effective perf gate mode/);
});

test("local release artifact revalidation docs stay aligned with helper controls", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");
  const readme = readFileSync(readmePath, "utf8");
  const runbook = readFileSync(runbookPath, "utf8");

  for (const content of [readme, runbook]) {
    assert.match(content, /verify:release:artifact:revalidate/);
    assert.match(content, /PerfGateMode auto\|with_perf\|without_perf/);
    assert.match(content, /SkipPerfLoadGate/);
    assert.match(content, /gh auth token/);
    assert.match(content, /GithubApiMaxAttempts/);
    assert.match(content, /GithubApiRetryBackoffMs/);
    assert.match(content, /MaxSourceRunAgeHours/);
    assert.match(content, /AllowAnySourceBranch/);
  }
});
