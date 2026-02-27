import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("railway deploy-all workflow is wired to combined helper with required secrets and flags", () => {
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "railway-deploy-all.yml");
  const source = readFileSync(workflowPath, "utf8");

  assert.match(source, /name:\s*Railway Deploy All/);
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /skip_release_verification:/);
  assert.match(source, /skip_gateway_deploy:/);
  assert.match(source, /skip_frontend_deploy:/);
  assert.match(source, /gateway_skip_root_descriptor_check:/);
  assert.match(source, /gateway_no_wait:/);
  assert.match(source, /frontend_no_wait:/);
  assert.match(source, /frontend_skip_health_check:/);

  assert.match(source, /RAILWAY_TOKEN:\s*\$\{\{\s*secrets\.RAILWAY_TOKEN\s*\}\}/);
  assert.match(source, /RAILWAY_PROJECT_ID:\s*\$\{\{\s*secrets\.RAILWAY_PROJECT_ID\s*\}\}/);
  assert.match(source, /RAILWAY_SERVICE_ID:\s*\$\{\{\s*secrets\.RAILWAY_SERVICE_ID\s*\}\}/);

  assert.match(source, /- name:\s*Install Railway CLI/);
  assert.match(source, /npm install -g @railway\/cli/);
  assert.match(source, /- name:\s*Validate Railway Secrets/);
  assert.match(source, /Missing required repository secret: RAILWAY_TOKEN/);
  assert.match(source, /- name:\s*Run Combined Railway Deploy/);
  assert.match(source, /npm run deploy:railway:all @args/);
  assert.match(source, /-SkipReleaseVerification/);
  assert.match(source, /-SkipGatewayDeploy/);
  assert.match(source, /-SkipFrontendDeploy/);
  assert.match(source, /-GatewaySkipRootDescriptorCheck/);
  assert.match(source, /-GatewayNoWait/);
  assert.match(source, /-FrontendNoWait/);
  assert.match(source, /-FrontendSkipHealthCheck/);
});

test("readme documents deploy-all workflow and required secrets", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /railway-deploy-all\.yml/);
  assert.match(readme, /RAILWAY_TOKEN/);
  assert.match(readme, /RAILWAY_PROJECT_ID/);
  assert.match(readme, /RAILWAY_SERVICE_ID/);
});
