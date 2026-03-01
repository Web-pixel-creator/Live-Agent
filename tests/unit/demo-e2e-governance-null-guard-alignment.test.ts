import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo-e2e governance lifecycle filters null entries before Get-FieldValue access", () => {
  const source = readFileSync(resolve(process.cwd(), "scripts", "demo-e2e.ps1"), "utf8");

  const requiredTokens = [
    "$summaryOperatorActionsLatest = Get-FieldValue -Object $governanceSummaryResponse -Path @(\"data\", \"audit\", \"operatorActions\", \"latest\")",
    "$summaryLatestGovernanceActionSeen = (",
    "$summaryOperatorActionsRecentRaw = Get-FieldValue -Object $governanceSummaryResponse -Path @(\"data\", \"audit\", \"operatorActions\", \"recent\")",
    "elseif ($null -ne $summaryOperatorActionsLatest) {",
    "http://localhost:8081/v1/governance/audit/operator-actions?tenantId=",
    "$governanceActions | Where-Object {",
    "$summaryOperatorActionsRecent | Where-Object {",
    "$adminOverridesRecent | Where-Object {",
    "$null -ne $_ -and",
    '[string](Get-FieldValue -Object $_ -Path @("action")) -eq "update_governance_policy"',
    '[string](Get-FieldValue -Object $_ -Path @("tenantId")) -eq $governanceTenantId',
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `demo-e2e governance null-guard contract missing token: ${token}`);
  }
});
