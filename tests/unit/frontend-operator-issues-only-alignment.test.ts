import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console supports issues-only filter for triage", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    'id="operatorIssuesOnlyBtn" class="button-muted" aria-pressed="false" aria-label="Issues Only" title="Issues Only">Issues<',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-issues-only token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "operatorIssuesOnly: false",
    "operatorIssuesOnlyBtn: document.getElementById(\"operatorIssuesOnlyBtn\")",
    "function setOperatorIssuesOnlyMode(enabled)",
    "el.operatorIssuesOnlyBtn.classList.toggle(\"is-active\", state.operatorIssuesOnly);",
    "el.operatorIssuesOnlyBtn.setAttribute(\"aria-label\", issuesOnlyLabel);",
    "el.operatorIssuesOnlyBtn.title = issuesOnlyLabel;",
    "el.operatorIssuesOnlyBtn.textContent = state.operatorIssuesOnly ? \"All Statuses\" : \"Issues\";",
    "if (state.operatorIssuesOnly && statusNode.classList.contains(\"status-ok\")) {",
    "el.operatorIssuesOnlyBtn.addEventListener(\"click\", () => {",
    "setOperatorIssuesOnlyMode(!state.operatorIssuesOnly);",
    "setOperatorIssuesOnlyMode(false);",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-issues-only token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Issues Only` toggle hides cards already in `ok` state"),
    "README missing operator issues-only note",
  );
  assert.ok(
    operatorGuideSource.includes("`Issues Only` hides cards already marked `ok`"),
    "operator guide missing operator issues-only note",
  );
});
