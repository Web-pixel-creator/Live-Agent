import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function parseRequiredNumber(source: string, pattern: RegExp, label: string): number {
  const match = source.match(pattern);
  assert.ok(match, `Could not parse ${label}`);
  return Number(match[1]);
}

test("release-readiness uses demo and scenario retry defaults and retry runner", () => {
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
  const demoScenarioRetryMaxAttempts = parseRequiredNumber(
    source,
    /\[int\]\$DemoScenarioRetryMaxAttempts\s*=\s*(\d+)/,
    "DemoScenarioRetryMaxAttempts default",
  );
  const demoScenarioRetryBackoffMs = parseRequiredNumber(
    source,
    /\[int\]\$DemoScenarioRetryBackoffMs\s*=\s*(\d+)/,
    "DemoScenarioRetryBackoffMs default",
  );
  const maxScenarioRetriesUsedCount = parseRequiredNumber(
    source,
    /MaxScenarioRetriesUsedCount\s*=\s*(\d+)/,
    "MaxScenarioRetriesUsedCount",
  );

  assert.ok(demoRunMaxAttempts >= 2, "demo run max attempts should provide at least one retry");
  assert.ok(demoRunRetryBackoffMs >= 500, "demo run retry backoff should be non-trivial");
  assert.ok(demoScenarioRetryMaxAttempts >= 2, "demo scenario retry max attempts should provide at least one retry");
  assert.ok(demoScenarioRetryBackoffMs >= 500, "demo scenario retry backoff should be non-trivial");
  assert.ok(maxScenarioRetriesUsedCount >= 2, "max scenario retries used guard should allow bounded retry tolerance");

  assert.match(source, /function\s+Run-StepWithRetry\s*\(/);
  assert.match(source, /Run-StepWithRetry\s+"Run demo e2e"/);
  assert.match(source, /\[switch\]\$StrictFinalRun/);
  assert.match(source, /\$MaxAllowedScenarioRetriesUsedCount\s*=\s*if\s*\(\$StrictFinalRun\)\s*\{\s*0\s*\}/);
  assert.match(source, /demo:e2e:policy -- --maxScenarioRetriesUsedCount \$MaxAllowedScenarioRetriesUsedCount/);
  assert.match(source, /-ScenarioRetryMaxAttempts\s+\$DemoScenarioRetryMaxAttempts/);
  assert.match(source, /-ScenarioRetryBackoffMs\s+\$DemoScenarioRetryBackoffMs/);
});
