import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("railway dry deploy verifier stays aligned across package, script, and docs", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const packageRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(packageRaw) as { scripts?: Record<string, string> };

  const dryAlias = pkg.scripts?.["verify:deploy:railway:dry"] ?? "";
  assert.match(dryAlias, /verify-deploy-railway-dry\.ps1/);

  const scriptPath = resolve(process.cwd(), "scripts", "verify-deploy-railway-dry.ps1");
  const scriptRaw = readFileSync(scriptPath, "utf8");
  assert.match(scriptRaw, /tests\/unit\/public-badge-check-alignment\.test\.ts/);
  assert.match(scriptRaw, /tests\/unit\/railway-deploy-alignment\.test\.ts/);
  assert.match(scriptRaw, /tests\/unit\/railway-deploy-all-alignment\.test\.ts/);
  assert.match(scriptRaw, /tests\/unit\/railway-deploy-all-workflow-alignment\.test\.ts/);
  assert.match(scriptRaw, /tests\/unit\/workflow-dispatch-alignment\.test\.ts/);
  assert.match(scriptRaw, /tests\/unit\/workflow-dispatch-defaults-alignment\.test\.ts/);
  assert.match(scriptRaw, /tests\/unit\/workflow-dispatch-dry-run-smoke\.test\.ts/);
  assert.match(scriptRaw, /tests\/unit\/railway-deploy-public-badge-flow-smoke\.test\.ts/);
  assert.match(scriptRaw, /tests\/unit\/railway-runtime-start-command-alignment\.test\.ts/);
  assert.match(scriptRaw, /tests\/unit\/repo-publish-release-gate-alignment\.test\.ts/);
  assert.match(scriptRaw, /tests\/unit\/repo-publish-railway-forwarding-smoke\.test\.ts/);
  assert.match(scriptRaw, /nodeArgs = @\("--import", "tsx", "--test"\)/);

  const readmePath = resolve(process.cwd(), "README.md");
  const readmeRaw = readFileSync(readmePath, "utf8");
  assert.match(readmeRaw, /npm run verify:deploy:railway:dry/);

  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");
  const runbookRaw = readFileSync(runbookPath, "utf8");
  assert.match(runbookRaw, /npm run verify:deploy:railway:dry/);
});
