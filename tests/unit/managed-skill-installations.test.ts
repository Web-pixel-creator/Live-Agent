import test from "node:test";
import assert from "node:assert/strict";
import {
  getManagedSkillInstallation,
  resolveManagedSkillInstallations,
  upsertManagedSkill,
  upsertManagedSkillInstallation,
} from "../../apps/api-backend/src/firestore.js";

test("managed skill installations support versioned upsert with idempotency controls", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const tenantId = `tenant-${Date.now()}`;
  const skillId = `managed-install-live-${Date.now()}`;

  await upsertManagedSkill({
    skillId,
    name: "Managed Installable Skill",
    prompt: "Managed installable prompt",
    scope: ["live-agent"],
    trustLevel: "reviewed",
    updatedBy: "unit-test",
  });

  const created = await upsertManagedSkillInstallation({
    tenantId,
    agentId: "live-agent",
    skillId,
    installPolicy: "track_latest",
    minTrustLevel: "reviewed",
    expectedVersion: 1,
    idempotencyKey: "install-create",
    updatedBy: "unit-test",
  });
  assert.equal(created.outcome, "created");
  if (created.outcome !== "created") {
    throw new Error("expected created installation");
  }
  assert.equal(created.installation.version, 1);
  assert.equal(created.installation.installPolicy, "track_latest");
  assert.equal(created.installation.status, "installed");

  const replay = await upsertManagedSkillInstallation({
    tenantId,
    agentId: "live-agent",
    skillId,
    installPolicy: "track_latest",
    minTrustLevel: "reviewed",
    expectedVersion: 1,
    idempotencyKey: "install-create",
    updatedBy: "unit-test",
  });
  assert.equal(replay.outcome, "idempotent_replay");

  const updated = await upsertManagedSkillInstallation({
    tenantId,
    agentId: "live-agent",
    skillId,
    installPolicy: "pinned",
    pinnedVersion: 1,
    minTrustLevel: "reviewed",
    expectedVersion: 1,
    idempotencyKey: "install-update",
    updatedBy: "unit-test",
  });
  assert.equal(updated.outcome, "updated");
  if (updated.outcome !== "updated") {
    throw new Error("expected updated installation");
  }
  assert.equal(updated.installation.version, 2);
  assert.equal(updated.installation.installPolicy, "pinned");
  assert.equal(updated.installation.pinnedVersion, 1);

  const versionConflict = await upsertManagedSkillInstallation({
    tenantId,
    agentId: "live-agent",
    skillId,
    installPolicy: "pinned",
    pinnedVersion: 1,
    expectedVersion: 1,
    idempotencyKey: "install-stale",
    updatedBy: "unit-test",
  });
  assert.equal(versionConflict.outcome, "version_conflict");
  if (versionConflict.outcome !== "version_conflict") {
    throw new Error("expected version_conflict installation");
  }
  assert.equal(versionConflict.expectedVersion, 1);
  assert.equal(versionConflict.actualVersion, 2);

  const idempotencyConflict = await upsertManagedSkillInstallation({
    tenantId,
    agentId: "live-agent",
    skillId,
    installPolicy: "pinned",
    pinnedVersion: 2,
    expectedVersion: 2,
    idempotencyKey: "install-update",
    updatedBy: "unit-test",
  });
  assert.equal(idempotencyConflict.outcome, "idempotency_conflict");

  const stored = await getManagedSkillInstallation({
    tenantId,
    agentId: "live-agent",
    skillId,
  });
  assert.ok(stored);
  assert.equal(stored?.version, 2);
});

