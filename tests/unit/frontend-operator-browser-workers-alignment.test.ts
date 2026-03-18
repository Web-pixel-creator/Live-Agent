import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes browser worker control plane and widget contract", () => {
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
    '<details id="operatorBrowserWorkerControl" class="operator-browser-worker-control operator-support-panel"',
    "Browser Worker Control",
    'id="operatorBrowserWorkerControlStatus"',
    'id="operatorBrowserWorkerControlMeta"',
    'id="operatorBrowserWorkerJobId"',
    'id="operatorBrowserWorkerReason"',
    'id="operatorBrowserWorkerRefreshBtn"',
    'id="operatorBrowserWorkerInspectBtn"',
    'id="operatorBrowserWorkerResumeBtn"',
    'id="operatorBrowserWorkerCancelBtn"',
    'id="operatorBrowserWorkerCurrentConfig"',
    'id="operatorBrowserWorkerLastResult"',
    "<h3>Browser Workers</h3>",
    'id="operatorBrowserWorkersStatus"',
    'id="operatorBrowserWorkersCheckpointReady"',
    'id="operatorBrowserWorkersHint"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing browser-worker token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "operatorBrowserWorkerSnapshot: null",
    "operatorBrowserWorkerLoadedAt: null",
    "operatorBrowserWorkerLastResult: null",
    'operatorBrowserWorkerControl: document.getElementById("operatorBrowserWorkerControl")',
    'operatorBrowserWorkerControlStatus: document.getElementById("operatorBrowserWorkerControlStatus")',
    'operatorBrowserWorkerJobId: document.getElementById("operatorBrowserWorkerJobId")',
    'operatorBrowserWorkerRefreshBtn: document.getElementById("operatorBrowserWorkerRefreshBtn")',
    'operatorBrowserWorkerInspectBtn: document.getElementById("operatorBrowserWorkerInspectBtn")',
    'operatorBrowserWorkerResumeBtn: document.getElementById("operatorBrowserWorkerResumeBtn")',
    'operatorBrowserWorkerCancelBtn: document.getElementById("operatorBrowserWorkerCancelBtn")',
    'operatorBrowserWorkersStatus: document.getElementById("operatorBrowserWorkersStatus")',
    'operatorBrowserWorkersCheckpointReady: document.getElementById("operatorBrowserWorkersCheckpointReady")',
    "function getOperatorBrowserWorkerSnapshotParts(snapshot)",
    "function findOperatorBrowserWorkerJob(snapshot, requestedJobId = null)",
    "function findOperatorBrowserWorkerReplayBundle(snapshot)",
    "function buildOperatorBrowserWorkerReplayPreview(snapshot)",
    "function syncOperatorBrowserWorkerJobId(snapshot, options = {})",
    "function renderOperatorBrowserWorkersWidget(browserWorkersSummary)",
    "function setOperatorBrowserWorkerControlStatus(text, variant = \"neutral\")",
    "function renderOperatorBrowserWorkerControlPanel()",
    "async function refreshOperatorBrowserWorkerRuntime(options = {})",
    "async function inspectOperatorBrowserWorkerJob()",
    "async function runOperatorBrowserWorkerAction(action)",
    'fetch(`${state.apiBaseUrl}/v1/runtime/browser-jobs?limit=20`',
    'fetch(`${state.apiBaseUrl}/v1/runtime/browser-jobs/${encodeURIComponent(jobId)}`',
    '`${state.apiBaseUrl}/v1/runtime/browser-jobs/${encodeURIComponent(jobId)}/${normalizedAction}`',
    'browser_workers',
    'browser_workers.latest',
    "resetOperatorBrowserWorkersWidget(failedRefreshReason);",
    "renderOperatorBrowserWorkerControlPanel();",
    "function ensureOperatorBrowserWorkerControlPrimed(options = {})",
    "function resolveOperatorBrowserWorkerPayloadDegradedState(payload) {",
    'summaryStatus === "unavailable"',
    'el.operatorBrowserWorkerControl.addEventListener("toggle", () => {',
    "el.operatorBrowserWorkerRefreshBtn.addEventListener(\"click\", () => {",
    "el.operatorBrowserWorkerInspectBtn.addEventListener(\"click\", () => {",
    "el.operatorBrowserWorkerResumeBtn.addEventListener(\"click\", () => {",
    "el.operatorBrowserWorkerCancelBtn.addEventListener(\"click\", () => {",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing browser-worker token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-browser-worker-control {",
    ".operator-browser-worker-control-body {",
    ".operator-browser-worker-control-actions > button {",
    ".operator-browser-worker-control-output-grid {",
    ".operator-browser-worker-control-output-card {",
    ".operator-browser-worker-control-output {",
    ".operator-browser-worker-control.is-unavailable {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing browser-worker token: ${token}`);
  }

  assert.ok(readmeSource.includes("`Browser Worker Control`"), "README missing browser worker control note");
  assert.ok(readmeSource.includes("`/v1/runtime/browser-jobs`"), "README missing browser worker API note");
  assert.ok(readmeSource.includes("background browser worker"), "README missing background browser worker note");
  assert.ok(operatorGuideSource.includes("`Browser Worker Control`"), "operator guide missing browser worker control note");
  assert.ok(operatorGuideSource.includes("resume or cancel"), "operator guide missing browser worker action note");
});
