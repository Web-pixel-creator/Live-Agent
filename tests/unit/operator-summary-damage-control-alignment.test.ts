import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api operator summary includes damage-control timeline contract", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "buildDamageControlSummary",
    "damageControl: runtime ? runtime.damageControl ?? null : null,",
    "event.damageControlEnabled",
    "event.damageControlVerdict",
    "event.damageControlSource",
    "event.damageControlMatchedRuleCount",
    "event.damageControlMatchRuleIds",
    "gatewayService && isRecord(gatewayService.damageControl)",
    "const damageControl = buildDamageControlSummary(recentEvents, services);",
    "damageControl,",
    "matchedRuleCountTotal",
    "verdictCounts",
    "sourceCounts",
    'status: "observed"',
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `api-backend damage-control summary contract missing token: ${token}`);
  }
});
