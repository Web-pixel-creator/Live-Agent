import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("railway combined deploy helper is wired across package script, script contract, and docs", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const packageRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(packageRaw) as { scripts?: Record<string, string> };

  const combinedAlias = pkg.scripts?.["deploy:railway:all"] ?? "";
  assert.match(combinedAlias, /railway-deploy-all\.ps1/);

  const scriptPath = resolve(process.cwd(), "scripts", "railway-deploy-all.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /\[switch\]\$SkipGatewayDeploy/);
  assert.match(source, /\[switch\]\$SkipFrontendDeploy/);
  assert.match(source, /\[switch\]\$GatewaySkipRootDescriptorCheck/);
  assert.match(source, /\[string\]\$GatewayPublicUrl = \$env:RAILWAY_PUBLIC_URL/);
  assert.match(source, /\[string\]\$GatewayDemoFrontendPublicUrl = \$env:DEMO_FRONTEND_PUBLIC_URL/);
  assert.match(source, /\[int\]\$GatewayRootDescriptorCheckMaxAttempts = 3/);
  assert.match(source, /\[int\]\$GatewayRootDescriptorCheckRetryBackoffSec = 2/);
  assert.match(source, /\[string\]\$FrontendPath = "apps\/demo-frontend"/);
  assert.match(source, /\[string\]\$FrontendWsUrl = \$env:FRONTEND_WS_URL/);
  assert.match(source, /\[string\]\$FrontendApiBaseUrl = \$env:FRONTEND_API_BASE_URL/);
  assert.match(source, /function Convert-ToWebSocketBaseUrl\(\[string\]\$HttpBaseUrl\)/);
  assert.match(
    source,
    /if \(-not \$SkipGatewayDeploy\)\s*\{[\s\S]*"-File", "\$PSScriptRoot\/railway-deploy\.ps1"/,
  );
  assert.match(source, /if \(-not \[string\]::IsNullOrWhiteSpace\(\$GatewayDemoFrontendPublicUrl\)\)\s*\{[\s\S]*"-DemoFrontendPublicUrl", \$GatewayDemoFrontendPublicUrl/);
  assert.match(
    source,
    /if \(\$GatewayRootDescriptorCheckMaxAttempts -gt 0\)\s*\{[\s\S]*"-RootDescriptorCheckMaxAttempts", \[string\]\$GatewayRootDescriptorCheckMaxAttempts/,
  );
  assert.match(
    source,
    /if \(\$GatewayRootDescriptorCheckRetryBackoffSec -ge 0\)\s*\{[\s\S]*"-RootDescriptorCheckRetryBackoffSec", \[string\]\$GatewayRootDescriptorCheckRetryBackoffSec/,
  );
  assert.match(source, /if \(\$GatewaySkipRootDescriptorCheck\)\s*\{[\s\S]*"-SkipRootDescriptorCheck"/);
  assert.match(
    source,
    /if \(-not \$SkipFrontendDeploy\)\s*\{[\s\S]*"-File", "\$PSScriptRoot\/railway-deploy-frontend\.ps1"/,
  );
  assert.match(source, /\$resolvedFrontendApiBaseUrl = \$FrontendApiBaseUrl/);
  assert.match(source, /\$resolvedFrontendWsUrl = \$FrontendWsUrl/);
  assert.match(
    source,
    /if \(\$SkipGatewayDeploy -and \$SkipFrontendDeploy\)\s*\{[\s\S]*nothing to deploy\./,
  );

  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");
  assert.match(readme, /npm run deploy:railway:all/);
  assert.match(readme, /Deploy gateway \+ frontend in one command/);
});
