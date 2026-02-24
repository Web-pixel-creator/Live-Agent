import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function parseRequiredNumber(source: string, pattern: RegExp, label: string): number {
  const match = source.match(pattern);
  assert.ok(match, `Could not parse ${label}`);
  return Number(match[1]);
}

test("demo-e2e defines scenario retry defaults for transient flake control", () => {
  const demoPath = resolve(process.cwd(), "scripts", "demo-e2e.ps1");
  const source = readFileSync(demoPath, "utf8");

  const retryAttempts = parseRequiredNumber(
    source,
    /\[int\]\$ScenarioRetryMaxAttempts\s*=\s*(\d+)/,
    "ScenarioRetryMaxAttempts",
  );
  const retryBackoffMs = parseRequiredNumber(
    source,
    /\[int\]\$ScenarioRetryBackoffMs\s*=\s*(\d+)/,
    "ScenarioRetryBackoffMs",
  );

  assert.ok(retryAttempts >= 2, "ScenarioRetryMaxAttempts should allow at least one retry");
  assert.ok(retryBackoffMs >= 500, "ScenarioRetryBackoffMs should use a meaningful backoff");
  assert.match(source, /function\s+Invoke-Scenario\s*\{/);
  assert.match(source, /\[int\]\$MaxAttempts\s*=\s*1/);
  assert.match(source, /\[switch\]\$RetryTransientFailures/);
});

test("demo-e2e applies transient retry to flaky operator/ui/runtime scenarios", () => {
  const demoPath = resolve(process.cwd(), "scripts", "demo-e2e.ps1");
  const source = readFileSync(demoPath, "utf8");

  assert.match(
    source,
    /Invoke-Scenario[\s\S]*-Name\s+"ui\.visual_testing"[\s\S]*-MaxAttempts\s+\$ScenarioRetryMaxAttempts[\s\S]*-RetryTransientFailures/,
  );
  assert.match(
    source,
    /Invoke-Scenario[\s\S]*-Name\s+"operator\.console\.actions"[\s\S]*-MaxAttempts\s+\$ScenarioRetryMaxAttempts[\s\S]*-RetryTransientFailures/,
  );
  assert.match(
    source,
    /Invoke-Scenario[\s\S]*-Name\s+"runtime\.lifecycle\.endpoints"[\s\S]*-MaxAttempts\s+\$ScenarioRetryMaxAttempts[\s\S]*-RetryTransientFailures/,
  );
  assert.match(
    source,
    /Invoke-Scenario[\s\S]*-Name\s+"runtime\.metrics\.endpoints"[\s\S]*-MaxAttempts\s+\$ScenarioRetryMaxAttempts[\s\S]*-RetryTransientFailures/,
  );
  assert.match(source, /scenarioRetriesUsedCount/);
  assert.match(source, /uiVisualTestingScenarioAttempts/);
  assert.match(source, /operatorConsoleActionsScenarioAttempts/);
  assert.match(source, /runtimeLifecycleScenarioAttempts/);
  assert.match(source, /runtimeMetricsScenarioAttempts/);
});
