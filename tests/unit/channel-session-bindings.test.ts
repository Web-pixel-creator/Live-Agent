import test from "node:test";
import assert from "node:assert/strict";
import {
  getChannelSessionBinding,
  listChannelSessionBindingIndex,
  listChannelSessionBindings,
  upsertChannelSessionBinding,
} from "../../apps/api-backend/src/firestore.js";

test("channel session bindings support versioning and idempotency controls", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const adapterId = "webchat";
  const externalSessionId = `chat-${Date.now()}`;

  const created = await upsertChannelSessionBinding({
    adapterId,
    externalSessionId,
    externalUserId: "web-user-1",
    sessionId: "internal-session-1",
    userId: "internal-user-1",
    metadata: { source: "unit-test" },
    expectedVersion: 1,
    idempotencyKey: "bind-k1",
  });
  assert.equal(created.outcome, "created");
  if (created.outcome !== "created") {
    throw new Error("expected created outcome");
  }
  assert.equal(created.binding.version, 1);
  assert.equal(created.binding.lastMutationId, "bind-k1");

  const replay = await upsertChannelSessionBinding({
    adapterId,
    externalSessionId,
    externalUserId: "web-user-1",
    sessionId: "internal-session-1",
    userId: "internal-user-1",
    metadata: { source: "unit-test" },
    expectedVersion: 1,
    idempotencyKey: "bind-k1",
  });
  assert.equal(replay.outcome, "idempotent_replay");
  if (replay.outcome !== "idempotent_replay") {
    throw new Error("expected idempotent_replay outcome");
  }
  assert.equal(replay.binding.version, 1);

  const idempotencyConflict = await upsertChannelSessionBinding({
    adapterId,
    externalSessionId,
    externalUserId: "web-user-1",
    sessionId: "internal-session-2",
    userId: "internal-user-2",
    metadata: { source: "unit-test-conflict" },
    expectedVersion: 1,
    idempotencyKey: "bind-k1",
  });
  assert.equal(idempotencyConflict.outcome, "idempotency_conflict");

  const updated = await upsertChannelSessionBinding({
    adapterId,
    externalSessionId,
    externalUserId: "web-user-1",
    sessionId: "internal-session-2",
    userId: "internal-user-2",
    metadata: { source: "unit-test-updated" },
    expectedVersion: 1,
    idempotencyKey: "bind-k2",
  });
  assert.equal(updated.outcome, "updated");
  if (updated.outcome !== "updated") {
    throw new Error("expected updated outcome");
  }
  assert.equal(updated.binding.version, 2);
  assert.equal(updated.binding.sessionId, "internal-session-2");

  const versionConflict = await upsertChannelSessionBinding({
    adapterId,
    externalSessionId,
    externalUserId: "web-user-1",
    sessionId: "internal-session-3",
    userId: "internal-user-3",
    expectedVersion: 1,
    idempotencyKey: "bind-k3",
  });
  assert.equal(versionConflict.outcome, "version_conflict");
  if (versionConflict.outcome !== "version_conflict") {
    throw new Error("expected version_conflict outcome");
  }
  assert.equal(versionConflict.expectedVersion, 1);
  assert.equal(versionConflict.actualVersion, 2);
});

test("channel session bindings are resolvable and list/index filters apply", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const now = Date.now();
  const sharedSessionId = `session-${now}`;

  await upsertChannelSessionBinding({
    adapterId: "telegram",
    externalSessionId: `tg-${now}`,
    externalUserId: "tg-user",
    sessionId: sharedSessionId,
    userId: "user-telegram",
    metadata: { lane: "telegram" },
  });
  await upsertChannelSessionBinding({
    adapterId: "slack",
    externalSessionId: `sl-${now}`,
    externalUserId: "sl-user",
    sessionId: sharedSessionId,
    userId: "user-slack",
    metadata: { lane: "slack" },
  });

  const resolved = await getChannelSessionBinding({
    adapterId: "telegram",
    externalSessionId: `tg-${now}`,
  });
  assert.ok(resolved);
  assert.equal(resolved?.sessionId, sharedSessionId);

  const telegramList = await listChannelSessionBindings({
    limit: 100,
    adapterId: "telegram",
  });
  assert.ok(telegramList.some((item) => item.externalSessionId === `tg-${now}`));
  assert.ok(!telegramList.some((item) => item.externalSessionId === `sl-${now}`));

  const index = await listChannelSessionBindingIndex({
    limit: 100,
    sessionId: sharedSessionId,
  });
  assert.ok(index.some((item) => item.externalSessionId === `tg-${now}`));
  assert.ok(index.some((item) => item.externalSessionId === `sl-${now}`));
});
