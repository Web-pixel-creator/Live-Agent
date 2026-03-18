import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("ws protocol documents ui_task grounding fields for orchestrator.request", () => {
  const protocolPath = resolve(process.cwd(), "docs", "ws-protocol.md");
  const source = readFileSync(protocolPath, "utf8");

  const requiredTokens = [
    "intent=ui_task",
    "orchestrator.request",
    "url",
    "deviceNodeId",
    "deviceNodeKind",
    "deviceNodePlatform",
    "deviceNodeCapabilities",
    "deviceNodeMinTrustLevel",
    "screenshotRef",
    "domSnapshot",
    "accessibilityTree",
    "markHints",
    "refMap",
  ];
  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `ws-protocol is missing ui grounding token: ${token}`);
  }
});
