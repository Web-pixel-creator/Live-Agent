import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("ui-executor exposes runtime config and control-plane override endpoints", () => {
  const source = readFileSync(resolve(process.cwd(), "apps", "ui-executor", "src", "index.ts"), "utf8");

  for (const token of [
    "/runtime/config",
    "/runtime/control-plane-override",
    "/browser-jobs",
    "parseBrowserJobActionPath",
    "getBrowserJobListSnapshot",
    "submitBrowserJob",
    "resumeBrowserJob",
    "cancelBrowserJob",
    'action: "submit"',
    "getUiExecutorRuntimeConfigStoreStatus",
    "setUiExecutorRuntimeControlPlaneOverride",
    "clearUiExecutorRuntimeControlPlaneOverride",
    "UI_EXECUTOR_RUNTIME_OVERRIDE_INVALID",
    'action: "set"',
    'action: "clear"',
  ]) {
    assert.ok(source.includes(token), `ui-executor runtime control-plane route is missing token: ${token}`);
  }
});

test("docs describe ui-executor runtime control-plane override contract", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuide = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");
  const architecture = readFileSync(resolve(process.cwd(), "docs", "architecture.md"), "utf8");

  assert.match(readme, /GET \/runtime\/config/);
  assert.match(readme, /POST \/runtime\/control-plane-override/);
  assert.match(readme, /POST \/browser-jobs/);
  assert.match(readme, /resume\/cancel/i);
  assert.match(operatorGuide, /control-plane-override/);
  assert.match(operatorGuide, /Browser Worker/i);
  assert.match(operatorGuide, /clear=true/);
  assert.match(architecture, /runtime control-plane override/i);
  assert.match(architecture, /browser worker/i);
});
