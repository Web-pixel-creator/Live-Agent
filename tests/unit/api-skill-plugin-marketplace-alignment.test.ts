import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("api backend skill registry route wires plugin manifest validation and error contracts", () => {
  const apiSource = readFileSync(
    join(process.cwd(), "apps", "api-backend", "src", "index.ts"),
    "utf8",
  );
  const marketplaceSource = readFileSync(
    join(process.cwd(), "apps", "api-backend", "src", "skill-plugin-marketplace.ts"),
    "utf8",
  );
  assert.match(apiSource, /normalizeSkillPluginManifest\(/);
  assert.match(apiSource, /SKILL_PLUGIN_REQUIRE_SIGNATURE/);
  assert.match(apiSource, /SKILL_PLUGIN_SIGNING_KEYS_JSON/);
  assert.match(apiSource, /pluginManifest:\s*pluginManifestResult\.manifest/);
  assert.match(apiSource, /\/v1\/skills\/plugins/);
  assert.match(apiSource, /\/v1\/skills\/plugins\/:pluginId/);
  assert.match(apiSource, /\/v1\/skills\/plugins\/:pluginId\/updates/);
  assert.match(apiSource, /parseSkillPluginPathSuffix/);
  assert.match(apiSource, /toSkillPluginMarketplaceItem/);
  assert.match(apiSource, /API_SKILL_PLUGIN_INVALID_PATH/);
  assert.match(apiSource, /API_SKILL_PLUGIN_NOT_FOUND/);
  assert.match(apiSource, /API_SKILL_PLUGIN_INVALID_FILTER/);
  assert.match(apiSource, /source:\s*"plugin_marketplace"/);
  assert.match(marketplaceSource, /API_SKILL_PLUGIN_PERMISSION_INVALID/);
  assert.match(marketplaceSource, /API_SKILL_PLUGIN_SIGNATURE_REQUIRED/);
  assert.match(marketplaceSource, /API_SKILL_PLUGIN_SIGNATURE_INVALID/);
  assert.match(marketplaceSource, /API_SKILL_PLUGIN_SIGNING_KEY_NOT_FOUND/);
});

test("readme documents plugin marketplace routes", () => {
  const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
  assert.match(readme, /GET \/v1\/skills\/plugins/);
  assert.match(readme, /GET \/v1\/skills\/plugins\/\{pluginId\}/);
  assert.match(readme, /GET \/v1\/skills\/plugins\/\{pluginId\}\/updates/);
});
