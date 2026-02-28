import test from "node:test";
import assert from "node:assert/strict";
import {
  listApprovals,
  recordApprovalDecision,
  upsertPendingApproval,
} from "../../apps/api-backend/src/firestore.js";

function uniqueToken(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

test("approvals list supports tenant scoping", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const tenantA = uniqueToken("tenant-a");
  const tenantB = uniqueToken("tenant-b");
  const sessionId = uniqueToken("session");

  await upsertPendingApproval({
    approvalId: uniqueToken("approval-a"),
    tenantId: tenantA,
    sessionId,
    runId: uniqueToken("run-a"),
    actionType: "ui_task",
    actor: "unit-test",
  });
  await upsertPendingApproval({
    approvalId: uniqueToken("approval-b"),
    tenantId: tenantB,
    sessionId,
    runId: uniqueToken("run-b"),
    actionType: "ui_task",
    actor: "unit-test",
  });

  const tenantApprovals = await listApprovals({
    limit: 100,
    tenantId: tenantA,
  });
  assert.ok(tenantApprovals.length >= 1);
  assert.ok(tenantApprovals.every((item) => item.tenantId === tenantA));
});

test("approval decision persists tenant id", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const tenantId = uniqueToken("tenant");
  const approvalId = uniqueToken("approval");
  const sessionId = uniqueToken("session");
  const runId = uniqueToken("run");

  await upsertPendingApproval({
    approvalId,
    tenantId,
    sessionId,
    runId,
    actionType: "ui_task",
    actor: "unit-test",
  });

  const approved = await recordApprovalDecision({
    approvalId,
    tenantId,
    sessionId,
    runId,
    decision: "approved",
    reason: "approved for tenant validation",
    actor: "unit-operator",
  });
  assert.equal(approved.tenantId, tenantId);

  const listed = await listApprovals({
    limit: 50,
    tenantId,
    sessionId,
  });
  const persisted = listed.find((item) => item.approvalId === approvalId);
  assert.ok(persisted);
  assert.equal(persisted?.tenantId, tenantId);
  assert.equal(persisted?.status, "approved");
});
