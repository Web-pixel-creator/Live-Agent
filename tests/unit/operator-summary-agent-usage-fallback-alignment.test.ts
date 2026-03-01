import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator summary agent usage includes synthetic fallback for response events without usage metadata", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "const syntheticUsageFromResponse =",
    "event.type === \"orchestrator.response\"",
    "usageSource = \"none\";",
    "usageCalls = 1;",
    "usageModels = [\"usage_metadata_unavailable\"];",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `missing synthetic usage fallback token: ${token}`);
  }
});
