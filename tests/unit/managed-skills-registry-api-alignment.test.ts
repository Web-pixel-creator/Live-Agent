import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend exposes managed-skill detail and update-history routes", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "/v1/skills/registry/:skillId",
    "/v1/skills/registry/:skillId/updates",
    "parseSkillRegistryPathSuffix",
    "getManagedSkillById",
    "API_SKILL_REGISTRY_NOT_FOUND",
    "API_SKILL_REGISTRY_INVALID_PATH",
    "skills_registry_upsert",
    "extractSkillIdFromOperatorAction",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `managed skills API contract missing token: ${token}`);
  }
});

test("readme documents managed-skill detail and update-history APIs", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /GET \/v1\/skills\/registry\/\{skillId\}/);
  assert.match(readme, /GET \/v1\/skills\/registry\/\{skillId\}\/updates/);
});

