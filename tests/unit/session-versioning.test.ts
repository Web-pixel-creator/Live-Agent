import test from "node:test";
import assert from "node:assert/strict";
import { createSession, updateSessionStatus } from "../../apps/api-backend/src/firestore.js";

test("session updates support optimistic versioning and idempotent replay", async () => {
  process.env.FIRESTORE_ENABLED = "false";

  const created = await createSession({
    userId: "unit-user",
    mode: "live",
  });

  assert.equal(created.version, 1);
  assert.equal(created.lastMutationId, null);

  const idempotencyKey = `idem-${Date.now()}`;
  const updated = await updateSessionStatus(created.sessionId, "paused", {
    expectedVersion: created.version,
    idempotencyKey,
  });

  assert.equal(updated.outcome, "updated");
  if (updated.outcome !== "updated") {
    throw new Error("expected updated outcome");
  }
  assert.equal(updated.session.version, 2);
  assert.equal(updated.session.status, "paused");
  assert.equal(updated.session.lastMutationId, idempotencyKey);

  const replay = await updateSessionStatus(created.sessionId, "paused", {
    expectedVersion: created.version,
    idempotencyKey,
  });

  assert.equal(replay.outcome, "idempotent_replay");
  if (replay.outcome !== "idempotent_replay") {
    throw new Error("expected idempotent replay outcome");
  }
  assert.equal(replay.session.version, 2);
  assert.equal(replay.session.status, "paused");
});

test("session updates return version conflict when expectedVersion is stale", async () => {
  process.env.FIRESTORE_ENABLED = "false";

  const created = await createSession({
    userId: "unit-user",
    mode: "live",
  });

  const first = await updateSessionStatus(created.sessionId, "paused", {
    expectedVersion: created.version,
    idempotencyKey: `idem-a-${Date.now()}`,
  });
  assert.equal(first.outcome, "updated");

  const conflict = await updateSessionStatus(created.sessionId, "closed", {
    expectedVersion: created.version,
    idempotencyKey: `idem-b-${Date.now()}`,
  });

  assert.equal(conflict.outcome, "version_conflict");
  if (conflict.outcome !== "version_conflict") {
    throw new Error("expected version conflict outcome");
  }
  assert.equal(conflict.expectedVersion, 1);
  assert.equal(conflict.actualVersion, 2);
});

test("session updates reject idempotency-key reuse with different target status", async () => {
  process.env.FIRESTORE_ENABLED = "false";

  const created = await createSession({
    userId: "unit-user",
    mode: "live",
  });

  const idempotencyKey = `idem-conflict-${Date.now()}`;
  const first = await updateSessionStatus(created.sessionId, "paused", {
    expectedVersion: created.version,
    idempotencyKey,
  });
  assert.equal(first.outcome, "updated");

  const conflict = await updateSessionStatus(created.sessionId, "closed", {
    idempotencyKey,
  });

  assert.equal(conflict.outcome, "idempotency_conflict");
  if (conflict.outcome !== "idempotency_conflict") {
    throw new Error("expected idempotency conflict outcome");
  }
  assert.equal(conflict.idempotencyKey, idempotencyKey);
  assert.equal(conflict.requestedStatus, "closed");
  assert.equal(conflict.session.status, "paused");
  assert.equal(conflict.session.version, 2);
});
