import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("release strict dispatch helper is wired across package script, script contract, and docs", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const packageRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(packageRaw) as { scripts?: Record<string, string> };

  const dispatchAlias = pkg.scripts?.["release:strict:dispatch"] ?? "";
  assert.match(dispatchAlias, /release-strict-dispatch\.ps1/);

  const scriptPath = resolve(process.cwd(), "scripts", "release-strict-dispatch.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /\[switch\]\$DeployToRailway/);
  assert.match(source, /\[string\]\$RailwayEnvironment = "production"/);
  assert.match(source, /\[string\]\$GatewayPublicUrl = "https:\/\/live-agent-production\.up\.railway\.app"/);
  assert.match(source, /\[string\]\$GatewayDemoFrontendPublicUrl = \$env:DEMO_FRONTEND_PUBLIC_URL/);
  assert.match(source, /\[int\]\$GatewayRootDescriptorCheckMaxAttempts = 3/);
  assert.match(source, /\[int\]\$GatewayRootDescriptorCheckRetryBackoffSec = 2/);
  assert.match(source, /\[switch\]\$SkipGatewayDeploy/);
  assert.match(source, /\[switch\]\$SkipFrontendDeploy/);
  assert.match(source, /\[switch\]\$GatewaySkipRootDescriptorCheck/);
  assert.match(source, /\[switch\]\$GatewayNoWait/);
  assert.match(source, /\[switch\]\$FrontendNoWait/);
  assert.match(source, /\[switch\]\$FrontendSkipHealthCheck/);
  assert.match(source, /\[switch\]\$NoWaitForRun/);
  assert.match(source, /\[int\]\$WaitTimeoutSec = 900/);
  assert.match(source, /\[int\]\$PollIntervalSec = 10/);

  assert.match(source, /workflow",\s*"run",\s*"release-strict-final\.yml"/);
  assert.match(source, /deploy_to_railway=/);
  assert.match(source, /railway_environment=/);
  assert.match(source, /gateway_public_url=/);
  assert.match(source, /gateway_demo_frontend_public_url=/);
  assert.match(source, /gateway_root_descriptor_check_max_attempts=/);
  assert.match(source, /gateway_root_descriptor_check_retry_backoff_sec=/);
  assert.match(source, /skip_gateway_deploy=/);
  assert.match(source, /skip_frontend_deploy=/);
  assert.match(source, /gateway_skip_root_descriptor_check=/);
  assert.match(source, /gateway_no_wait=/);
  assert.match(source, /frontend_no_wait=/);
  assert.match(source, /frontend_skip_health_check=/);
  assert.match(source, /gh auth token/);
  assert.match(source, /Missing token\. Set -Token or env GITHUB_TOKEN\/GH_TOKEN/);
  assert.match(source, /Get-LatestReleaseStrictRun/);
  assert.match(source, /Get-RunStatus/);

  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");
  assert.match(readme, /npm run release:strict:dispatch/);
  assert.match(readme, /-DeployToRailway/);
});
