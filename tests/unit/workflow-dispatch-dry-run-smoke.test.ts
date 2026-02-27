import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

function runDryDispatch(args: string[]) {
  const scriptPath = resolve(process.cwd(), "scripts", "workflow-dispatch.ps1");
  return spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-Owner", "Web-pixel-creator", "-Repo", "Live-Agent", "-DryRun", ...args],
    {
      encoding: "utf8",
    },
  );
}

test("workflow dispatch dry-run previews railway deploy-all target command", () => {
  const result = runDryDispatch([
    "-Workflow",
    "railway_deploy_all",
    "-SkipReleaseVerification",
    "-GatewaySkipRootDescriptorCheck",
    "-GatewayDemoFrontendPublicUrl",
    "https://live-agent-frontend-production.up.railway.app",
  ]);
  assert.equal(result.status, 0, `dry-run railway dispatch failed: ${result.stderr}`);
  assert.match(result.stdout, /\[workflow-dispatch\] DryRun enabled\. Command preview:/);
  assert.match(result.stdout, /railway-deploy-all-dispatch\.ps1/);
  assert.match(result.stdout, /"-SkipReleaseVerification"/);
  assert.match(result.stdout, /"-GatewaySkipRootDescriptorCheck"/);
  assert.match(result.stdout, /"-GatewayDemoFrontendPublicUrl"/);
  assert.match(result.stdout, /"https:\/\/live-agent-frontend-production\.up\.railway\.app"/);
});

test("workflow dispatch dry-run previews release strict target command", () => {
  const result = runDryDispatch(["-Workflow", "release_strict", "-DeployToRailway"]);
  assert.equal(result.status, 0, `dry-run release dispatch failed: ${result.stderr}`);
  assert.match(result.stdout, /\[workflow-dispatch\] DryRun enabled\. Command preview:/);
  assert.match(result.stdout, /release-strict-dispatch\.ps1/);
  assert.match(result.stdout, /"-DeployToRailway"/);
});
