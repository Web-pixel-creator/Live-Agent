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
  assert.match(source, /verify_only_fallback_on_auth_failure:/);
  assert.match(source, /push:\s*\r?\n\s*branches:\s*\r?\n\s*-\s*main[\s\S]*-\s*master/);
  assert.match(source, /Run Release Strict Final Gate/);
  assert.match(source, /npm run verify:release:strict/);
  assert.match(source, /RAILWAY_API_TOKEN:\s*\$\{\{\s*secrets\.RAILWAY_API_TOKEN\s*\|\|\s*secrets\.RAILWAY_TOKEN\s*\}\}/);
  assert.match(source, /RAILWAY_TOKEN:\s*\$\{\{\s*secrets\.RAILWAY_PROJECT_TOKEN\s*\}\}/);
  assert.match(source, /RAILWAY_PROJECT_ID:\s*\$\{\{\s*secrets\.RAILWAY_PROJECT_ID\s*\}\}/);
  assert.match(source, /RAILWAY_SERVICE_ID:\s*\$\{\{\s*secrets\.RAILWAY_SERVICE_ID\s*\}\}/);
  assert.match(source, /FRONTEND_PUBLIC_URL:\s*\$\{\{\s*vars\.FRONTEND_PUBLIC_URL\s*\}\}/);
  assert.match(source, /- name:\s*Install Railway CLI/);
  assert.match(source, /if:\s*github\.event_name == 'workflow_dispatch' && inputs\.deploy_to_railway == true/);
  assert.match(source, /npm install -g @railway\/cli/);
  assert.match(source, /- name:\s*Validate Railway Secrets/);
  assert.match(source, /Missing required repository secret: RAILWAY_API_TOKEN \(or legacy RAILWAY_TOKEN\)/);
  assert.match(source, /- name:\s*Probe Railway Auth/);
  assert.match(source, /run:\s*railway whoami/);
  assert.match(source, /- name:\s*Deploy To Railway \(Gateway \+ Frontend\)/);
  assert.match(source, /id:\s*combined_deploy/);
  assert.match(source, /continue-on-error:\s*true/);
  assert.match(source, /\$gatewayDemoFrontendPublicUrl = "\$\{\{\s*inputs\.gateway_demo_frontend_public_url\s*\}\}"\.Trim\(\)/);
  assert.match(source, /if \(\[string\]::IsNullOrWhiteSpace\(\$gatewayDemoFrontendPublicUrl\) -and -not \[string\]::IsNullOrWhiteSpace\(\$env:FRONTEND_PUBLIC_URL\)\)/);
  assert.match(source, /npm run deploy:railway:all @args/);
  assert.match(source, /- name:\s*Verify Public Endpoints Fallback \(Deploy Failure\)/);
  assert.match(source, /id:\s*verify_only_fallback/);
  assert.match(source, /steps\.combined_deploy\.outcome != 'success'/);
  assert.match(source, /npm run badge:public:check -- -RailwayPublicUrl/);
  assert.match(source, /- name:\s*Fail on Railway Deploy/);
  assert.match(source, /verify_only_fallback_on_auth_failure=false/);
  assert.match(source, /- name:\s*Publish Railway Deploy Mode Summary/);
  assert.match(source, /railway_deploy_mode=/);
  assert.match(source, /not_requested/);
  assert.match(source, /real_deploy/);
  assert.match(source, /verify_only_fallback/);
  assert.match(source, /deploy_failed_no_fallback/);
  assert.match(source, /- name:\s*Collect Badge Evidence Statuses/);
  assert.match(source, /id:\s*collect_badge_evidence/);
  assert.match(source, /badge_details_present=/);
  assert.match(source, /operator_damage_control_status=/);
  assert.match(source, /governance_policy_status=/);
  assert.match(source, /skills_registry_status=/);
  assert.match(source, /Badge details present: \$\{\{\s*steps\.collect_badge_evidence\.outputs\.badge_details_present\s*\}\}/);
  assert.match(source, /Operator damage-control status \(badge evidence\): \$\{\{\s*steps\.collect_badge_evidence\.outputs\.operator_damage_control_status\s*\}\}/);
  assert.match(source, /Governance policy status \(badge evidence\): \$\{\{\s*steps\.collect_badge_evidence\.outputs\.governance_policy_status\s*\}\}/);
  assert.match(source, /Skills registry status \(badge evidence\): \$\{\{\s*steps\.collect_badge_evidence\.outputs\.skills_registry_status\s*\}\}/);
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
  assert.match(readme, /RAILWAY_API_TOKEN/);
  assert.match(readme, /RAILWAY_TOKEN/);
  assert.match(readme, /RAILWAY_PROJECT_ID/);
  assert.match(readme, /RAILWAY_SERVICE_ID/);
  assert.match(readme, /badge evidence statuses/i);
  assert.match(readme, /operatorDamageControl/);
  assert.match(readme, /governancePolicy/);
  assert.match(readme, /skillsRegistry/);
});
