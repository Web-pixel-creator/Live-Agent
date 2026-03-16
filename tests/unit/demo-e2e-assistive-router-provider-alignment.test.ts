import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo-e2e delegation summary carries assistive router provider metadata", () => {
  const source = readFileSync(resolve(process.cwd(), "scripts", "demo-e2e.ps1"), "utf8");
  const badgeSource = readFileSync(resolve(process.cwd(), "scripts", "demo-e2e-badge-json.mjs"), "utf8");
  const policySource = readFileSync(resolve(process.cwd(), "scripts", "demo-e2e-policy-check.mjs"), "utf8");

  for (const token of [
    "routingProvider",
    "routingDefaultProvider",
    "routingDefaultModel",
    "routingSelectionReason",
    "routingBudgetPolicy",
    "routingPromptCaching",
    "routingWatchlistEnabled",
    "assistiveRouterProviderMetadataValidated = if (",
    "assistiveRouterProvider = if ($null -ne $delegationData)",
    "assistiveRouterBudgetPolicy = if ($null -ne $delegationData)",
  ]) {
    assert.ok(source.includes(token), `demo-e2e assistive router metadata missing token: ${token}`);
  }

  for (const token of [
    'capability: "routing_reasoning"',
    "assistiveRouterProviderMetadataValidated",
    "assistiveRouterBudgetPolicy",
    "assistiveRouterPromptCaching",
  ]) {
    assert.ok(badgeSource.includes(token), `badge provider usage missing token: ${token}`);
  }

  for (const token of [
    '"kpi.assistiveRouterProviderMetadataValidated"',
    '"kpi.assistiveRouterProvider"',
    '"gemini_api", "openai", "anthropic", "deepseek", "moonshot"',
  ]) {
    assert.ok(policySource.includes(token), `demo-e2e policy check missing token: ${token}`);
  }
});
