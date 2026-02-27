import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("railway deploy no-wait mode skips post-deploy badge check flow", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "railway-deploy.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(
    source,
    /if \(\$NoWait\)\s*\{[\s\S]*if \(-not \$SkipPublicBadgeCheck\)\s*\{[\s\S]*Skipping public badge endpoint check in no-wait mode\.[\s\S]*No-wait mode enabled\. Exiting after trigger\.[\s\S]*exit 0[\s\S]*\}/,
  );

  assert.match(source, /if \(\$NoWait\)\s*\{[\s\S]*Skipping gateway root descriptor check in no-wait mode\./);
  assert.match(source, /\$pending = @\("QUEUED", "INITIALIZING", "BUILDING", "DEPLOYING"\)/);
});

test("railway deploy success path runs badge check only when skip flag is disabled", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "railway-deploy.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /function Invoke-GatewayRootDescriptorCheck\(/);
  assert.match(
    source,
    /if \(\$state -eq "SUCCESS"\)\s*\{[\s\S]*if \(-not \$SkipRootDescriptorCheck\)\s*\{[\s\S]*Invoke-GatewayRootDescriptorCheck -Endpoint \$effectivePublicUrl -TimeoutSec \$RootDescriptorCheckTimeoutSec/,
  );
  assert.match(
    source,
    /if \(\$state -eq "SUCCESS"\)\s*\{[\s\S]*if \(-not \$SkipPublicBadgeCheck\)\s*\{[\s\S]*Invoke-PublicBadgeCheck -Endpoint \$PublicBadgeEndpoint -DetailsEndpoint \$PublicBadgeDetailsEndpoint -PublicUrl \$effectivePublicUrl -TimeoutSec \$PublicBadgeCheckTimeoutSec/,
  );
});

test("railway deploy pre-deploy gate selects strict/default verification script when not skipped", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "railway-deploy.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(
    source,
    /if \(-not \$SkipReleaseVerification\)\s*\{[\s\S]*\$verificationScript = if \(\$StrictReleaseVerification\) \{ "verify:release:strict" \} else \{ "verify:release" \}[\s\S]*\$npmCli = Resolve-NpmCli[\s\S]*& \$npmCli run \$verificationScript[\s\S]*\}/,
  );
  assert.match(source, /function Resolve-NpmCli\(\)/);
});

test("railway deploy link step accepts existing linked context when project/service are omitted", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "railway-deploy.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /\$hasProjectId = -not \[string\]::IsNullOrWhiteSpace\(\$ProjectId\)/);
  assert.match(source, /\$hasServiceId = -not \[string\]::IsNullOrWhiteSpace\(\$ServiceId\)/);
  assert.match(
    source,
    /elseif \(-not \$hasProjectId -and -not \$hasServiceId\)\s*\{[\s\S]*using existing linked Railway context\./,
  );
  assert.match(
    source,
    /else\s*\{[\s\S]*Fail "Provide both -ProjectId and -ServiceId together, or omit both to use existing Railway link, or use -SkipLink\."/,
  );
});

test("railway deploy failure path captures diagnostics logs before failing", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "railway-deploy.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /function Show-DeploymentFailureDiagnostics/);
  assert.match(source, /if \(\$SkipFailureLogs\)\s*\{[\s\S]*Failure diagnostics log capture skipped by flag\./);
  assert.match(source, /Collecting failure diagnostics \(build logs\)/);
  assert.match(source, /Collecting failure diagnostics \(deployment logs\)/);
  assert.match(source, /\$baseArgs = @\("logs", \$DeploymentId, "--lines", \[string\]\$lineCount\)/);
  assert.match(
    source,
    /if \(\$pending -notcontains \$state\)\s*\{[\s\S]*Show-DeploymentFailureDiagnostics -DeploymentId \$deploymentId -Service \$resolvedService -Env \$Environment -Lines \$FailureLogLines[\s\S]*Fail "Railway deployment finished with non-success status:/,
  );
});

test("railway deploy success path reports effective runtime start command metadata", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "railway-deploy.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /function Resolve-DeploymentStartCommand/);
  assert.match(source, /function Resolve-ServicePublicUrlFromStatus/);
  assert.match(
    source,
    /if \(\$state -eq "SUCCESS"\)\s*\{[\s\S]*\$effectiveStartCommand = Resolve-DeploymentStartCommand -Deployment \$deployment[\s\S]*Effective start command:/,
  );
  assert.match(
    source,
    /if \(\$state -eq "SUCCESS"\)\s*\{[\s\S]*\$configSource = \[string\]\$deployment\.meta\.configFile[\s\S]*Config-as-code source:/,
  );
  assert.match(
    source,
    /if \(\$state -eq "SUCCESS"\)\s*\{[\s\S]*\$effectivePublicUrl = if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayPublicUrl\)\)[\s\S]*Effective public URL:/,
  );
});

test("railway deploy docs mention no-wait badge-check skip behavior", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(
    readme,
    /In `-- -NoWait` mode, post-deploy gateway root descriptor and badge endpoint checks are not executed/,
  );
  assert.match(readme, /Runs gateway root descriptor check \(`GET \/`\) after successful deploy/);
  assert.match(readme, /`-- -SkipRootDescriptorCheck` - skip post-deploy gateway root descriptor check/);
  assert.match(readme, /If `-ProjectId\/-ServiceId` are omitted, reuses existing Railway linked context/);
  assert.match(readme, /effective runtime metadata after successful deploy/);
});
