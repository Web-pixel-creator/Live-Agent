import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend exposes skills catalog, personas, and recipes routes", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "/v1/skills/catalog",
    "/v1/skills/personas",
    "/v1/skills/recipes",
    "getSkillsRuntimeCatalogSnapshot",
    "getSkillsCatalogSnapshot",
    'source: "repo_owned_catalog"',
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `skills catalog API contract missing token: ${token}`);
  }
});

test("readme and env document skills catalog config and routes", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");

  assert.match(readme, /GET \/v1\/skills\/catalog/);
  assert.match(readme, /GET \/v1\/skills\/personas/);
  assert.match(readme, /GET \/v1\/skills\/recipes/);
  assert.match(readme, /configs\/skills\.catalog\.json/);
  assert.match(envExample, /SKILLS_CATALOG_PATH=configs\/skills\.catalog\.json/);
  assert.match(envExample, /SKILLS_CATALOG_JSON=/);
});

test("repo-owned skills catalog config exists with personas and recipes", () => {
  const configPath = resolve(process.cwd(), "configs", "skills.catalog.json");
  assert.ok(existsSync(configPath), "configs/skills.catalog.json should exist");
  const source = readFileSync(configPath, "utf8");
  assert.match(source, /"personas"/);
  assert.match(source, /"recipes"/);
  assert.match(source, /"live-negotiation-judge-demo"/);
  assert.match(source, /"calendar-managed-skill-lifecycle"/);
});
