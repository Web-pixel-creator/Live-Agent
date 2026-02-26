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

  assert.match(source, /\$pending = @\("QUEUED", "INITIALIZING", "BUILDING", "DEPLOYING"\)/);
});

test("railway deploy success path runs badge check only when skip flag is disabled", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "railway-deploy.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(
    source,
    /if \(\$state -eq "SUCCESS"\)\s*\{[\s\S]*if \(-not \$SkipPublicBadgeCheck\)\s*\{[\s\S]*Invoke-PublicBadgeCheck -Endpoint \$PublicBadgeEndpoint -DetailsEndpoint \$PublicBadgeDetailsEndpoint -PublicUrl \$RailwayPublicUrl -TimeoutSec \$PublicBadgeCheckTimeoutSec/,
  );
});

test("railway deploy pre-deploy gate selects strict/default verification script when not skipped", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "railway-deploy.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(
    source,
    /if \(-not \$SkipReleaseVerification\)\s*\{[\s\S]*\$verificationScript = if \(\$StrictReleaseVerification\) \{ "verify:release:strict" \} else \{ "verify:release" \}[\s\S]*& npm run \$verificationScript[\s\S]*\}/,
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

test("railway deploy docs mention no-wait badge-check skip behavior", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /In `-- -NoWait` mode, post-deploy badge endpoint check is not executed/);
});
