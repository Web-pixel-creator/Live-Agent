import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace main row exposes an active-only task rail", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const styleSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");

  for (const token of [
    'id="caseWorkspaceMainActionTaskRail"',
    'id="caseWorkspaceMainActionTaskRailLabel"',
    'id="caseWorkspaceMainActionTaskNowLabel"',
    'id="caseWorkspaceMainActionTaskNowValue"',
    'id="caseWorkspaceMainActionTaskReviewLabel"',
    'id="caseWorkspaceMainActionTaskReviewValue"',
    'id="caseWorkspaceMainActionTaskThenLabel"',
    'id="caseWorkspaceMainActionTaskThenValue"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing task-rail token: ${token}`);
  }

  for (const token of [
    'caseWorkspaceMainActionTaskRail: document.getElementById("caseWorkspaceMainActionTaskRail")',
    'caseWorkspaceMainActionTaskRailLabel: document.getElementById("caseWorkspaceMainActionTaskRailLabel")',
    'caseWorkspaceMainActionTaskNowValue: document.getElementById("caseWorkspaceMainActionTaskNowValue")',
    'caseWorkspaceMainActionTaskReviewValue: document.getElementById("caseWorkspaceMainActionTaskReviewValue")',
    'caseWorkspaceMainActionTaskThenValue: document.getElementById("caseWorkspaceMainActionTaskThenValue")',
    "function getCaseWorkspacePrimaryActionTaskRail(flowState, primaryActionCopy, isRu)",
    'el.caseWorkspaceMainActionTaskRail.hidden = primaryActionTaskRail.visible !== true;',
    'el.caseWorkspaceMainActionTaskRailLabel.textContent = primaryActionTaskRail.label;',
    'el.caseWorkspaceMainActionTaskNowValue.textContent = primaryActionTaskRail.nowValue;',
    'el.caseWorkspaceMainActionTaskReviewValue.textContent = primaryActionTaskRail.reviewValue;',
    'el.caseWorkspaceMainActionTaskThenValue.textContent = primaryActionTaskRail.thenValue;',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing task-rail token: ${token}`);
  }

  for (const token of [
    ".case-workspace-main-action-task-rail",
    ".case-workspace-main-action-task-rail-label",
    ".case-workspace-main-action-task-rail-grid",
    ".case-workspace-main-action-task-item",
    ".case-workspace-main-action-task-item-label",
    ".case-workspace-main-action-task-item-value",
  ]) {
    assert.ok(styleSource.includes(token), `styles.css missing task-rail token: ${token}`);
  }
});
