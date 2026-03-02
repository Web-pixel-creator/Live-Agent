import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api operator summary includes plugin marketplace lifecycle contract", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "buildPluginMarketplaceLifecycleSummary",
    'item.action === "skills_registry_upsert"',
    "signingStatusCounts",
    "permissionTotals",
    '"API_SKILL_REGISTRY_VERSION_CONFLICT"',
    '"API_SKILL_PLUGIN_PERMISSION_INVALID"',
    "const pluginMarketplaceLifecycle = buildPluginMarketplaceLifecycleSummary(operatorActions);",
    "pluginMarketplaceLifecycle,",
    "lifecycleValidated",
    '"partial"',
    '"observed"',
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `api-backend plugin marketplace summary contract missing token: ${token}`);
  }
});
