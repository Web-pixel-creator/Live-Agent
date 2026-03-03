import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("ui executor supports Railway dynamic PORT and standalone start script", () => {
  const sourcePath = resolve(process.cwd(), "apps", "ui-executor", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");
  assert.match(source, /process\.env\.PORT \?\? process\.env\.UI_EXECUTOR_PORT \?\? 8090/);
  assert.match(source, /from "\.\/contracts\/index\.js"/);

  const packagePath = resolve(process.cwd(), "apps", "ui-executor", "package.json");
  const packageRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(packageRaw) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
  };

  assert.equal(pkg.scripts?.build, "tsc -p tsconfig.json");
  assert.equal(pkg.scripts?.start, "node --import tsx src/index.ts");
  assert.equal(pkg.dependencies?.tsx, "^4.20.5");
});

test("ui executor railway config pins healthcheck and start command", () => {
  const configPath = resolve(process.cwd(), "apps", "ui-executor", "railway.json");
  const configRaw = readFileSync(configPath, "utf8");
  const config = JSON.parse(configRaw) as {
    deploy?: { startCommand?: string; healthcheckPath?: string };
    build?: { buildCommand?: string };
  };

  assert.equal(
    config.build?.buildCommand,
    "echo \"[ui-executor] skip compile build; runtime starts from tsx source\"",
  );
  assert.equal(config.deploy?.startCommand, "npm run start");
  assert.equal(config.deploy?.healthcheckPath, "/healthz");
});
