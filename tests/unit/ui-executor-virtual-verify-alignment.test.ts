import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("ui-executor treats virtual verify targets as observation-only checkpoints", () => {
  const source = readFileSync(resolve(process.cwd(), "apps", "ui-executor", "src", "index.ts"), "utf8");

  const requiredTokens = [
    "function isVirtualVerifyTarget(target: string): boolean {",
    'normalized === "initial-screen"',
    'normalized === "post-action-screen"',
    "if (isVirtualVerifyTarget(action.target)) {",
    'observation = `${action.target.toLowerCase()} observed`;',
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `ui-executor virtual verify token missing: ${token}`);
  }
});
