import test from "node:test";
import assert from "node:assert/strict";
import { buildStoryCacheMetricRecords } from "../../agents/orchestrator/src/story-cache-telemetry.js";

test("story cache telemetry emits expected totals metrics", () => {
  const metrics = buildStoryCacheMetricRecords({
    enabled: true,
    config: {
      maxEntries: 600,
      ttlMs: 1800000,
    },
    policy: {
      modelFingerprint: "planner:gemini-3-pro|branch:gemini-3-flash",
      purgeToken: null,
    },
    totals: {
      entries: 12,
      hits: 80,
      misses: 20,
      writes: 40,
      evictions: 4,
      invalidations: 1,
      hitRatePct: 80,
    },
    scopes: {
      plan: 3,
      branch: 2,
      asset: 7,
    },
    memory: {
      approxBytes: 4096,
    },
    lastInvalidation: {
      reason: "model_fingerprint_changed",
      at: "2026-02-22T00:00:00.000Z",
    },
  });

  const byType = new Map(metrics.map((record) => [record.metricType, record]));
  assert.equal(byType.get("storyteller.cache.entries")?.value, 12);
  assert.equal(byType.get("storyteller.cache.hit_rate_pct")?.value, 80);
  assert.equal(byType.get("storyteller.cache.hits_total")?.value, 80);
  assert.equal(byType.get("storyteller.cache.misses_total")?.value, 20);
  assert.equal(byType.get("storyteller.cache.writes_total")?.value, 40);
  assert.equal(byType.get("storyteller.cache.evictions_total")?.value, 4);
  assert.equal(byType.get("storyteller.cache.invalidations_total")?.value, 1);
  assert.equal(byType.get("storyteller.cache.memory_approx_bytes")?.value, 4096);
});

test("story cache telemetry clamps invalid totals values", () => {
  const metrics = buildStoryCacheMetricRecords({
    enabled: true,
    config: {
      maxEntries: 600,
      ttlMs: 1800000,
    },
    policy: {
      modelFingerprint: null,
      purgeToken: null,
    },
    totals: {
      entries: -1,
      hits: Number.NaN,
      misses: -4,
      writes: -8,
      evictions: -5,
      invalidations: -3,
      hitRatePct: 120,
    },
    scopes: {
      plan: -2,
      branch: -3,
      asset: -4,
    },
    memory: {
      approxBytes: Number.NaN,
    },
    lastInvalidation: {
      reason: null,
      at: null,
    },
  });

  const byType = new Map(metrics.map((record) => [record.metricType, record]));
  assert.equal(byType.get("storyteller.cache.entries")?.value, 0);
  assert.equal(byType.get("storyteller.cache.hit_rate_pct")?.value, 100);
  assert.equal(byType.get("storyteller.cache.hits_total")?.value, 0);
  assert.equal(byType.get("storyteller.cache.misses_total")?.value, 0);
  assert.equal(byType.get("storyteller.cache.writes_total")?.value, 0);
  assert.equal(byType.get("storyteller.cache.evictions_total")?.value, 0);
  assert.equal(byType.get("storyteller.cache.invalidations_total")?.value, 0);
  assert.equal(byType.get("storyteller.cache.memory_approx_bytes")?.value, 0);
});

test("story cache telemetry emits scope metrics with labels", () => {
  const metrics = buildStoryCacheMetricRecords({
    enabled: true,
    config: {
      maxEntries: 600,
      ttlMs: 1800000,
    },
    policy: {
      modelFingerprint: null,
      purgeToken: null,
    },
    totals: {
      entries: 3,
      hits: 1,
      misses: 1,
      writes: 2,
      evictions: 0,
      invalidations: 0,
      hitRatePct: 50,
    },
    scopes: {
      plan: 1,
      branch: 1,
      asset: 1,
    },
    memory: {
      approxBytes: 1024,
    },
    lastInvalidation: {
      reason: null,
      at: null,
    },
  });

  const scopeMetrics = metrics.filter((record) => record.metricType === "storyteller.cache.scope_entries");
  assert.equal(scopeMetrics.length, 3);
  assert.equal(scopeMetrics.find((record) => record.labels?.scope === "plan")?.value, 1);
  assert.equal(scopeMetrics.find((record) => record.labels?.scope === "branch")?.value, 1);
  assert.equal(scopeMetrics.find((record) => record.labels?.scope === "asset")?.value, 1);
});
