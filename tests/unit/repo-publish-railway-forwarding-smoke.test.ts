import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("repo publish forwards railway deploy arguments with stable contract", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "github-repo-publish.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /if \(\$DeployRailway\)/);
  assert.match(source, /\$railwayArgs = @\(/);
  assert.match(source, /"-File", "\$PSScriptRoot\/railway-deploy\.ps1"/);
  assert.match(source, /"-SkipReleaseVerification"/);
  assert.match(source, /artifacts\\deploy\\repo-publish-summary\.json/);
  assert.match(source, /artifacts\/deploy\/railway-deploy-summary\.json/);
  assert.match(source, /releaseEvidenceSnapshot = \$releaseEvidenceSnapshot/);
  assert.match(source, /repo_publish_summary_path/);
  assert.match(source, /repo_publish_release_evidence_artifacts_count/);
  assert.match(source, /repo_publish_railway_summary_path/);
  assert.match(source, /repo_publish_release_evidence_snapshot_available/);
  assert.match(source, /Repo publish Railway deploy summary artifact:/);

  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayProjectId\)\)\s*\{\s*\$railwayArgs \+= @\("-ProjectId", \$RailwayProjectId\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayServiceId\)\)\s*\{\s*\$railwayArgs \+= @\("-ServiceId", \$RailwayServiceId\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayEnvironment\)\)\s*\{\s*\$railwayArgs \+= @\("-Environment", \$RailwayEnvironment\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayWorkspace\)\)\s*\{\s*\$railwayArgs \+= @\("-Workspace", \$RailwayWorkspace\)/,
  );

  assert.match(source, /if \(\$RailwaySkipLink\)\s*\{\s*\$railwayArgs \+= "-SkipLink"/);
  assert.match(source, /if \(\$RailwaySkipPublicBadgeCheck\)\s*\{\s*\$railwayArgs \+= "-SkipPublicBadgeCheck"/);
  assert.match(source, /if \(\$RailwaySkipRootDescriptorCheck\)\s*\{\s*\$railwayArgs \+= "-SkipRootDescriptorCheck"/);
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayPublicBadgeEndpoint\)\)\s*\{\s*\$railwayArgs \+= @\("-PublicBadgeEndpoint", \$RailwayPublicBadgeEndpoint\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayPublicBadgeDetailsEndpoint\)\)\s*\{\s*\$railwayArgs \+= @\("-PublicBadgeDetailsEndpoint", \$RailwayPublicBadgeDetailsEndpoint\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayPublicUrl\)\)\s*\{\s*\$railwayArgs \+= @\("-RailwayPublicUrl", \$RailwayPublicUrl\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayDemoFrontendPublicUrl\)\)\s*\{\s*\$railwayArgs \+= @\("-DemoFrontendPublicUrl", \$RailwayDemoFrontendPublicUrl\)/,
  );
  assert.match(
    source,
    /if \(\$RailwayRootDescriptorCheckMaxAttempts -gt 0\)\s*\{\s*\$railwayArgs \+= @\("-RootDescriptorCheckMaxAttempts", \[string\]\$RailwayRootDescriptorCheckMaxAttempts\)/,
  );
  assert.match(
    source,
    /if \(\$RailwayRootDescriptorCheckRetryBackoffSec -ge 0\)\s*\{\s*\$railwayArgs \+= @\("-RootDescriptorCheckRetryBackoffSec", \[string\]\$RailwayRootDescriptorCheckRetryBackoffSec\)/,
  );
  assert.match(
    source,
    /if \(\$RailwayPublicBadgeCheckTimeoutSec -gt 0\)\s*\{\s*\$railwayArgs \+= @\("-PublicBadgeCheckTimeoutSec", \[string\]\$RailwayPublicBadgeCheckTimeoutSec\)/,
  );
  assert.match(source, /if \(\$RailwayNoWait\)\s*\{\s*\$railwayArgs \+= "-NoWait"/);

  assert.match(source, /if \(\$DeployRailwayFrontend\)/);
  assert.match(source, /\$railwayFrontendArgs = @\(/);
  assert.match(source, /"-File", "\$PSScriptRoot\/railway-deploy-frontend\.ps1"/);
  assert.match(source, /\$resolvedFrontendApiBaseUrl = \$RailwayFrontendApiBaseUrl/);
  assert.match(source, /\$resolvedFrontendWsUrl = \$RailwayFrontendWsUrl/);
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayFrontendProjectId\)\)\s*\{\s*\$railwayFrontendArgs \+= @\("-ProjectId", \$RailwayFrontendProjectId\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayFrontendService\)\)\s*\{\s*\$railwayFrontendArgs \+= @\("-Service", \$RailwayFrontendService\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayFrontendEnvironment\)\)\s*\{\s*\$railwayFrontendArgs \+= @\("-Environment", \$RailwayFrontendEnvironment\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayFrontendPath\)\)\s*\{\s*\$railwayFrontendArgs \+= @\("-FrontendPath", \$RailwayFrontendPath\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$resolvedFrontendWsUrl\)\)\s*\{\s*\$railwayFrontendArgs \+= @\("-FrontendWsUrl", \$resolvedFrontendWsUrl\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$resolvedFrontendApiBaseUrl\)\)\s*\{\s*\$railwayFrontendArgs \+= @\("-FrontendApiBaseUrl", \$resolvedFrontendApiBaseUrl\)/,
  );
  assert.match(source, /if \(\$RailwayFrontendNoWait\)\s*\{\s*\$railwayFrontendArgs \+= "-NoWait"/);
  assert.match(source, /if \(\$RailwayFrontendSkipHealthCheck\)\s*\{\s*\$railwayFrontendArgs \+= "-SkipHealthCheck"/);
  assert.match(
    source,
    /if \(\$RailwayFrontendHealthCheckTimeoutSec -gt 0\)\s*\{\s*\$railwayFrontendArgs \+= @\("-HealthCheckTimeoutSec", \[string\]\$RailwayFrontendHealthCheckTimeoutSec\)/,
  );
});

test("repo publish docs include railway badge check override example", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /npm run repo:publish -- -DeployRailway -SkipPages -SkipBadgeCheck/);
  assert.match(readme, /-RailwayPublicUrl https:\/\/live-agent-production\.up\.railway\.app/);
  assert.match(readme, /-RailwayPublicBadgeCheckTimeoutSec 30/);
  assert.match(readme, /-DeployRailwayFrontend/);
  assert.match(readme, /-RailwayFrontendService "Live-Agent-Frontend"/);
  assert.match(readme, /repo publish surfaces local release-evidence report\/manifest paths after pre-publish verification/);
  assert.match(readme, /artifacts\/deploy\/repo-publish-summary\.json/);
  assert.match(readme, /artifacts\/deploy\/railway-deploy-summary\.json/);
  assert.match(readme, /repo_publish_summary_path/);
});

test("repo publish supports trigger-only railway deploy flags combination", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "github-repo-publish.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(
    source,
    /if \(\$RailwaySkipPublicBadgeCheck\)\s*\{\s*\$railwayArgs \+= "-SkipPublicBadgeCheck"\s*\}[\s\S]*if \(\$RailwayNoWait\)\s*\{\s*\$railwayArgs \+= "-NoWait"\s*\}/,
  );
});
