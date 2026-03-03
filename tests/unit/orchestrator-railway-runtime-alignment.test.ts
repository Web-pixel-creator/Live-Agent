import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("orchestrator supports Railway dynamic PORT fallback", () => {
  const sourcePath = resolve(process.cwd(), "agents", "orchestrator", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");
  assert.match(source, /process\.env\.PORT \?\? process\.env\.ORCHESTRATOR_PORT \?\? 8082/);
});
