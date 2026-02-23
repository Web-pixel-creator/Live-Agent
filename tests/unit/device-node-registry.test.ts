import test from "node:test";
import assert from "node:assert/strict";
import {
  getDeviceNodeById,
  listDeviceNodeIndex,
  listDeviceNodes,
  touchDeviceNodeHeartbeat,
  upsertDeviceNode,
} from "../../apps/api-backend/src/firestore.js";

test("device node registry supports versioned upsert and heartbeat", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const nodeId = `desktop-node-${Date.now()}`;

  const created = await upsertDeviceNode({
    nodeId,
    displayName: "Desktop Node A",
    kind: "desktop",
    platform: "windows",
    executorUrl: "http://127.0.0.1:8090",
    status: "online",
    capabilities: ["screen", "keyboard"],
    trustLevel: "reviewed",
    expectedVersion: 1,
    updatedBy: "unit-test",
  });
  assert.equal(created.outcome, "created");
  if (created.outcome !== "created") {
    throw new Error("expected created outcome");
  }
  assert.equal(created.node.version, 1);
  assert.equal(created.node.status, "online");

  const replay = await upsertDeviceNode({
    nodeId,
    displayName: "Desktop Node A",
    kind: "desktop",
    platform: "windows",
    executorUrl: "http://127.0.0.1:8090",
    status: "online",
    capabilities: ["screen", "keyboard"],
    trustLevel: "reviewed",
    expectedVersion: 1,
    updatedBy: "unit-test",
  });
  assert.equal(replay.outcome, "idempotent_replay");

  const updated = await upsertDeviceNode({
    nodeId,
    displayName: "Desktop Node A",
    kind: "desktop",
    platform: "windows",
    executorUrl: "http://127.0.0.1:8091",
    status: "degraded",
    capabilities: ["screen", "keyboard", "mouse"],
    trustLevel: "trusted",
    expectedVersion: 1,
    updatedBy: "unit-test",
  });
  assert.equal(updated.outcome, "updated");
  if (updated.outcome !== "updated") {
    throw new Error("expected updated outcome");
  }
  assert.equal(updated.node.version, 2);
  assert.equal(updated.node.status, "degraded");
  assert.equal(updated.node.trustLevel, "trusted");

  const conflict = await upsertDeviceNode({
    nodeId,
    displayName: "Desktop Node A",
    kind: "desktop",
    platform: "windows",
    status: "online",
    expectedVersion: 1,
  });
  assert.equal(conflict.outcome, "version_conflict");
  if (conflict.outcome !== "version_conflict") {
    throw new Error("expected version conflict outcome");
  }
  assert.equal(conflict.expectedVersion, 1);
  assert.equal(conflict.actualVersion, 2);

  const heartbeat = await touchDeviceNodeHeartbeat({
    nodeId,
    status: "online",
    metadata: { ping: true },
  });
  assert.ok(heartbeat);
  assert.equal(heartbeat?.status, "online");
  assert.ok(heartbeat?.lastSeenAt);

  const lookup = await getDeviceNodeById(nodeId);
  assert.ok(lookup);
  assert.equal(lookup?.nodeId, nodeId);
  assert.equal(lookup?.status, "online");

  const missing = await getDeviceNodeById(`missing-${Date.now()}`);
  assert.equal(missing, null);
});

test("device node index applies status and kind filtering", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const desktopId = `desktop-filter-${Date.now()}`;
  const mobileId = `mobile-filter-${Date.now()}`;

  await upsertDeviceNode({
    nodeId: desktopId,
    displayName: "Desktop Filter Node",
    kind: "desktop",
    platform: "windows",
    status: "online",
    capabilities: ["screen"],
    trustLevel: "reviewed",
  });
  await upsertDeviceNode({
    nodeId: mobileId,
    displayName: "Mobile Filter Node",
    kind: "mobile",
    platform: "android",
    status: "offline",
    capabilities: ["screen", "camera"],
    trustLevel: "reviewed",
  });

  const onlineDesktop = await listDeviceNodes({
    limit: 100,
    includeOffline: false,
    kind: "desktop",
  });
  assert.ok(onlineDesktop.some((node) => node.nodeId === desktopId));
  assert.ok(!onlineDesktop.some((node) => node.nodeId === mobileId));

  const fullIndex = await listDeviceNodeIndex({
    limit: 100,
    includeOffline: true,
  });
  assert.ok(fullIndex.some((node) => node.nodeId === desktopId));
  assert.ok(fullIndex.some((node) => node.nodeId === mobileId));
});
