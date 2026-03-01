import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend exposes managed skill installations lifecycle routes", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "/v1/skills/installations",
    "/v1/skills/installations/resolve",
    "/v1/skills/installations/:agentId/:skillId",
    "/v1/skills/installations/:agentId/:skillId/updates",
    "parseSkillInstallationPathSuffix",
    "listManagedSkillInstallations",
    "getManagedSkillInstallation",
    "resolveManagedSkillInstallations",
    "upsertManagedSkillInstallation",
    "skills_installation_upsert",
    "API_SKILL_INSTALLATION_VERSION_CONFLICT",
    "API_SKILL_INSTALLATION_IDEMPOTENCY_CONFLICT",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `managed skill installations API contract missing token: ${token}`);
  }
});

test("readme documents managed skill installations and resolve APIs", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /GET \/v1\/skills\/installations/);
  assert.match(readme, /GET \/v1\/skills\/installations\/resolve/);
  assert.match(readme, /GET \/v1\/skills\/installations\/\{agentId\}\/\{skillId\}/);
  assert.match(readme, /POST \/v1\/skills\/installations/);
});
