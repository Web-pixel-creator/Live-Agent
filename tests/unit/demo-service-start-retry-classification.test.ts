import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo-e2e classifies non-retryable service startup failures before retry backoff", () => {
  const demoPath = resolve(process.cwd(), "scripts", "demo-e2e.ps1");
  const source = readFileSync(demoPath, "utf8");

  assert.match(source, /function\s+Test-IsRetryableServiceStartFailure\s*\{/);
  assert.match(source, /"cannot find module"/);
  assert.match(source, /"eaddrinuse"/);
  assert.match(source, /"syntaxerror"/);
  assert.match(source, /Test-IsRetryableServiceStartFailure\s+-ErrorMessage\s+\$attemptError\s+-StderrTail\s+\$stderrTail/);
  assert.match(source, /startup failed with non-retryable diagnostics on attempt/);
  assert.match(
    source,
    /Test-IsRetryableServiceStartFailure[\s\S]*if\s*\(\$attempt\s*-ge\s*\$maxAttempts\)[\s\S]*Start-Sleep\s+-Milliseconds\s+\$retryBackoffMs/,
  );
});
