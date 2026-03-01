import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("gateway runtime state exposes agent usage evidence block", () => {
  const sourcePath = resolve(process.cwd(), "apps", "realtime-gateway", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "type AgentUsageSnapshot = {",
    "const agentUsageRuntime = {",
    "function observeAgentUsageEvidence(event: EventEnvelope): void",
    "if (event.type !== \"orchestrator.response\")",
    "agentUsageRuntime.total += 1;",
    "agentUsage: {",
    "totalCalls: agentUsageRuntime.totalCalls",
    "sourceCounts:",
    "observeAgentUsageEvidence(outboundEvent);",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `gateway agent usage runtime token missing: ${token}`);
  }
});
