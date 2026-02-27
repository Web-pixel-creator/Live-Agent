import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("realtime gateway root endpoint exposes service descriptor instead of 404", () => {
  const sourcePath = resolve(process.cwd(), "apps/realtime-gateway/src/index.ts");
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /if \(url\.pathname === "\/" && req\.method === "GET"\)/);
  assert.match(source, /const publicUrl = resolveGatewayPublicUrl\(req\);/);
  assert.match(source, /message:\s*"realtime-gateway is online"/);
  assert.match(source, /websocket:\s*"\/realtime"/);
  assert.match(source, /health:\s*"\/healthz"/);
  assert.match(source, /badge:\s*"\/demo-e2e\/badge\.json"/);
  assert.match(source, /ui:\s*"demo-frontend is deployed separately"/);
  assert.match(source, /uiUrl:\s*demoFrontendPublicUrl/);
  assert.match(source, /function resolveGatewayPublicUrl\(req: IncomingMessage\)/);
  assert.match(source, /const forwardedProtoHeader = req\.headers\["x-forwarded-proto"\]/);
  assert.match(source, /function resolveDemoFrontendPublicUrl\(\)/);
  assert.match(source, /const frontendPublicUrl = toNonEmptyString\(process\.env\.FRONTEND_PUBLIC_URL\)/);
  assert.match(source, /if \(url\.pathname === "\/favicon\.ico" && req\.method === "GET"\)/);
});
