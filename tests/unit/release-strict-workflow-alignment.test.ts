import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("release strict workflow runs verify:release with strict final mode", () => {
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "release-strict-final.yml");
  const source = readFileSync(workflowPath, "utf8");

  assert.match(source, /name:\s*Release Strict Final Gate/);
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /deploy_to_railway:/);
  assert.match(source, /railway_environment:/);
  assert.match(source, /gateway_public_url:/);
  assert.match(source, /gateway_demo_frontend_public_url:/);
  assert.match(source, /gateway_root_descriptor_check_max_attempts:/);
  assert.match(source, /gateway_root_descriptor_check_retry_backoff_sec:/);
  assert.match(source, /skip_gateway_deploy:/);
  assert.match(source, /skip_frontend_deploy:/);
  assert.match(source, /gateway_skip_root_descriptor_check:/);
  assert.match(source, /gateway_no_wait:/);
  assert.match(source, /frontend_no_wait:/);
  assert.match(source, /frontend_skip_health_check:/);
  assert.match(source, /push:\s*\r?\n\s*branches:\s*\r?\n\s*-\s*main[\s\S]*-\s*master/);
  assert.match(source, /Run Release Strict Final Gate/);
  assert.match(source, /npm run verify:release:strict/);
  assert.match(source, /RAILWAY_TOKEN:\s*\$\{\{\s*secrets\.RAILWAY_TOKEN\s*\}\}/);
  assert.match(source, /RAILWAY_PROJECT_ID:\s*\$\{\{\s*secrets\.RAILWAY_PROJECT_ID\s*\}\}/);
  assert.match(source, /RAILWAY_SERVICE_ID:\s*\$\{\{\s*secrets\.RAILWAY_SERVICE_ID\s*\}\}/);
  assert.match(source, /- name:\s*Install Railway CLI/);
  assert.match(source, /if:\s*github\.event_name == 'workflow_dispatch' && inputs\.deploy_to_railway == true/);
  assert.match(source, /npm install -g @railway\/cli/);
  assert.match(source, /- name:\s*Validate Railway Secrets/);
  assert.match(source, /Missing required repository secret: RAILWAY_TOKEN/);
  assert.match(source, /- name:\s*Deploy To Railway \(Gateway \+ Frontend\)/);
  assert.match(source, /npm run deploy:railway:all @args/);
  assert.match(source, /-GatewayDemoFrontendPublicUrl/);
  assert.match(source, /-GatewayRootDescriptorCheckMaxAttempts/);
  assert.match(source, /-GatewayRootDescriptorCheckRetryBackoffSec/);
  assert.match(source, /-SkipReleaseVerification/);
  assert.match(source, /-SkipGatewayDeploy/);
  assert.match(source, /-SkipFrontendDeploy/);
  assert.match(source, /-GatewaySkipRootDescriptorCheck/);
  assert.match(source, /-GatewayNoWait/);
  assert.match(source, /-FrontendNoWait/);
  assert.match(source, /-FrontendSkipHealthCheck/);
  assert.match(source, /release-strict-final-\$\{\{ github\.ref \}\}/);
});

test("release strict workflow publishes release-critical artifacts", () => {
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "release-strict-final.yml");
  const source = readFileSync(workflowPath, "utf8");

  assert.match(source, /name:\s*release-strict-final-artifacts/);
  assert.match(source, /artifacts\/demo-e2e\/summary\.json/);
  assert.match(source, /artifacts\/demo-e2e\/policy-check\.json/);
  assert.match(source, /artifacts\/demo-e2e\/badge\.json/);
  assert.match(source, /artifacts\/perf-load\/summary\.json/);
  assert.match(source, /artifacts\/perf-load\/policy-check\.json/);
});

test("strict release npm script stays aligned with release-readiness strict flag", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const pkgRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };
  const strictScript = pkg.scripts?.["verify:release:strict"] ?? "";

  assert.match(strictScript, /release-readiness\.ps1/);
  assert.match(strictScript, /-StrictFinalRun/);
});

test("readme documents optional release-strict railway deploy path", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /release-strict-final\.yml/);
  assert.match(readme, /deploy_to_railway=true/);
  assert.match(readme, /RAILWAY_TOKEN/);
  assert.match(readme, /RAILWAY_PROJECT_ID/);
  assert.match(readme, /RAILWAY_SERVICE_ID/);
});
