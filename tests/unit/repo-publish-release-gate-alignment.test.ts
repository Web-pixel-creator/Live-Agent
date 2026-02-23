import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("repo publish script includes pre-publish release verification controls", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "github-repo-publish.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /\[switch\]\$SkipReleaseVerification/);
  assert.match(source, /\[switch\]\$StrictReleaseVerification/);
  assert.match(source, /npm run \$verificationScript/);
  assert.match(source, /verify:release:strict/);
  assert.match(source, /verify:release/);
});
