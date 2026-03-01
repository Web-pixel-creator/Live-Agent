import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator agent-usage evidence widget is wired in frontend HTML and runtime", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  const requiredHtmlIds = [
    'id="operatorAgentUsageStatus"',
    'id="operatorAgentUsageTotal"',
    'id="operatorAgentUsageRuns"',
    'id="operatorAgentUsageSessions"',
    'id="operatorAgentUsageCalls"',
    'id="operatorAgentUsageTokens"',
    'id="operatorAgentUsageModels"',
    'id="operatorAgentUsageSource"',
    'id="operatorAgentUsageSeenAt"',
    'id="operatorAgentUsageHint"',
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator agent-usage widget token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "setOperatorAgentUsageHint",
    "resetOperatorAgentUsageWidget",
    "renderOperatorAgentUsageWidget",
    "const agentUsage = summary.agentUsage",
    "agent_usage",
    "agent_usage.latest",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator agent-usage token: ${token}`);
  }
});
