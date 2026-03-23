import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator toolbar keeps broad board controls behind an explicit disclosure when a focused workspace is active", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="operatorToolbar"',
    'id="operatorToolbarAdvancedControls"',
    'id="operatorToolbarAdvancedSummary"',
    'id="operatorToolbarAdvancedTitle"',
    'id="operatorToolbarAdvancedHint"',
    'id="operatorToolbarAdvancedPill"',
    'id="operatorToolbarClusterView"',
    'id="operatorToolbarClusterFilters"',
    'id="operatorToolbarClusterSaved"',
    'id="operatorToolbarClusterRefresh"',
    'id="operatorToolbarRefreshMeta"',
    'id="operatorWorkspaceReturnBtn"',
    "Advanced board controls",
    "Back to Overview",
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing toolbar focus token: ${token}`);
  }

  for (const token of [
    'operatorToolbar: document.getElementById("operatorToolbar")',
    'operatorToolbarAdvancedControls: document.getElementById("operatorToolbarAdvancedControls")',
    'operatorToolbarAdvancedSummary: document.getElementById("operatorToolbarAdvancedSummary")',
    'operatorToolbarAdvancedTitle: document.getElementById("operatorToolbarAdvancedTitle")',
    'operatorToolbarAdvancedHint: document.getElementById("operatorToolbarAdvancedHint")',
    'operatorToolbarAdvancedPill: document.getElementById("operatorToolbarAdvancedPill")',
    'operatorToolbarClusterSaved: document.getElementById("operatorToolbarClusterSaved")',
    'operatorToolbarClusterRefresh: document.getElementById("operatorToolbarClusterRefresh")',
    'operatorToolbarRefreshMeta: document.getElementById("operatorToolbarRefreshMeta")',
    'operatorWorkspaceReturnBtn: document.getElementById("operatorWorkspaceReturnBtn")',
    "function getOperatorWorkspacePresentationState(viewId = state.operatorSavedView) {",
    "function syncOperatorToolbarWorkspaceMode() {",
    'el.operatorToolbar.dataset.workspaceFocus = workspaceFocus;',
    'el.operatorToolbarAdvancedControls.dataset.workspaceFocus = workspaceFocus;',
    'el.operatorToolbarAdvancedControls.open = workspaceFocus === "overview";',
    "Advanced board controls are available on demand while a focused workspace is active",
    'syncOperatorToolbarWorkspaceMode();',
    'Open Advanced board controls only if you need broader triage filters.',
    'el.operatorWorkspaceReturnBtn.hidden = !returnToOverviewVisible;',
    'Use Back to Overview to reopen the broader board.',
    'el.operatorToolbarAdvancedTitle.textContent =',
    'el.operatorToolbarAdvancedHint.textContent =',
    'el.operatorToolbarAdvancedPill.textContent =',
    'el.operatorRefreshBtn.textContent = refreshLabel;',
    'el.operatorToolbarRefreshMeta.textContent =',
    'Hydrate ${presentation.routeFacts.label.toLowerCase()} first, then open broader board controls only if you need cross-lane triage.',
    'Refresh after recovery or when new ${presentation.routeFacts.label.toLowerCase()} evidence lands.',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing toolbar focus token: ${token}`);
  }

  for (const token of [
    '.panel-operator-console .operator-toolbar[data-workspace-focus="approvals"]',
    '.panel-operator-console .operator-toolbar[data-workspace-focus="runtime"]',
    '.panel-operator-console .operator-toolbar[data-workspace-focus="audit"]',
    ".panel-operator-console .operator-toolbar-advanced {",
    ".panel-operator-console .operator-toolbar-advanced-summary {",
    ".panel-operator-console .operator-toolbar-advanced-body {",
    ".panel-operator-console .operator-toolbar-refresh-meta {",
    '.panel-operator-console .operator-toolbar-advanced[data-workspace-focus="approvals"]:not([open])',
    ".panel-operator-console .operator-workspace-return {",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing toolbar focus style token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("keeps broad `Board` / `Filters` chrome behind one explicit `Advanced board controls` disclosure"),
    "README should document the advanced board controls disclosure",
  );
  assert.ok(
    readmeSource.includes("visible `Back to Overview` action"),
    "README should document the return-to-overview action",
  );
  assert.ok(
    readmeSource.includes("That same workspace posture now also rewrites `Refresh` and `Advanced board controls` copy from the active workspace state"),
    "README should document state-aware refresh and advanced control copy",
  );
  assert.ok(
    operatorGuideSource.includes("broad `Board` / `Filters` controls now live behind one explicit `Advanced board controls` disclosure"),
    "operator guide should document the advanced board controls disclosure",
  );
  assert.ok(
    operatorGuideSource.includes("visible `Back to Overview` action"),
    "operator guide should document the return-to-overview action",
  );
  assert.ok(
    operatorGuideSource.includes("That same workspace posture now also rewrites `Refresh` and `Advanced board controls` copy from the active workspace state"),
    "operator guide should document state-aware refresh and advanced control copy",
  );
});
