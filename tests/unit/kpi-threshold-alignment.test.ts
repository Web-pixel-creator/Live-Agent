import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function parseRequiredNumber(source: string, pattern: RegExp, label: string): number {
  const match = source.match(pattern);
  assert.ok(match, `Could not parse ${label}`);
  return Number(match[1]);
}

test("critical KPI thresholds are aligned across policy/release and demo startup defaults", () => {
  const policyPath = resolve(process.cwd(), "scripts", "demo-e2e-policy-check.mjs");
  const releasePath = resolve(process.cwd(), "scripts", "release-readiness.ps1");
  const demoPath = resolve(process.cwd(), "scripts", "demo-e2e.ps1");

  const policySource = readFileSync(policyPath, "utf8");
  const releaseSource = readFileSync(releasePath, "utf8");
  const demoSource = readFileSync(demoPath, "utf8");

  const policyMaxRoundTrip = parseRequiredNumber(
    policySource,
    /const maxGatewayWsRoundTripMs[\s\S]*?:\s*(\d+)\s*;/,
    "policy maxGatewayWsRoundTripMs",
  );
  const policyMaxInterruptLatency = parseRequiredNumber(
    policySource,
    /const maxGatewayInterruptLatencyMs[\s\S]*?:\s*(\d+)\s*;/,
    "policy maxGatewayInterruptLatencyMs",
  );
  const policyMinStartAttempts = parseRequiredNumber(
    policySource,
    /const minServiceStartMaxAttempts[\s\S]*?:\s*(\d+)\s*;/,
    "policy minServiceStartMaxAttempts",
  );
  const policyMinStartBackoff = parseRequiredNumber(
    policySource,
    /const minServiceStartRetryBackoffMs[\s\S]*?:\s*(\d+)\s*;/,
    "policy minServiceStartRetryBackoffMs",
  );

  const releaseMaxRoundTrip = parseRequiredNumber(
    releaseSource,
    /MaxGatewayWsRoundTripMs\s*=\s*(\d+)/,
    "release MaxGatewayWsRoundTripMs",
  );
  const releaseMaxInterruptLatency = parseRequiredNumber(
    releaseSource,
    /MaxGatewayInterruptLatencyMs\s*=\s*(\d+)/,
    "release MaxGatewayInterruptLatencyMs",
  );
  const releaseMinStartAttempts = parseRequiredNumber(
    releaseSource,
    /MinServiceStartMaxAttempts\s*=\s*(\d+)/,
    "release MinServiceStartMaxAttempts",
  );
  const releaseMinStartBackoff = parseRequiredNumber(
    releaseSource,
    /MinServiceStartRetryBackoffMs\s*=\s*(\d+)/,
    "release MinServiceStartRetryBackoffMs",
  );

  const demoDefaultStartAttempts = parseRequiredNumber(
    demoSource,
    /Set-EnvDefault\s+-Name\s+"DEMO_E2E_SERVICE_START_MAX_ATTEMPTS"\s+-Value\s+"(\d+)"/,
    "demo DEMO_E2E_SERVICE_START_MAX_ATTEMPTS",
  );
  const demoDefaultStartBackoff = parseRequiredNumber(
    demoSource,
    /Set-EnvDefault\s+-Name\s+"DEMO_E2E_SERVICE_START_RETRY_BACKOFF_MS"\s+-Value\s+"(\d+)"/,
    "demo DEMO_E2E_SERVICE_START_RETRY_BACKOFF_MS",
  );

  assert.equal(releaseMaxRoundTrip, policyMaxRoundTrip);
  assert.equal(releaseMaxInterruptLatency, policyMaxInterruptLatency);
  assert.equal(releaseMinStartAttempts, policyMinStartAttempts);
  assert.equal(releaseMinStartBackoff, policyMinStartBackoff);

  assert.ok(demoDefaultStartAttempts >= policyMinStartAttempts);
  assert.ok(demoDefaultStartBackoff >= policyMinStartBackoff);
});
