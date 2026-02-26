import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("railway deploy helper stays aligned across package, script, and docs", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const packageRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(packageRaw) as { scripts?: Record<string, string> };

  const deployAlias = pkg.scripts?.["deploy:railway"] ?? "";
  assert.match(deployAlias, /railway-deploy\.ps1/);

  const scriptPath = resolve(process.cwd(), "scripts/railway-deploy.ps1");
  const scriptRaw = readFileSync(scriptPath, "utf8");
  assert.match(scriptRaw, /\$env:RAILWAY_PROJECT_ID/);
  assert.match(scriptRaw, /\$env:RAILWAY_SERVICE_ID/);
  assert.match(scriptRaw, /SkipReleaseVerification/);
  assert.match(scriptRaw, /StrictReleaseVerification/);
  assert.match(scriptRaw, /SkipPublicBadgeCheck/);
  assert.match(scriptRaw, /PublicBadgeEndpoint/);
  assert.match(scriptRaw, /PublicBadgeDetailsEndpoint/);
  assert.match(scriptRaw, /RailwayPublicUrl/);
  assert.match(scriptRaw, /Invoke-PublicBadgeCheck/);
  assert.match(scriptRaw, /Resolve-ServiceIdFromStatus/);
  assert.match(scriptRaw, /serviceInstances/);
  assert.match(scriptRaw, /@\("link", "-p"/);
  assert.match(scriptRaw, /@\("up", "-d", "-m"/);
  assert.match(scriptRaw, /deployment", "list"/);

  const readmePath = resolve(process.cwd(), "README.md");
  const readmeRaw = readFileSync(readmePath, "utf8");
  assert.match(readmeRaw, /## Railway Deploy Automation/);
  assert.match(readmeRaw, /npm run deploy:railway/);
  assert.match(readmeRaw, /-- -SkipReleaseVerification/);
  assert.match(readmeRaw, /-- -SkipPublicBadgeCheck/);
  assert.match(readmeRaw, /-- -PublicBadgeEndpoint <url>/);
  assert.match(readmeRaw, /-- -NoWait/);

  const runbookPath = resolve(process.cwd(), "docs/challenge-demo-runbook.md");
  const runbookRaw = readFileSync(runbookPath, "utf8");
  assert.match(runbookRaw, /npm run deploy:railway/);
});
