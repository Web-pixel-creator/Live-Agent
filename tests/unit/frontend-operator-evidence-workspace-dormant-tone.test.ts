import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence tones dormant primary CTA by workspace", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'const workspaceTone = typeof options.workspaceTone === "string" ? options.workspaceTone.trim() : "";',
    'button.dataset.actionWorkspace = workspaceTone;',
    'wrapper.dataset.actionWorkspace = workspaceTone;',
    'workspaceTone:',
    '? normalizeOperatorSavedView(model?.activeSavedViewId) || "incidents"',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing dormant tone token: ${token}`);
  }

  for (const token of [
    '.panel-operator-console .operator-evidence-drawer-action-primary[data-action-workspace="approvals"] {',
    '.panel-operator-console .operator-evidence-drawer-action-primary[data-action-workspace="runtime"] {',
    '.panel-operator-console .operator-evidence-drawer-action-primary[data-action-workspace="audit"] {',
    '.panel-operator-console .operator-evidence-drawer-action-stack[data-action-primary="true"][data-action-workspace="approvals"] .operator-evidence-drawer-action-meta {',
    '.panel-operator-console .operator-evidence-drawer-action-stack[data-action-primary="true"][data-action-workspace="runtime"] .operator-evidence-drawer-action-meta {',
    '.panel-operator-console .operator-evidence-drawer-action-stack[data-action-primary="true"][data-action-workspace="audit"] .operator-evidence-drawer-action-meta {',
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing dormant tone token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("dormant primary CTA now also shifts its accent tone by workspace posture"),
    "README should document workspace-toned dormant primary CTA",
  );
  assert.ok(
    operatorGuideSource.includes("dormant primary CTA now also shifts its accent tone by workspace posture"),
    "operator guide should document workspace-toned dormant primary CTA",
  );
});
