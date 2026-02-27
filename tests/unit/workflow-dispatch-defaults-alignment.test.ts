import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function extractIntDefault(source: string, name: string): number {
  const match = source.match(new RegExp(`\\[int\\]\\$${name}\\s*=\\s*(\\d+)`, "m"));
  assert.ok(match, `missing int default for ${name}`);
  return Number(match[1]);
}

function extractStringDefault(source: string, name: string): string {
  const match = source.match(new RegExp(`\\[string\\]\\$${name}\\s*=\\s*"([^"]+)"`, "m"));
  assert.ok(match, `missing string default for ${name}`);
  return match[1];
}

test("workflow dispatch defaults stay aligned with release and railway dispatch helpers", () => {
  const workflowDispatch = readFileSync(resolve(process.cwd(), "scripts", "workflow-dispatch.ps1"), "utf8");
  const releaseDispatch = readFileSync(resolve(process.cwd(), "scripts", "release-strict-dispatch.ps1"), "utf8");
  const railwayDispatch = readFileSync(resolve(process.cwd(), "scripts", "railway-deploy-all-dispatch.ps1"), "utf8");

  const workflowWaitTimeoutSec = extractIntDefault(workflowDispatch, "WaitTimeoutSec");
  const workflowPollIntervalSec = extractIntDefault(workflowDispatch, "PollIntervalSec");
  const workflowRailwayEnvironment = extractStringDefault(workflowDispatch, "RailwayEnvironment");
  const workflowGatewayPublicUrl = extractStringDefault(workflowDispatch, "GatewayPublicUrl");

  const releaseWaitTimeoutSec = extractIntDefault(releaseDispatch, "WaitTimeoutSec");
  const releasePollIntervalSec = extractIntDefault(releaseDispatch, "PollIntervalSec");
  const releaseRailwayEnvironment = extractStringDefault(releaseDispatch, "RailwayEnvironment");
  const releaseGatewayPublicUrl = extractStringDefault(releaseDispatch, "GatewayPublicUrl");

  const railwayWaitTimeoutSec = extractIntDefault(railwayDispatch, "WaitTimeoutSec");
  const railwayPollIntervalSec = extractIntDefault(railwayDispatch, "PollIntervalSec");
  const railwayEnvironment = extractStringDefault(railwayDispatch, "Environment");
  const railwayGatewayPublicUrl = extractStringDefault(railwayDispatch, "GatewayPublicUrl");

  assert.equal(workflowWaitTimeoutSec, releaseWaitTimeoutSec, "WaitTimeoutSec must align with release dispatch");
  assert.equal(workflowWaitTimeoutSec, railwayWaitTimeoutSec, "WaitTimeoutSec must align with railway deploy-all dispatch");
  assert.equal(workflowPollIntervalSec, releasePollIntervalSec, "PollIntervalSec must align with release dispatch");
  assert.equal(workflowPollIntervalSec, railwayPollIntervalSec, "PollIntervalSec must align with railway deploy-all dispatch");
  assert.equal(workflowRailwayEnvironment, releaseRailwayEnvironment, "Environment defaults must align with release dispatch");
  assert.equal(workflowRailwayEnvironment, railwayEnvironment, "Environment defaults must align with railway deploy-all dispatch");
  assert.equal(workflowGatewayPublicUrl, releaseGatewayPublicUrl, "GatewayPublicUrl defaults must align with release dispatch");
  assert.equal(
    workflowGatewayPublicUrl,
    railwayGatewayPublicUrl,
    "GatewayPublicUrl defaults must align with railway deploy-all dispatch",
  );
});
