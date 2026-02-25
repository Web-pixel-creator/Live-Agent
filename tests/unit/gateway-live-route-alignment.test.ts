import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("gateway routes conversation.item.truncate through live bridge path", () => {
  const gatewayPath = resolve(process.cwd(), "apps", "realtime-gateway", "src", "index.ts");
  const source = readFileSync(gatewayPath, "utf8");

  assert.match(source, /function isLiveBridgeEventType\(type: string\)/);
  assert.match(source, /type === "conversation\.item\.truncate"/);
  assert.match(source, /if \(isLiveBridgeEventType\(parsed\.type\)\)/);
});
