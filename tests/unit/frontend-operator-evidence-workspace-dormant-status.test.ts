import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence uses a workspace-specific dormant status pill", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function resolveOperatorEvidenceDrawerWorkspaceStatusText(model, activeView) {",
    'return "Seed approvals";',
    'return "Hydrate incidents";',
    'const workspaceTitle = normalizeOperatorUiCopy(config?.hydrateTitle)?.replace(/\\s+posture$/iu, "").trim();',
    "el.operatorEvidenceDrawerStatus.textContent = resolveOperatorEvidenceDrawerWorkspaceStatusText(model, activeView);",
    "el.operatorEvidenceDrawerStatus.textContent = resolveOperatorEvidenceDrawerWorkspaceStatusText(model, null);",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace dormant-status token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("dormant `Focused Evidence` status pill now also changes by workspace"),
    "README should document workspace-specific dormant status pill copy",
  );
  assert.ok(
    operatorGuideSource.includes("dormant `Focused Evidence` status pill now also changes by workspace"),
    "operator guide should document workspace-specific dormant status pill copy",
  );
});
