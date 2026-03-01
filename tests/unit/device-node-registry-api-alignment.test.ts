import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend exposes device-node detail and update-history routes", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "/v1/device-nodes/:id",
    "/v1/device-nodes/:id/updates",
    "parseDeviceNodePathSuffix",
    "API_DEVICE_NODE_INVALID_PATH",
    "API_DEVICE_NODE_NOT_FOUND",
    "device_node_upsert",
    "device_node_heartbeat",
    "extractDeviceNodeIdFromOperatorAction",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `device node API contract missing token: ${token}`);
  }
});

test("readme documents device-node detail and update-history APIs", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /GET \/v1\/device-nodes\/\{nodeId\}/);
  assert.match(readme, /GET \/v1\/device-nodes\/\{nodeId\}\/updates/);
});

