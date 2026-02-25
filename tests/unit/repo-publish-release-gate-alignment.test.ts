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
  assert.match(source, /\[switch\]\$DeployRailway/);
  assert.match(source, /\[string\]\$RailwayProjectId = \$env:RAILWAY_PROJECT_ID/);
  assert.match(source, /\[string\]\$RailwayServiceId = \$env:RAILWAY_SERVICE_ID/);
  assert.match(source, /function Run-Git\(\[string\[\]\]\$CliArgs\)/);
  assert.doesNotMatch(source, /function Run-Git\(\[string\[\]\]\$Args\)/);
  assert.match(source, /railway-deploy\.ps1/);
  assert.match(source, /\-SkipReleaseVerification/);
});
