import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("credential store env knobs stay aligned across docs and runtime call sites", () => {
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const envExampleSource = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
  const skillsSource = readFileSync(resolve(process.cwd(), "shared", "skills", "src", "index.ts"), "utf8");
  const uiNavigatorSource = readFileSync(resolve(process.cwd(), "agents", "ui-navigator-agent", "src", "index.ts"), "utf8");
  const pluginSource = readFileSync(resolve(process.cwd(), "apps", "api-backend", "src", "skill-plugin-marketplace.ts"), "utf8");

  const requiredTokens = [
    "CREDENTIAL_STORE_FILE",
    "CREDENTIAL_STORE_MASTER_KEY",
    "AUTH_PROFILE_STORE_FILE",
    "SKILLS_MANAGED_INDEX_AUTH_CREDENTIAL",
    "SKILLS_MANAGED_INDEX_AUTH_PROFILE",
    "UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_CREDENTIAL",
    "UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_PROFILE",
    "SKILL_PLUGIN_SIGNING_KEYS_CREDENTIAL",
  ];

  for (const token of requiredTokens) {
    assert.ok(readmeSource.includes(token), `README missing token: ${token}`);
    assert.ok(envExampleSource.includes(token), `.env.example missing token: ${token}`);
  }

  assert.ok(skillsSource.includes("skills.managed_index.auth_token"));
  assert.ok(uiNavigatorSource.includes("ui_navigator.device_node_index.auth_token"));
  assert.ok(pluginSource.includes("api.skill_plugin.signing_keys"));
});
