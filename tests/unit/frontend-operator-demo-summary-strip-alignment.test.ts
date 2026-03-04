import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes demo summary strip with mirrored status pills and lane mini-kpis", () => {
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
    'id="operatorDemoSummaryStrip"',
    'id="operatorDemoSummaryBridge"',
    'id="operatorDemoSummaryQueue"',
    'id="operatorDemoSummaryApprovals"',
    'id="operatorDemoSummaryStartup"',
    'id="operatorDemoSummaryUiExecutor"',
    'id="operatorDemoSummaryDeviceNodes"',
    'id="operatorDemoSummaryBridgeKpi"',
    'id="operatorDemoSummaryQueueKpi"',
    'id="operatorDemoSummaryApprovalsKpi"',
    'id="operatorDemoSummaryStartupKpi"',
    'id="operatorDemoSummaryUiExecutorKpi"',
    'id="operatorDemoSummaryDeviceNodesKpi"',
    'class="operator-demo-summary-card operator-signal-jump"',
    "F 0 · N 0 · O 0",
    "Realtime Gateway",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator demo-summary token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorDemoSummaryStrip: document.getElementById("operatorDemoSummaryStrip")',
    'operatorDemoSummaryBridge: document.getElementById("operatorDemoSummaryBridge")',
    'operatorDemoSummaryQueue: document.getElementById("operatorDemoSummaryQueue")',
    'operatorDemoSummaryApprovals: document.getElementById("operatorDemoSummaryApprovals")',
    'operatorDemoSummaryStartup: document.getElementById("operatorDemoSummaryStartup")',
    'operatorDemoSummaryUiExecutor: document.getElementById("operatorDemoSummaryUiExecutor")',
    'operatorDemoSummaryDeviceNodes: document.getElementById("operatorDemoSummaryDeviceNodes")',
    'operatorDemoSummaryBridgeKpi: document.getElementById("operatorDemoSummaryBridgeKpi")',
    'operatorDemoSummaryQueueKpi: document.getElementById("operatorDemoSummaryQueueKpi")',
    'operatorDemoSummaryApprovalsKpi: document.getElementById("operatorDemoSummaryApprovalsKpi")',
    'operatorDemoSummaryStartupKpi: document.getElementById("operatorDemoSummaryStartupKpi")',
    'operatorDemoSummaryUiExecutorKpi: document.getElementById("operatorDemoSummaryUiExecutorKpi")',
    'operatorDemoSummaryDeviceNodesKpi: document.getElementById("operatorDemoSummaryDeviceNodesKpi")',
    "const OPERATOR_DEMO_SUMMARY_STATUS_MIRROR_IDS = {",
    "const OPERATOR_DEMO_SUMMARY_KPI_IDS = {",
    'operatorHealthStatus: "operatorDemoSummaryBridge"',
    'operatorTaskQueueStatus: "operatorDemoSummaryQueue"',
    'operatorApprovalsStatus: "operatorDemoSummaryApprovals"',
    'operatorStartupStatus: "operatorDemoSummaryStartup"',
    'operatorUiExecutorStatus: "operatorDemoSummaryUiExecutor"',
    'operatorDeviceNodesStatus: "operatorDemoSummaryDeviceNodes"',
    'operatorHealthStatus: "operatorDemoSummaryBridgeKpi"',
    'operatorTaskQueueStatus: "operatorDemoSummaryQueueKpi"',
    'operatorApprovalsStatus: "operatorDemoSummaryApprovalsKpi"',
    'operatorStartupStatus: "operatorDemoSummaryStartupKpi"',
    'operatorUiExecutorStatus: "operatorDemoSummaryUiExecutorKpi"',
    'operatorDeviceNodesStatus: "operatorDemoSummaryDeviceNodesKpi"',
    "function formatOperatorDemoSummaryKpi(fail, neutral, ok)",
    "function syncOperatorDemoSummaryKpi(statusNode)",
    "function refreshOperatorDemoSummaryKpis()",
    "syncOperatorDemoSummaryKpi(node);",
    "refreshOperatorDemoSummaryKpis();",
    "el.operatorDemoSummaryStrip.classList.toggle(\"is-hidden\", !isDemo);",
    "OPERATOR_DEMO_SUMMARY_STATUS_MIRROR_IDS[node.id]",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator demo-summary token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-demo-summary-strip {",
    ".operator-demo-summary-strip.is-hidden {",
    ".operator-demo-summary-card {",
    ".operator-demo-summary-title {",
    ".operator-demo-summary-kpi {",
    ".operator-demo-summary-copy {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator demo-summary token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Demo Summary` strip"),
    "README missing operator demo-summary strip note",
  );
  assert.ok(
    readmeSource.includes("mini-KPI"),
    "README missing operator demo-summary mini-kpi note",
  );
  assert.ok(
    operatorGuideSource.includes("`Demo Summary` strip"),
    "operator guide missing operator demo-summary strip note",
  );
  assert.ok(
    operatorGuideSource.includes("mini-KPI"),
    "operator guide missing operator demo-summary mini-kpi note",
  );
});
