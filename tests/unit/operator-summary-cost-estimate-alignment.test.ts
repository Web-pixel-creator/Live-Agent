import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api operator summary includes cost-estimate evidence contract", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "OPERATOR_COST_PER_1K_INPUT_USD",
    "OPERATOR_COST_PER_1K_OUTPUT_USD",
    "function parseNonNegativeFloat(",
    "function buildCostEstimateSummary(agentUsage: Record<string, unknown>)",
    'currency: "USD"',
    'estimationMode: pricingConfigured ? "token_rate_estimate" : "tokens_only"',
    "pricePer1kInputUsd",
    "pricePer1kOutputUsd",
    "const costEstimate = buildCostEstimateSummary(agentUsage);",
    "costEstimate,",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `api-backend cost-estimate summary contract missing token: ${token}`);
  }
});
