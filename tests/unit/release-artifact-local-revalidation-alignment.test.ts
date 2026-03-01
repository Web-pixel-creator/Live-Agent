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
  assert.match(source, /function Resolve-GhCli\(\)/);
  assert.match(source, /GitHub CLI\\gh\.exe/);
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
  assert.match(source, /release-artifact-revalidation/);
  assert.match(source, /source-run\.json/);
  assert.match(source, /evidenceSnapshot/);
  assert.match(source, /operatorDamageControlSummaryValidated/);
  assert.match(source, /badgeEvidenceOperatorTurnTruncationStatus/);
  assert.match(source, /badgeEvidenceOperatorTurnDeleteStatus/);
  assert.match(source, /badgeEvidenceOperatorDamageControlStatus/);
  assert.match(source, /badgeEvidenceGovernancePolicyStatus/);
  assert.match(source, /badgeEvidenceSkillsRegistryStatus/);
  assert.match(source, /badgeEvidenceDeviceNodesStatus/);
  assert.match(source, /retryableStatusCodes/);
  assert.match(source, /Source run manifest written/);
  assert.match(source, /source run manifest:/);
  assert.match(source, /requested perf gate mode/);
  assert.match(source, /effective perf gate mode/);
  assert.match(source, /turn truncation status/);
  assert.match(source, /turn delete status/);
  assert.match(source, /governance policy status/);
  assert.match(source, /skills registry status/);
  assert.match(source, /device nodes status/);
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
    assert.match(content, /source-run\.json/);
  }
});
