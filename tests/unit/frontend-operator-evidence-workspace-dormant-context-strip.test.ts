import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence uses workspace-specific dormant workspace and source context chips", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function resolveOperatorEvidenceDrawerWorkspaceLane(model, activeView) {",
    'const baseLane = normalizeOperatorUiCopy(model?.lane)',
    "return normalizeOperatorUiCopy(config?.contextLabel ?? config?.drawerKicker ?? activeView?.label) ?? baseLane;",
    'label: "Workspace"',
    'label: "Source"',
    'label: "Next"',
    'value: config.drawerKicker ?? activeView?.label ?? "Focused Evidence"',
    "setText(el.operatorEvidenceDrawerLane, resolveOperatorEvidenceDrawerWorkspaceLane(model, activeView));",
    "setText(el.operatorEvidenceDrawerLane, resolveOperatorEvidenceDrawerWorkspaceLane(model, null));",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace dormant-context-strip token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("dormant `Focused Evidence` context strip now also swaps to workspace-aware `Workspace / Source / Next` copy"),
    "README should document workspace-specific dormant context strip copy",
  );
  assert.ok(
    operatorGuideSource.includes("dormant `Focused Evidence` context strip now also swaps to workspace-aware `Workspace / Source / Next` copy"),
    "operator guide should document workspace-specific dormant context strip copy",
  );
});
