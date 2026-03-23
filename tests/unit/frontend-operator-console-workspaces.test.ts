import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes a productized workspace chooser above the full board toolbar", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="operatorWorkspaceChooser"',
    'id="operatorWorkspaceChooserStatus"',
    'id="operatorWorkspaceChooserMeta"',
    'id="operatorWorkspaceOverviewBtn"',
    'id="operatorWorkspaceApprovalsBtn"',
    'id="operatorWorkspaceRuntimeBtn"',
    'id="operatorWorkspaceAuditBtn"',
    'data-operator-saved-view="incidents"',
    'data-operator-saved-view="approvals"',
    'data-operator-saved-view="runtime"',
    'data-operator-saved-view="audit"',
    "Choose workspace",
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing workspace chooser token: ${token}`);
  }

  const chooserIndex = htmlSource.indexOf('id="operatorWorkspaceChooser"');
  const toolbarIndex = htmlSource.indexOf('class="actions operator-toolbar"');
  assert.ok(chooserIndex !== -1 && toolbarIndex !== -1 && chooserIndex < toolbarIndex, "workspace chooser should appear before the full board toolbar");

  for (const token of [
    'operatorWorkspaceChooser: document.getElementById("operatorWorkspaceChooser")',
    'operatorWorkspaceChooserStatus: document.getElementById("operatorWorkspaceChooserStatus")',
    'operatorWorkspaceChooserMeta: document.getElementById("operatorWorkspaceChooserMeta")',
    "function syncOperatorWorkspaceChooser() {",
    'el.operatorWorkspaceChooser.dataset.activeWorkspace = activeConfig.id;',
    'setStatusPill(el.operatorWorkspaceChooserStatus, "overview", "neutral");',
    'const activeLabel = activeConfig.id === "incidents" ? "overview active" : `${activeConfig.label} active`;',
    'syncOperatorWorkspaceChooser();',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace chooser token: ${token}`);
  }

  for (const token of [
    ".panel-operator-console .operator-workspace-chooser {",
    ".panel-operator-console .operator-workspace-chooser-head {",
    ".panel-operator-console .operator-workspace-chooser-cards {",
    ".panel-operator-console .operator-workspace-card {",
    ".panel-operator-console .operator-workspace-card.is-active {",
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing workspace chooser style token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("dedicated `Choose workspace` strip (`Overview`, `Approvals`, `Runtime`, `Audit`)"),
    "README should document the operator workspace chooser",
  );
  assert.ok(
    operatorGuideSource.includes("includes a `Choose workspace` strip (`Overview`, `Approvals`, `Runtime`, `Audit`)"),
    "operator guide should document the operator workspace chooser",
  );
});
