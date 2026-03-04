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
    "entry.className = \"entry system task-entry\";",
    "progressTrack.className = \"task-entry-progress-track\";",
    "progressFill.className = \"task-entry-progress-fill\";",
    "createTaskMetaChip(\"stage\", stageText)",
    "createTaskMetaChip(\"intent\", intentText)",
    "createTaskMetaChip(\"route\", routeText)",
    "exportNode.className = \"task-entry-export sr-only\";",
    "entry.classList.contains(\"task-entry\")",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing active-task card token: ${token}`);
  }

  const requiredStyleTokens = [
    ".task-entry {",
    ".task-entry-head {",
    ".task-entry-meta {",
    ".task-entry-chip {",
    ".task-entry-progress-track {",
    ".task-entry-progress-fill {",
    ".task-entry-foot {",
    ".task-entry-error {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing active-task card token: ${token}`);
  }

  assert.ok(
    operatorGuideSource.includes("render as status/progress cards with stage/intent/route chips"),
    "operator guide missing active-task status/progress card note",
  );
});
