import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence keeps dormant CTA emphasis tied to workspace and refresh posture", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");

  for (const token of [
    'kind: hasManualRefresh ? "secondary" : undefined,',
    'kind: hasManualRefresh ? undefined : "secondary",',
    "return hasManualRefresh ? [openAction, seedAction] : [seedAction, openAction];",
    "return hasManualRefresh ? [openAction, hydrateAction] : [hydrateAction, openAction];",
    'button.dataset.actionDensity = compact ? "compact" : "default";',
    'wrapper.dataset.actionDensity = options.compact === true ? "compact" : "default";',
    'wrapper.className = "operator-evidence-drawer-action-stack";',
    'metaNode.className = "operator-evidence-drawer-action-meta";',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing dormant CTA emphasis token: ${token}`);
  }

  for (const token of [
    ".panel-operator-console .operator-evidence-drawer-action-stack {",
    ".panel-operator-console .operator-evidence-drawer-action-meta {",
    '.panel-operator-console .operator-evidence-drawer[data-evidence-action-density="compact"] .operator-evidence-drawer-action-meta {',
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing dormant CTA emphasis token: ${token}`);
  }
});
