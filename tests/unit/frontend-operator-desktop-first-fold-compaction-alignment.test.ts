import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console keeps desktop first fold compact with live summary notes and queue overflow", () => {
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
    'id="operatorDemoSummaryBridgeNote"',
    'id="operatorDemoSummaryQueueNote"',
    'id="operatorDemoSummaryApprovalsNote"',
    'id="operatorDemoSummaryStartupNote"',
    'id="operatorDemoSummaryUiExecutorNote"',
    'id="operatorDemoSummaryDeviceNodesNote"',
    'id="operatorPriorityQueueOverflow"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing desktop first-fold compaction token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "const OPERATOR_DEMO_SUMMARY_NOTE_IDS = {",
    "function summarizeOperatorDemoSummaryNoteText(value)",
    "function buildOperatorDemoSummaryNote(statusNode)",
    "function syncOperatorDemoSummaryNote(statusNode)",
    "syncOperatorDemoSummaryNote(node);",
    'window.matchMedia("(min-width: 921px)").matches',
    "const visibleEntries = shouldCompactDesktopQueue ? finalEntries.slice(0, 2) : finalEntries;",
    "el.operatorPriorityQueueOverflow.hidden = overflowCopy.length === 0;",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing desktop first-fold compaction token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-priority-queue-overflow {",
    "@media (min-width: 921px) {",
    ".panel-operator-console .operator-demo-summary-copy {",
    ".panel-operator-console .operator-demo-summary-placeholder-note {",
    ".panel-operator-console .operator-priority-queue-meta {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing desktop first-fold compaction token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("replace the generic category copy with a live operator note"),
    "README missing desktop live-note compaction note",
  );
  assert.ok(
    readmeSource.includes("first two queued actions in the visible stack"),
    "README missing desktop queue overflow compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("replace their generic category copy with a live operator note"),
    "operator guide missing desktop live-note compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("first two queued actions in the visible stack"),
    "operator guide missing desktop queue overflow compaction note",
  );
});
