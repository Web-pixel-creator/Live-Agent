import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence makes compact provenance copy follow the active workspace posture", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function resolveOperatorEvidenceDrawerWorkspaceCompactRouteValue(actionConfig, details = {}) {",
    "return \"Trace review\";",
    "return \"Runtime recovery\";",
    "return \"Approval queue\";",
    "return \"Approval recovery\";",
    "return \"Audit review\";",
    "function resolveOperatorEvidenceDrawerWorkspaceCompactVerifyValue(details = {}) {",
    "return \"Trace + refresh\";",
    "return \"Decision + refresh\";",
    "return \"Audit + refresh\";",
    "function resolveOperatorEvidenceDrawerWorkspaceProvenanceLabel(details = {}) {",
    "return \"Runtime provenance\";",
    "return \"Approval provenance\";",
    "return \"Audit provenance\";",
    "compactValue: resolveOperatorEvidenceDrawerWorkspaceCompactRouteValue(preferredAction, details),",
    "compactValue: resolveOperatorEvidenceDrawerWorkspaceCompactVerifyValue(details),",
    "setText(el.operatorEvidenceDrawerProvenanceLabel, resolveOperatorEvidenceDrawerWorkspaceProvenanceLabel({",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace-aware provenance token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("compacts `Focused Evidence` provenance copy by the active workspace posture"),
    "README should document workspace-aware provenance compaction",
  );
  assert.ok(
    operatorGuideSource.includes("compacts `Focused Evidence` provenance copy by the active workspace posture"),
    "operator guide should document workspace-aware provenance compaction",
  );
});
