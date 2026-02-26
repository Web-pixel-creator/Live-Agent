import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("repo publish forwards railway deploy arguments with stable contract", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "github-repo-publish.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /if \(\$DeployRailway\)/);
  assert.match(source, /\$railwayArgs = @\(/);
  assert.match(source, /"-File", "\$PSScriptRoot\/railway-deploy\.ps1"/);
  assert.match(source, /"-SkipReleaseVerification"/);

  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayProjectId\)\)\s*\{\s*\$railwayArgs \+= @\("-ProjectId", \$RailwayProjectId\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayServiceId\)\)\s*\{\s*\$railwayArgs \+= @\("-ServiceId", \$RailwayServiceId\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayEnvironment\)\)\s*\{\s*\$railwayArgs \+= @\("-Environment", \$RailwayEnvironment\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayWorkspace\)\)\s*\{\s*\$railwayArgs \+= @\("-Workspace", \$RailwayWorkspace\)/,
  );

  assert.match(source, /if \(\$RailwaySkipLink\)\s*\{\s*\$railwayArgs \+= "-SkipLink"/);
  assert.match(source, /if \(\$RailwaySkipPublicBadgeCheck\)\s*\{\s*\$railwayArgs \+= "-SkipPublicBadgeCheck"/);
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayPublicBadgeEndpoint\)\)\s*\{\s*\$railwayArgs \+= @\("-PublicBadgeEndpoint", \$RailwayPublicBadgeEndpoint\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayPublicBadgeDetailsEndpoint\)\)\s*\{\s*\$railwayArgs \+= @\("-PublicBadgeDetailsEndpoint", \$RailwayPublicBadgeDetailsEndpoint\)/,
  );
  assert.match(
    source,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$RailwayPublicUrl\)\)\s*\{\s*\$railwayArgs \+= @\("-RailwayPublicUrl", \$RailwayPublicUrl\)/,
  );
  assert.match(
    source,
    /if \(\$RailwayPublicBadgeCheckTimeoutSec -gt 0\)\s*\{\s*\$railwayArgs \+= @\("-PublicBadgeCheckTimeoutSec", \[string\]\$RailwayPublicBadgeCheckTimeoutSec\)/,
  );
  assert.match(source, /if \(\$RailwayNoWait\)\s*\{\s*\$railwayArgs \+= "-NoWait"/);
});

test("repo publish docs include railway badge check override example", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /npm run repo:publish -- -DeployRailway -SkipPages -SkipBadgeCheck/);
  assert.match(readme, /-RailwayPublicUrl https:\/\/live-agent-production\.up\.railway\.app/);
  assert.match(readme, /-RailwayPublicBadgeCheckTimeoutSec 30/);
});
