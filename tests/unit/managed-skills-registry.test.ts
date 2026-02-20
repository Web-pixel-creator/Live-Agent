import test from "node:test";
import assert from "node:assert/strict";
import {
  listManagedSkillIndex,
  listManagedSkills,
  upsertManagedSkill,
} from "../../apps/api-backend/src/firestore.js";

test("managed skill registry supports versioned upsert with idempotent replay", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const skillId = `managed-live-${Date.now()}`;

  const created = await upsertManagedSkill({
    skillId,
    name: "Managed Live Negotiation",
    description: "Managed catalog entry",
    prompt: "Always restate hard constraints before proposing concessions.",
    scope: ["live-agent"],
    trustLevel: "reviewed",
    updatedBy: "unit-test",
    expectedVersion: 1,
  });
  assert.equal(created.outcome, "created");
  if (created.outcome !== "created") {
    throw new Error("expected created outcome");
  }
  assert.equal(created.skill.version, 1);
  assert.equal(created.skill.trustLevel, "reviewed");

  const replay = await upsertManagedSkill({
    skillId,
    name: "Managed Live Negotiation",
    description: "Managed catalog entry",
    prompt: "Always restate hard constraints before proposing concessions.",
    scope: ["live-agent"],
    trustLevel: "reviewed",
    updatedBy: "unit-test",
    expectedVersion: 1,
  });
  assert.equal(replay.outcome, "idempotent_replay");
  if (replay.outcome !== "idempotent_replay") {
    throw new Error("expected idempotent replay outcome");
  }
  assert.equal(replay.skill.version, 1);

  const updated = await upsertManagedSkill({
    skillId,
    name: "Managed Live Negotiation",
    description: "Managed catalog entry",
    prompt: "Use strict negotiation policy and highlight fallback alternatives.",
    scope: ["live-agent"],
    trustLevel: "trusted",
    updatedBy: "unit-test",
    expectedVersion: 1,
  });
  assert.equal(updated.outcome, "updated");
  if (updated.outcome !== "updated") {
    throw new Error("expected updated outcome");
  }
  assert.equal(updated.skill.version, 2);
  assert.equal(updated.skill.trustLevel, "trusted");

  const conflict = await upsertManagedSkill({
    skillId,
    name: "Managed Live Negotiation",
    prompt: "This update should fail because version is stale.",
    scope: ["live-agent"],
    trustLevel: "trusted",
    updatedBy: "unit-test",
    expectedVersion: 1,
  });
  assert.equal(conflict.outcome, "version_conflict");
  if (conflict.outcome !== "version_conflict") {
    throw new Error("expected version conflict outcome");
  }
  assert.equal(conflict.expectedVersion, 1);
  assert.equal(conflict.actualVersion, 2);
});

test("managed skill registry list/index applies enabled and scope filtering", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  const sharedId = `managed-shared-${Date.now()}`;
  const uiDisabledId = `managed-ui-disabled-${Date.now()}`;

  await upsertManagedSkill({
    skillId: sharedId,
    name: "Shared Skill",
    prompt: "Use as a shared directive",
    scope: ["live-agent", "ui-navigator-agent"],
    trustLevel: "reviewed",
    updatedBy: "unit-test",
  });

  await upsertManagedSkill({
    skillId: uiDisabledId,
    name: "Disabled UI Skill",
    prompt: "Should be hidden from default list",
    scope: ["ui-navigator-agent"],
    enabled: false,
    trustLevel: "reviewed",
    updatedBy: "unit-test",
  });

  const liveList = await listManagedSkills({
    limit: 50,
    scope: "live-agent",
  });
  assert.ok(liveList.some((item) => item.skillId === sharedId));
  assert.ok(!liveList.some((item) => item.skillId === uiDisabledId));

  const fullIndex = await listManagedSkillIndex({
    limit: 50,
    scope: "ui-navigator-agent",
    includeDisabled: true,
  });
  assert.ok(fullIndex.some((item) => item.id === sharedId));
  assert.ok(fullIndex.some((item) => item.id === uiDisabledId));
});
