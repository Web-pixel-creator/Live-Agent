import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("railway deploy helpers try API auth first, then legacy fallback, then project-token fallback", () => {
  const gatewayScriptPath = resolve(process.cwd(), "scripts", "railway-deploy.ps1");
  const frontendScriptPath = resolve(process.cwd(), "scripts", "railway-deploy-frontend.ps1");

  const gatewayScript = readFileSync(gatewayScriptPath, "utf8");
  const frontendScript = readFileSync(frontendScriptPath, "utf8");

  for (const source of [gatewayScript, frontendScript]) {
    assert.match(source, /function Ensure-RailwayAuthContext\(\[string\]\$LogPrefix\)/);
    assert.match(source, /\$accountToken = \$env:RAILWAY_API_TOKEN/);
    assert.match(source, /\$legacyToken = if \(-not \[string\]::IsNullOrWhiteSpace\(\$env:RAILWAY_LEGACY_TOKEN\)\) \{ \$env:RAILWAY_LEGACY_TOKEN \} else \{ \$env:RAILWAY_TOKEN \}/);
    assert.match(source, /\$projectToken = \$env:RAILWAY_PROJECT_TOKEN/);
    assert.match(source, /Ignoring RAILWAY_TOKEN because RAILWAY_API_TOKEN is already set\./);
    assert.match(source, /railway whoami failed with RAILWAY_API_TOKEN; retrying legacy RAILWAY_TOKEN fallback\./);
    assert.match(source, /\$env:RAILWAY_TOKEN = ""/);
    assert.match(source, /RAILWAY_API_TOKEN is empty or failed auth; using project-token fallback for CLI auth\./);
    assert.match(source, /function Invoke-AuthProbe/);
    assert.match(source, /\$script:authProbe = \(& railway whoami 2>&1 \| Out-String\)\.Trim\(\)/);
    assert.match(source, /\$script:authProbeExitCode = \$LASTEXITCODE/);
    assert.match(source, /railway whoami failed; continuing with project-token fallback mode\./);
    assert.match(
      source,
      /Railway authentication failed\. Set RAILWAY_API_TOKEN \(account token\), or set RAILWAY_TOKEN\/RAILWAY_LEGACY_TOKEN \(legacy account token\), or set RAILWAY_PROJECT_TOKEN, or run 'railway login'\./,
    );
  }

  assert.match(gatewayScript, /Ensure-RailwayAuthContext -LogPrefix "railway-deploy"/);
  assert.match(frontendScript, /Ensure-RailwayAuthContext -LogPrefix "railway-frontend"/);
});

test("readme documents api, legacy, and project-token deploy auth order", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /Runs auth preflight \(`railway whoami`\) before deploy/);
  assert.match(readme, /try `RAILWAY_API_TOKEN` first, then retry `RAILWAY_TOKEN`\/`RAILWAY_LEGACY_TOKEN`/i);
  assert.match(readme, /fall back to `RAILWAY_PROJECT_TOKEN`/i);
});
