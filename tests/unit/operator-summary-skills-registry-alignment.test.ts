import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api operator summary includes skills registry lifecycle contract", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "buildSkillsRegistryLifecycleSummary",
    'item.action === "skills_registry_upsert"',
    '"API_SKILL_REGISTRY_VERSION_CONFLICT"',
    '"API_SKILL_PLUGIN_PERMISSION_INVALID"',
    "const skillsRegistryLifecycle = buildSkillsRegistryLifecycleSummary(operatorActions);",
    "skillsRegistryLifecycle,",
    "lifecycleValidated",
    '"partial"',
    '"observed"',
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `api-backend skills registry summary contract missing token: ${token}`);
  }
});
