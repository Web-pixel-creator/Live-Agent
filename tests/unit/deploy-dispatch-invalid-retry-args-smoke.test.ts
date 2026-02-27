import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

function runPowerShellScript(scriptRelativePath: string, args: string[]) {
  const scriptPath = resolve(process.cwd(), scriptRelativePath);
  return spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args], {
    encoding: "utf8",
  });
}

function expectScriptFailure(result: ReturnType<typeof runPowerShellScript>, pattern: RegExp) {
  assert.notEqual(result.status, 0, "script should fail for invalid retry arguments");
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, pattern);
}

test("workflow-dispatch fails fast on invalid gateway root-descriptor max attempts", () => {
  const result = runPowerShellScript("scripts/workflow-dispatch.ps1", [
    "-Owner",
    "Web-pixel-creator",
    "-Repo",
    "Live-Agent",
    "-DryRun",
    "-GatewayRootDescriptorCheckMaxAttempts",
    "0",
  ]);
  expectScriptFailure(result, /GatewayRootDescriptorCheckMaxAttempts must be >= 1/i);
});

test("railway-deploy-all-dispatch fails fast on invalid gateway root-descriptor retry backoff", () => {
  const result = runPowerShellScript("scripts/railway-deploy-all-dispatch.ps1", [
    "-Owner",
    "Web-pixel-creator",
    "-Repo",
    "Live-Agent",
    "-GatewayRootDescriptorCheckRetryBackoffSec",
    "-1",
  ]);
  expectScriptFailure(result, /GatewayRootDescriptorCheckRetryBackoffSec must be >= 0/i);
});

test("release-strict-dispatch fails fast on invalid gateway root-descriptor max attempts", () => {
  const result = runPowerShellScript("scripts/release-strict-dispatch.ps1", [
    "-Owner",
    "Web-pixel-creator",
    "-Repo",
    "Live-Agent",
    "-GatewayRootDescriptorCheckMaxAttempts",
    "0",
  ]);
  expectScriptFailure(result, /GatewayRootDescriptorCheckMaxAttempts must be >= 1/i);
});

test("railway-deploy-all fails fast on invalid gateway root-descriptor retry backoff", () => {
  const result = runPowerShellScript("scripts/railway-deploy-all.ps1", [
    "-GatewayRootDescriptorCheckRetryBackoffSec",
    "-1",
  ]);
  expectScriptFailure(result, /GatewayRootDescriptorCheckRetryBackoffSec must be >= 0/i);
});

test("railway-deploy fails fast on invalid root-descriptor max attempts", () => {
  const result = runPowerShellScript("scripts/railway-deploy.ps1", [
    "-RootDescriptorCheckMaxAttempts",
    "0",
  ]);
  expectScriptFailure(result, /RootDescriptorCheckMaxAttempts must be >= 1/i);
});

test("repo-publish fails fast on invalid railway root-descriptor retry backoff when deploy is enabled", () => {
  const result = runPowerShellScript("scripts/github-repo-publish.ps1", [
    "-RemoteUrl",
    "https://github.com/Web-pixel-creator/Live-Agent.git",
    "-DeployRailway",
    "-RailwayRootDescriptorCheckRetryBackoffSec",
    "-1",
    "-SkipGitInit",
    "-SkipCommit",
    "-SkipPush",
    "-SkipPages",
    "-SkipBadgeCheck",
  ]);
  expectScriptFailure(result, /RailwayRootDescriptorCheckRetryBackoffSec must be >= 0/i);
});
