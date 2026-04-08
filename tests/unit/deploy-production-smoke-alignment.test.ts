import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("deploy production smoke helper is wired across package, script, and docs", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const packageRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(packageRaw) as { scripts?: Record<string, string> };

  const alias = pkg.scripts?.["verify:deploy:production-smoke"] ?? "";
  assert.match(alias, /deploy-production-smoke\.ps1/);

  const scriptPath = resolve(process.cwd(), "scripts", "deploy-production-smoke.ps1");
  const scriptRaw = readFileSync(scriptPath, "utf8");
  assert.match(scriptRaw, /\[string\]\$GatewayPublicUrl/);
  assert.match(scriptRaw, /\[string\]\$FrontendPublicUrl/);
  assert.match(scriptRaw, /production-smoke\.json/);
  assert.match(scriptRaw, /production-smoke\.md/);
  assert.match(scriptRaw, /public-badge-check\.ps1/);
  assert.match(scriptRaw, /Gateway root descriptor/);
  assert.match(scriptRaw, /AI Action Desk/);
  assert.match(scriptRaw, /Case Workspace/);
  assert.match(scriptRaw, /Operator Console/);
  assert.match(scriptRaw, /Session Boundary/);
  assert.match(scriptRaw, /helperValidated/);
  assert.match(scriptRaw, /runtimeState/);
  assert.match(scriptRaw, /healthOk/);

  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  assert.match(readme, /verify:deploy:production-smoke/);
  assert.match(readme, /production-smoke\.json/);

  const runbook = readFileSync(resolve(process.cwd(), "docs", "challenge-demo-runbook.md"), "utf8");
  assert.match(runbook, /verify:deploy:production-smoke/);
});
