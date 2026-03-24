import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence compacts panel meta and checkpoints by active workspace posture", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function resolveOperatorEvidenceDrawerWorkspacePanelMeta(activeView, model) {",
    "return \"Trace anchors and freshness stay first for runtime review.\";",
    "return \"Approval backlog and next decision stay first.\";",
    "return \"Audit proof stays first while deeper board review remains secondary.\";",
    "function resolveOperatorEvidenceDrawerWorkspaceCheckpointsLabel(activeView, model) {",
    "return \"Runtime anchors\";",
    "return \"Decision checks\";",
    "return \"Audit checks\";",
    "function resolveOperatorEvidenceDrawerWorkspaceCheckpoints(activeView, model) {",
    "return checkpoints.slice(0, 2);",
    "resolveOperatorEvidenceDrawerWorkspacePanelMeta(activeView, model)",
    "resolveOperatorEvidenceDrawerWorkspaceCheckpointsLabel(activeView, model)",
    "resolveOperatorEvidenceDrawerWorkspaceCheckpoints(activeView, model)",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace-compaction evidence token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("compacts `Focused Evidence` panel meta and checkpoint copy by the active workspace posture"),
    "README should document workspace-aware focused evidence meta/checkpoint compaction",
  );
  assert.ok(
    operatorGuideSource.includes("compacts `Focused Evidence` panel meta and checkpoint copy by the active workspace posture"),
    "operator guide should document workspace-aware focused evidence meta/checkpoint compaction",
  );
});
