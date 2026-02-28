import test from "node:test";
import assert from "node:assert/strict";
import { createSession, listOperatorActions, listSessions, recordOperatorAction } from "../../apps/api-backend/src/firestore.js";

test("tenant-scoped operator audit returns only requested tenant actions", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const tenantA = `tenant-a-${Date.now()}`;
  const tenantB = `tenant-b-${Date.now()}`;

  await recordOperatorAction({
    tenantId: tenantA,
    actorRole: "operator",
    action: "retry_task",
    outcome: "succeeded",
    reason: "tenant A action",
    taskId: "task-a-1",
  });
  await recordOperatorAction({
    tenantId: tenantB,
    actorRole: "operator",
    action: "cancel_task",
    outcome: "succeeded",
    reason: "tenant B action",
    taskId: "task-b-1",
  });

  const scopedA = await listOperatorActions(50, { tenantId: tenantA });
  assert.ok(scopedA.length >= 1);
  assert.ok(scopedA.every((item) => item.tenantId === tenantA));
  assert.ok(scopedA.some((item) => item.taskId === "task-a-1"));
  assert.ok(!scopedA.some((item) => item.taskId === "task-b-1"));

  const scopedB = await listOperatorActions(50, { tenantId: tenantB });
  assert.ok(scopedB.length >= 1);
  assert.ok(scopedB.every((item) => item.tenantId === tenantB));
  assert.ok(scopedB.some((item) => item.taskId === "task-b-1"));
});

test("session list/create supports tenant scoping", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const tenantA = `tenant-a-${Date.now()}`;
  const tenantB = `tenant-b-${Date.now()}`;

  const sessionA = await createSession({
    userId: "user-a",
    mode: "live",
    tenantId: tenantA,
  });
  await new Promise((resolve) => setTimeout(resolve, 2));
  const sessionB = await createSession({
    userId: "user-b",
    mode: "multi",
    tenantId: tenantB,
  });

  assert.equal(sessionA.tenantId, tenantA);
  assert.equal(sessionB.tenantId, tenantB);

  const listA = await listSessions(100, { tenantId: tenantA });
  assert.ok(listA.some((item) => item.sessionId === sessionA.sessionId));
  assert.ok(!listA.some((item) => item.sessionId === sessionB.sessionId));
  assert.ok(listA.every((item) => item.tenantId === tenantA));
});
