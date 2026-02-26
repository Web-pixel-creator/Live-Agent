import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("gateway exposes public demo badge endpoints", () => {
  const gatewaySource = readFileSync(
    resolve(process.cwd(), "apps", "realtime-gateway", "src", "index.ts"),
    "utf8",
  );

  assert.match(gatewaySource, /\/demo-e2e\/badge\.json/);
  assert.match(gatewaySource, /\/demo-e2e\/badge-details\.json/);
  assert.match(gatewaySource, /public, max-age=300/);
  assert.match(gatewaySource, /public, max-age=60/);
});

test("tracked public badge payload has required schema fields", () => {
  const badgePath = resolve(process.cwd(), "public", "demo-e2e", "badge.json");
  const badge = JSON.parse(readFileSync(badgePath, "utf8")) as Record<string, unknown>;

  assert.equal(badge.schemaVersion, 1);
  assert.equal(typeof badge.label, "string");
  assert.equal(typeof badge.message, "string");
  assert.equal(typeof badge.color, "string");
  assert.equal(typeof badge.cacheSeconds, "number");
});

test("tracked public badge details embed badge payload", () => {
  const detailsPath = resolve(process.cwd(), "public", "demo-e2e", "badge-details.json");
  const details = JSON.parse(readFileSync(detailsPath, "utf8")) as Record<string, unknown>;
  const badge = details.badge as Record<string, unknown>;

  assert.equal(details.ok, true);
  assert.equal(typeof details.generatedAt, "string");
  assert.equal(typeof details.checks, "number");
  assert.equal(typeof details.violations, "number");
  assert.equal(typeof details.roundTripMs, "number");
  assert.equal(typeof details.policyPath, "string");
  assert.equal(typeof details.summaryPath, "string");
  assert.equal(badge.schemaVersion, 1);
  assert.equal(typeof badge.label, "string");
  assert.equal(typeof badge.message, "string");
  assert.equal(typeof badge.color, "string");
  assert.equal(typeof badge.cacheSeconds, "number");
});
