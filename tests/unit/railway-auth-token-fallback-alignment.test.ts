import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("railway deploy helpers normalize auth env and probe whoami before rollout", () => {
  const gatewayScriptPath = resolve(process.cwd(), "scripts", "railway-deploy.ps1");
  const frontendScriptPath = resolve(process.cwd(), "scripts", "railway-deploy-frontend.ps1");

  const gatewayScript = readFileSync(gatewayScriptPath, "utf8");
  const frontendScript = readFileSync(frontendScriptPath, "utf8");

  for (const source of [gatewayScript, frontendScript]) {
    assert.match(source, /function Ensure-RailwayAuthContext\(\[string\]\$LogPrefix\)/);
    assert.match(
      source,
      /if \(\[string\]::IsNullOrWhiteSpace\(\$env:RAILWAY_API_TOKEN\) -and -not \[string\]::IsNullOrWhiteSpace\(\$env:RAILWAY_TOKEN\)\)\s*\{[\s\S]*\$env:RAILWAY_API_TOKEN = \$env:RAILWAY_TOKEN/,
    );
    assert.match(source, /\$authProbe = \(& railway whoami 2>&1 \| Out-String\)\.Trim\(\)/);
    assert.match(source, /Railway authentication failed\. Set RAILWAY_API_TOKEN \(recommended\) or run 'railway login'\./);
  }

  assert.match(gatewayScript, /Ensure-RailwayAuthContext -LogPrefix "railway-deploy"/);
  assert.match(frontendScript, /Ensure-RailwayAuthContext -LogPrefix "railway-frontend"/);
});

test("readme documents local token fallback and auth preflight behavior", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /Runs auth preflight \(`railway whoami`\) before deploy/);
  assert.match(readme, /RAILWAY_API_TOKEN` is empty and `RAILWAY_TOKEN` is set/);
  assert.match(readme, /RAILWAY_TOKEN -> RAILWAY_API_TOKEN/);
});
