import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("gateway index guards outbound websocket sends and listens for socket errors", () => {
  const source = readFileSync(resolve(process.cwd(), "apps", "realtime-gateway", "src", "index.ts"), "utf8");

  const requiredTokens = [
    'import { sendWsJson } from "./socket-send.js";',
    "const sendResult = sendWsJson(ws, outboundEvent);",
    "if (!sendResult.sent) {",
    'ws.on("error", (error) => {',
    'metrics.record("ws.connection.error", 0, false);',
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `missing gateway websocket send guard token: ${token}`);
  }
});
