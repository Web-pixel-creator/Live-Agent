import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence uses workspace-specific dormant summary sentences", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "if (!workspacePresentation.hasManualRefresh) {",
    'return `Refresh ${workspaceLabel} first to seed the decision queue before opening the ${viewLabel} proof path.`;',
    'return `Refresh ${workspaceLabel} first to hydrate trace anchors before opening the ${viewLabel} proof path.`;',
    'return `Refresh ${workspaceLabel} first to hydrate governance proof before opening the ${viewLabel} proof path.`;',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace dormant-summary token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("dormant `Focused Evidence` summary sentence now also changes by workspace"),
    "README should document workspace-specific dormant summary copy",
  );
  assert.ok(
    operatorGuideSource.includes("dormant `Focused Evidence` summary sentence now also changes by workspace"),
    "operator guide should document workspace-specific dormant summary copy",
  );
});
