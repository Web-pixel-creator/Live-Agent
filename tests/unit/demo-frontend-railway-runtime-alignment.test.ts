import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend server supports Railway runtime config and dynamic PORT", () => {
  const serverPath = resolve(process.cwd(), "apps", "demo-frontend", "src", "server.ts");
  const source = readFileSync(serverPath, "utf8");

  assert.match(source, /process\.env\.PORT \?\? process\.env\.FRONTEND_PORT \?\? 3000/);
  assert.match(source, /process\.env\.FRONTEND_WS_URL/);
  assert.match(source, /process\.env\.FRONTEND_API_BASE_URL/);
  assert.match(source, /req\.method === "GET" && req\.url === "\/config\.json"/);
  assert.match(source, /service:\s*"demo-frontend"/);
  assert.match(source, /runtime:\s*\{/);
});

test("demo frontend package has standalone start script for Railway deploy", () => {
  const packagePath = resolve(process.cwd(), "apps", "demo-frontend", "package.json");
  const packageRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(packageRaw) as { scripts?: Record<string, string> };

  assert.equal(pkg.scripts?.build, "tsc -p tsconfig.json");
  assert.equal(pkg.scripts?.start, "node dist/server.js");
});

test("demo frontend railway config pins healthcheck and start command", () => {
  const configPath = resolve(process.cwd(), "apps", "demo-frontend", "railway.json");
  const configRaw = readFileSync(configPath, "utf8");
  const config = JSON.parse(configRaw) as {
    deploy?: { startCommand?: string; healthcheckPath?: string };
    build?: { buildCommand?: string };
  };

  assert.equal(config.build?.buildCommand, "npm run build");
  assert.equal(config.deploy?.startCommand, "npm run start");
  assert.equal(config.deploy?.healthcheckPath, "/healthz");
});

test("demo frontend runtime applies /config.json overrides on bootstrap", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const source = readFileSync(appPath, "utf8");

  assert.match(source, /async function loadRuntimeConfig\(\)/);
  assert.match(source, /fetch\("\/config\.json"/);
  assert.match(source, /const runtimeConfig = await loadRuntimeConfig\(\)/);
  assert.match(source, /if \(runtimeConfig\?\.wsUrl\)/);
  assert.match(source, /if \(runtimeConfig\?\.apiBaseUrl\)/);
});
