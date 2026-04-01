import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes compact session boundary widget", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");
  const architecturePath = resolve(process.cwd(), "docs", "architecture.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");
  const architectureSource = readFileSync(architecturePath, "utf8");

  const requiredHtmlTokens = [
    "<h3>Session Boundary</h3>",
    'id="operatorSessionBoundaryStatus"',
    'id="operatorSessionBoundarySession"',
    'id="operatorSessionBoundarySummary"',
    'id="operatorSessionBoundaryLatestProof"',
    'id="operatorSessionBoundaryRecovery"',
    'id="operatorSessionBoundaryOpenBtn"',
    'id="operatorSessionBoundaryHint"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing session boundary token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorSessionBoundaryOpenBtn: document.getElementById("operatorSessionBoundaryOpenBtn")',
    'operatorSessionBoundaryStatus: document.getElementById("operatorSessionBoundaryStatus")',
    'operatorSessionBoundarySession: document.getElementById("operatorSessionBoundarySession")',
    'operatorSessionBoundarySummary: document.getElementById("operatorSessionBoundarySummary")',
    'operatorSessionBoundaryLatestProof: document.getElementById("operatorSessionBoundaryLatestProof")',
    'operatorSessionBoundaryRecovery: document.getElementById("operatorSessionBoundaryRecovery")',
    'operatorSessionBoundaryHint: document.getElementById("operatorSessionBoundaryHint")',
    "setOperatorSessionBoundaryHint",
    "resetOperatorSessionBoundaryWidget",
    "renderOperatorSessionBoundaryWidget",
    "openOperatorSessionBoundaryTarget",
    "boundaryOwner",
    "approvalGate",
    "workflowBoundarySummary",
    "latestProofPointer",
    "recoveryPathHint",
    "recoveryHandoff",
    "latestVerifiedStage",
    "renderOperatorSessionBoundaryWidget(state.operatorSessionReplaySnapshot);",
    "openOperatorSessionBoundaryTarget();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing session boundary token: ${token}`);
  }

  assert.ok(readmeSource.includes("`Session Boundary`"), "README missing Session Boundary card note");
  assert.match(readmeSource, /approval gate|boundary owner|recovery path/i);
  assert.ok(operatorGuideSource.includes("`Session Boundary`"), "operator guide missing Session Boundary card note");
  assert.match(operatorGuideSource, /approval gate|boundary owner|recovery path/i);
  assert.match(architectureSource, /Session Boundary/);
});
