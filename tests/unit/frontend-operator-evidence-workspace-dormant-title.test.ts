import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence uses a workspace-specific dormant drawer title", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function resolveOperatorEvidenceDrawerWorkspaceHeading(model, activeView) {",
    'const baseTitle = model?.title ?? "Awaiting focused evidence";',
    "const config = getOperatorEvidenceDrawerWorkspaceConfig(model);",
    "const workspaceTitle = normalizeOperatorUiCopy(config?.hydrateTitle);",
    "return { kicker: baseKicker, title: workspaceTitle ?? baseTitle };",
    "title: workspaceTitle ?? baseTitle,",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace dormant-title token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("dormant `Focused Evidence` drawer title now also follows the active workspace posture"),
    "README should document workspace-specific dormant title copy",
  );
  assert.ok(
    operatorGuideSource.includes("dormant `Focused Evidence` drawer title now also follows the active workspace posture"),
    "operator guide should document workspace-specific dormant title copy",
  );
});
