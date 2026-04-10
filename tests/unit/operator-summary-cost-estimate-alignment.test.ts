import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api operator summary includes cost-estimate evidence contract", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");
  const trackerPath = resolve(process.cwd(), "apps", "api-backend", "src", "runtime-cost-tracker.ts");
  const trackerSource = readFileSync(trackerPath, "utf8");

  const requiredIndexTokens = [
    "OPERATOR_COST_PER_1K_INPUT_USD",
    "OPERATOR_COST_PER_1K_OUTPUT_USD",
    "function parseNonNegativeFloat(",
    "function buildCostEstimateSummary(agentUsage: Record<string, unknown>)",
    "buildRuntimeCostSummary({",
    "const costEstimate = buildCostEstimateSummary(agentUsage);",
    "costEstimate,",
  ];

  for (const token of requiredIndexTokens) {
    assert.ok(source.includes(token), `api-backend cost-estimate summary contract missing token: ${token}`);
  }

  const requiredTrackerTokens = [
    'currency: "USD"',
    "derivedTotalTokens",
    "tokenConsistency",
    "tokenDriftTokens",
    "pricePer1kInputUsd",
    "pricePer1kOutputUsd",
    "pricePerLiveMinuteUsd",
    "pricePerUiExecutorMinuteUsd",
    "pricePerStorageMbUsd",
    'estimationMode = pricingConfigured',
  ];

  for (const token of requiredTrackerTokens) {
    assert.ok(
      trackerSource.includes(token),
      `runtime-cost-tracker contract missing token: ${token}`,
    );
  }
});
