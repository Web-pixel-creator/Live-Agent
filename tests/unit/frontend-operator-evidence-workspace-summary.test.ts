import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence summary reorients its first sentence to the active workspace", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function buildOperatorEvidenceDrawerWorkspaceSummary(activeView, model) {",
    'el.operatorEvidenceDrawer.dataset.evidenceWorkspace =',
    'el.operatorEvidenceDrawer.dataset.evidenceWorkspaceState = workspaceState;',
    'if (workspacePresentation.normalizedView === "incidents") {',
    'return `Refresh ${workspaceLabel} first to load the ${activeView?.label?.toLowerCase() ?? "focused"} proof path.`;',
    'const workspaceLead =',
    'return `${workspaceLead}. ${nextValue}.`;',
    'return `${workspaceLead}. ${basePart || `${activeView?.label ?? "Focused Evidence"} keeps the current proof path visible`}.`;',
    "buildOperatorEvidenceDrawerWorkspaceSummary(activeView, model)",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing focused evidence workspace-summary token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("makes the first `Focused Evidence` summary sentence reorient to the active workspace"),
    "README should document the workspace-aware focused evidence summary",
  );
  assert.ok(
    operatorGuideSource.includes("makes the first `Focused Evidence` summary sentence reorient to the active workspace"),
    "operator guide should document the workspace-aware focused evidence summary",
  );
});
