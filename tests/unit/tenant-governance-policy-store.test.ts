import test from "node:test";
import assert from "node:assert/strict";
import {
  getTenantGovernancePolicy,
  upsertTenantGovernancePolicy,
} from "../../apps/api-backend/src/firestore.js";

function retention(days: number) {
  return {
    rawMediaDays: days,
    auditLogsDays: days + 100,
    approvalsDays: days + 100,
    eventsDays: days + 100,
    operatorActionsDays: days + 100,
    metricsRollupsDays: days + 150,
    sessionsDays: Math.max(1, Math.floor(days / 2)),
  };
}

test("tenant governance policy store supports versioning and idempotency controls", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const tenantId = `tenant-governance-${Date.now()}`;

  const created = await upsertTenantGovernancePolicy({
    tenantId,
    complianceTemplate: "strict",
    retentionPolicy: retention(10),
    updatedBy: "unit-admin",
    expectedVersion: 1,
    idempotencyKey: "gov-k1",
    metadata: {
      source: "unit-test",
    },
  });
  assert.equal(created.outcome, "created");
  if (created.outcome !== "created") {
    throw new Error("expected created outcome");
  }
  assert.equal(created.policy.version, 1);
  assert.equal(created.policy.lastMutationId, "gov-k1");
  assert.equal(created.policy.complianceTemplate, "strict");

  const replay = await upsertTenantGovernancePolicy({
    tenantId,
    complianceTemplate: "strict",
    retentionPolicy: retention(10),
    updatedBy: "unit-admin",
    expectedVersion: 1,
    idempotencyKey: "gov-k1",
    metadata: {
      source: "unit-test",
    },
  });
  assert.equal(replay.outcome, "idempotent_replay");

  const idempotencyConflict = await upsertTenantGovernancePolicy({
    tenantId,
    complianceTemplate: "regulated",
    retentionPolicy: retention(3),
    updatedBy: "unit-admin",
    expectedVersion: 1,
    idempotencyKey: "gov-k1",
  });
  assert.equal(idempotencyConflict.outcome, "idempotency_conflict");

  const updated = await upsertTenantGovernancePolicy({
    tenantId,
    complianceTemplate: "regulated",
    retentionPolicy: retention(3),
    updatedBy: "unit-admin-2",
    expectedVersion: 1,
    idempotencyKey: "gov-k2",
  });
  assert.equal(updated.outcome, "updated");
  if (updated.outcome !== "updated") {
    throw new Error("expected updated outcome");
  }
  assert.equal(updated.policy.version, 2);
  assert.equal(updated.policy.complianceTemplate, "regulated");
  assert.equal(updated.policy.updatedBy, "unit-admin-2");

  const versionConflict = await upsertTenantGovernancePolicy({
    tenantId,
    complianceTemplate: "baseline",
    retentionPolicy: retention(7),
    updatedBy: "unit-admin-3",
    expectedVersion: 1,
    idempotencyKey: "gov-k3",
  });
  assert.equal(versionConflict.outcome, "version_conflict");
  if (versionConflict.outcome !== "version_conflict") {
    throw new Error("expected version_conflict outcome");
  }
  assert.equal(versionConflict.expectedVersion, 1);
  assert.equal(versionConflict.actualVersion, 2);

  const fetched = await getTenantGovernancePolicy({ tenantId });
  assert.ok(fetched);
  assert.equal(fetched?.version, 2);
  assert.equal(fetched?.complianceTemplate, "regulated");
});
