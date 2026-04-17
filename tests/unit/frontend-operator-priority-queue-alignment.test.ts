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
    "Refresh summary once, then follow the highlighted workspace instead of scanning the full console.",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-priority-queue token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "const OPERATOR_PRIORITY_QUEUE_ACTIONS = Object.freeze({",
    "function runOperatorPriorityQueueAction(actionId, options = {}) {",
    "function createOperatorPriorityQueueActionButton(config) {",
    "function createOperatorPriorityQueueSignalEntry(signal) {",
    "operatorQueueSnapshot: null,",
    "operatorQueueLoadedAt: null,",
    "function buildOperatorPriorityQueueEntriesFromSnapshot() {",
    "function buildOperatorCaseWikiPriorityQueueEntry() {",
    "function buildOperatorQueueSnapshot(snapshot) {",
    "function normalizeOperatorQueueCompliancePreview(value) {",
    "function resolveOperatorQueueComplianceReasonText(compliance) {",
    "function resolveOperatorQueueComplianceTitle(item, compliance) {",
    "const OPERATOR_QUEUE_SNAPSHOT_STALE_THRESHOLD_MS = 15 * 60 * 1000;",
    "function buildOperatorQueueSummaryFromSnapshot(snapshot) {",
    "async function refreshOperatorQueue(options = {}) {",
    'new URL(`${state.apiBaseUrl}/v1/operator/queue`)',
    "await refreshOperatorQueue({ silent: true });",
    "const operatorQueueSnapshot = buildOperatorQueueSnapshot(summary.operatorQueue);",
    "const operatorQueueSummary = buildOperatorQueueSummaryFromSnapshot(operatorQueueSnapshot);",
    "renderOperatorTaskQueueWidget(taskQueueSummary, operatorQueueSnapshot);",
    "const summaryOperatorQueueSnapshot = buildOperatorQueueSnapshot(payload?.data?.operatorQueue);",
    "if (!summaryOperatorQueueSnapshot) {",
    "const repoOwnedQueueEntries = buildOperatorPriorityQueueEntriesFromSnapshot();",
    'actionId: "open_case_wiki_remediation"',
    'actionId: "copy_case_wiki_remediation_draft"',
    'kicker: complianceBlocked ? "Compliance blocker" : toOptionalText(item.kicker) ?? "Queue item",',
    "Raw evidence refs must be redacted before export",
    'return "Case Wiki evidence signing must pass before export.";',
    "buildComplianceArtifactDetailText",
    "blockingRefs",
    'return "Clear export blocker";',
    'return "Clear export blocker first.";',
    "let complianceBlockedCount = 0;",
    "topItemComplianceReason: resolveOperatorQueueComplianceReasonText(topItemCompliance),",
    ' ? "Compiled queue export is blocked by compliance enforcement. Clear the first queue item before handoff or export."',
    'actionId: "saved_view_approvals"',
    'actionId: "saved_view_runtime"',
    'actionId: "saved_view_incidents"',
    "void openOperatorCaseWikiFocusedRemediationInOperatorOps();",
    'void copyOperatorCaseWikiFocusedRemediationBlock("draft");',
    "function syncOperatorPriorityQueue() {",
    "pushEntry(buildOperatorCaseWikiPriorityQueueEntry());",
    "runOperatorEmptyStateAction(normalizedAction);",
    "buildOperatorRuntimeGuardrailActionTitle(state.operatorRuntimeGuardrailAction)",
    "buildOperatorRuntimeGuardrailActionMeta(state.operatorRuntimeGuardrailAction)",
    "el.operatorPriorityQueueList.innerHTML = \"\";",
    "el.operatorPriorityQueueList.append(item);",
    'meta: "Refresh summary once, then use the highlighted workspace or recovery path instead of scanning the entire console.",',
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
  assert.ok(readmeSource.includes("highlighted workspace"), "README missing workspace-first active queue helper note");
  assert.ok(readmeSource.includes("Open Remediation"), "README missing case wiki queue remediation note");
  assert.ok(readmeSource.includes("Copy Draft"), "README missing case wiki queue draft note");
  assert.ok(readmeSource.includes("Compliance blocker"), "README missing compliance blocker queue note");
  assert.ok(readmeSource.includes("Clear export blocker"), "README missing export blocker queue note");
  assert.ok(
    operatorGuideSource.includes("`Triage Summary` now behaves like an `Active Queue`"),
    "operator guide missing operator priority-queue note",
  );
  assert.ok(
    operatorGuideSource.includes("highlighted workspace"),
    "operator guide missing workspace-first active queue helper note",
  );
  assert.ok(operatorGuideSource.includes("Open Remediation"), "operator guide missing case wiki remediation note");
  assert.ok(operatorGuideSource.includes("Copy Draft"), "operator guide missing case wiki draft note");
  assert.ok(operatorGuideSource.includes("Compliance blocker"), "operator guide missing compliance blocker queue note");
  assert.ok(operatorGuideSource.includes("Clear export blocker"), "operator guide missing export blocker queue note");
});
