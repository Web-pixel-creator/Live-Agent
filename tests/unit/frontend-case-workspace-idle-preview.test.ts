import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("idle case path keeps future steps as preview rail until intake is confirmed", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="caseWorkspaceCaseIdlePreview"',
    'id="caseWorkspaceCaseLaterSteps"',
    'id="caseWorkspaceCaseLaterActions"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing idle preview token: ${token}`);
  }

  for (const token of [
    'if (CASE_WORKSPACE_CASE_ACTIONS.has(buttonActionId) && (typeof activeActionId !== "string" || activeActionId.length === 0)) {',
    'state: "preview"',
    'button.disabled = uiState.state === "preview";',
    'const idleCasePathPreview =',
    '"Route preview after intake"',
    '"Before intake is confirmed, this rail shows only the future path order. After intake, the same steps unlock as the working case path."',
    'renderCaseWorkspacePreviewRail(caseIdlePreview, visibleCaseEntries, isRu);',
    'caseLaterActions.hidden = idleCasePathPreview;',
    'caseLaterSteps.hidden = idleCasePathPreview || caseLaterVisibleCount === 0;',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing idle preview token: ${token}`);
  }

  for (const token of [
    '[data-case-workspace-action-state="preview"]',
    ".case-workspace-preview-rail",
    ".case-workspace-preview-row",
    ".case-workspace-preview-kicker",
    ".case-workspace-preview-title",
    "cursor: not-allowed;",
    "border-style: dashed;",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing idle preview token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("route preview"),
    "README should mention idle case-path preview behavior",
  );
  assert.ok(
    readmeSource.includes("static preview rail"),
    "README should mention the static preview rail",
  );
  assert.ok(
    operatorGuideSource.includes("route preview"),
    "operator guide should mention idle case-path preview behavior",
  );
  assert.ok(
    operatorGuideSource.includes("static preview rail"),
    "operator guide should mention the static preview rail",
  );
});
