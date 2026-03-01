import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("firestore event mapping exposes agent usage fields for operator summary", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "firestore.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "agentUsageSource?: string;",
    "agentUsageCalls?: number;",
    "agentUsageInputTokens?: number;",
    "agentUsageOutputTokens?: number;",
    "agentUsageTotalTokens?: number;",
    "agentUsageModels?: string[];",
    "const usage = output ? asRecord(output.usage) : null;",
    "const agentUsageSource = toNonEmptyString(usage?.source) ?? undefined;",
    "const agentUsageCalls = toNonNegativeInt(usage?.calls) ?? undefined;",
    "const agentUsageInputTokens = toNonNegativeInt(usage?.inputTokens) ?? undefined;",
    "const agentUsageOutputTokens = toNonNegativeInt(usage?.outputTokens) ?? undefined;",
    "const agentUsageTotalTokens = toNonNegativeInt(usage?.totalTokens) ?? undefined;",
    "const agentUsageModels = Array.isArray(usage?.models)",
    "agentUsageSource,",
    "agentUsageCalls,",
    "agentUsageInputTokens,",
    "agentUsageOutputTokens,",
    "agentUsageTotalTokens,",
    "agentUsageModels: agentUsageModels.length > 0 ? agentUsageModels : undefined,",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `firestore agent usage mapping missing token: ${token}`);
  }
});

