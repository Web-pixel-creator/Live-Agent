import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator cost-estimate evidence widget is wired in frontend HTML and runtime", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  const requiredHtmlIds = [
    'id="operatorCostEstimateStatus"',
    'id="operatorCostEstimateCurrency"',
    'id="operatorCostEstimateMode"',
    'id="operatorCostEstimateSource"',
    'id="operatorCostEstimateTokens"',
    'id="operatorCostEstimateInputUsd"',
    'id="operatorCostEstimateOutputUsd"',
    'id="operatorCostEstimateTotalUsd"',
    'id="operatorCostEstimateRates"',
    'id="operatorCostEstimateSeenAt"',
    'id="operatorCostEstimateHint"',
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator cost-estimate widget token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "setOperatorCostEstimateHint",
    "resetOperatorCostEstimateWidget",
    "renderOperatorCostEstimateWidget",
    "const costEstimate = summary.costEstimate",
    "cost_estimate",
    "cost_estimate.latest",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator cost-estimate token: ${token}`);
  }
});
