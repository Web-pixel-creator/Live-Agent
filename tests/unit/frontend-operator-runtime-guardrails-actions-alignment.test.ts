import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator runtime guardrails expose direct recovery actions", () => {
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
    'id="operatorRuntimeGuardrailsAction"',
    'id="operatorRuntimeGuardrailsOpenBtn"',
    'id="operatorRuntimeGuardrailsRefreshBtn"',
    'id="operatorRuntimeGuardrailsClearBtn"',
    'id="operatorRuntimeGuardrailsActionList"',
    'id="operatorRuntimeGuardrailsHistoryStatus"',
    "Clear Path History",
    "Signal paths will appear after runtime diagnostics refresh.",
    "Path history is empty. Refresh summary to populate signal paths.",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing runtime guardrails action token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "operatorRuntimeGuardrailAction: null",
    "operatorRuntimeGuardrailActions: []",
    "operatorRuntimeGuardrailActionStates: new Map()",
    "operatorRuntimeGuardrailHistoryRestoredCount: 0",
    'const OPERATOR_RUNTIME_GUARDRAIL_ACTION_STATE_STORAGE_KEY = "mla.demoFrontend.operatorRuntimeGuardrailActionStates"',
    'operatorRuntimeGuardrailsAction: document.getElementById("operatorRuntimeGuardrailsAction")',
    'operatorRuntimeGuardrailsOpenBtn: document.getElementById("operatorRuntimeGuardrailsOpenBtn")',
    'operatorRuntimeGuardrailsRefreshBtn: document.getElementById("operatorRuntimeGuardrailsRefreshBtn")',
    'operatorRuntimeGuardrailsClearBtn: document.getElementById("operatorRuntimeGuardrailsClearBtn")',
    'operatorRuntimeGuardrailsActionList: document.getElementById("operatorRuntimeGuardrailsActionList")',
    'operatorRuntimeGuardrailsHistoryStatus: document.getElementById("operatorRuntimeGuardrailsHistoryStatus")',
    "OPERATOR_RUNTIME_GUARDRAIL_SIGNAL_RECOVERY_PROFILE_IDS",
    'service_draining: "gateway-drain-rejection"',
    'workflow_last_known_good: "orchestrator-last-known-good"',
    "function setOperatorRuntimeGuardrailsAction(",
    "function buildOperatorRuntimeGuardrailActionFingerprint(",
    "function getOperatorRuntimeGuardrailActionState(",
    "function setOperatorRuntimeGuardrailActionState(",
    "function findOperatorRuntimeGuardrailActionByRuntimeDrill(",
    "function findOperatorRuntimeGuardrailWorkflowAction(",
    "function buildOperatorRuntimeGuardrailActionLifecycle(",
    "function reconcileOperatorRuntimeGuardrailActionStates(",
    "function buildOperatorRuntimeGuardrailsDisplayActions(",
    "function readStoredOperatorRuntimeGuardrailActionStates(",
    "function persistOperatorRuntimeGuardrailActionStates(",
    "function restoreOperatorRuntimeGuardrailActionStates(",
    "function clearOperatorRuntimeGuardrailActionStates(",
    "function setOperatorRuntimeGuardrailsHistoryStatus(",
    "function syncOperatorRuntimeGuardrailsHistoryStatus(",
    "function buildOperatorRuntimeGuardrailAction(",
    "function resolveOperatorRuntimeGuardrailActions(",
    "function resolveOperatorRuntimeGuardrailAction(",
    "function renderOperatorRuntimeGuardrailsActionList(",
    "function syncOperatorRuntimeGuardrailsActionList(",
    "function setOperatorRuntimeGuardrailsActions(",
    "function openOperatorSupportPanel(panel, focusTarget = null)",
    "async function runOperatorRuntimeGuardrailsAction(actionOverride = null)",
    "signalDescriptors:",
    'statusCode: "cleared"',
    'statusText = "planned"',
    'statusText = "executed"',
    'statusText = "cleared"',
    "window.localStorage?.getItem(OPERATOR_RUNTIME_GUARDRAIL_ACTION_STATE_STORAGE_KEY)",
    "window.localStorage?.setItem(",
    "window.localStorage?.removeItem(OPERATOR_RUNTIME_GUARDRAIL_ACTION_STATE_STORAGE_KEY)",
    "persistOperatorRuntimeGuardrailActionStates();",
    "restoreOperatorRuntimeGuardrailActionStates();",
    "clearOperatorRuntimeGuardrailActionStates();",
    "Path history is empty. Refresh summary to populate signal paths.",
    "Local path history persists across reloads.",
    "setOperatorRuntimeGuardrailsActions(runtimeGuardrailActions);",
    "resolveOperatorRuntimeGuardrailActions(prioritizedSignals);",
    'setOperatorRuntimeGuardrailActionState(',
    '"staged",',
    '"planned"',
    '"executed"',
    "workflowGuardrailAction = findOperatorRuntimeGuardrailWorkflowAction()",
    "void runOperatorRuntimeGuardrailsAction(action);",
    'buttonLabel: "Plan Recovery Drill"',
    'buttonLabel: "Open Workflow Clear Path"',
    "await runOperatorRuntimeFaultExecution();",
    "await refreshOperatorWorkflowConfig({ silent: true });",
    'targetStatusId: "operatorStartupStatus"',
    'targetStatusId: "operatorSkillsRegistryStatus"',
    'el.operatorRuntimeGuardrailsOpenBtn.addEventListener("click", () => {',
    'el.operatorRuntimeGuardrailsRefreshBtn.addEventListener("click", () => {',
    'el.operatorRuntimeGuardrailsClearBtn.addEventListener("click", () => {',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing runtime guardrails action token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-health-actions {",
    ".operator-health-actions > button {",
    ".operator-health-action-list {",
    ".operator-health-action-item {",
    ".operator-health-action-copy {",
    ".operator-health-action-status-row {",
    ".operator-health-action-status-detail {",
    ".operator-health-action-meta {",
    ".operator-health-action-empty {",
    ".operator-health-action-history {",
    ".operator-health-action-history.is-ok {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing runtime guardrails action token: ${token}`);
  }

  assert.ok(readmeSource.includes("Plan Recovery Drill"), "README missing guardrails recovery drill CTA note");
  assert.ok(readmeSource.includes("Open Workflow Clear Path"), "README missing workflow clear CTA note");
  assert.ok(readmeSource.includes("Signal Paths"), "README missing multi-signal guardrails action list note");
  assert.ok(readmeSource.includes("staged"), "README missing guardrails lifecycle state note");
  assert.ok(readmeSource.includes("cleared"), "README missing guardrails cleared state note");
  assert.ok(readmeSource.includes("Clear Path History"), "README missing guardrails history reset note");
  assert.ok(operatorGuideSource.includes("Plan Recovery Drill"), "operator guide missing guardrails recovery drill CTA note");
  assert.ok(
    operatorGuideSource.includes("Open Workflow Clear Path"),
    "operator guide missing workflow clear CTA note",
  );
  assert.ok(operatorGuideSource.includes("Signal Paths"), "operator guide missing multi-signal guardrails action list note");
  assert.ok(operatorGuideSource.includes("planned"), "operator guide missing guardrails planned state note");
  assert.ok(operatorGuideSource.includes("cleared"), "operator guide missing guardrails cleared state note");
  assert.ok(operatorGuideSource.includes("Clear Path History"), "operator guide missing guardrails history reset note");
});
