import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator handoff entry demotes into a completed state after workspace choice or refresh", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="operatorConsoleEntry"',
    'id="operatorConsoleEntryStatus"',
    'id="operatorConsoleEntryTitle"',
    'id="operatorConsoleEntryHint"',
    'class="operator-console-entry-actions"',
    'class="operator-workspace-chooser"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing handoff-entry completion token: ${token}`);
  }

  for (const token of [
    "function syncOperatorConsoleEntry() {",
    'const hasManualRefresh = state.operatorSummaryUserRefreshed === true;',
    'const hasWorkspace = !!activeConfig;',
    'const isComplete = hasManualRefresh || hasWorkspace;',
    'el.operatorConsoleEntry.dataset.entryState = isComplete ? "complete" : "active";',
    'setStatusPill(el.operatorConsoleEntryStatus, "handoff complete", "ok");',
    'el.operatorConsoleEntryStatus.dataset.statusCode = "handoff_complete";',
    "syncOperatorConsoleEntry();",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing handoff-entry completion token: ${token}`);
  }

  for (const token of [
    '.panel-operator-console .operator-console-entry[data-entry-state="complete"] {',
    '.panel-operator-console .operator-console-entry[data-entry-state="complete"] .operator-console-entry-title {',
    '.panel-operator-console .operator-console-entry[data-entry-state="complete"] .operator-console-entry-hint {',
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing handoff-entry completion token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Operator handoff` card now drops into a completed, quieter state"),
    "README should document the quieter completed handoff state",
  );
  assert.ok(
    operatorGuideSource.includes("`Operator handoff` card now drops into a completed, quieter state"),
    "operator guide should document the quieter completed handoff state",
  );
});
