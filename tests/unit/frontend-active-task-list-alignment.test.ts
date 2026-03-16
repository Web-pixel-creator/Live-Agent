import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend renders active tasks as structured status/progress cards", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function resolveTaskStatusVariant(status) {",
    "function createTaskStatusPill(statusText) {",
    "function resolveTaskIntentTitle(intentText) {",
    "function resolveTaskStageTitle(stageText, statusText) {",
    "entry.className = \"entry system task-entry\";",
    "entry.dataset.taskVariant = statusVariant;",
    "titleBlock.className = \"task-entry-title-block\";",
    "progressTrack.className = \"task-entry-progress-track\";",
    "progressTrack.dataset.taskVariant = statusVariant;",
    "progressFill.className = \"task-entry-progress-fill\";",
    "createTaskMetaChip(taskCopy.stageLabel, taskStageTitle)",
    "createTaskMetaChip(taskCopy.routeLabel, taskRouteTitle)",
    "createTaskMetaChip(taskCopy.taskLabel, task.taskId)",
    "refs.className = \"task-entry-ref-grid\";",
    "exportNode.className = \"task-entry-export sr-only\";",
    "el.tasks.append(entry);",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing active-task card token: ${token}`);
  }

  const requiredStyleTokens = [
    ".task-entry {",
    ".task-entry-head {",
    ".task-entry-title-block {",
    ".task-entry-details {",
    ".task-entry-chip {",
    ".task-entry-progress-track {",
    ".task-entry-progress-track[data-task-variant=\"fail\"] .task-entry-progress-fill {",
    ".task-entry-progress-fill {",
    ".task-entry-ref-grid {",
    ".task-entry-error {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing active-task card token: ${token}`);
  }

  assert.ok(
    operatorGuideSource.includes("render as title-first queue cards with a clear stage, route, progress, and calmer run/session references"),
    "operator guide missing title-first active-task queue note",
  );
});
