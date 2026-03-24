import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence reorders and compacts timeline and checkpoint cues by active workspace posture", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function prioritizeOperatorEvidenceDrawerCheckpointsForWorkspace(checkpoints, activeView, model) {",
    'priorityLabels = ["Trace", "Route", "Freshness"];',
    'priorityLabels = ["State", "Next", "Refresh"];',
    'priorityLabels = ["Review", "Posture", "Board"];',
    'priorityLabels = ["Path", "Verify", "Priority"];',
    "function resolveOperatorEvidenceDrawerWorkspaceTimelineLabel(activeView, model) {",
    'return "Runtime trail";',
    'return "Recovery trail";',
    'return "Decision trail";',
    'return "Approval recovery";',
    'return "Audit trail";',
    "function prioritizeOperatorEvidenceDrawerTimelineForWorkspace(timeline, activeView, model) {",
    'prioritySteps = activeView?.id === "recovery" ? ["Path", "Verify after", "Risk"] : ["Anchor", "Freshness", "Context"];',
    'prioritySteps = activeView?.id === "recovery" ? ["Path", "Verify after", "Risk"] : ["Signal", "Next check", "Observed"];',
    'prioritySteps = ["Review", "Posture", "Board state"];',
    "return prioritized.slice(0, 2);",
    "setText(el.operatorEvidenceDrawerTimelineLabel, resolveOperatorEvidenceDrawerWorkspaceTimelineLabel(activeView, model));",
    "prioritizeOperatorEvidenceDrawerTimelineForWorkspace(activeView.timeline, activeView, model)",
    "prioritizeOperatorEvidenceDrawerCheckpointsForWorkspace(checkpoints, activeView, model)",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace-aware timeline/checkpoint token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("reorders and compacts `Focused Evidence` timeline and checkpoint cues by the active workspace posture"),
    "README should document workspace-aware focused evidence timeline/checkpoint compaction",
  );
  assert.ok(
    operatorGuideSource.includes("reorders and compacts `Focused Evidence` timeline and checkpoint cues by the active workspace posture"),
    "operator guide should document workspace-aware focused evidence timeline/checkpoint compaction",
  );
});
