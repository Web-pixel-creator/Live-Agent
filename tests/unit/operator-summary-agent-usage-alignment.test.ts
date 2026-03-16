import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api operator summary includes agent-usage evidence contract", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "agent-usage-summary.ts");
  const source = readFileSync(sourcePath, "utf8");
  const indexSource = readFileSync(resolve(process.cwd(), "apps", "api-backend", "src", "index.ts"), "utf8");

  const requiredTokens = [
    "function applySyntheticUsageFallback",
    "const syntheticUsageFromResponse =",
    "event.type === \"orchestrator.response\"",
    "usageSource = \"none\";",
    "usageModels = [\"usage_metadata_unavailable\"]",
    "aggregationMode: \"high_water_by_run\"",
    "authority",
    "authoritativeRuns",
    "fallbackRuns",
    "sourceCounts",
    "models: Array.from(modelSet).sort",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `api-backend agent-usage summary contract missing token: ${token}`);
  }

  assert.ok(indexSource.includes("const agentUsage = buildAgentUsageSummary(recentEvents, services);"));
  assert.ok(indexSource.includes("agentUsage,"));
});
