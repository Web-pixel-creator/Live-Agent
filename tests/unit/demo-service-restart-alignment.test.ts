import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo-e2e can replace healthy services for deterministic release verification", () => {
  const demoPath = resolve(process.cwd(), "scripts", "demo-e2e.ps1");
  const source = readFileSync(demoPath, "utf8");

  assert.match(source, /\[switch\]\$RestartHealthyServices/);
  assert.match(source, /function\s+Stop-HealthyManagedServiceForRestart\s*\{/);
  assert.match(source, /RestartHealthyServices enabled; replacing healthy/);
  assert.match(source, /Get-Process -Id \$owningProcessId -ErrorAction SilentlyContinue/);
  assert.match(source, /Healthy \{0\} instance on :\{1\} exited before forced restart completed; continuing\./);
  assert.match(source, /Start-ManagedService[\s\S]*-RestartHealthyServices:\$RestartHealthyServices/);
});

test("demo-e2e preflight tolerates expected managed service commands on occupied ports", () => {
  const demoPath = resolve(process.cwd(), "scripts", "demo-e2e.ps1");
  const source = readFileSync(demoPath, "utf8");

  assert.match(source, /\$expectedCommandFragment = \[string\]\(Get-FieldValue -Object \$service -Path @\("expectedCommandFragment"\)\)/);
  assert.match(source, /\$processCommandLine\.IndexOf\(\$expectedCommandFragment, \[System\.StringComparison\]::OrdinalIgnoreCase\) -ge 0/);
  assert.match(source, /Port preflight for \{0\} detected expected managed command on :\{1\}; deferring to startup retry\/health reuse\./);
  assert.match(source, /expectedCommandFragment = "apps\/realtime-gateway\/src\/index\.ts"/);
  assert.match(source, /expectedCommandFragment = "apps\/demo-frontend\/src\/server\.ts"/);
});
