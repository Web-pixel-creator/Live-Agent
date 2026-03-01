import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("public badge check helper stays aligned across package, script, and docs", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const packageRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(packageRaw) as { scripts?: Record<string, string> };

  const publicBadgeAlias = pkg.scripts?.["badge:public:check"] ?? "";
  assert.match(publicBadgeAlias, /public-badge-check\.ps1/);

  const scriptPath = resolve(process.cwd(), "scripts", "public-badge-check.ps1");
  const scriptRaw = readFileSync(scriptPath, "utf8");
  assert.match(scriptRaw, /PUBLIC_BADGE_ENDPOINT/);
  assert.match(scriptRaw, /PUBLIC_BADGE_DETAILS_ENDPOINT/);
  assert.match(scriptRaw, /RAILWAY_PUBLIC_URL/);
  assert.match(scriptRaw, /AllowFailingEvidence/);
  assert.match(scriptRaw, /live-agent-production\.up\.railway\.app/);
  assert.match(scriptRaw, /schemaVersion/);
  assert.match(scriptRaw, /badge-details\.json/);
  assert.match(scriptRaw, /badge-details\.evidence/);
  assert.match(scriptRaw, /operatorTurnTruncation/);
  assert.match(scriptRaw, /operatorTurnDelete/);
  assert.match(scriptRaw, /damageControl/);
  assert.match(scriptRaw, /operatorDamageControl/);
  assert.match(scriptRaw, /governancePolicy/);
  assert.match(scriptRaw, /skillsRegistry/);
  assert.match(scriptRaw, /governancePolicyEvidenceRequired/);
  assert.match(scriptRaw, /skillsRegistryEvidenceRequired/);
  assert.match(scriptRaw, /must be 'pass' for deployment gate/);
  assert.match(scriptRaw, /operatorTurnTruncation must be validated and expectedEventSeen=true/);
  assert.match(scriptRaw, /governancePolicy must be validated with operatorActionSeen=true and overrideTenantSeen=true/);
  assert.match(scriptRaw, /skillsRegistry must be validated with indexHasSkill=true and registryHasSkill=true/);
  assert.match(scriptRaw, /img\.shields\.io\/endpoint/);

  const readmePath = resolve(process.cwd(), "README.md");
  const readmeRaw = readFileSync(readmePath, "utf8");
  assert.match(readmeRaw, /badge:public:check/);
  assert.match(readmeRaw, /PUBLIC_BADGE_ENDPOINT/);
});
