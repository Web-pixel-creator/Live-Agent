import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator governance policy lifecycle widget is wired in frontend HTML and runtime", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  const requiredHtmlIds = [
    'id="operatorGovernancePolicyStatus"',
    'id="operatorGovernancePolicyTotal"',
    'id="operatorGovernancePolicyTenants"',
    'id="operatorGovernancePolicyOutcomes"',
    'id="operatorGovernancePolicyLifecycle"',
    'id="operatorGovernancePolicyConflicts"',
    'id="operatorGovernancePolicyLatest"',
    'id="operatorGovernancePolicySeenAt"',
    'id="operatorGovernancePolicyHint"',
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator governance-policy widget token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "setOperatorGovernancePolicyHint",
    "resetOperatorGovernancePolicyWidget",
    "renderOperatorGovernancePolicyWidget",
    "summary.governancePolicyLifecycle",
    "governance_policy.lifecycle",
    "governance_policy.latest",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator governance-policy token: ${token}`);
  }
});

