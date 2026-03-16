import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes runtime drill runner contract", () => {
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
    '<details id="operatorRuntimeDrills" class="operator-runtime-drills operator-support-panel"',
    "Runtime Drill Runner",
    'id="operatorRuntimeFaultCatalogStatus"',
    'id="operatorRuntimeFaultProfileId"',
    'id="operatorRuntimeFaultPhase"',
    'id="operatorRuntimeFaultDryRun"',
    'id="operatorRuntimeFaultContext"',
    'id="operatorRuntimeFaultRefreshBtn"',
    'id="operatorRuntimeFaultRunBtn"',
    'id="operatorRuntimeFaultExecuteBtn"',
    'id="operatorRuntimeFaultUseFollowUpBtn"',
    'id="operatorRuntimeFaultSupport"',
    'id="operatorRuntimeFaultMissingContext"',
    'id="operatorRuntimeFaultArtifacts"',
    'id="operatorRuntimeFaultResult"',
    'id="operatorRuntimeFaultFollowUp"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-runtime-drills token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "operatorRuntimeFaultProfiles: []",
    "operatorRuntimeFaultCatalogLoadedAt: null",
    "operatorRuntimeFaultLastResult: null",
    "operatorRuntimeFaultFollowUpContext: null",
    'operatorRuntimeDrills: document.getElementById("operatorRuntimeDrills")',
    'operatorRuntimeFaultCatalogStatus: document.getElementById("operatorRuntimeFaultCatalogStatus")',
    'operatorRuntimeFaultProfileId: document.getElementById("operatorRuntimeFaultProfileId")',
    'operatorRuntimeFaultPhase: document.getElementById("operatorRuntimeFaultPhase")',
    'operatorRuntimeFaultDryRun: document.getElementById("operatorRuntimeFaultDryRun")',
    'operatorRuntimeFaultContext: document.getElementById("operatorRuntimeFaultContext")',
    'operatorRuntimeFaultRefreshBtn: document.getElementById("operatorRuntimeFaultRefreshBtn")',
    'operatorRuntimeFaultRunBtn: document.getElementById("operatorRuntimeFaultRunBtn")',
    'operatorRuntimeFaultExecuteBtn: document.getElementById("operatorRuntimeFaultExecuteBtn")',
    'operatorRuntimeFaultUseFollowUpBtn: document.getElementById("operatorRuntimeFaultUseFollowUpBtn")',
    "operatorRuntimeDrills, el.operatorWorkflowControl]",
    "function normalizeOperatorRuntimeFaultPhase(value)",
    "function parseOperatorRuntimeFaultContext()",
    "function applyOperatorRuntimeFaultContext(value, options = {})",
    "function renderOperatorRuntimeFaultPanel()",
    "async function refreshOperatorRuntimeFaultProfiles(options = {})",
    "function useOperatorRuntimeFaultFollowUpContext()",
    "async function runOperatorRuntimeFaultExecution(options = {})",
    'fetch(`${state.apiBaseUrl}/v1/runtime/fault-profiles`',
    'fetch(`${state.apiBaseUrl}/v1/runtime/fault-profiles/execute`',
    "followUpContext",
    "el.operatorRuntimeFaultRefreshBtn.addEventListener(\"click\", () => {",
    "el.operatorRuntimeFaultRunBtn.addEventListener(\"click\", () => {",
    "el.operatorRuntimeFaultExecuteBtn.addEventListener(\"click\", () => {",
    "el.operatorRuntimeFaultUseFollowUpBtn.addEventListener(\"click\", () => {",
    "await refreshOperatorSummary({ markUserRefresh: true });",
    "refreshOperatorRuntimeFaultProfiles({ silent: true }).catch(() => {",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-runtime-drills token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-runtime-drills {",
    ".operator-runtime-drills-body {",
    ".operator-runtime-drills-grid {",
    ".operator-runtime-drills-actions > button {",
    ".operator-runtime-drills-output-grid {",
    ".operator-runtime-drills-output-card {",
    ".operator-runtime-drills-output {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-runtime-drills token: ${token}`);
  }

  assert.ok(readmeSource.includes("`Runtime Drill Runner`"), "README missing runtime drill runner note");
  assert.ok(readmeSource.includes("`followUpContext`"), "README missing runtime drill follow-up note");
  assert.ok(readmeSource.includes("refreshes operator summary after live execution"), "README missing runtime drill auto-refresh note");
  assert.ok(operatorGuideSource.includes("`Runtime Drill Runner`"), "operator guide missing runtime drill runner note");
  assert.ok(operatorGuideSource.includes("`Plan Drill` uses `dryRun=true`"), "operator guide missing runtime drill dry-run note");
  assert.ok(operatorGuideSource.includes("auto-refresh operator summary evidence"), "operator guide missing runtime drill auto-refresh note");
});
