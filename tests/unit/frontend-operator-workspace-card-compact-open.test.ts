import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("inactive workspace cards expose a compact Open line while the active card keeps the full breakdown", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");

  for (const token of [
    'id="operatorWorkspaceOverviewOpenValue"',
    'id="operatorWorkspaceApprovalsOpenValue"',
    'id="operatorWorkspaceRuntimeOpenValue"',
    'id="operatorWorkspaceAuditOpenValue"',
    'class="operator-workspace-card-open" hidden aria-hidden="true">',
    'class="operator-workspace-card-open-label">Open</span>',
    'class="operator-workspace-card-open-value">Recovery kits</strong>',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing compact-open chooser token: ${token}`);
  }

  for (const token of [
    "function buildOperatorWorkspaceCardJumpSummary(presentation) {",
    'target.button.dataset.workspaceSummaryDensity = isActive ? "full" : "compact";',
    'focusLabel.textContent = isActive ? "Focus" : "Workspace";',
    'target.focusValue.textContent = isActive ? presentation.routeFacts.focus : workspaceSummary;',
    'openSection.hidden = isActive;',
    'openSection.setAttribute("aria-hidden", isActive ? "true" : "false");',
    'target.openValue.textContent = resolveOperatorWorkspaceCardViewLabel(presentation);',
    'viewLabel.textContent = "View";',
    'viewSection.hidden = !isActive;',
    'viewSection.setAttribute("aria-hidden", isActive ? "false" : "true");',
    'nextSection.hidden = !isActive;',
    'nextSection.setAttribute("aria-hidden", isActive ? "false" : "true");',
    'target.viewValue.textContent = resolveOperatorWorkspaceCardViewLabel(presentation);',
    'target.nextValue.textContent = presentation.next;',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing compact-open chooser token: ${token}`);
  }

  for (const token of [
    '.panel-operator-console .operator-workspace-card-open {',
    '.panel-operator-console .operator-workspace-card-open-label {',
    '.panel-operator-console .operator-workspace-card-open-value {',
    '.panel-operator-console .operator-workspace-card[data-workspace-summary-density="compact"] .operator-workspace-card-open {',
    '.panel-operator-console .operator-workspace-card[data-workspace-summary-density="compact"] .operator-workspace-card-open-label {',
    '.panel-operator-console .operator-workspace-card[data-workspace-summary-density="compact"] .operator-workspace-card-open-value {',
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing compact-open chooser style token: ${token}`);
  }
});
