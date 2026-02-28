import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api operator summary includes governance policy lifecycle contract", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "buildGovernancePolicyLifecycleSummary",
    'item.action === "update_governance_policy"',
    '"API_GOVERNANCE_POLICY_VERSION_CONFLICT"',
    '"API_GOVERNANCE_POLICY_IDEMPOTENCY_CONFLICT"',
    '"API_TENANT_SCOPE_FORBIDDEN"',
    "const governancePolicyLifecycle = buildGovernancePolicyLifecycleSummary(operatorActions);",
    "governancePolicyLifecycle,",
    "lifecycleValidated",
    '"partial"',
    '"observed"',
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `api-backend governance policy summary contract missing token: ${token}`);
  }
});

