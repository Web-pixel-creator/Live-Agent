import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("railway deploy helpers normalize auth env and support project-token fallback when whoami fails", () => {
  const gatewayScriptPath = resolve(process.cwd(), "scripts", "railway-deploy.ps1");
  const frontendScriptPath = resolve(process.cwd(), "scripts", "railway-deploy-frontend.ps1");

  const gatewayScript = readFileSync(gatewayScriptPath, "utf8");
  const frontendScript = readFileSync(frontendScriptPath, "utf8");

  for (const source of [gatewayScript, frontendScript]) {
    assert.match(source, /function Ensure-RailwayAuthContext\(\[string\]\$LogPrefix\)/);
    assert.match(
      source,
      /if \(\[string\]::IsNullOrWhiteSpace\(\$env:RAILWAY_API_TOKEN\) -and \$hasProjectToken\)\s*\{[\s\S]*\$env:RAILWAY_API_TOKEN = \$env:RAILWAY_TOKEN/,
    );
    assert.match(source, /try\s*\{[\s\S]*\$authProbe = \(& railway whoami 2>&1 \| Out-String\)\.Trim\(\)[\s\S]*\$authProbeExitCode = \$LASTEXITCODE[\s\S]*\}\s*catch/);
    assert.match(source, /railway whoami failed; forcing RAILWAY_TOKEN project-token mode \(RAILWAY_TOKEN -> RAILWAY_API_TOKEN\)\./);
    assert.match(source, /railway whoami failed; continuing with RAILWAY_TOKEN project-token mode\./);
    assert.match(
      source,
      /Railway authentication failed\. Set RAILWAY_API_TOKEN \(account token\), or set RAILWAY_TOKEN \(project token\), or run 'railway login'\./,
    );
  }

  assert.match(gatewayScript, /Ensure-RailwayAuthContext -LogPrefix "railway-deploy"/);
  assert.match(frontendScript, /Ensure-RailwayAuthContext -LogPrefix "railway-frontend"/);
});

test("readme documents local token fallback and project-token auth behavior", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /Runs auth preflight \(`railway whoami`\) before deploy/);
  assert.match(readme, /project-token mode/);
  assert.match(readme, /RAILWAY_TOKEN -> RAILWAY_API_TOKEN/);
});
