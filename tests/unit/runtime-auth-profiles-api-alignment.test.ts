import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("runtime auth-profile control plane exposes credential inventory and rotation metadata", () => {
  const apiSource = readFileSync(join(process.cwd(), "apps", "api-backend", "src", "index.ts"), "utf8");
  const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");

  assert.match(apiSource, /\/v1\/runtime\/auth-profiles/);
  assert.match(apiSource, /availableCredentialNames/);
  assert.match(apiSource, /availableCredentials/);
  assert.match(apiSource, /rotation:/);
  assert.match(apiSource, /repo_owned_auth_profile_control_plane/);

  assert.match(readme, /GET \/v1\/runtime\/auth-profiles/);
  assert.match(readme, /rotation metadata/);
  assert.match(readme, /available credential metadata/);
});
