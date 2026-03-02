import test from "node:test";
import assert from "node:assert/strict";
import { resolveDeviceNode, upsertDeviceNode } from "../../apps/api-backend/src/firestore.js";

test("device-node resolver selects best candidate by routing criteria", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const seed = Date.now();
  const capability = `ui-exec-${seed}`;

  await upsertDeviceNode({
    nodeId: `resolve-desktop-${seed}`,
    displayName: "Resolve Desktop",
    kind: "desktop",
    platform: "windows",
    status: "online",
    trustLevel: "reviewed",
    capabilities: [capability, "keyboard"],
    executorUrl: "http://127.0.0.1:6001",
    updatedBy: "unit-test",
  });
  await upsertDeviceNode({
    nodeId: `resolve-mobile-degraded-${seed}`,
    displayName: "Resolve Mobile Degraded",
    kind: "mobile",
    platform: "android",
    status: "degraded",
    trustLevel: "trusted",
    capabilities: [capability, "touch"],
    executorUrl: "http://127.0.0.1:6002",
    updatedBy: "unit-test",
  });
  await upsertDeviceNode({
    nodeId: `resolve-mobile-online-${seed}`,
    displayName: "Resolve Mobile Online",
    kind: "mobile",
    platform: "android",
    status: "online",
    trustLevel: "trusted",
    capabilities: [capability, "touch", "camera"],
    executorUrl: "http://127.0.0.1:6003",
    updatedBy: "unit-test",
  });

  const result = await resolveDeviceNode({
    kind: "mobile",
    platform: "android",
    requiredCapabilities: [capability, "touch"],
    minTrustLevel: "reviewed",
    includeDegraded: true,
    includeOffline: false,
    limit: 10,
  });

  assert.equal(result.reason, "selected");
  assert.ok(result.selected);
  assert.equal(result.selected?.nodeId, `resolve-mobile-online-${seed}`);
  assert.ok(result.candidates.some((candidate) => candidate.nodeId === `resolve-mobile-degraded-${seed}`));
  assert.ok(result.considered >= 3);
});

test("device-node resolver reports node_filtered when requested node fails filters", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const seed = Date.now();
  const nodeId = `resolve-offline-${seed}`;

  await upsertDeviceNode({
    nodeId,
    displayName: "Resolve Offline",
    kind: "desktop",
    platform: "windows",
    status: "offline",
    trustLevel: "trusted",
    capabilities: ["ui-exec-offline"],
    executorUrl: "http://127.0.0.1:6010",
    updatedBy: "unit-test",
  });

  const result = await resolveDeviceNode({
    nodeId,
    includeOffline: false,
  });

  assert.equal(result.reason, "node_filtered");
  assert.equal(result.selected, null);
  assert.equal(result.candidates.length, 0);
  assert.ok(result.considered >= 1);
});

test("device-node resolver reports node_not_found for unknown nodeId", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const result = await resolveDeviceNode({
    nodeId: `missing-${Date.now()}`,
  });
  assert.equal(result.reason, "node_not_found");
  assert.equal(result.selected, null);
  assert.equal(result.candidates.length, 0);
  assert.equal(result.considered, 0);
});
