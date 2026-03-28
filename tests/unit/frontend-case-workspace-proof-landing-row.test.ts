import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace main row shows where the next proof or move lands", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const styleSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="caseWorkspaceMainActionProofLabel"',
    'id="caseWorkspaceMainActionProofValue"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing proof-landing token: ${token}`);
  }

  for (const token of [
    'caseWorkspaceMainActionProofLabel: document.getElementById("caseWorkspaceMainActionProofLabel")',
    'caseWorkspaceMainActionProofValue: document.getElementById("caseWorkspaceMainActionProofValue")',
    "function getCaseWorkspacePrimaryActionProofLanding(flowState, primaryActionCopy, isRu)",
    "const primaryActionProofLanding = getCaseWorkspacePrimaryActionProofLanding(flowState, primaryActionCopy, isRu);",
    'el.caseWorkspaceMainActionProofLabel.textContent = primaryActionProofLanding.label;',
    'el.caseWorkspaceMainActionProofValue.textContent = primaryActionProofLanding.value;',
    'el.runVisaDemoBtn.setAttribute("aria-describedby", "caseWorkspaceMainActionMeta caseWorkspaceMainActionOutcomeValue caseWorkspaceMainActionProofValue");',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing proof-landing token: ${token}`);
  }

  for (const token of [
    ".case-workspace-main-action-proof-row",
    ".case-workspace-main-action-proof-label",
    ".case-workspace-main-action-proof-value",
  ]) {
    assert.ok(styleSource.includes(token), `styles.css missing proof-landing token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("primary case row now also includes a short `Proof lands in` line"),
    "README should explain the proof-landing line",
  );
  assert.ok(
    operatorGuideSource.includes("primary case row now also includes a short `Proof lands in` line"),
    "operator guide should explain the proof-landing line",
  );
});
