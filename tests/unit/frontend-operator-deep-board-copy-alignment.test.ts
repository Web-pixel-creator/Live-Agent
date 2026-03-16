import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator desktop deep-board copy stays human-readable in expanded cards", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    'return "None yet";',
    "function formatOperatorWorkflowRuntimeSourceLine(sourceKind, sourcePath = null, loadedAt = \"n/a\") {",
    "function formatOperatorWorkflowRuntimeAssistiveLine(options = {}) {",
    "function formatOperatorWorkflowRuntimeOverrideLine(options = {}) {",
    "function formatOperatorWorkflowRuntimeFingerprintText(value) {",
    'let hint = "UI fallback is ready. No manual action required.";',
    'let hint = "Workflow path is on baseline config. No manual override is active.";',
    '"Assistive route is on, but the key is missing. Use deterministic fallback or restore the secret before live routing."',
    '"Approval timeouts detected. Review pending decisions and time limits before demo."',
    'setText(el.operatorWorkflowRuntimeLastError, lastError === "none" ? "No recent error" : lastError);',
  ];

  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator deep-board copy token: ${token}`);
  }

  const requiredHtmlTokens = [
    "Refresh summary to inspect UI fallback readiness.",
    "Refresh summary to inspect workflow path and any temporary override.",
    "Refresh summary to inspect active runtime risks and recovery paths.",
    "<strong>From Tasks</strong>",
    "<strong>SLA Watch/Breach</strong>",
    "Refresh summary to inspect approval backlog and time limits.",
  ];

  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator deep-board copy token: ${token}`);
  }

  const removedHtmlTokens = [
    "Refresh summary to inspect ui-executor failover state.",
    "Refresh summary to inspect workflow-store override and assistive-router posture.",
    "<strong>Pending from Tasks</strong>",
    "<strong>SLA Soft/Hard</strong>",
  ];

  for (const token of removedHtmlTokens) {
    assert.ok(!htmlSource.includes(token), `frontend html still leaks old operator copy token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("normalizes deep-board placeholders and runtime hints into operator-facing copy"),
    "README missing operator deep-board copy normalization note",
  );
  assert.ok(
    operatorGuideSource.includes("normalizes deep-board placeholders and runtime hints into operator-facing copy"),
    "operator guide missing operator deep-board copy normalization note",
  );
});
