import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("artifact-only smoke workflow keeps manual strict toggle and script wiring", () => {
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "release-artifact-only-smoke.yml");
  const source = readFileSync(workflowPath, "utf8");

  assert.match(source, /name:\s*Release Artifact-Only Smoke/);
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /strict_final_run:/);
  assert.match(source, /type:\s*boolean/);
  assert.match(source, /default:\s*false/);
  assert.match(source, /release-artifact-only-smoke-\$\{\{ github\.ref \}\}/);

  assert.match(source, /Run Artifact-Only Smoke/);
  assert.match(source, /\$strictFinalRun\s*=\s*"\$\{\{\s*github\.event\.inputs\.strict_final_run\s*\}\}"\s*-eq\s*"true"/);
  assert.match(source, /release-artifact-only-smoke\.ps1/);
  assert.match(source, /-StrictFinalRun/);
  assert.match(source, /Tee-Object -FilePath/);
  assert.match(source, /artifacts\/release-artifact-only-smoke\/smoke\.log/);
  assert.match(source, /artifacts\/release-artifact-only-smoke\/summary\.json/);
  assert.match(source, /exitCode/);
  assert.match(source, /passed/);

  assert.match(source, /Publish Smoke Summary/);
  assert.match(source, /Strict final run input:/);
  assert.match(source, /script\s*=\s*"scripts\/release-artifact-only-smoke\.ps1"/);
  assert.match(source, /Smoke script:/);
  assert.match(source, /Smoke log tail \(last 80 lines\)/);

  assert.match(source, /Upload Smoke Artifacts/);
  assert.match(source, /name:\s*release-artifact-only-smoke-artifacts/);
  assert.match(source, /artifacts\/release-artifact-only-smoke\/summary\.json/);
  assert.match(source, /artifacts\/release-artifact-only-smoke\/smoke\.log/);
});
