import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console groups toolbar controls and demotes board-visibility counters", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    'class="operator-toolbar-cluster operator-toolbar-cluster-view"',
    'class="operator-toolbar-cluster operator-toolbar-cluster-filters"',
    'class="operator-toolbar-cluster operator-toolbar-cluster-saved"',
    'class="operator-toolbar-cluster operator-toolbar-cluster-refresh"',
    'class="operator-toolbar-label">Board<',
    'class="operator-toolbar-label">Filters<',
    'class="operator-toolbar-label">Views<',
    'class="operator-toolbar-label">Sync<',
    'id="operatorDemoViewBtn" class="button-muted" aria-pressed="true" aria-label="Demo View" title="Demo View">Demo<',
    'id="operatorFullOpsViewBtn" class="button-muted" aria-pressed="false" aria-label="Full Ops View" title="Full Ops View">Full Ops<',
    'id="operatorFocusCriticalBtn" class="button-muted" aria-pressed="false" aria-label="Focus Critical" title="Focus critical cards">Critical<',
    'id="operatorIssuesOnlyBtn" class="button-muted" aria-pressed="false" aria-label="Issues Only" title="Issues Only">Issues<',
    'id="operatorRefreshBtn" class="button-muted" aria-label="Refresh Summary" title="Refresh Summary">Refresh<',
    'id="operatorGuideToggleBtn"',
    'class="button-muted operator-guide-toggle operator-support-summary-action"',
    'class="operator-triage-summary-head"',
    'class="operator-priority-queue-list"',
    'class="operator-triage-summary-grid"',
    'class="operator-triage-stat operator-triage-stat-total"',
    'class="operator-triage-stat-label"',
    'class="operator-triage-stat-label">Watch<',
    'Active Queue',
    'Board Visibility',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-toolbar-hierarchy token: ${token}`);
  }

  const requiredStyleTokens = [
    '.panel-operator-console .operator-toolbar-cluster {',
    '.panel-operator-console .operator-toolbar-label {',
    '.panel-operator-console .operator-toolbar-hint {',
    '.panel-operator-console .operator-saved-view-buttons {',
    'grid-template-columns: repeat(4, minmax(0, 1fr));',
    '.layout[data-active-tab="operator"] .panel-operator-console .operator-toolbar {',
    'grid-template-columns: max-content max-content minmax(0, 1fr) auto;',
    '.layout[data-active-tab="operator"] .panel-operator-console .operator-toolbar-label {',
    '.layout[data-active-tab="operator"] .panel-operator-console .operator-toolbar-hint {',
    '.layout[data-active-tab="operator"] .panel-operator-console .operator-toolbar .operator-view-mode-actions,',
    '.layout[data-active-tab="operator"] .panel-operator-console .operator-toolbar .button-muted {',
    'font-size: 0.68rem;',
    '.layout[data-active-tab="operator"] .panel-operator-console .operator-toolbar #operatorRefreshBtn {',
    'min-width: 96px;',
    '.panel-operator-console .operator-triage-summary-head {',
    '.panel-operator-console .operator-triage-summary-foot-label {',
    '.panel-operator-console .operator-priority-queue-list {',
    '.panel-operator-console .operator-triage-summary-grid {',
    '.panel-operator-console .operator-triage-summary-grid .operator-triage-stat-total {',
    '.panel-operator-console .operator-triage-stat-label {',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-toolbar-hierarchy token: ${token}`);
  }

  assert.ok(
    readmeSource.includes('toolbar now groups `Board`, `Filters`, `Views`, and `Sync`'),
    'README missing operator toolbar grouping note',
  );
  assert.ok(
    readmeSource.includes('`Show/Hide Setup Panels` toggle now lives inside the `Advanced Controls` summary'),
    'README missing setup-toggle relocation note',
  );
  assert.ok(
    readmeSource.includes('quieter `Board Visibility` footer'),
    'README missing board-visibility triage note',
  );
  assert.ok(
    readmeSource.includes('compact chip ledger'),
    'README missing board-visibility chip-ledger note',
  );
  assert.ok(
    readmeSource.includes('drops its heading, hides the redundant `Total` chip, and relabels `Neutral` as `Watch`'),
    'README missing desktop board-visibility compaction note',
  );
  assert.ok(
    readmeSource.includes('quieter incident header'),
    'README missing desktop operator-header compaction note',
  );
  assert.ok(
    readmeSource.includes('toolbar now flattens further into a utility strip'),
    'README missing desktop toolbar utility-strip note',
  );
  assert.ok(
    readmeSource.includes('utility strip now also uses shorter button labels (`Demo`, `Full Ops`, `Critical`, `Issues`, `Refresh`)'),
    'README missing desktop short-toolbar-label note',
  );
  assert.ok(
    readmeSource.includes('global dashboard nav also retreats into a quieter left rail for `Operator`'),
    'README missing desktop operator quiet-sidebar note',
  );
  assert.ok(
    operatorGuideSource.includes('Toolbar groups now separate `Board`, `Filters`, `Views`, and `Sync`'),
    'operator guide missing operator toolbar grouping note',
  );
  assert.ok(
    operatorGuideSource.includes('`Show/Hide Setup Panels` toggle now lives inside the `Advanced Controls` summary'),
    'operator guide missing setup-toggle relocation note',
  );
  assert.ok(
    operatorGuideSource.includes('quieter `Board Visibility` footer'),
    'operator guide missing board-visibility triage note',
  );
  assert.ok(
    operatorGuideSource.includes('compact chip ledger'),
    'operator guide missing board-visibility chip-ledger note',
  );
  assert.ok(
    operatorGuideSource.includes('drops its heading, hides the redundant `Total` chip, and relabels `Neutral` as `Watch`'),
    'operator guide missing desktop board-visibility compaction note',
  );
  assert.ok(
    operatorGuideSource.includes('quieter incident header'),
    'operator guide missing desktop operator-header compaction note',
  );
  assert.ok(
    operatorGuideSource.includes('toolbar flattens into a utility strip'),
    'operator guide missing desktop toolbar utility-strip note',
  );
  assert.ok(
    operatorGuideSource.includes('uses shorter visible labels (`Demo`, `Full Ops`, `Critical`, `Issues`, `Refresh`)'),
    'operator guide missing desktop short-toolbar-label note',
  );
  assert.ok(
    operatorGuideSource.includes('global dashboard nav now retreats into a quieter left rail for `Operator`'),
    'operator guide missing desktop operator quiet-sidebar note',
  );
});
