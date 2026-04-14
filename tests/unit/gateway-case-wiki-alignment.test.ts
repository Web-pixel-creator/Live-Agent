import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("gateway wiring injects compiled case wiki into orchestrator dispatch paths", () => {
  const gatewaySource = readFileSync(resolve(process.cwd(), "apps", "realtime-gateway", "src", "index.ts"), "utf8");
  const configSource = readFileSync(resolve(process.cwd(), "apps", "realtime-gateway", "src", "config.ts"), "utf8");

  assert.match(gatewaySource, /createCaseWikiRequestAttacher/);
  assert.match(gatewaySource, /const attachCaseWikiToOrchestratorRequest = createCaseWikiRequestAttacher\(config\);/);
  assert.match(gatewaySource, /request = await attachCaseWikiToOrchestratorRequest\(request\);/);
  assert.match(configSource, /apiBackendBaseUrl: string;/);
  assert.match(configSource, /apiBackendBaseUrl: parseOptionalString\(env\.API_BACKEND_BASE_URL\) \?\? "http:\/\/localhost:8081"/);
});

test("docs explain the gateway Case Wiki dependency on api-backend", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const localDevelopment = readFileSync(resolve(process.cwd(), "docs", "local-development.md"), "utf8");

  assert.match(readme, /API_BACKEND_BASE_URL/);
  assert.match(readme, /compiled Case Wiki context/i);
  assert.match(localDevelopment, /API_BACKEND_BASE_URL=http:\/\/localhost:8081/);
  assert.match(localDevelopment, /compiled Case Wiki snapshots/i);
});
