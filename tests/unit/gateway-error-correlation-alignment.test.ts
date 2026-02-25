import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("gateway websocket errors preserve client event correlation id in diagnostics", () => {
  const gatewayPath = resolve(process.cwd(), "apps", "realtime-gateway", "src", "index.ts");
  const source = readFileSync(gatewayPath, "utf8");

  assert.match(source, /clientEventId\?:\s*string/);
  assert.match(source, /const clientEventId = toNonEmptyString\(params\.clientEventId\)/);
  assert.match(source, /details = \{\s*\.\.\.details,\s*clientEventId,/);
  assert.match(source, /code:\s*"GATEWAY_SESSION_MISMATCH"[\s\S]*clientEventId:\s*parsed\.id/);
  assert.match(source, /code:\s*"GATEWAY_USER_MISMATCH"[\s\S]*clientEventId:\s*parsed\.id/);
  assert.match(source, /code:\s*"GATEWAY_DRAINING"[\s\S]*clientEventId:\s*parsed\.id/);
});

test("ws protocol documents clientEventId correlation in gateway.error payload", () => {
  const protocolPath = resolve(process.cwd(), "docs", "ws-protocol.md");
  const source = readFileSync(protocolPath, "utf8");

  assert.match(source, /details\.clientEventId/i);
});
