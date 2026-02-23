import test from "node:test";
import assert from "node:assert/strict";
import { buildDeviceNodeHealthSummary } from "../../apps/api-backend/src/device-node-summary.js";
import type { DeviceNodeRecord } from "../../apps/api-backend/src/firestore.js";

function makeNode(params: {
  nodeId: string;
  status: DeviceNodeRecord["status"];
  updatedAt: string;
  lastSeenAt?: string | null;
}): DeviceNodeRecord {
  return {
    nodeId: params.nodeId,
    displayName: params.nodeId,
    kind: "desktop",
    platform: "windows",
    executorUrl: "http://localhost:8090/execute",
    status: params.status,
    capabilities: ["screen"],
    trustLevel: "reviewed",
    version: 1,
    lastSeenAt: params.lastSeenAt ?? null,
    updatedBy: "unit-test",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: params.updatedAt,
    metadata: null,
  };
}

test("device node health summary counts statuses and stale nodes", () => {
  const nowMs = Date.parse("2026-02-23T00:00:10.000Z");
  const nodes: DeviceNodeRecord[] = [
    makeNode({
      nodeId: "desktop-a",
      status: "online",
      updatedAt: "2026-02-23T00:00:09.000Z",
      lastSeenAt: "2026-02-23T00:00:09.500Z",
    }),
    makeNode({
      nodeId: "desktop-b",
      status: "degraded",
      updatedAt: "2026-02-23T00:00:08.000Z",
      lastSeenAt: "2026-02-23T00:00:00.000Z",
    }),
    makeNode({
      nodeId: "desktop-c",
      status: "offline",
      updatedAt: "2026-02-23T00:00:07.000Z",
      lastSeenAt: null,
    }),
  ];

  const summary = buildDeviceNodeHealthSummary(nodes, {
    nowMs,
    staleThresholdMs: 5_000,
    recentLimit: 10,
  });

  assert.equal(summary.total, 3);
  assert.equal(summary.statusCounts.online, 1);
  assert.equal(summary.statusCounts.degraded, 1);
  assert.equal(summary.statusCounts.offline, 1);
  assert.equal(summary.staleCount, 2);
  assert.equal(summary.missingHeartbeatCount, 1);
  assert.equal(summary.lastSeenMaxAgeMs, 10_000);
  assert.equal(summary.recent.length, 3);
  assert.equal(summary.recent[0]?.nodeId, "desktop-a");
});

test("device node health summary handles invalid stale config safely", () => {
  const summary = buildDeviceNodeHealthSummary([], {
    staleThresholdMs: Number.NaN,
    recentLimit: -5,
  });

  assert.equal(summary.total, 0);
  assert.equal(summary.staleThresholdMs, 300_000);
  assert.equal(summary.staleCount, 0);
  assert.equal(summary.missingHeartbeatCount, 0);
  assert.equal(summary.lastSeenMaxAgeMs, null);
  assert.equal(summary.recent.length, 0);
});
