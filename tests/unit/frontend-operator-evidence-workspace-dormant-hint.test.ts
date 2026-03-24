import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence uses workspace-specific dormant hint and panel meta", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function resolveOperatorEvidenceDrawerWorkspaceHint(activeView, model) {",
    "return config.drawerDormantHint",
    "setText(el.operatorEvidenceDrawerHint, resolveOperatorEvidenceDrawerWorkspaceHint(activeView, model));",
    'return "Hydrate runtime evidence first, then confirm trace anchors or recovery.";',
    'return "Seed one decision path first, then confirm backlog and next checks.";',
    'return "Hydrate governance proof first, then review audit trail and export posture.";',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace dormant-hint token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("dormant `Focused Evidence` hint and panel meta now also change by workspace"),
    "README should document workspace-specific dormant hint/meta copy",
  );
  assert.ok(
    operatorGuideSource.includes("dormant `Focused Evidence` hint and panel meta now also change by workspace"),
    "operator guide should document workspace-specific dormant hint/meta copy",
  );
});
