import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator device-node updates evidence widget is wired in frontend HTML and runtime", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  const requiredHtmlIds = [
    'id="operatorDeviceNodeUpdatesStatus"',
    'id="operatorDeviceNodeUpdatesTotal"',
    'id="operatorDeviceNodeUpdatesUpsert"',
    'id="operatorDeviceNodeUpdatesHeartbeat"',
    'id="operatorDeviceNodeUpdatesUniqueNodes"',
    'id="operatorDeviceNodeUpdatesLatest"',
    'id="operatorDeviceNodeUpdatesSeenAt"',
    'id="operatorDeviceNodeUpdatesHint"',
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator device-node updates widget token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "setOperatorDeviceNodeUpdatesHint",
    "resetOperatorDeviceNodeUpdatesWidget",
    "renderOperatorDeviceNodeUpdatesWidget",
    "const deviceNodeUpdates = summary.deviceNodeUpdates",
    "device_nodes_updates",
    "device_nodes_updates.latest",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator device-node updates token: ${token}`);
  }
});
