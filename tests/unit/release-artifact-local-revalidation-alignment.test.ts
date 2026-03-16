import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function resolvePowerShellBinary(): string | null {
  const candidates = process.platform === "win32" ? ["powershell", "pwsh"] : ["pwsh", "powershell"];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
      encoding: "utf8",
    });
    if (probe.status === 0) {
      return candidate;
    }
  }
  return null;
}

const powershellBin = resolvePowerShellBinary();
const skipIfNoPowerShell = powershellBin ? false : "PowerShell binary is not available";

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
  assert.match(source, /SkipPerfLoadGate/);
  assert.match(source, /SkipPerfLoadGate is deprecated/);
  assert.match(source, /run branch/);
  assert.match(source, /run age hours/);
  assert.match(source, /release-artifact-revalidation/);
  assert.match(source, /source-run\.json/);
  assert.match(source, /release-evidence\/report\.json/);
  assert.match(source, /release-evidence\/report\.md/);
  assert.match(source, /deploy\/railway-deploy-summary\.json/);
  assert.match(source, /deploy\/repo-publish-summary\.json/);
  assert.match(source, /release-evidence-report\.ps1/);
  assert.match(source, /OutputManifestJsonPath/);
  assert.match(source, /OutputManifestMarkdownPath/);
  assert.match(source, /evidenceSnapshot/);
  assert.match(source, /SkipBuild\s*=\s*\$true/);
  assert.match(source, /SkipUnitTests\s*=\s*\$true/);
  assert.match(source, /SkipPerfRun\s*=\s*\$true/);
  assert.match(source, /SkipPerfLoad\s*=\s*\$true/);
  assert.match(source, /StrictFinalRun\s*=\s*\$true/);
  assert.match(source, /recognized artifact root lanes/);
  assert.match(source, /\$bundleArtifactNames -contains "demo-e2e"/);
  assert.match(source, /\$bundleArtifactNames -contains "perf-load"/);
  assert.match(source, /\$bundleArtifactNames -contains "release-evidence"/);
  assert.match(source, /railwayDeploySummaryPresent/);
  assert.match(source, /repoPublishSummaryPresent/);
  assert.match(source, /railwayDeploySummaryProjectId/);
  assert.match(source, /railwayDeploySummaryService/);
  assert.match(source, /railwayDeploySummaryEnvironment/);
  assert.match(source, /railwayDeploySummaryEffectiveStartCommand/);
  assert.match(source, /railwayDeploySummaryConfigSource/);
  assert.match(source, /railwayDeploySummaryRootDescriptorAttempted/);
  assert.match(source, /railwayDeploySummaryRootDescriptorSkipped/);
  assert.match(source, /railwayDeploySummaryRootDescriptorExpectedUiUrl/);
  assert.match(source, /railwayDeploySummaryPublicBadgeAttempted/);
  assert.match(source, /railwayDeploySummaryPublicBadgeSkipped/);
  assert.match(source, /repoPublishSummaryBranch/);
  assert.match(source, /repoPublishSummaryRemoteName/);
  assert.match(source, /repoPublishSummaryVerificationSkipped/);
  assert.match(source, /repoPublishSummaryVerificationStrict/);
  assert.match(source, /repoPublishSummaryReleaseEvidenceArtifactsCount/);
  assert.match(source, /repoPublishSummaryCommitEnabled/);
  assert.match(source, /repoPublishSummaryPushEnabled/);
  assert.match(source, /repoPublishSummaryPagesEnabled/);
  assert.match(source, /repoPublishSummaryBadgeCheckEnabled/);
  assert.match(source, /repoPublishSummaryRuntimeRailwayPublicUrl/);
  assert.match(source, /repoPublishSummaryRuntimeRailwayDemoFrontendPublicUrl/);
  assert.match(source, /repoPublishSummaryRuntimeRailwayNoWait/);
  assert.match(source, /repoPublishSummaryRuntimeRailwayFrontendNoWait/);
  assert.match(source, /repoPublishSummaryArtifactSelf/);
  assert.match(source, /repoPublishSummaryArtifactRailwayDeploySummary/);
  assert.match(source, /repoPublishSummaryArtifactReleaseEvidenceReportJson/);
  assert.match(source, /repoPublishSummaryArtifactReleaseEvidenceManifestJson/);
  assert.match(source, /repoPublishSummaryArtifactBadgeDetailsJson/);
  assert.match(source, /operatorDamageControlSummaryValidated/);
  assert.match(source, /badgeEvidenceOperatorTurnTruncationStatus/);
  assert.match(source, /badgeEvidenceOperatorTurnDeleteStatus/);
  assert.match(source, /badgeEvidenceOperatorDamageControlStatus/);
  assert.match(source, /badgeEvidenceGovernancePolicyStatus/);
  assert.match(source, /badgeEvidenceSkillsRegistryStatus/);
  assert.match(source, /badgeEvidencePluginMarketplaceStatus/);
  assert.match(source, /badgeEvidenceDeviceNodesStatus/);
  assert.match(source, /badgeEvidenceDeviceNodeUpdatesStatus/);
  assert.match(source, /badgeEvidenceRuntimeGuardrailsSignalPathsStatus/);
  assert.match(source, /badgeEvidenceRuntimeGuardrailsSignalPathsSummaryStatus/);
  assert.match(source, /badgeEvidenceRuntimeGuardrailsSignalPathsTotalPaths/);
  assert.match(source, /badgeEvidenceRuntimeGuardrailsSignalPathsPrimaryPath/);
  assert.match(source, /badgeEvidenceProviderUsageStatus/);
  assert.match(source, /badgeEvidenceProviderUsageValidated/);
  assert.match(source, /badgeEvidenceProviderUsageActiveSecondaryProviders/);
  assert.match(source, /badgeEvidenceProviderUsageEntriesCount/);
  assert.match(source, /badgeEvidenceProviderUsagePrimaryEntry/);
  assert.match(source, /retryableStatusCodes/);
  assert.match(source, /Source run manifest written/);
  assert.match(source, /source run manifest:/);
  assert.match(source, /requested perf gate mode/);
  assert.match(source, /effective perf gate mode/);
  assert.match(source, /turn truncation status/);
  assert.match(source, /turn delete status/);
  assert.match(source, /governance policy status/);
  assert.match(source, /skills registry status/);
  assert.match(source, /plugin marketplace status/);
  assert.match(source, /device nodes status/);
  assert.match(source, /runtime guardrails signal paths status/);
  assert.match(source, /runtime guardrails signal paths summary status/);
  assert.match(source, /runtime guardrails signal paths total paths/);
  assert.match(source, /runtime guardrails signal paths primary path title/);
  assert.match(source, /provider usage status/);
  assert.match(source, /provider usage validated/);
  assert.match(source, /provider usage active secondary providers/);
  assert.match(source, /provider usage entries count/);
  assert.match(source, /provider usage primary entry/);
  assert.match(source, /device node updates status/);
  assert.match(source, /railway deploy summary present/);
  assert.match(source, /railway deploy summary status/);
  assert.match(source, /railway deploy summary deployment id/);
  assert.match(source, /railway deploy summary project id/);
  assert.match(source, /railway deploy summary service/);
  assert.match(source, /railway deploy summary environment/);
  assert.match(source, /railway deploy summary effective start command/);
  assert.match(source, /railway deploy summary config source/);
  assert.match(source, /railway deploy summary root descriptor attempted/);
  assert.match(source, /railway deploy summary root descriptor skipped/);
  assert.match(source, /railway deploy summary expected UI URL/);
  assert.match(source, /railway deploy summary public badge attempted/);
  assert.match(source, /railway deploy summary public badge skipped/);
  assert.match(source, /repo publish summary present/);
  assert.match(source, /repo publish branch/);
  assert.match(source, /repo publish remote name/);
  assert.match(source, /repo publish verification script/);
  assert.match(source, /repo publish verification skipped/);
  assert.match(source, /repo publish verification strict/);
  assert.match(source, /repo publish release-evidence artifacts count/);
  assert.match(source, /repo publish commit enabled/);
  assert.match(source, /repo publish push enabled/);
  assert.match(source, /repo publish pages enabled/);
  assert.match(source, /repo publish badge-check enabled/);
  assert.match(source, /repo publish runtime Railway public URL/);
  assert.match(source, /repo publish runtime Railway frontend URL/);
  assert.match(source, /repo publish runtime Railway no-wait/);
  assert.match(source, /repo publish runtime Railway frontend no-wait/);
  assert.match(source, /repo publish artifact self/);
  assert.match(source, /repo publish artifact Railway deploy summary/);
  assert.match(source, /repo publish artifact release evidence report/);
  assert.match(source, /repo publish artifact release evidence manifest/);
  assert.match(source, /repo publish artifact badge details/);
  assert.match(source, /release evidence report/);
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
    assert.match(content, /artifacts\/release-evidence\/report\.json/);
    assert.match(content, /artifacts\/release-evidence\/report\.md/);
  }
});

test(
  "local release artifact revalidation script parses in PowerShell",
  { skip: skipIfNoPowerShell },
  () => {
    if (!powershellBin) {
      throw new Error("PowerShell binary is not available");
    }

    const scriptPath = resolve(process.cwd(), "scripts", "release-artifact-revalidate.ps1");
    const parseCommand = [
      "$errors = $null;",
      "[void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path '" + scriptPath.replace(/'/g, "''") + "'), [ref]$null, [ref]$errors);",
      "if ($errors) { $errors | ForEach-Object { $_.ToString() }; exit 1 }",
    ].join(" ");
    const result = spawnSync(
      powershellBin,
      ["-NoProfile", "-Command", parseCommand],
      {
        encoding: "utf8",
      },
    );

    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    assert.equal(result.status ?? 1, 0, output);
  },
);
