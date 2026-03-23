import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator toolbar compresses broad board controls when a focused workspace is active", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="operatorToolbar"',
    'id="operatorToolbarClusterView"',
    'id="operatorToolbarClusterFilters"',
    'id="operatorToolbarClusterSaved"',
    'id="operatorToolbarClusterRefresh"',
    'id="operatorWorkspaceReturnBtn"',
    'Back to Overview',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing toolbar focus token: ${token}`);
  }

  for (const token of [
    'operatorToolbar: document.getElementById("operatorToolbar")',
    'operatorToolbarClusterView: document.getElementById("operatorToolbarClusterView")',
    'operatorToolbarClusterFilters: document.getElementById("operatorToolbarClusterFilters")',
    'operatorToolbarClusterSaved: document.getElementById("operatorToolbarClusterSaved")',
    'operatorToolbarClusterRefresh: document.getElementById("operatorToolbarClusterRefresh")',
    'operatorWorkspaceReturnBtn: document.getElementById("operatorWorkspaceReturnBtn")',
    "function syncOperatorToolbarWorkspaceMode() {",
    'el.operatorToolbar.dataset.workspaceFocus = workspaceFocus;',
    'cluster.hidden = shouldCompressBoardChrome;',
    'cluster.setAttribute("aria-hidden", shouldCompressBoardChrome ? "true" : "false");',
    'syncOperatorToolbarWorkspaceMode();',
    'Use Overview to reopen broader board controls.',
    'el.operatorWorkspaceReturnBtn.hidden = !returnToOverviewVisible;',
    'Use Back to Overview to reopen the broader board.',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing toolbar focus token: ${token}`);
  }

  for (const token of [
    '.panel-operator-console .operator-toolbar[data-workspace-focus="approvals"]',
    '.panel-operator-console .operator-toolbar[data-workspace-focus="runtime"]',
    '.panel-operator-console .operator-toolbar[data-workspace-focus="audit"]',
    ".panel-operator-console .operator-toolbar-cluster[hidden] {",
    ".panel-operator-console .operator-workspace-return {",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing toolbar focus style token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("compresses automatically and hides broad `Board` / `Filters` chrome"),
    "README should document toolbar workspace compression",
  );
  assert.ok(
    readmeSource.includes("visible `Back to Overview` action"),
    "README should document the return-to-overview action",
  );
  assert.ok(
    operatorGuideSource.includes("compresses and hides broad `Board` / `Filters` controls"),
    "operator guide should document toolbar workspace compression",
  );
  assert.ok(
    operatorGuideSource.includes("visible `Back to Overview` action"),
    "operator guide should document the return-to-overview action",
  );
});
