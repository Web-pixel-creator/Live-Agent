import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("railway api deploy workflow is wired to the dedicated helper and public live-capabilities checks", () => {
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "railway-deploy-api.yml");
  const source = readFileSync(workflowPath, "utf8");

  assert.match(source, /name:\s*Railway Deploy API/);
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /api_service:/);
  assert.match(source, /api_public_url:/);
  assert.match(source, /api_cors_allowed_origins:/);
  assert.match(source, /skip_health_check:/);
  assert.match(source, /skip_capabilities_check:/);
  assert.match(source, /no_wait:/);
  assert.match(source, /verify_only_fallback_on_auth_failure:/);

  assert.match(source, /RAILWAY_API_TOKEN:\s*\$\{\{\s*secrets\.RAILWAY_API_TOKEN\s*\}\}/);
  assert.match(source, /RAILWAY_LEGACY_TOKEN:\s*\$\{\{\s*secrets\.RAILWAY_TOKEN\s*\}\}/);
  assert.match(source, /RAILWAY_PROJECT_TOKEN:\s*\$\{\{\s*secrets\.RAILWAY_PROJECT_TOKEN\s*\}\}/);
  assert.match(source, /RAILWAY_PROJECT_ID:\s*\$\{\{\s*secrets\.RAILWAY_PROJECT_ID\s*\}\}/);
  assert.match(source, /RAILWAY_API_SERVICE_ID:\s*\$\{\{\s*secrets\.RAILWAY_API_SERVICE_ID\s*\}\}/);
  assert.match(source, /railway whoami/);
  assert.match(source, /scripts\/railway-deploy-api\.ps1/);
  assert.match(source, /-ApiPublicUrl/);
  assert.match(source, /-ApiCorsAllowedOrigins/);
  assert.match(source, /-SkipHealthCheck/);
  assert.match(source, /-SkipCapabilitiesCheck/);
  assert.match(source, /-NoWait/);
  assert.match(source, /Verify Public API Fallback \(Deploy Failure\)/);
  assert.match(source, /\/v1\/runtime\/live\/capabilities/);
  assert.match(source, /Railway API deploy summary path:/);
  assert.match(source, /Railway API live capabilities active mode:/);
  assert.match(source, /railway-deploy-api-artifacts/);
  assert.match(source, /artifacts\/deploy\/railway-api-deploy-summary\.json/);
});

test("package and docs expose the dedicated Railway API deploy lane", () => {
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const runbook = readFileSync(resolve(process.cwd(), "docs", "challenge-demo-runbook.md"), "utf8");
  const script = readFileSync(resolve(process.cwd(), "scripts", "railway-deploy-api.ps1"), "utf8");

  assert.equal(
    packageJson.scripts?.["deploy:railway:api"],
    "powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/railway-deploy-api.ps1",
  );

  assert.match(readme, /deploy:railway:api/);
  assert.match(readme, /railway-deploy-api\.yml/);
  assert.match(readme, /railway-api-deploy-summary\.json/);
  assert.match(readme, /\/v1\/runtime\/live\/capabilities/);
  assert.match(readme, /api-backend\.railway\.json/);

  assert.match(runbook, /deploy:railway:api/);
  assert.match(runbook, /railway-deploy-api\.yml/);
  assert.match(runbook, /live-agent-api-production\.up\.railway\.app/);

  assert.match(script, /API_CORS_ALLOWED_ORIGINS/);
  assert.match(script, /Live-Agent-API/);
  assert.match(script, /v1\/runtime\/live\/capabilities/);
  assert.match(script, /railway-api-deploy-summary\.json/);
  assert.match(script, /infra\\railway\\manifests\\api-backend\.railway\.json/);
  assert.doesNotMatch(script, /--path-as-root/);

  const manifest = readFileSync(
    resolve(process.cwd(), "infra", "railway", "manifests", "api-backend.railway.json"),
    "utf8",
  );
  assert.match(manifest, /apps\/api-backend\/src\/index\.ts/);
  assert.match(manifest, /"healthcheckPath": "\/healthz"/);
});
