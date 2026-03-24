import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence prioritizes visible facts and origins by active workspace posture", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function buildOperatorEvidenceDrawerWorkspaceLeadFact(details = {}, viewId = \"latest\") {",
    "function prioritizeOperatorEvidenceDrawerFactsForWorkspace(facts, details = {}, viewId = \"latest\") {",
    "function prioritizeOperatorEvidenceDrawerOriginsForWorkspace(origins, details = {}) {",
    "return prioritizeOperatorEvidenceDrawerFactsForWorkspace(facts, details, \"latest\")",
    "return prioritizeOperatorEvidenceDrawerFactsForWorkspace(facts, details, \"trace\");",
    "return prioritizeOperatorEvidenceDrawerFactsForWorkspace(facts, details, \"recovery\");",
    "return prioritizeOperatorEvidenceDrawerOriginsForWorkspace(origins, details);",
    "activeSavedView,",
    'label: normalizedViewId === "latest" ? "Workspace" : "Posture",',
    'label: "View",',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace-priority evidence token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("prioritizes the first visible `Focused Evidence` facts and origins by the active workspace"),
    "README should document workspace-prioritized evidence facts/origins",
  );
  assert.ok(
    operatorGuideSource.includes("prioritizes the first visible `Focused Evidence` facts and origins by the active workspace"),
    "operator guide should document workspace-prioritized evidence facts/origins",
  );
});
