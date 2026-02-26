import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("frontend railway deploy helper is wired across package script, script contract, and docs", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const packageRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(packageRaw) as { scripts?: Record<string, string> };

  const frontendAlias = pkg.scripts?.["deploy:railway:frontend"] ?? "";
  assert.match(frontendAlias, /railway-deploy-frontend\.ps1/);

  const scriptPath = resolve(process.cwd(), "scripts", "railway-deploy-frontend.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /\[string\]\$Service = \$\(/);
  assert.match(source, /\[string\]\$FrontendPath = "apps\/demo-frontend"/);
  assert.match(source, /\[string\]\$FrontendWsUrl = \$env:FRONTEND_WS_URL/);
  assert.match(source, /\[string\]\$FrontendApiBaseUrl = \$env:FRONTEND_API_BASE_URL/);
  assert.match(source, /Run-Cli -CliArgs @\("variable", "set", "-s", \$Service, "-e", \$Environment, "--skip-deploys", "FRONTEND_WS_URL=\$FrontendWsUrl"\)/);
  assert.match(
    source,
    /Run-Cli -CliArgs @\("variable", "set", "-s", \$Service, "-e", \$Environment, "--skip-deploys", "FRONTEND_API_BASE_URL=\$FrontendApiBaseUrl"\)/,
  );
  assert.match(source, /\$deployArgs = @\("up", \$FrontendPath, "--path-as-root", "-d", "-s", \$Service, "-e", \$Environment, "-m", \$DeployMessage\)/);
  assert.match(source, /\$pending = @\("QUEUED", "INITIALIZING", "BUILDING", "DEPLOYING"\)/);
  assert.match(source, /Frontend deployment completed successfully\./);
  assert.match(source, /function Test-FrontendHealth/);

  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");
  assert.match(readme, /## Railway Frontend Service/);
  assert.match(readme, /npm run deploy:railway:frontend/);
});

