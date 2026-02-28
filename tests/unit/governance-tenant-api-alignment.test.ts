import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend exposes tenant governance baseline routes and tenant audit scope wiring", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const source = readFileSync(sourcePath, "utf8");

  const requiredTokens = [
    "API_DEFAULT_TENANT_ID",
    "API_COMPLIANCE_TEMPLATE",
    "resolveRequestTenantContext",
    "requestTenant",
    "/v1/governance/tenant",
    "/v1/governance/audit/operator-actions",
    "API_TENANT_SCOPE_FORBIDDEN",
    "tenantId: requestTenant.tenantId",
    "listOperatorActions(50, { tenantId: requestTenant.tenantId })",
    "listSessions(limit, { tenantId: requestTenant.tenantId })",
    "tenant: requestTenant",
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `tenant governance API contract missing token: ${token}`);
  }
});
