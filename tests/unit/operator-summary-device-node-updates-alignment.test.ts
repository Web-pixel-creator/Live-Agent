import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api operator summary includes device-node updates evidence contract", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "buildDeviceNodeUpdatesSummary",
    'item.action === "device_node_upsert" || item.action === "device_node_heartbeat"',
    "const deviceNodeUpdates = buildDeviceNodeUpdatesSummary(operatorActions);",
    "deviceNodeUpdates,",
    'status: normalized.length <= 0 ? "missing" : validated ? "validated" : "partial"',
    'source: "operator_actions"',
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `api-backend device-node updates summary contract missing token: ${token}`);
  }
});
