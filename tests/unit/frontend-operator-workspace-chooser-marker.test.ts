import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator workspace chooser keeps exactly one marked card without changing saved-view wiring", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="operatorWorkspaceOverviewMarker"',
    'id="operatorWorkspaceApprovalsMarker"',
    'id="operatorWorkspaceRuntimeMarker"',
    'id="operatorWorkspaceAuditMarker"',
    'data-operator-saved-view="incidents"',
    'data-operator-saved-view="approvals"',
    'data-operator-saved-view="runtime"',
    'data-operator-saved-view="audit"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing chooser marker token: ${token}`);
  }

  for (const token of [
    'operatorWorkspaceOverviewMarker: document.getElementById("operatorWorkspaceOverviewMarker")',
    'operatorWorkspaceApprovalsMarker: document.getElementById("operatorWorkspaceApprovalsMarker")',
    'operatorWorkspaceRuntimeMarker: document.getElementById("operatorWorkspaceRuntimeMarker")',
    'operatorWorkspaceAuditMarker: document.getElementById("operatorWorkspaceAuditMarker")',
    "const markerViewId = activeView !== \"incidents\"",
    'const markerVariant = activeView !== "incidents" || hasManualRefresh ? "current" : "recommended-next";',
    'const markerLabel = markerVariant === "current" ? "Current workspace" : "Recommended next";',
    'const shouldShowMarker = viewId === markerViewId;',
    'target.marker.hidden = !shouldShowMarker;',
    'target.marker.textContent = markerLabel;',
    'target.button.dataset.workspaceMarker = markerVariant;',
    'delete target.button.dataset.workspaceMarker;',
    'setStatusPill(target.status, cardLabel, presentation.tone);',
    'target.button.dataset.workspaceActive = isActive ? "true" : "false";',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing chooser marker token: ${token}`);
  }

  for (const token of [
    '.panel-operator-console .operator-workspace-card-marker {',
    '.panel-operator-console .operator-workspace-card[data-workspace-marker="current"] .operator-workspace-card-marker {',
    '.panel-operator-console .operator-workspace-card[data-workspace-marker="recommended-next"] .operator-workspace-card-marker {',
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing chooser marker token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Choose workspace` strip now also marks the current card and the recommended next card"),
    "README should document chooser current/recommended markers",
  );
  assert.ok(
    operatorGuideSource.includes("`Choose workspace` strip now also marks the current card and the recommended next card"),
    "operator guide should document chooser current/recommended markers",
  );
  assert.ok(
    readmeSource.includes("explicit `Current workspace` marker"),
    "README should document the explicit current-workspace chooser marker",
  );
  assert.ok(
    operatorGuideSource.includes("explicit `Current workspace` marker"),
    "operator guide should document the explicit current-workspace chooser marker",
  );
});
