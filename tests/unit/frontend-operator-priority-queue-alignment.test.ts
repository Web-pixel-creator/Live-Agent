import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console keeps a priority queue surface for next actions", () => {
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
    'id="operatorPriorityQueueList"',
    'class="operator-priority-queue-list"',
    'class="operator-priority-queue-item is-neutral"',
    'class="operator-priority-queue-kicker">Start here<',
    'Hydrate the incident board',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-priority-queue token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "const OPERATOR_PRIORITY_QUEUE_ACTIONS = Object.freeze({",
    "function runOperatorPriorityQueueAction(actionId, options = {}) {",
    "function createOperatorPriorityQueueActionButton(config) {",
    "function createOperatorPriorityQueueSignalEntry(signal) {",
    "function syncOperatorPriorityQueue() {",
    "runOperatorEmptyStateAction(normalizedAction);",
    "buildOperatorRuntimeGuardrailActionTitle(state.operatorRuntimeGuardrailAction)",
    "buildOperatorRuntimeGuardrailActionMeta(state.operatorRuntimeGuardrailAction)",
    "el.operatorPriorityQueueList.innerHTML = \"\";",
    "el.operatorPriorityQueueList.append(item);",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-priority-queue token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-priority-queue-item {",
    ".panel-operator-console .operator-priority-queue-item.is-fail {",
    ".panel-operator-console .operator-priority-queue-item.is-watch {",
    ".panel-operator-console .operator-priority-queue-item.is-stale {",
    ".panel-operator-console .operator-priority-queue-actions {",
    ".panel-operator-console .operator-priority-queue-action {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-priority-queue token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("compact action queue appears before visibility counts"),
    "README missing operator priority-queue note",
  );
  assert.ok(
    operatorGuideSource.includes("`Triage Summary` now behaves like an `Active Queue`"),
    "operator guide missing operator priority-queue note",
  );
});
