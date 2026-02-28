import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import {
  normalizeSkillPluginManifest,
  parseSkillPluginSigningKeys,
} from "../../apps/api-backend/src/skill-plugin-marketplace.js";

function canonicalPayloadHash(): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        skillId: "plugin-skill",
        name: "Plugin Skill",
        prompt: "Use plugin behavior",
        scope: ["live-agent"],
        trustLevel: "trusted",
        publisher: "acme",
        checksum: "sha256:abc",
        permissions: ["live.conversation", "ui.execute"],
      }),
      "utf8",
    )
    .digest("hex");
}

test("skill plugin signing keys parser accepts valid JSON map", () => {
  const parsed = parseSkillPluginSigningKeys(
    JSON.stringify({
      publisher_main: "secret-1",
      publisher_backup: "secret-2",
    }),
  );
  assert.equal(parsed.configError, null);
  assert.equal(parsed.keys.get("publisher_main"), "secret-1");
  assert.equal(parsed.keys.get("publisher_backup"), "secret-2");
});

test("skill plugin manifest normalizer verifies valid hmac signature", () => {
  const payloadHash = canonicalPayloadHash();
  const secret = "secret-1";
  const signature = createHmac("sha256", secret).update(payloadHash, "utf8").digest("hex");
  const result = normalizeSkillPluginManifest({
    raw: {
      permissions: ["live.conversation", "ui.execute"],
      signing: {
        algorithm: "hmac-sha256",
        keyId: "publisher_main",
        signature,
      },
    },
    requireSignature: true,
    signingKeys: new Map([["publisher_main", secret]]),
    signingKeysConfigError: null,
    nowIso: "2026-02-28T00:00:00.000Z",
    skill: {
      skillId: "plugin-skill",
      name: "Plugin Skill",
      prompt: "Use plugin behavior",
      scope: ["live-agent"],
      trustLevel: "trusted",
      publisher: "acme",
      checksum: "sha256:abc",
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error("Expected successful plugin manifest normalization");
  }
  assert.deepEqual(result.manifest?.permissions, ["live.conversation", "ui.execute"]);
  assert.equal(result.manifest?.signing.status, "verified");
  assert.equal(result.manifest?.signing.keyId, "publisher_main");
  assert.equal(result.manifest?.signing.payloadSha256, payloadHash);
});

test("skill plugin manifest normalizer rejects unsupported permissions", () => {
  const result = normalizeSkillPluginManifest({
    raw: {
      permissions: ["live.conversation", "filesystem.delete"],
    },
    requireSignature: false,
    signingKeys: new Map(),
    signingKeysConfigError: null,
    nowIso: "2026-02-28T00:00:00.000Z",
    skill: {
      skillId: "plugin-skill",
      name: "Plugin Skill",
      prompt: "Use plugin behavior",
      scope: ["live-agent"],
      trustLevel: "trusted",
      publisher: "acme",
      checksum: "sha256:abc",
    },
  });
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("Expected permission validation failure");
  }
  assert.equal(result.code, "API_SKILL_PLUGIN_PERMISSION_INVALID");
});

test("skill plugin manifest normalizer enforces signature when required", () => {
  const result = normalizeSkillPluginManifest({
    raw: {
      permissions: ["live.conversation"],
      signing: {},
    },
    requireSignature: true,
    signingKeys: new Map(),
    signingKeysConfigError: null,
    nowIso: "2026-02-28T00:00:00.000Z",
    skill: {
      skillId: "plugin-skill",
      name: "Plugin Skill",
      prompt: "Use plugin behavior",
      scope: ["live-agent"],
      trustLevel: "trusted",
      publisher: "acme",
      checksum: "sha256:abc",
    },
  });
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("Expected signature-required failure");
  }
  assert.equal(result.code, "API_SKILL_PLUGIN_SIGNATURE_REQUIRED");
});

test("skill plugin manifest normalizer rejects invalid signature", () => {
  const result = normalizeSkillPluginManifest({
    raw: {
      permissions: ["live.conversation"],
      signing: {
        algorithm: "hmac-sha256",
        keyId: "publisher_main",
        signature: "bad-signature",
      },
    },
    requireSignature: true,
    signingKeys: new Map([["publisher_main", "secret-1"]]),
    signingKeysConfigError: null,
    nowIso: "2026-02-28T00:00:00.000Z",
    skill: {
      skillId: "plugin-skill",
      name: "Plugin Skill",
      prompt: "Use plugin behavior",
      scope: ["live-agent"],
      trustLevel: "trusted",
      publisher: "acme",
      checksum: "sha256:abc",
    },
  });
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("Expected signature validation failure");
  }
  assert.equal(result.code, "API_SKILL_PLUGIN_SIGNATURE_INVALID");
});

