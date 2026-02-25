import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("gateway handles conversation=none as out-of-band lane", () => {
  const gatewayPath = resolve(process.cwd(), "apps", "realtime-gateway", "src", "index.ts");
  const source = readFileSync(gatewayPath, "utf8");

  assert.match(source, /const isOutOfBandRequest = isOutOfBandConversation\(parsed\.conversation\)/);
  assert.match(source, /const shouldTrackTask = parsed\.type === "orchestrator\.request" && !isOutOfBandRequest/);
  assert.match(source, /if \(!isOutOfBandRequest\)\s*\{\s*emitSessionState\(\s*"orchestrator_dispatching"/);
  assert.match(source, /if \(isOutOfBandRequest\)\s*\{\s*const responseMetadata = toMetadataRecord/);
  assert.match(source, /conversation:\s*"none"/);
  assert.match(source, /oob:\s*true/);
  assert.match(source, /parentEventId:\s*parsed\.id/);
});

test("ws protocol and demo frontend document/use oob request lane", () => {
  const protocolPath = resolve(process.cwd(), "docs", "ws-protocol.md");
  const frontendPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");

  const protocol = readFileSync(protocolPath, "utf8");
  const frontend = readFileSync(frontendPath, "utf8");
  const html = readFileSync(htmlPath, "utf8");

  assert.match(protocol, /conversation=none/i);
  assert.match(protocol, /oob=true/i);
  assert.match(protocol, /parentEventId/i);

  assert.match(frontend, /function sendOutOfBandRequest\(\)/);
  assert.match(frontend, /conversation:\s*"none"/);
  assert.match(frontend, /topic:\s*"assistive_router"/);
  assert.match(html, /id="sendOobBtn"/);
});
