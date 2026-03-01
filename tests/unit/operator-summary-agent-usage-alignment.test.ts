import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api operator summary includes agent-usage evidence contract", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "buildAgentUsageSummary",
    "event.agentUsageSource",
    "event.agentUsageCalls",
    "event.agentUsageInputTokens",
    "event.agentUsageOutputTokens",
    "event.agentUsageTotalTokens",
    "event.agentUsageModels",
    "const agentUsage = buildAgentUsageSummary(recentEvents);",
    "agentUsage,",
    "sourceCounts",
    "totalCalls",
    "inputTokens",
    "outputTokens",
    "models: Array.from(modelSet).sort",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `api-backend agent-usage summary contract missing token: ${token}`);
  }
});

