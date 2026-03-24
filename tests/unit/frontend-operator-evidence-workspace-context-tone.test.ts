import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence context strip carries workspace-specific tones", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  assert.ok(
    appSource.includes("el.operatorEvidenceDrawerContext.dataset.workspace ="),
    "app.js should keep wiring the context row with the active workspace",
  );

  for (const token of [
    '.panel-operator-console .operator-evidence-drawer-context[data-workspace="approvals"] .operator-evidence-drawer-context-item {',
    '.panel-operator-console .operator-evidence-drawer-context[data-workspace="approvals"] .operator-evidence-drawer-context-value {',
    '.panel-operator-console .operator-evidence-drawer-context[data-workspace="runtime"] .operator-evidence-drawer-context-item {',
    '.panel-operator-console .operator-evidence-drawer-context[data-workspace="runtime"] .operator-evidence-drawer-context-value {',
    '.panel-operator-console .operator-evidence-drawer-context[data-workspace="audit"] .operator-evidence-drawer-context-item {',
    '.panel-operator-console .operator-evidence-drawer-context[data-workspace="audit"] .operator-evidence-drawer-context-value {',
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing workspace context-tone token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("`Workspace / View / Next` context row now also carries a workspace-specific accent tone"),
    "README should document workspace-toned context strip",
  );
  assert.ok(
    operatorGuideSource.includes("`Workspace / View / Next` context row now also carries a workspace-specific accent tone"),
    "operator guide should document workspace-toned context strip",
  );
});
