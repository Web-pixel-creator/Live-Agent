import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function parseRequiredNumber(source: string, pattern: RegExp, label: string): number {
  const match = source.match(pattern);
  assert.ok(match, `Could not parse ${label}`);
  return Number(match[1]);
}

test("release-readiness uses demo e2e retry defaults and retry runner", () => {
  const releasePath = resolve(process.cwd(), "scripts", "release-readiness.ps1");
  const source = readFileSync(releasePath, "utf8");

  const demoRunMaxAttempts = parseRequiredNumber(
    source,
    /\[int\]\$DemoRunMaxAttempts\s*=\s*(\d+)/,
    "DemoRunMaxAttempts default",
  );
  const demoRunRetryBackoffMs = parseRequiredNumber(
    source,
    /\[int\]\$DemoRunRetryBackoffMs\s*=\s*(\d+)/,
    "DemoRunRetryBackoffMs default",
  );

  assert.ok(demoRunMaxAttempts >= 2, "demo run max attempts should provide at least one retry");
  assert.ok(demoRunRetryBackoffMs >= 500, "demo run retry backoff should be non-trivial");
  assert.match(source, /function\s+Run-StepWithRetry\s*\(/);
  assert.match(source, /Run-StepWithRetry\s+"Run demo e2e"/);
});
