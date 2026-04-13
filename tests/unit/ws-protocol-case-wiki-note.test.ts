import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("ws protocol documents case wiki as canonical orchestrator context", () => {
  const protocolPath = resolve(process.cwd(), "docs", "ws-protocol.md");
  const source = readFileSync(protocolPath, "utf8");

  assert.ok(
    source.includes("caseWiki") && source.includes("canonical memory substrate"),
    "ws protocol should document caseWiki as canonical context for orchestrator.request",
  );
});
