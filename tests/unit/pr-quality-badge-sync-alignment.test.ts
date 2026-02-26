import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("pr-quality uses release-readiness with public badge sync disabled", () => {
  const source = readFileSync(resolve(process.cwd(), "scripts", "pr-quality.ps1"), "utf8");

  assert.match(source, /SkipPerfLoad\s*=\s*\$true/);
  assert.match(source, /UseFastDemoE2E\s*=\s*\$true/);
  assert.match(source, /SkipPublicBadgeSync\s*=\s*\$true/);
});
