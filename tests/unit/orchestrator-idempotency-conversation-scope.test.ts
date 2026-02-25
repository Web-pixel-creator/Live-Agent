import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("orchestrator idempotency key/fingerprint includes conversation scope", () => {
  const orchestratePath = resolve(process.cwd(), "agents", "orchestrator", "src", "orchestrate.ts");
  const source = readFileSync(orchestratePath, "utf8");

  assert.match(source, /const conversation = request\.conversation === "none" \? "none" : "default"/);
  assert.match(source, /`\$\{request\.sessionId\}:\$\{runId\}:\$\{intent\}:\$\{conversation\}:\$\{key\}`/);
  assert.match(source, /conversation:\s*request\.conversation === "none" \? "none" : "default"/);
});
