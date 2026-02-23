import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

function assertContains(source: string, pattern: string, label: string): void {
  assert.ok(source.includes(pattern), `Missing expected pattern (${label}): ${pattern}`);
}

test("webrtc V2 spike guardrails stay aligned across docs and runtime gates", () => {
  const docsSpikePath = resolve(process.cwd(), "docs", "webrtc-v2-spike.md");
  const designPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "design.md");
  const tasksPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "tasks.md");
  const demoPath = resolve(process.cwd(), "scripts", "demo-e2e.ps1");
  const policyPath = resolve(process.cwd(), "scripts", "demo-e2e-policy-check.mjs");
  const releasePath = resolve(process.cwd(), "scripts", "release-readiness.ps1");

  const docsSpikeSource = readSource(docsSpikePath);
  const designSource = readSource(designPath);
  const tasksSource = readSource(tasksPath);
  const demoSource = readSource(demoPath);
  const policySource = readSource(policyPath);
  const releaseSource = readSource(releasePath);

  assertContains(docsSpikeSource, "Keep WebSocket as MVP transport.", "spike decision websocket baseline");
  assertContains(docsSpikeSource, "Proceed with WebRTC only as V2 flagged migration.", "spike decision v2 only");
  assertContains(docsSpikeSource, "No MVP transport migration", "spike scope no migration");

  assertContains(designSource, "WebSocket is the only required transport in MVP.", "design websocket only");
  assertContains(designSource, "WebRTC remains a V2 enhancement", "design webrtc deferred");

  assertContains(
    tasksSource,
    "T-223 | WebRTC spike and migration plan for Live Agent V2 transport",
    "tasks t-223 presence",
  );
  assertContains(tasksSource, "no MVP transport change", "tasks t-223 no mvp transport change");

  assertContains(
    demoSource,
    "MVP active transport must remain websocket for realtime-gateway",
    "demo runtime websocket active guard",
  );
  assertContains(
    demoSource,
    "WebRTC requested mode must surface fallbackActive=true until transport path is implemented",
    "demo runtime webrtc fallback guard",
  );

  assertContains(policySource, "\"kpi.gatewayTransportActiveMode\"", "policy gateway active mode check");
  assertContains(policySource, "\"websocket\"", "policy websocket expectation");
  assertContains(policySource, "\"kpi.gatewayTransportFallbackActive\"", "policy fallback check");

  assertContains(
    releaseSource,
    "gatewayTransportActiveMode expected websocket",
    "release gateway active mode check",
  );
  assertContains(
    releaseSource,
    "gatewayTransportFallbackActive expected",
    "release gateway fallback check",
  );
});
