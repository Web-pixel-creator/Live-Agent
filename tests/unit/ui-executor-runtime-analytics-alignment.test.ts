import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("ui-executor runtime analytics contract stays aligned with demo lifecycle gate", () => {
  const uiExecutorPath = resolve(process.cwd(), "apps", "ui-executor", "src", "index.ts");
  const demoE2ePath = resolve(process.cwd(), "scripts", "demo-e2e.ps1");

  const uiExecutorSource = readFileSync(uiExecutorPath, "utf8");
  const demoE2eSource = readFileSync(demoE2ePath, "utf8");

  const requiredUiExecutorTokens = [
    "requestedEnabled",
    "splitValid",
    "bigQueryConfigValid",
    "bigQueryDataset",
    "bigQueryTable",
    "ANALYTICS_SPLIT_INVALID",
    "ANALYTICS_BIGQUERY_CONFIG_INVALID",
  ];

  for (const token of requiredUiExecutorTokens) {
    assert.ok(
      uiExecutorSource.includes(token),
      `ui-executor runtime analytics snapshot is missing token: ${token}`,
    );
  }

  const requiredDemoGateTokens = [
    "$analyticsRequestedEnabled",
    "$analyticsSplitValid",
    "$analyticsBigQueryConfigValid",
    "$analyticsBigQueryDataset",
    "$analyticsBigQueryTable",
    "Analytics requestedEnabled should be true for demo runtime",
    "Analytics splitValid should be true",
    "Analytics BigQuery config should be valid",
  ];

  for (const token of requiredDemoGateTokens) {
    assert.ok(
      demoE2eSource.includes(token),
      `demo-e2e runtime lifecycle gate is missing analytics contract token: ${token}`,
    );
  }
});
