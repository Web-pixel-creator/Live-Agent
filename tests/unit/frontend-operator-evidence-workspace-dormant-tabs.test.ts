import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence uses workspace-specific dormant tab labels", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function resolveOperatorEvidenceDrawerWorkspaceTabLabel(viewId, model) {",
    "const fallbackLabel = OPERATOR_EVIDENCE_DRAWER_VIEWS.find((view) => view.id === normalizedViewId)?.label ?? \"Latest event\";",
    "if (!shouldUseOperatorEvidenceDrawerWorkspacePlaceholder(model)) {",
    "return OPERATOR_EVIDENCE_ROUTE_VIEW_INTENTS[workspaceId]?.[normalizedViewId] ?? fallbackLabel;",
    "const visibleLabel = resolveOperatorEvidenceDrawerWorkspaceTabLabel(buttonViewId, model);",
    "button.textContent = visibleLabel;",
    "button.setAttribute(\"aria-label\", visibleLabel);",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace dormant-tab token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("dormant `Focused Evidence` tab strip now also changes its visible labels by workspace"),
    "README should document workspace-specific dormant tab labels",
  );
  assert.ok(
    operatorGuideSource.includes("dormant `Focused Evidence` tab strip now also changes its visible labels by workspace"),
    "operator guide should document workspace-specific dormant tab labels",
  );
});
