import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes workflow control panel contract", () => {
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
    '<details id="operatorWorkflowControl" class="operator-workflow-control operator-support-panel"',
    "Workflow Control Panel",
    'id="operatorWorkflowControlStatus"',
    'id="operatorWorkflowControlMeta"',
    'id="operatorWorkflowOverrideJson"',
    'id="operatorWorkflowRefreshBtn"',
    'id="operatorWorkflowAssistiveEnableBtn"',
    'id="operatorWorkflowFallbackBtn"',
    'id="operatorWorkflowApplyBtn"',
    'id="operatorWorkflowClearBtn"',
    'id="operatorWorkflowCurrentConfig"',
    'id="operatorWorkflowLastResult"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-workflow-control token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "operatorWorkflowConfigSnapshot: null",
    "operatorWorkflowConfigLoadedAt: null",
    "operatorWorkflowLastResult: null",
    'operatorWorkflowControl: document.getElementById("operatorWorkflowControl")',
    'operatorWorkflowControlStatus: document.getElementById("operatorWorkflowControlStatus")',
    'operatorWorkflowControlMeta: document.getElementById("operatorWorkflowControlMeta")',
    'operatorWorkflowOverrideJson: document.getElementById("operatorWorkflowOverrideJson")',
    'operatorWorkflowRefreshBtn: document.getElementById("operatorWorkflowRefreshBtn")',
    'operatorWorkflowAssistiveEnableBtn: document.getElementById("operatorWorkflowAssistiveEnableBtn")',
    'operatorWorkflowFallbackBtn: document.getElementById("operatorWorkflowFallbackBtn")',
    'operatorWorkflowApplyBtn: document.getElementById("operatorWorkflowApplyBtn")',
    'operatorWorkflowClearBtn: document.getElementById("operatorWorkflowClearBtn")',
    'operatorWorkflowCurrentConfig: document.getElementById("operatorWorkflowCurrentConfig")',
    'operatorWorkflowLastResult: document.getElementById("operatorWorkflowLastResult")',
    "operatorWorkflowControl]",
    "function buildOperatorWorkflowPreset(kind)",
    "function parseOperatorWorkflowOverrideJson()",
    "function renderOperatorWorkflowControlPanel()",
    "async function refreshOperatorWorkflowConfig(options = {})",
    "async function runOperatorWorkflowControlPlaneOverride(options = {})",
    'fetch(`${state.apiBaseUrl}/v1/runtime/workflow-config`',
    'fetch(`${state.apiBaseUrl}/v1/runtime/workflow-control-plane-override`',
    "apiKeyConfigured",
    "el.operatorWorkflowRefreshBtn.addEventListener(\"click\", () => {",
    "el.operatorWorkflowAssistiveEnableBtn.addEventListener(\"click\", () => {",
    "el.operatorWorkflowFallbackBtn.addEventListener(\"click\", () => {",
    "el.operatorWorkflowApplyBtn.addEventListener(\"click\", () => {",
    "el.operatorWorkflowClearBtn.addEventListener(\"click\", () => {",
    "function getOperatorControlPlaneFailureState(error, options = {})",
    "function ensureOperatorWorkflowControlPrimed(options = {})",
    "function resolveOperatorWorkflowPayloadDegradedState(payload) {",
    'payload?.degraded === true',
    'el.operatorWorkflowControl.addEventListener("toggle", () => {',
    "await refreshOperatorSummary({ markUserRefresh: true });",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-workflow-control token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-workflow-control {",
    ".operator-workflow-control-body {",
    ".operator-workflow-control-actions > button {",
    ".operator-workflow-control-output-grid {",
    ".operator-workflow-control-output-card {",
    ".operator-workflow-control-output {",
    ".operator-workflow-control.is-unavailable,",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-workflow-control token: ${token}`);
  }

  assert.ok(readmeSource.includes("`Workflow Control Panel`"), "README missing workflow control panel note");
  assert.ok(readmeSource.includes("`apiKeyConfigured`"), "README missing workflow control redaction note");
  assert.ok(operatorGuideSource.includes("`Workflow Control Panel`"), "operator guide missing workflow control panel note");
  assert.ok(operatorGuideSource.includes("redacted"), "operator guide missing workflow control redaction note");
});