test("managed skill installations resolve lane reports readiness and updateability", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const tenantId = `tenant-resolve-${Date.now()}`;
  const liveReadySkillId = `skill-ready-${Date.now()}`;
  const trustBlockedSkillId = `skill-untrusted-${Date.now()}`;
  const disabledSkillId = `skill-disabled-${Date.now()}`;
  const pinnedSkillId = `skill-pinned-${Date.now()}`;

  await upsertManagedSkill({
    skillId: liveReadySkillId,
    name: "Ready Skill",
    prompt: "Ready prompt",
    scope: ["live-agent"],
    trustLevel: "trusted",
    updatedBy: "unit-test",
  });
  await upsertManagedSkill({
    skillId: trustBlockedSkillId,
    name: "Untrusted Skill",
    prompt: "Untrusted prompt",
    scope: ["live-agent"],
    trustLevel: "untrusted",
    updatedBy: "unit-test",
  });
  await upsertManagedSkill({
    skillId: disabledSkillId,
    name: "Disabled Skill",
    prompt: "Disabled prompt",
    scope: ["live-agent"],
    enabled: false,
    trustLevel: "trusted",
    updatedBy: "unit-test",
  });
  const pinnedSkill = await upsertManagedSkill({
    skillId: pinnedSkillId,
    name: "Pinned Skill",
    prompt: "Pinned prompt",
    scope: ["live-agent"],
    trustLevel: "trusted",
    updatedBy: "unit-test",
  });
  assert.equal(pinnedSkill.outcome, "created");

  await upsertManagedSkillInstallation({
    tenantId,
    agentId: "live-agent",
    skillId: liveReadySkillId,
    minTrustLevel: "reviewed",
    updatedBy: "unit-test",
  });
  await upsertManagedSkillInstallation({
    tenantId,
    agentId: "live-agent",
    skillId: trustBlockedSkillId,
    minTrustLevel: "trusted",
    updatedBy: "unit-test",
  });
  await upsertManagedSkillInstallation({
    tenantId,
    agentId: "live-agent",
    skillId: disabledSkillId,
    minTrustLevel: "reviewed",
    updatedBy: "unit-test",
  });
  await upsertManagedSkillInstallation({
    tenantId,
    agentId: "live-agent",
    skillId: `missing-${Date.now()}`,
    minTrustLevel: "reviewed",
    updatedBy: "unit-test",
  });
  await upsertManagedSkillInstallation({
    tenantId,
    agentId: "live-agent",
    skillId: pinnedSkillId,
    installPolicy: "pinned",
    pinnedVersion: 1,
    minTrustLevel: "reviewed",
    updatedBy: "unit-test",
  });

  const resolved = await resolveManagedSkillInstallations({
    tenantId,
    agentId: "live-agent",
    includeDisabled: true,
    limit: 50,
  });
  const bySkillId = new Map(resolved.map((item) => [item.skillId, item]));
  assert.equal(bySkillId.get(liveReadySkillId)?.resolveStatus, "ready");
  assert.equal(bySkillId.get(liveReadySkillId)?.effectiveVersion, 1);
  assert.equal(bySkillId.get(trustBlockedSkillId)?.resolveStatus, "trust_blocked");
  assert.equal(bySkillId.get(disabledSkillId)?.resolveStatus, "skill_disabled");
  assert.equal(
    bySkillId.get(pinnedSkillId)?.resolveStatus,
    "ready",
    "pinned version should resolve when available",
  );
  assert.equal(bySkillId.get(pinnedSkillId)?.updateAvailable, false);

  const pinnedMissingVersionSkillId = `skill-pinned-unavailable-${Date.now()}`;
  await upsertManagedSkill({
    skillId: pinnedMissingVersionSkillId,
    name: "Pinned Missing Version Skill",
    prompt: "Pinned missing version prompt",
    scope: ["live-agent"],
    trustLevel: "trusted",
    updatedBy: "unit-test",
  });
  await upsertManagedSkillInstallation({
    tenantId,
    agentId: "live-agent",
    skillId: pinnedMissingVersionSkillId,
    installPolicy: "pinned",
    pinnedVersion: 9,
    minTrustLevel: "reviewed",
    updatedBy: "unit-test",
  });

  const resolvedAfterPinnedMiss = await resolveManagedSkillInstallations({
    tenantId,
    agentId: "live-agent",
    includeDisabled: true,
    limit: 100,
  });
  const pinnedMiss = resolvedAfterPinnedMiss.find((item) => item.skillId === pinnedMissingVersionSkillId);
  assert.equal(pinnedMiss?.resolveStatus, "pinned_version_unavailable");
});
