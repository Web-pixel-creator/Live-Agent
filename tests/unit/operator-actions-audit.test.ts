import test from "node:test";
import assert from "node:assert/strict";
import {
  listOperatorActions,
  recordOperatorAction,
} from "../../apps/api-backend/src/firestore.js";

test("operator action audit stores and returns latest entries in local fallback mode", async () => {
  process.env.FIRESTORE_ENABLED = "false";

  const before = await listOperatorActions(200);
  const beforeCount = before.length;

  const action = await recordOperatorAction({
    actorRole: "operator",
    action: "retry_task",
    outcome: "succeeded",
    reason: "unit test retry action",
    taskId: "task-unit-1",
    details: {
      source: "unit-test",
    },
  });

  assert.equal(action.actorRole, "operator");
  assert.equal(action.action, "retry_task");
  assert.equal(action.outcome, "succeeded");
  assert.equal(action.taskId, "task-unit-1");

  const after = await listOperatorActions(200);
  assert.ok(after.length >= beforeCount);
  assert.equal(after[0]?.action, "retry_task");
  assert.equal(after[0]?.outcome, "succeeded");
});

