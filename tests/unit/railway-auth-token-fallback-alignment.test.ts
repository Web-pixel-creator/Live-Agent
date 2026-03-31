import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("railway deploy helpers prefer account tokens and only use project-token fallback when API auth is absent", () => {
  const gatewayScriptPath = resolve(process.cwd(), "scripts", "railway-deploy.ps1");
  const frontendScriptPath = resolve(process.cwd(), "scripts", "railway-deploy-frontend.ps1");

  const gatewayScript = readFileSync(gatewayScriptPath, "utf8");
  const frontendScript = readFileSync(frontendScriptPath, "utf8");

  for (const source of [gatewayScript, frontendScript]) {
    assert.match(source, /function Ensure-RailwayAuthContext\(\[string\]\$LogPrefix\)/);
    assert.match(source, /\$accountToken = \$env:RAILWAY_API_TOKEN/);
    assert.match(source, /\$legacyToken = \$env:RAILWAY_TOKEN/);
    assert.match(source, /\$projectToken = \$env:RAILWAY_PROJECT_TOKEN/);
    assert.match(source, /Ignoring RAILWAY_TOKEN because RAILWAY_API_TOKEN is already set\./);
    assert.match(
      source,
      /if \(-not \[string\]::IsNullOrWhiteSpace\(\$projectToken\)\)\s*\{[\s\S]*\$fallbackProjectToken = \$projectToken[\s\S]*elseif \(-not \[string\]::IsNullOrWhiteSpace\(\$legacyToken\)\)\s*\{[\s\S]*\$fallbackProjectToken = \$legacyToken/,
    );
    assert.match(source, /\$env:RAILWAY_TOKEN = ""/);
    assert.match(source, /RAILWAY_API_TOKEN is empty; using project-token fallback for CLI auth\./);
    assert.match(source, /try\s*\{[\s\S]*\$authProbe = \(& railway whoami 2>&1 \| Out-String\)\.Trim\(\)[\s\S]*\$authProbeExitCode = \$LASTEXITCODE[\s\S]*\}\s*catch/);
    assert.match(source, /railway whoami failed; continuing with project-token fallback mode\./);
    assert.match(
      source,
      /Railway authentication failed\. Set RAILWAY_API_TOKEN \(account token\), or set RAILWAY_PROJECT_TOKEN \(or legacy RAILWAY_TOKEN\), or run 'railway login'\./,
    );
  }

  assert.match(gatewayScript, /Ensure-RailwayAuthContext -LogPrefix "railway-deploy"/);
  assert.match(frontendScript, /Ensure-RailwayAuthContext -LogPrefix "railway-frontend"/);
});

test("readme documents account-token precedence and project-token fallback behavior", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /Runs auth preflight \(`railway whoami`\) before deploy/);
  assert.match(readme, /ignore `RAILWAY_TOKEN` so a stale legacy\/project token cannot override account-scope auth/i);
  assert.match(readme, /fall back to `RAILWAY_PROJECT_TOKEN` \(or legacy `RAILWAY_TOKEN`\)/);
});
