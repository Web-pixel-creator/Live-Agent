import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function extractQuotedItems(raw: string): string[] {
  return [...raw.matchAll(/"([^"]+)"/g)]
    .map((match) => match[1].trim())
    .filter((item) => item.length > 0);
}

function parsePolicyRequiredScenarios(source: string): string[] {
  const match = source.match(
    /args\.requiredScenarios\s*\?\?\s*\[([\s\S]*?)\]\.join\(","\)/m,
  );
  assert.ok(match, "Could not parse policy requiredScenarios list");
  return extractQuotedItems(match[1]);
}

function parseReleaseRequiredScenarios(source: string): string[] {
  const match = source.match(/\$requiredSummaryScenarios\s*=\s*@\(([\s\S]*?)\)/m);
  assert.ok(match, "Could not parse release requiredSummaryScenarios list");
  return extractQuotedItems(match[1]);
}

test("release required scenarios are aligned with policy required scenarios", () => {
  const policyPath = resolve(process.cwd(), "scripts", "demo-e2e-policy-check.mjs");
  const releasePath = resolve(process.cwd(), "scripts", "release-readiness.ps1");

  const policySource = readFileSync(policyPath, "utf8");
  const releaseSource = readFileSync(releasePath, "utf8");

  const policyRequired = parsePolicyRequiredScenarios(policySource);
  const releaseRequired = parseReleaseRequiredScenarios(releaseSource);

  const expectedReleaseCritical = [
    "gateway.websocket.item_truncate",
    "gateway.websocket.item_delete",
    "gateway.websocket.binding_mismatch",
    "gateway.websocket.draining_rejection",
    "api.sessions.versioning",
  ];

  assert.deepEqual(
    releaseRequired,
    expectedReleaseCritical,
    "release required scenario set changed unexpectedly",
  );

  const policySet = new Set(policyRequired);
  const releaseSet = new Set(releaseRequired);

  assert.equal(policySet.size, policyRequired.length, "policy required scenarios contain duplicates");
  assert.equal(releaseSet.size, releaseRequired.length, "release required scenarios contain duplicates");

  for (const scenario of releaseRequired) {
    assert.ok(
      policySet.has(scenario),
      `release scenario '${scenario}' is missing from policy required scenarios`,
    );
  }
});
