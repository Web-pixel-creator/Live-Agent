import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

test("readme documents managed skill signing guide and helper command", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /docs\/managed-skill-signing-example\.md/);
  assert.match(readme, /npm run skills:plugin:sign -- --input skills\/workspace\/calendar-assistant\/managed-skill-signing-input\.sample\.json --secret/);
});

test("managed skill signing guide references canonical payload and API contracts", () => {
  const docPath = resolve(process.cwd(), "docs", "managed-skill-signing-example.md");
  const source = readFileSync(docPath, "utf8");

  const requiredTokens = [
    "canonical payload hash",
    "skills/workspace/calendar-assistant/managed-skill-signing-input.sample.json",
    "npm run skills:plugin:sign",
    "SKILL_PLUGIN_SIGNING_KEYS_JSON",
    "API_SKILL_PLUGIN_SIGNATURE_INVALID",
    "API_SKILL_PLUGIN_SIGNING_KEY_NOT_FOUND",
    "/v1/skills/registry",
    "/v1/skills/registry/calendar-managed-demo/updates",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `managed skill signing doc missing token: ${token}`);
  }
});

test("calendar-assistant managed skill samples exist with required fields", () => {
  const signingInputPath = resolve(
    process.cwd(),
    "skills",
    "workspace",
    "calendar-assistant",
    "managed-skill-signing-input.sample.json",
  );
  const upsertSamplePath = resolve(
    process.cwd(),
    "skills",
    "workspace",
    "calendar-assistant",
    "managed-skill-upsert.sample.json",
  );
  const skillMarkdownPath = resolve(
    process.cwd(),
    "skills",
    "workspace",
    "calendar-assistant",
    "SKILL.md",
  );

  assert.equal(existsSync(signingInputPath), true);
  assert.equal(existsSync(upsertSamplePath), true);
  assert.equal(existsSync(skillMarkdownPath), true);

  const signingInput = JSON.parse(readFileSync(signingInputPath, "utf8")) as Record<string, unknown>;
  const upsertSample = JSON.parse(readFileSync(upsertSamplePath, "utf8")) as Record<string, unknown>;

  assert.equal(signingInput.skillId, "calendar-managed-demo");
  assert.equal(signingInput.keyId, "demo-key");
  assert.deepEqual(signingInput.permissions, ["ui.execute", "operator.actions"]);

  assert.equal(upsertSample.skillId, "calendar-managed-demo");
  assert.equal(upsertSample.version, 1);
  assert.equal(typeof upsertSample.pluginManifest, "object");
});

test("package scripts expose skill plugin signing helper", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  assert.equal(pkg.scripts?.["skills:plugin:sign"], "node ./scripts/skill-plugin-sign.mjs");
});

