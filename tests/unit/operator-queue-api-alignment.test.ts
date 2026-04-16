import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator queue route, builder, inventory, and docs stay aligned", () => {
  const indexSource = readFileSync(resolve(process.cwd(), "apps", "api-backend", "src", "index.ts"), "utf8");
  const builderSource = readFileSync(
    resolve(process.cwd(), "apps", "api-backend", "src", "runtime-operator-queue.ts"),
    "utf8",
  );
  const inventorySource = readFileSync(
    resolve(process.cwd(), "apps", "api-backend", "src", "runtime-surface-inventory.ts"),
    "utf8",
  );
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuide = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");
  const architecture = readFileSync(resolve(process.cwd(), "docs", "architecture.md"), "utf8");

  for (const token of [
    "/v1/operator/queue",
    "buildRuntimeOperatorQueueForTenant",
    "buildRuntimeOperatorQueueSnapshot",
    "loadRuntimeCaseWikiCollections",
    "buildRuntimeCaseWikiFromCollections",
    'source: "repo_owned_operator_queue"',
    "API_OPERATOR_QUEUE_SESSION_NOT_FOUND",
    "operatorQueue: operatorQueue.operatorQueue",
  ]) {
    assert.ok(indexSource.includes(token), `operator queue route missing token: ${token}`);
  }

  for (const token of [
    "buildRuntimeOperatorQueueItem",
    "buildRuntimeOperatorQueueSnapshot",
    "resolveSavedViewAction",
    'actionId: "saved_view_approvals"',
    'actionId: "saved_view_runtime"',
    'actionId: "saved_view_incidents"',
    'actionId: "open_case_wiki_remediation"',
    'actionId: "copy_case_wiki_remediation_draft"',
    'source: "case_wiki"',
  ]) {
    assert.ok(builderSource.includes(token), `operator queue builder missing token: ${token}`);
  }

  for (const token of ['path: "/v1/operator/queue"', 'label: "Operator queue"']) {
    assert.ok(inventorySource.includes(token), `runtime surface inventory missing token: ${token}`);
  }

  assert.match(readme, /GET \/v1\/operator\/queue/);
  assert.match(readme, /GET \/v1\/operator\/summary/);
  assert.match(readme, /repo-owned operator queue/i);
  assert.match(readme, /data\.operatorQueue/);
  assert.match(readme, /Active Queue/i);
  assert.match(readme, /Case Wiki/i);
  assert.match(operatorGuide, /GET \/v1\/operator\/queue/);
  assert.match(operatorGuide, /GET \/v1\/operator\/summary/);
  assert.match(operatorGuide, /repo-owned operator queue/i);
  assert.match(operatorGuide, /data\.operatorQueue/);
  assert.match(operatorGuide, /compiled Case Wiki/i);
  assert.match(operatorGuide, /Active Queue/i);
  assert.match(architecture, /\/v1\/operator\/queue/);
  assert.match(architecture, /repo-owned operator queue/i);
  assert.match(architecture, /Case Wiki/i);
});
