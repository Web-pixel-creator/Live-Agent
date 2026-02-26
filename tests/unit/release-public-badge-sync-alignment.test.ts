import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("release-readiness syncs badge artifacts to public endpoint files", () => {
  const source = readFileSync(resolve(process.cwd(), "scripts", "release-readiness.ps1"), "utf8");

  assert.match(source, /\[switch\]\$SkipPublicBadgeSync/);
  assert.match(source, /\[string\]\$BadgeDetailsPath = "artifacts\/demo-e2e\/badge-details\.json"/);
  assert.match(source, /\[string\]\$PublicBadgePath = "public\/demo-e2e\/badge\.json"/);
  assert.match(source, /\[string\]\$PublicBadgeDetailsPath = "public\/demo-e2e\/badge-details\.json"/);
  assert.match(source, /Run-Step "Generate badge artifact" "npm run demo:e2e:badge"/);
  assert.match(source, /Sync-PublicBadgeArtifacts -SourcePath \$BadgePath -TargetPath \$PublicBadgePath/);
  assert.match(source, /Sync-PublicBadgeArtifacts -SourcePath \$BadgeDetailsPath -TargetPath \$PublicBadgeDetailsPath/);
  assert.match(source, /\$requiredFiles \+= \$BadgeDetailsPath/);
  assert.match(source, /\$requiredFiles \+= \$PublicBadgePath/);
  assert.match(source, /\$requiredFiles \+= \$PublicBadgeDetailsPath/);
});
