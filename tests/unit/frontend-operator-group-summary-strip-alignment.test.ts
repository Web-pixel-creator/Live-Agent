import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console lane headers expose compact subdomain summary strips", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    'class="operator-health-group-summary-strip" data-operator-group-summary-strip',
    'class="operator-health-group-summary-chip is-dormant"',
    'class="operator-health-group-summary-chip-label">Lane summary</span>',
    'class="operator-health-group-summary-chip-value">Awaiting refresh</strong>',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator group summary token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "const OPERATOR_GROUP_SUMMARY_STRIPS = Object.freeze({",
    '{ statusId: "operatorHealthStatus", label: "Bridge" }',
    '{ statusId: "operatorGovernancePolicyStatus", label: "Governance" }',
    '{ statusId: "operatorWorkflowRuntimeStatus", label: "Workflow" }',
    '{ statusId: "operatorApprovalsStatus", label: "Approvals" }',
    "function getOperatorGroupSummaryConfig(groupKey)",
    "function resolveOperatorGroupSummaryState(statusNode)",
    "function formatOperatorGroupSummaryStatusValue(statusNode)",
    "function createOperatorGroupSummaryChip(item)",
    "function syncOperatorGroupSummaryStrip(group)",
    "const summaryStripNode = group.querySelector(\"[data-operator-group-summary-strip]\");",
    "summaryStripNode.replaceChildren(fragment);",
    "syncOperatorGroupSummaryStrip(group);",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator group summary token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-health-group-summary-strip {",
    ".operator-health-group-summary-chip {",
    ".operator-health-group-summary-chip-label {",
    ".operator-health-group-summary-chip-value {",
    ".operator-health-group-summary-chip.is-fail {",
    ".operator-health-group-summary-chip.is-watch {",
    ".operator-health-group-summary-chip.is-ok {",
    ".operator-health-group-summary-chip.is-dormant {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator group summary token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("Each deep-board lane header now also exposes compact subdomain summary chips"),
    "README missing deep-board lane summary chip note",
  );
  assert.ok(
    operatorGuideSource.includes("Each deep-board lane header also carries compact subdomain summary chips"),
    "operator guide missing deep-board lane summary chip note",
  );
});
