import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const smokeScriptPath = resolve(process.cwd(), "scripts", "release-artifact-only-smoke.ps1");

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

test("artifact-only smoke script is wired to release-readiness with local artifacts", () => {
  const source = readFileSync(smokeScriptPath, "utf8");

  assert.match(source, /release-readiness\.ps1/);
  assert.match(source, /source-run\.json/);
  assert.match(source, /perf-load/);
  assert.match(source, /-SkipDemoE2E/);
  assert.match(source, /-SkipPolicy/);
  assert.match(source, /-SkipBadge/);
  assert.match(source, /-SkipPerfRun/);
  assert.match(source, /-SourceRunManifestPath/);
  assert.match(source, /-PerfSummaryPath/);
  assert.match(source, /-PerfPolicyPath/);
  assert.match(source, /-StrictFinalRun/);
  assert.match(source, /evidenceSnapshot/);
  assert.match(source, /operatorDamageControlSummaryValidated/);
  assert.match(source, /badgeEvidenceOperatorTurnTruncationStatus/);
  assert.match(source, /badgeEvidenceOperatorTurnDeleteStatus/);
  assert.match(source, /badgeEvidenceOperatorDamageControlStatus/);
  assert.match(source, /badgeEvidenceGovernancePolicyStatus/);
  assert.match(source, /badgeEvidenceSkillsRegistryStatus/);
  assert.match(source, /badgeEvidencePluginMarketplaceStatus/);
  assert.match(source, /badgeEvidenceDeviceNodesStatus/);
  assert.match(source, /badgeEvidenceAgentUsageStatus/);
  assert.match(source, /badgeEvidenceRuntimeGuardrailsSignalPathsStatus/);
  assert.match(source, /badgeEvidenceRuntimeGuardrailsSignalPathsSummaryStatus/);
  assert.match(source, /badgeEvidenceRuntimeGuardrailsSignalPathsTotalPaths/);
  assert.match(source, /badgeEvidenceRuntimeGuardrailsSignalPathsPrimaryPath/);
  assert.match(source, /badgeEvidenceProviderUsageStatus/);
  assert.match(source, /badgeEvidenceProviderUsageValidated/);
  assert.match(source, /badgeEvidenceProviderUsageActiveSecondaryProviders/);
  assert.match(source, /badgeEvidenceProviderUsageEntriesCount/);
  assert.match(source, /badgeEvidenceProviderUsagePrimaryEntry/);
  assert.match(source, /badgeEvidenceDeviceNodeUpdatesStatus/);
  assert.match(source, /railway-deploy-summary\.json/);
  assert.match(source, /repo-publish-summary\.json/);
  assert.match(source, /railwayDeploySummaryPresent/);
  assert.match(source, /railwayDeploySummaryStatus/);
  assert.match(source, /railwayDeploySummaryDeploymentId/);
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
  assert.match(source, /repoPublishSummaryPresent/);
  assert.match(source, /repoPublishSummaryBranch/);
  assert.match(source, /repoPublishSummaryRemoteName/);
  assert.match(source, /repoPublishSummaryVerificationScript/);
  assert.match(source, /repoPublishSummaryVerificationSkipped/);
  assert.match(source, /repoPublishSummaryVerificationStrict/);
  assert.match(source, /repoPublishSummaryReleaseEvidenceValidated/);
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
});

test(
  "artifact-only smoke script passes end-to-end with generated local artifacts",
  { skip: skipIfNoPowerShell },
  () => {
    if (!powershellBin) {
      throw new Error("PowerShell binary is not available");
    }

    const result = spawnSync(
      powershellBin,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        smokeScriptPath,
      ],
      {
        encoding: "utf8",
      },
    );

    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    assert.equal(result.status ?? 1, 0, output);
    assert.match(output, /\[artifact-only-smoke\] Passed/i);
    assert.match(output, /release readiness check passed/i);
    assert.match(output, /artifact\.source_run_manifest:/i);
  },
);
