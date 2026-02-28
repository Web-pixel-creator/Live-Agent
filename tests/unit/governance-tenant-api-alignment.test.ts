import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend exposes tenant governance routes with compliance/retention/audit summary contracts", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "API_DEFAULT_TENANT_ID",
    "API_COMPLIANCE_TEMPLATE",
    "resolveComplianceTemplateProfile",
    "resolveRequestTenantContext",
    "resolveGovernanceTenantScope",
    "complianceTemplateProfile",
    "requestTenant",
    "/v1/governance/tenant",
    "/v1/governance/compliance-template",
    "/v1/governance/retention-policy",
    "/v1/governance/policy",
    "/v1/governance/audit/operator-actions",
    "/v1/governance/audit/summary",
    "API_TENANT_SCOPE_FORBIDDEN",
    "API_INVALID_COMPLIANCE_TEMPLATE",
    "API_INVALID_RETENTION_POLICY",
    "API_GOVERNANCE_POLICY_VERSION_CONFLICT",
    "API_GOVERNANCE_POLICY_IDEMPOTENCY_CONFLICT",
    "upsertTenantGovernancePolicy(",
    "update_governance_policy",
    "tenantId: requestTenant.tenantId",
    "listOperatorActions(50, { tenantId: requestTenant.tenantId })",
    "listSessions(limit, { tenantId: requestTenant.tenantId })",
    "tenant: requestTenant",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `tenant governance API contract missing token: ${token}`);
  }
});
