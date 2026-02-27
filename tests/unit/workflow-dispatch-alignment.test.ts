import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("workflow dispatch helper routes to release and railway dispatch scripts with shared flags", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const packageRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(packageRaw) as { scripts?: Record<string, string> };

  const dispatchAlias = pkg.scripts?.["workflow:dispatch"] ?? "";
  assert.match(dispatchAlias, /workflow-dispatch\.ps1/);

  const scriptPath = resolve(process.cwd(), "scripts", "workflow-dispatch.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /\[ValidateSet\("release_strict", "railway_deploy_all"\)\]/);
  assert.match(source, /\[string\]\$Workflow = "railway_deploy_all"/);
  assert.match(source, /"release-strict-dispatch\.ps1"/);
  assert.match(source, /"railway-deploy-all-dispatch\.ps1"/);
  assert.match(source, /if \(\$Workflow -eq "release_strict"\)/);
  assert.match(source, /"-RailwayEnvironment"/);
  assert.match(source, /"-Environment"/);
  assert.match(source, /if \(\$DeployToRailway\)\s*\{\s*\$dispatchArgs \+= "-DeployToRailway"/);
  assert.match(source, /if \(\$SkipReleaseVerification\)\s*\{\s*\$dispatchArgs \+= "-SkipReleaseVerification"/);
  assert.match(source, /if \(\$SkipGatewayDeploy\)\s*\{\s*\$dispatchArgs \+= "-SkipGatewayDeploy"/);
  assert.match(source, /if \(\$SkipFrontendDeploy\)\s*\{\s*\$dispatchArgs \+= "-SkipFrontendDeploy"/);
  assert.match(source, /if \(\$GatewayNoWait\)\s*\{\s*\$dispatchArgs \+= "-GatewayNoWait"/);
  assert.match(source, /if \(\$FrontendNoWait\)\s*\{\s*\$dispatchArgs \+= "-FrontendNoWait"/);
  assert.match(source, /if \(\$FrontendSkipHealthCheck\)\s*\{\s*\$dispatchArgs \+= "-FrontendSkipHealthCheck"/);
  assert.match(source, /\[switch\]\$DryRun/);
  assert.match(source, /if \(\$NoWaitForRun\)\s*\{\s*\$dispatchArgs \+= "-NoWaitForRun"/);
  assert.match(source, /\[int\]\$WaitTimeoutSec = 900/);
  assert.match(source, /\[int\]\$PollIntervalSec = 10/);
  assert.match(source, /\[workflow-dispatch\] DryRun enabled\. Command preview:/);
  assert.match(source, /if \(\$DryRun\)\s*\{[\s\S]*exit 0[\s\S]*\}/);
});

test("readme documents unified workflow dispatch entrypoint", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /npm run workflow:dispatch/);
  assert.match(readme, /-Workflow railway_deploy_all/);
  assert.match(readme, /-Workflow release_strict/);
});
