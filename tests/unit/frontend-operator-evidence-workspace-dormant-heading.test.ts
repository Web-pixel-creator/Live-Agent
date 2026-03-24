import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence uses a workspace-specific dormant drawer heading", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function resolveOperatorEvidenceDrawerWorkspaceHeading(model, activeView) {",
    'const baseKicker = model?.kicker ?? "Focused Evidence";',
    "if (!shouldUseOperatorEvidenceDrawerWorkspacePlaceholder(model) || !activeView) {",
    "const viewLabel = normalizeOperatorUiCopy(activeView?.label);",
    "kicker: viewLabel,",
    "const heading = resolveOperatorEvidenceDrawerWorkspaceHeading(model, activeView);",
    "const heading = resolveOperatorEvidenceDrawerWorkspaceHeading(model, null);",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace dormant-heading token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("dormant `Focused Evidence` drawer head now also shifts its visible kicker by workspace view"),
    "README should document workspace-specific dormant heading copy",
  );
  assert.ok(
    operatorGuideSource.includes("dormant `Focused Evidence` drawer head now also shifts its visible kicker by workspace view"),
    "operator guide should document workspace-specific dormant heading copy",
  );
});
