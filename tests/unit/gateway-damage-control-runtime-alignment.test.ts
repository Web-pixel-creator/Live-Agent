import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("realtime gateway captures damage-control runtime evidence from orchestrator responses", () => {
  const sourcePath = resolve(process.cwd(), "apps", "realtime-gateway", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "type DamageControlSnapshot",
    "const damageControlRuntime = {",
    "function observeDamageControlEvidence(event: EventEnvelope): void",
    'if (event.type !== "orchestrator.response")',
    "const damageControl = output && isObject(output.damageControl) ? output.damageControl : null;",
    "damageControlRuntime.matchedRuleCountTotal",
    "damageControlRuntime.verdictCounts",
    "damageControlRuntime.sourceCounts",
    "damageControl: {",
    "matchedRuleCountTotal:",
    "verdictCounts:",
    "sourceCounts:",
    "observeDamageControlEvidence(outboundEvent);",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `gateway damage-control runtime evidence missing token: ${token}`);
  }
});

